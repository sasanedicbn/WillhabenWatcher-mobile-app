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

let isScraping = false;
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
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.error("[Push] Failed:", error?.message || error);
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
    sendPushNotifications(newlyFoundVehicles).catch((e) =>
      console.error("[Push] async error:", e?.message || e),
    );
  }

  return newlyFoundVehicles.length;
}

async function scrapeAndStoreSafe() {
  if (currentScrapePromise) return currentScrapePromise;

  currentScrapePromise = (async () => {
    if (isScraping) return 0;
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

// --- RISKY DAY DELAY: skoro bez delay-a ---
function getNextScrapeDelayMs() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  const isNight = h === 23 || (h >= 0 && h < 5) || (h === 5 && m < 50);
  if (isNight) {
    return 40 * 60 * 1000 + Math.random() * 5 * 60 * 1000;
  }

  // Dan: 0.05–0.20s (rizično)
  return 200 + Math.random() * 200;
}

function scheduleNext(fn, delayMs) {
  if (delayMs <= 0) setImmediate(fn);
  else setTimeout(fn, delayMs);
}

function startScrapeLoop() {
  const tick = async () => {
    const t0 = performance.now();
    const newCount = await scrapeAndStoreSafe();
    const scrapeMs = performance.now() - t0;

    const delayMs = getNextScrapeDelayMs();
    const now = new Date();

    console.log(
      `[${now.toLocaleTimeString()}] scrape=${Math.round(
        scrapeMs,
      )}ms new=${newCount} next_in=${(delayMs / 1000).toFixed(
        1,
      )}s cycle≈${((scrapeMs + delayMs) / 1000).toFixed(1)}s`,
    );

    scheduleNext(tick, delayMs);
  };

  tick();
}

console.log(
  "[Boot] env PORT =",
  process.env.PORT,
  "API_PORT =",
  process.env.API_PORT,
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Backend] API running on port ${PORT}`);
});

startScrapeLoop();
