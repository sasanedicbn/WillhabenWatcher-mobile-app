// import { scrapeWillhaben } from "./scrape.js";

import { scrapeWillhaben } from "./scraper.js";

async function debugScrape() {
  console.log("🔍 Starting debug scrape...");
  try {
    const vehicles = await scrapeWillhaben();
    console.log(`📊 Found ${vehicles.length} vehicles`);

    if (vehicles.length > 0) {
      console.log("First vehicle:", vehicles[0]);
    } else {
      console.log("❌ NO VEHICLES FOUND - Check parsing!");
    }
  } catch (error) {
    console.error("💥 SCRAPE ERROR:", error.message);
    console.error(error.stack);
  }
}

debugScrape();
