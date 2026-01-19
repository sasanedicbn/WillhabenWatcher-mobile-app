import http from "http";
import https from "https";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getNextProxy } from "./proxy.js";
import { fetchPageIPRoyal } from "./fetchPageIPRoyal.ts";

function fetchPage(url, baseUrl = null) {
  return new Promise((resolve, reject) => {
    let fullUrl = url;
    if (!url.startsWith("http") && baseUrl) {
      const base = new URL(baseUrl);
      fullUrl = url.startsWith("/")
        ? `${base.protocol}//${base.host}${url}`
        : `${baseUrl}/${url}`;
    }

    const parsedUrl = new URL(fullUrl);

    // 🔁 UZMI SLEDEĆI PROXY
    const proxyString = getNextProxy();
    const [ip, port, user, pass] = proxyString.split(":");
    const proxyUrl = `http://${user}:${pass}@${ip}:${port}`;

    const agent =
      parsedUrl.protocol === "https:"
        ? new HttpsProxyAgent(proxyUrl)
        : new HttpProxyAgent(proxyUrl);

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      agent,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
      },
    };

    const protocol = parsedUrl.protocol === "https:" ? https : http;

    protocol
      .get(options, (res) => {
        if ([301, 302].includes(res.statusCode)) {
          fetchPage(res.headers.location, fullUrl).then(resolve).catch(reject);
          return;
        }

        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}
function extractPrice(text) {
  if (!text) return null;
  const match = text.replace(/[^\d]/g, "");
  return match ? parseInt(match, 10) : null;
}

function extractYear(text) {
  if (!text) return null;
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

function extractMileage(text) {
  if (!text) return null;
  const match = text.match(/([\d.]+)\s*km/i);
  if (match) {
    return parseInt(match[1].replace(/\./g, ""), 10);
  }
  return null;
}

function extractPhoneNumber(text) {
  if (!text) return null;

  const patterns = [
    /\+43\s*\d{1,4}[\s\-\/]?\d{3,}[\s\-\/]?\d{2,}/g,
    /0\d{3,4}[\s\-\/]?\d{3,}[\s\-\/]?\d{2,}/g,
    /\b06\d{2}[\s\-\/]?\d{3}[\s\-\/]?\d{2,4}\b/g,
    /\b0\d{3}[\s\-\/]?\d{6,}\b/g,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      let phone = matches[0].replace(/[\s\-\/]/g, "");
      if (phone.startsWith("0") && !phone.startsWith("00")) {
        phone = "+43" + phone.substring(1);
      }
      return phone;
    }
  }

  return null;
}
function parseVehiclesFromHTML(html) {
  const vehicles = [];

  const articleRegex =
    /<article[^>]*data-testid="search-result-entry-header-[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;

  let match;
  while ((match = articleRegex.exec(html)) !== null) {
    const articleHtml = match[0];

    const titleMatch = articleHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    if (!title || title.length < 3) continue;

    const sellerMatch =
      articleHtml.match(/data-testid="ad-contact[^"]*"[^>]*>([^<]+)</i) ||
      articleHtml.match(/<span[^>]*class="[^"]*seller[^"]*"[^>]*>([^<]+)</i);

    const sellerName = sellerMatch ? sellerMatch[1].trim() : null;

    // ⛔ FILTER FIRMI
    if (sellerName && /(gmbh|kg|ag|d\.o\.o|ltd|autohaus)/i.test(sellerName)) {
      continue;
    }

    const priceMatch = articleHtml.match(/€\s*([\d.,]+)/);
    const price = priceMatch ? extractPrice(priceMatch[0]) : null;

    // PROMIJENI OVO: vraćaj boolean umjesto broja
    const isPrivate = !(
      sellerName && /(gmbh|kg|ag|d\.o\.o|ltd|autohaus)/i.test(sellerName)
    );
    console.log(isPrivate, "IS PRIVATE UNUTAR HTML SCRAPA");

    const linkMatch = articleHtml.match(/href="(\/iad\/[^"]+)"/);
    const willhabenUrl = linkMatch
      ? `https://www.willhaben.at${linkMatch[1]}`
      : null;

    vehicles.push({
      id: `wh-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      price,
      willhabenUrl,
      sellerName,
      isPrivate, // SADA JE BOOLEAN!
    });
  }

  return vehicles;
}

const FUEL_TYPE_MAP = {
  100001: "Benzin",
  100002: "Benzin/Elektro",
  100003: "Diesel",
  100004: "Elektro",
  100005: "Erdgas (CNG)",
  100006: "Ethanol",
  100007: "Flüssiggas (LPG)",
  100008: "Hybrid (Benzin/Elektro)",
  100009: "Hybrid (Diesel/Elektro)",
  100010: "Wasserstoff",
};
// function isPrivateAd(attrs) {
//   const isPrivateAttr = attrs.find((a) => a.name === "ISPRIVATE")?.values?.[0];
//   return isPrivateAttr === "1";
// }
function isPrivateAd(attrs) {
  // Prvo provjeri AUTDEALER - najpouzdanije
  console.log(attrs, "logovi iz attrs");
  const autdealerAttr = attrs.find((a) => a.name === "AUTDEALER")?.values?.[0];

  if (autdealerAttr === "1") return false; // firma
  if (autdealerAttr === "0") return true; // privatno

  // Onda provjeri ISPRIVATE
  const isPrivateAttr = attrs.find((a) => a.name === "ISPRIVATE")?.values?.[0];
  return isPrivateAttr === "1";
}

function parseVehiclesFromJSON(html) {
  const vehicles = [];

  try {
    const scriptMatch = html.match(
      /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
    );
    if (!scriptMatch) return vehicles;

    const jsonData = JSON.parse(scriptMatch[1]);
    const ads =
      jsonData?.props?.pageProps?.searchResult?.advertSummaryList
        ?.advertSummary || [];

    for (const ad of ads) {
      const attrs = ad.attributes?.attribute || [];

      // ✅ KORISTI isPrivateAd FUNKCIJU koju si napravio/la!
      const isPrivate = isPrivateAd(attrs);

      if (!isPrivate) {
        console.log(`Skipping company ad: ${ad.id}`);
        continue; // preskoči oglas firme
      }

      const getAttr = (name) =>
        attrs.find((a) => a.name === name)?.values?.[0] || null;

      const postcode = getAttr("POSTCODE") || getAttr("ZIP") || null;
      const price =
        parseFloat(getAttr("PRICE/AMOUNT") || getAttr("PRICE")) || null;
      const year =
        parseInt(getAttr("YEAR_MODEL") || getAttr("YEAR"), 10) || null;
      const mileage = parseInt(getAttr("MILEAGE"), 10) || null;
      const fuelCode = getAttr("ENGINE/FUEL");
      const fuelType = fuelCode ? FUEL_TYPE_MAP[fuelCode] || fuelCode : null;
      const imageUrl = getAttr("MMO")
        ? `https://cache.willhaben.at/mmo/${getAttr("MMO")}`
        : null;
      const seoUrl = getAttr("SEO_URL");
      const willhabenUrl = seoUrl
        ? `https://www.willhaben.at/iad/${seoUrl}`
        : `https://www.willhaben.at/iad/gebrauchtwagen/d/auto/${ad.id}`;
      const bodyText =
        ad.description || getAttr("BODY") || getAttr("DESCRIPTION") || "";

      vehicles.push({
        id: `wh-${ad.id}`,
        title: ad.description || getAttr("HEADING") || "Vehicle",
        price,
        year,
        mileage,
        location:
          getAttr("LOCATION") ||
          getAttr("CITY") ||
          getAttr("DISTRICT") ||
          "Österreich",
        fuelType,
        imageUrl,
        willhabenUrl,
        phone: extractPhoneNumber(bodyText),
        sellerName: getAttr("CONTACT_NAME") || null,
        isPrivate: isPrivate, // 👈 KORISTI STVARNU VRIJEDNOST, ne true!
        postcode,
      });
    }
  } catch (e) {
    console.error("JSON parse error:", e.message);
  }

  return vehicles;
}

export async function scrapeWillhaben() {
  const url =
    "https://www.willhaben.at/iad/gebrauchtwagen/auto/gebrauchtwagenboerse?rows=30&PRICE_TO=10000&DEALER=1";

  try {
    console.log("🔍 Scraping URL:", url);

    // 1️⃣ PRVO Webshare
    let html = await fetchPage(url);
    console.log("✅ Fetched HTML, length:", html.length);

    let vehicles = parseVehiclesFromJSON(html);
    console.log(`📊 JSON parsing: ${vehicles.length} vehicles found`);

    if (vehicles.length === 0) {
      console.log("⚠️ JSON parsing failed, trying HTML fallback");
      vehicles = parseVehiclesFromHTML(html);
      console.log(`📊 HTML parsing: ${vehicles.length} vehicles found`);
    }

    // 2️⃣ Ako Webshare faila → IPRoyal
    if (vehicles.length === 0) {
      console.warn("⚠️ Webshare fail → switching to IPRoyal");
      html = await fetchPageIPRoyal(url);
      console.log("✅ IPRoyal HTML, length:", html.length);

      vehicles = parseVehiclesFromJSON(html);
      console.log(`📊 IPRoyal JSON parsing: ${vehicles.length} vehicles found`);

      if (vehicles.length === 0) {
        console.log("⚠️ IPRoyal JSON parsing failed, trying HTML fallback");
        vehicles = parseVehiclesFromHTML(html);
        console.log(
          `📊 IPRoyal HTML parsing: ${vehicles.length} vehicles found`
        );
      }
    }

    // Log detalje o vozilima
    console.log("📋 Vehicle details:");
    vehicles.forEach((v, i) => {
      console.log(
        `  ${i + 1}. ${v.title} - €${v.price} - Private: ${v.isPrivate} (Type: ${typeof v.isPrivate})`
      );
    });

    const filtered = vehicles.filter(
      (v) => v.isPrivate === true && (!v.price || v.price <= 10000)
    );

    console.log(
      `🎯 Filter applied: ${vehicles.length} -> ${filtered.length} vehicles`
    );
    console.log(
      `❌ Removed: ${vehicles.length - filtered.length} vehicles (non-private or price > 10000)`
    );

    return filtered;
  } catch (err) {
    console.error("❌ Scrape error:", err.message);
    return [];
  }
}
