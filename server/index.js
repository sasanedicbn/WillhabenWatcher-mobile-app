const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 8082;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        price INTEGER,
        year INTEGER,
        mileage INTEGER,
        location TEXT,
        fuel_type TEXT,
        image_url TEXT,
        willhaben_url TEXT,
        phone TEXT,
        first_seen_at TIMESTAMP DEFAULT NOW(),
        is_new BOOLEAN DEFAULT true
      )
    `);
    console.log('Database initialized');
  } finally {
    client.release();
  }
}

let cachedVehicles = [];
let lastScrapeTime = null;

async function scrapeAndStore() {
  try {
    console.log('Starting scrape...');
    const scrapedVehicles = await scraper.scrapeWillhaben();
    console.log(`Scraped ${scrapedVehicles.length} vehicles`);

    const client = await pool.connect();
    const newVehicles = [];

    try {
      for (const vehicle of scrapedVehicles) {
        const existing = await client.query(
          'SELECT id FROM vehicles WHERE id = $1',
          [vehicle.id]
        );

        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO vehicles (id, title, price, year, mileage, location, fuel_type, image_url, willhaben_url, phone, is_new)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)`,
            [
              vehicle.id,
              vehicle.title,
              vehicle.price,
              vehicle.year,
              vehicle.mileage,
              vehicle.location,
              vehicle.fuelType,
              vehicle.imageUrl,
              vehicle.willhabenUrl,
              vehicle.phone || null,
            ]
          );
          newVehicles.push(vehicle);
        }
      }

      const result = await client.query(
        'SELECT * FROM vehicles ORDER BY first_seen_at DESC LIMIT 100'
      );
      cachedVehicles = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        price: row.price,
        year: row.year,
        mileage: row.mileage,
        location: row.location,
        fuelType: row.fuel_type,
        imageUrl: row.image_url,
        willhabenUrl: row.willhaben_url,
        phone: row.phone,
        isNew: row.is_new,
        firstSeenAt: row.first_seen_at,
      }));

      lastScrapeTime = new Date();
      console.log(`Found ${newVehicles.length} new vehicles`);
      return newVehicles;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Scrape error:', error.message);
    return [];
  }
}

app.get('/api/vehicles', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM vehicles ORDER BY first_seen_at DESC LIMIT 100'
      );
      const vehicles = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        price: row.price,
        year: row.year,
        mileage: row.mileage,
        location: row.location,
        fuelType: row.fuel_type,
        imageUrl: row.image_url,
        willhabenUrl: row.willhaben_url,
        phone: row.phone,
        isNew: row.is_new,
        firstSeenAt: row.first_seen_at,
      }));
      res.json({ vehicles, lastScrapeTime });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

app.get('/api/vehicles/new', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM vehicles WHERE is_new = true ORDER BY first_seen_at DESC'
      );
      const vehicles = result.rows.map((row) => ({
        id: row.id,
        title: row.title,
        price: row.price,
        year: row.year,
        mileage: row.mileage,
        location: row.location,
        fuelType: row.fuel_type,
        imageUrl: row.image_url,
        willhabenUrl: row.willhaben_url,
        phone: row.phone,
        isNew: row.is_new,
        firstSeenAt: row.first_seen_at,
      }));
      res.json({ vehicles, count: vehicles.length });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching new vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch new vehicles' });
  }
});

app.post('/api/vehicles/mark-seen', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('UPDATE vehicles SET is_new = false WHERE is_new = true');
      res.json({ success: true });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error marking vehicles as seen:', error);
    res.status(500).json({ error: 'Failed to mark vehicles as seen' });
  }
});

app.post('/api/scrape', async (req, res) => {
  const newVehicles = await scrapeAndStore();
  res.json({ 
    success: true, 
    newCount: newVehicles.length,
    newVehicles: newVehicles.slice(0, 10),
    lastScrapeTime 
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', lastScrapeTime });
});

async function startServer() {
  await initDatabase();
  
  await scrapeAndStore();
  
  setInterval(scrapeAndStore, 30000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(console.error);
