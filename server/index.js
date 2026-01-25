import express from "express";
import cors from "cors";
import { scrapeWillhaben } from "./scraper.js";

const app = express();
const PORT = process.env.API_PORT || 8083;

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
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log(`[Push] Sent ${messages.length} notifications`);

    // Expo odgovara sa "data" kao niz ticket-a u mnogim slučajevima
    if (Array.isArray(result?.data)) {
      result.data.forEach((ticket, index) => {
        if (ticket?.status === "error") {
          console.log(`[Push] Error: ${ticket.message || "unknown"}`);
          if (ticket.details?.error === "DeviceNotRegistered") {
            const badToken = messages[index]?.to;
            if (badToken) {
              pushTokens.delete(badToken);
              console.log(`[Push] Removed invalid token`);
            }
          }
        }
      });
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

  if (newlyFoundVehicles.length > 0) {
    console.log(`[Backend] ${newlyFoundVehicles.length} new vehicles`);
    // Može biti sporije, ali je deterministično i bez overlap-a
    await sendPushNotifications(newlyFoundVehicles);
  }

  return newlyFoundVehicles.length;
}

/** Safe wrapper: nema paralelnih scrape-ova. */
async function scrapeAndStoreSafe() {
  if (currentScrapePromise) return currentScrapePromise;

  currentScrapePromise = (async () => {
    if (isScraping) return 0; // dodatni safety, realno neće doći ovdje
    isScraping = true;

    try {
      return await scrapeAndStore();
    } catch (e) {
      console.error("Scrape error:", e?.message || e);
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

app.delete("/api/register-push-token", (req, res) => {
  const { token } = req.body;
  if (token) pushTokens.delete(token);
  res.json({ success: true });
});

app.get("/api/vehicles", (req, res) => {
  // Ovdje je O(n log n) sort; na ~1k elemenata je OK.
  // Bitno: API endpoint ne smije čekati scrape – zato smo riješili overlap.
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
  // KRITIČNO: ne zovi scrapeAndStore() direktno – uvijek safe wrapper
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

function getNextScrapeDelay() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  const isNight = h === 23 || (h >= 0 && h < 5) || (h === 5 && m < 45);

  if (isNight) {
    const interval = 40 * 60 * 1000 + Math.random() * 5 * 60 * 1000;
    console.log(
      `[${now.toLocaleTimeString()}] Night scrape in ${Math.round(interval / 60000)} min`,
    );
    return interval;
  }

  // Day: 2–5s (tvoj original)
  const interval = 2000 + Math.random() * 3000;
  console.log(
    `[${now.toLocaleTimeString()}] Day scrape in ${Math.round(interval / 1000)}s`,
  );
  return interval;
}

// --- START SERVER & SCRAPER LOOP ---
function startScrapeLoop() {
  const tick = async () => {
    await scrapeAndStoreSafe();
    setTimeout(tick, getNextScrapeDelay());
  };
  tick();
}

function startServer() {
  // 1) Server odmah sluša (ne blokira se na scrape)
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] API running on port ${PORT}`);
  });

  // 2) Start scraping loop (prvi tick odmah)
  startScrapeLoop();
}

startServer();
