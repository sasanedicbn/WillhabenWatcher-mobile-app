import express from "express";
import cors from "cors";
import { scrapeWillhaben } from "./scraper.js";
import { performance } from "node:perf_hooks";

const app = express();
const PORT = process.env.PORT || process.env.API_PORT || 8083;

app.use(cors());
app.use(express.json());

const vehicleCache = new Map();
const newVehicleIds = new Set();
const pushTokens = new Set();

let lastScrapeTime = null;
let isFirstScrape = true;

// --- SCRAPE LOCK (kritično) ---
let isScraping = false;
/** Ako scrape već traje, svi pozivi dobiju isti promise (nema overlap-a). */
let currentScrapePromise = null;

// Ovo koristimo samo za backoff logiku u loop-u (ne mijenja API ponašanje)
let lastScrapeErrorMsg = null;

// --- PUSH NOTIFICATIONS ---
async function sendPushNotifications(newVehicles) {
  if (pushTokens.size === 0 || newVehicles.length === 0) return;

  const messages = [];
  for (const token of pushTokens) {
    const title =
      newVehicles.length === 1
        ? "Novo vozilo!"
        : `${newVehicles.length} novih vozila!`;

    const firstVehicle = newVehicles[0];
    const body =
      newVehicles.length === 1
        ? `${firstVehicle.title} - €${
            firstVehicle.price?.toLocaleString("de-AT") || "N/A"
          }`
        : `${firstVehicle.title} i još ${newVehicles.length - 1} vozila`;

    messages.push({
      to: token,
      sound: "default",
      title,
      body,
      data: { vehicleId: firstVehicle.id },
    });
  }

  try {
    console.log(`[Push] tokens=${pushTokens.size} messages=${messages.length}`);
    console.log(`[Push] sample to= ${messages[0]?.to}`);

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const resultText = await response.text();

    let result;
    try {
      result = JSON.parse(resultText);
    } catch {
      return;
    }

    if (Array.isArray(result?.data)) {
      result.data.forEach((ticket, index) => {
        if (ticket?.status === "error") {
          console.log(
            `[Push] ERROR ticket message: ${ticket.message || "unknown"}`,
          );
          console.log(`[Push] ERROR details:`, ticket.details || null);

          if (ticket.details?.error === "DeviceNotRegistered") {
            const badToken = messages[index]?.to;
            if (badToken) pushTokens.delete(badToken);
          }
        }
      });
    } else {
      console.log("[Push] Unexpected Expo response shape:", result);
    }
  } catch (error) {
    console.error(
      "[Push] Failed to send notifications:",
      error?.message || error,
    );
  }
}

// --- SCRAPING & CACHE ---
async function scrapeAndStore() {
  const scrapedVehicles = await scrapeWillhaben();

  const newlyFoundVehicles = [];
  for (const vehicle of scrapedVehicles) {
    if (!vehicleCache.has(vehicle.id)) {
      const newVehicle = {
        ...vehicle,
        isNew: !isFirstScrape,
        firstSeenAt: new Date().toISOString(),
      };

      vehicleCache.set(vehicle.id, newVehicle);

      if (!isFirstScrape) {
        newVehicleIds.add(vehicle.id);
        newlyFoundVehicles.push(newVehicle);
      }
    }
  }

  lastScrapeTime = new Date().toISOString();
  isFirstScrape = false;

  // ✅ NE BLOKIRAJ SCRAPE LOOP NA PUSH (fire-and-forget)
  if (newlyFoundVehicles.length > 0) {
    sendPushNotifications(newlyFoundVehicles).catch((e) =>
      console.error("[Push] async error:", e?.message || e),
    );
  }

  return newlyFoundVehicles.length;
}

/** Safe wrapper: nema paralelnih scrape-ova. */
async function scrapeAndStoreSafe() {
  if (currentScrapePromise) return currentScrapePromise;

  currentScrapePromise = (async () => {
    if (isScraping) return 0;
    isScraping = true;

    try {
      lastScrapeErrorMsg = null;
      return await scrapeAndStore();
    } catch (e) {
      lastScrapeErrorMsg = e?.message || String(e);
      console.error("Scrape error:", lastScrapeErrorMsg);
      return 0;
    } finally {
      isScraping = false;
      currentScrapePromise = null;
    }
  })();

  return currentScrapePromise;
}

// --- ROUTES ---
app.post("/api/register-push-token", (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Invalid token" });
  }
  pushTokens.add(token);
  console.log(`[Push] Token registered. Total: ${pushTokens.size}`);
  res.json({ success: true });
});

app.get("/api/vehicles", (req, res) => {
  const vehicles = Array.from(vehicleCache.values())
    .filter((v) => v.isPrivate === true)
    .sort((a, b) => new Date(b.firstSeenAt) - new Date(a.firstSeenAt))
    .slice(0, 100);

  res.json({ vehicles, lastScrapeTime });
});

app.get("/api/vehicles/new", (req, res) => {
  const vehicles = Array.from(vehicleCache.values())
    .filter((v) => newVehicleIds.has(v.id))
    .sort((a, b) => new Date(b.firstSeenAt) - new Date(a.firstSeenAt));

  res.json({ vehicles, count: vehicles.length });
});

app.post("/api/vehicles/mark-seen", (req, res) => {
  for (const id of newVehicleIds) {
    const vehicle = vehicleCache.get(id);
    if (vehicle) vehicle.isNew = false;
  }
  newVehicleIds.clear();
  res.json({ success: true });
});

app.post("/api/scrape", async (req, res) => {
  const newCount = await scrapeAndStoreSafe();

  res.json({
    success: true,
    newCount,
    totalVehicles: vehicleCache.size,
    lastScrapeTime,
    isScraping,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    lastScrapeTime,
    totalVehicles: vehicleCache.size,
    newVehicles: newVehicleIds.size,
    registeredPushTokens: pushTokens.size,
    isScraping,
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "Willhaben Cars API",
    endpoints: [
      "/api/vehicles",
      "/api/vehicles/new",
      "/api/health",
      "/api/register-push-token",
      "/api/scrape",
    ],
    status: "running",
    registeredPushTokens: pushTokens.size,
    isScraping,
  });
});

// --- LOOP DELAY: day = fast but not spam; night = your old schedule ---
let dayBackoffMs = 0;

function isNightNow() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  return h === 23 || (h >= 0 && h < 5) || (h === 5 && m < 50);
}

function getNightDelayMs() {
  return 40 * 60 * 1000 + Math.random() * 5 * 60 * 1000; // 40–45min
}

function getDayBaseDelayMs() {
  return 1200 + Math.random() * 1000; // 250–450ms (brzo, ali ne ubija proxy pool)
}

function computeNextDelayMs(scrapeMs) {
  if (isNightNow()) return getNightDelayMs();

  // Heuristika problema:
  // - error u scrape-u ili
  // - “sporo” (često znači fallback / block / loš proxy)
  const hadError = Boolean(lastScrapeErrorMsg);
  const isSlow = scrapeMs >= 4500;
  const hadIssue = hadError || isSlow;

  if (hadIssue) {
    // agresivnije uspori kad krene haos (sprečava 20s timeouts u seriji)
    dayBackoffMs = Math.min(8000, Math.round(dayBackoffMs * 1.6 + 500));
  } else {
    // polako vraćaj na fast
    dayBackoffMs = Math.max(0, Math.round(dayBackoffMs * 0.7 - 200));
  }

  return Math.round(getDayBaseDelayMs() + dayBackoffMs);
}

function startScrapeLoop() {
  const tick = async () => {
    const t0 = performance.now();

    const newCount = await scrapeAndStoreSafe();
    const scrapeMs = performance.now() - t0;

    const delayMs = computeNextDelayMs(scrapeMs);
    const now = new Date();

    console.log(
      `[${now.toLocaleTimeString()}] scrape=${Math.round(
        scrapeMs,
      )}ms new=${newCount} next_in=${(delayMs / 1000).toFixed(
        1,
      )}s cycle≈${((scrapeMs + delayMs) / 1000).toFixed(1)}s`,
    );

    setTimeout(tick, delayMs);
  };

  tick();
}

console.log(
  "[Boot] env PORT =",
  process.env.PORT,
  "API_PORT =",
  process.env.API_PORT,
);

function startServer() {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] API running on port ${PORT}`);
  });

  startScrapeLoop();
}

startServer();
