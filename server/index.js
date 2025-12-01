const express = require('express');
const cors = require('cors');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 8082;

app.use(cors());
app.use(express.json());

const vehicleCache = new Map();
const newVehicleIds = new Set();
let lastScrapeTime = null;
let isFirstScrape = true;

async function scrapeAndStore() {
  try {
    console.log('Starting scrape...');
    const scrapedVehicles = await scraper.scrapeWillhaben();
    console.log(`Scraped ${scrapedVehicles.length} vehicles`);

    let newCount = 0;
    
    for (const vehicle of scrapedVehicles) {
      if (!vehicleCache.has(vehicle.id)) {
        if (!isFirstScrape) {
          newVehicleIds.add(vehicle.id);
          newCount++;
        }
        vehicleCache.set(vehicle.id, {
          ...vehicle,
          isNew: !isFirstScrape,
          firstSeenAt: new Date().toISOString(),
        });
      }
    }

    lastScrapeTime = new Date().toISOString();
    isFirstScrape = false;
    
    console.log(`Cache size: ${vehicleCache.size}, New this scrape: ${newCount}`);
    return newCount;
  } catch (error) {
    console.error('Scrape error:', error.message);
    return 0;
  }
}

app.get('/api/vehicles', (req, res) => {
  const vehicles = Array.from(vehicleCache.values())
    .sort((a, b) => new Date(b.firstSeenAt) - new Date(a.firstSeenAt))
    .slice(0, 100);
  
  res.json({ vehicles, lastScrapeTime });
});

app.get('/api/vehicles/new', (req, res) => {
  const vehicles = Array.from(vehicleCache.values())
    .filter(v => newVehicleIds.has(v.id))
    .sort((a, b) => new Date(b.firstSeenAt) - new Date(a.firstSeenAt));
  
  res.json({ vehicles, count: vehicles.length });
});

app.post('/api/vehicles/mark-seen', (req, res) => {
  for (const id of newVehicleIds) {
    const vehicle = vehicleCache.get(id);
    if (vehicle) {
      vehicle.isNew = false;
    }
  }
  newVehicleIds.clear();
  res.json({ success: true });
});

app.post('/api/scrape', async (req, res) => {
  const newCount = await scrapeAndStore();
  res.json({ 
    success: true, 
    newCount,
    totalVehicles: vehicleCache.size,
    lastScrapeTime 
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    lastScrapeTime,
    totalVehicles: vehicleCache.size,
    newVehicles: newVehicleIds.size
  });
});

async function startServer() {
  console.log('Starting Willhaben scraper (no database)...');
  
  await scrapeAndStore();
  
  setInterval(scrapeAndStore, 30000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Scraping every 30 seconds...`);
  });
}

startServer().catch(console.error);
