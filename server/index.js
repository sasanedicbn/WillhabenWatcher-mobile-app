const express = require("express");
const cors = require("cors");
const scraper = require("./scraper");

const app = express();
const PORT = process.env.API_PORT || 8083;

app.use(cors());
app.use(express.json());

const vehicleCache = new Map();
const newVehicleIds = new Set();
const pushTokens = new Set();
let lastScrapeTime = null;
let isFirstScrape = true;

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
        ? `${firstVehicle.title} - €${firstVehicle.price?.toLocaleString("de-AT") || "N/A"}`
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

    if (result.data) {
      result.data.forEach((ticket, index) => {
        if (ticket.status === "error") {
          console.log(`[Push] Error for token: ${ticket.message}`);
          if (ticket.details?.error === "DeviceNotRegistered") {
            const token = messages[index].to;
            pushTokens.delete(token);
            console.log(`[Push] Removed invalid token`);
          }
        }
      });
    }
  } catch (error) {
    console.error("[Push] Failed to send notifications:", error.message);
  }
}

// --- SCRAPING & CACHE ---
async function scrapeAndStore() {
  try {
    const scrapedVehicles = await scraper.scrapeWillhaben();

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
      await sendPushNotifications(newlyFoundVehicles);
    }

    return newlyFoundVehicles.length;
  } catch (e) {
    console.error("Scrape error:", e.message);
    return 0;
  }
}

// --- ROUTES ---
app.post("/api/register-push-token", (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== "string")
    return res.status(400).json({ error: "Invalid token" });
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
  const vehicles = Array.from(vehicleCache.values())
    .filter((v) => v.isPrivate === 1)
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
  const newCount = await scrapeAndStore();
  res.json({
    success: true,
    newCount,
    totalVehicles: vehicleCache.size,
    lastScrapeTime,
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    lastScrapeTime,
    totalVehicles: vehicleCache.size,
    newVehicles: newVehicleIds.size,
    registeredPushTokens: pushTokens.size,
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
    ],
    status: "running",
    registeredPushTokens: pushTokens.size,
  });
});

// --- SCRAPE INTERVAL ---
function getNextScrapeDelay() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  const isNight = h === 23 || (h >= 0 && h < 5) || (h === 5 && m < 45);

  if (isNight) {
    // noćni scraping: ~40 minuta
    const interval = 40 * 60 * 1000 + Math.random() * 5 * 60 * 1000;
    console.log(
      `[${now.toLocaleTimeString()}] 🌙 Night scrape in ${Math.round(interval / 60000)} min`
    );
    return interval;
  }

  // dnevni scraping: 2-5s
  const interval = 2000 + Math.random() * 3000;
  console.log(
    `[${now.toLocaleTimeString()}] ☀️ Day scrape in ${Math.round(interval / 1000)}s`
  );
  return interval;
}

// --- START SERVER & SCRAPER LOOP ---
async function startServer() {
  await scrapeAndStore();

  async function scheduledScrape() {
    try {
      await scrapeAndStore();
    } catch (e) {
      console.error("Scrape error:", e.message);
    }
    const nextDelay = getNextScrapeDelay();
    setTimeout(scheduledScrape, nextDelay);
  }

  scheduledScrape();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] API running on port ${PORT}`);
  });
}

startServer().catch(console.error);
