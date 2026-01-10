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

async function scrapeAndStore() {
  try {
    const scrapedVehicles = await scraper.scrapeWillhaben();

    let newCount = 0;
    const newlyFoundVehicles = [];

    for (const vehicle of scrapedVehicles) {
      if (!vehicleCache.has(vehicle.id)) {
        const newVehicle = {
          ...vehicle,
          isNew: !isFirstScrape,
          firstSeenAt: new Date().toISOString(),
        };

        console.log("ADDING VEHICLE TO CACHE:", newVehicle); // 🔹 log
        vehicleCache.set(vehicle.id, newVehicle);

        if (!isFirstScrape) {
          newVehicleIds.add(vehicle.id);
          newlyFoundVehicles.push(newVehicle);
        }
      }
    }

    lastScrapeTime = new Date().toISOString();
    isFirstScrape = false;

    if (newCount > 0) {
      console.log(`[Willhaben] ${newCount} novih vozila pronađeno`);
      await sendPushNotifications(newlyFoundVehicles);
    }
    return newCount;
  } catch (error) {
    console.error("Scrape error:", error.message);
    return 0;
  }
}

app.post("/api/register-push-token", (req, res) => {
  const { token } = req.body;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Invalid token" });
  }

  pushTokens.add(token);
  console.log(`[Push] Token registered. Total tokens: ${pushTokens.size}`);

  res.json({ success: true, message: "Push token registered" });
});

app.delete("/api/register-push-token", (req, res) => {
  const { token } = req.body;

  if (token) {
    pushTokens.delete(token);
    console.log(`[Push] Token removed. Total tokens: ${pushTokens.size}`);
  }

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
    if (vehicle) {
      vehicle.isNew = false;
    }
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

// DODAJ OVU FUNKCIJU PRE startServer()
function getNextScrapeDelay() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Noćno vreme: 23:00 - 05:50
  const isNightTime =
    hours === 23 || // 23:00-23:59
    (hours >= 0 && hours < 5) || // 00:00-04:59
    (hours === 5 && minutes < 50); // 05:00-05:49

  if (isNightTime) {
    console.log(`[${now.toLocaleTimeString()}] 🌙 Night mode: 20min interval`);
    return 1200000; // 20 minuta
  } else {
    // Danju: random 12-18 sekundi
    const interval = 12000 + Math.random() * 6000; // 12-18s
    console.log(
      `[${now.toLocaleTimeString()}] ☀️ Day mode: ${Math.round(interval / 1000)}s interval`
    );
    return interval;
  }
}

async function startServer() {
  await scrapeAndStore();

  async function scheduledScrape() {
    try {
      await scrapeAndStore();
    } catch (error) {
      console.error("Scrape error:", error.message);
    }

    const nextDelay = getNextScrapeDelay();
    setTimeout(scheduledScrape, nextDelay);
  }

  // Pokreni
  scheduledScrape();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Backend] API running on port ${PORT}`);
    console.log(`[Backend] Day mode (05:50-22:59): 12-18s random`);
    console.log(`[Backend] Night mode (23:00-05:50): 20min interval`);
  });
}

startServer().catch(console.error);
