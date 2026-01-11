const https = require("https");
const http = require("http");

function fetchPage(url, baseUrl = null) {
  return new Promise((resolve, reject) => {
    let fullUrl = url;
    if (!url.startsWith("http") && baseUrl) {
      const base = new URL(baseUrl);
      fullUrl = url.startsWith("/")
        ? `${base.protocol}//${base.host}${url}`
        : `${baseUrl}/${url}`;
    }

    if (!fullUrl.startsWith("http")) {
      reject(new Error(`Invalid URL: ${fullUrl}`));
      return;
    }

    const parsedUrl = new URL(fullUrl);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
    };

    protocol
      .get(options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const redirectUrl = res.headers.location;
          fetchPage(redirectUrl, fullUrl).then(resolve).catch(reject);
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
    const isPrivate =
      sellerName && /(gmbh|kg|ag|d\.o\.o|ltd|autohaus)/i.test(sellerName)
        ? 0
        : 1;

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
      isPrivate,
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
function isPrivateAd(attrs) {
  const isPrivateAttr = attrs.find((a) => a.name === "ISPRIVATE")?.value;
  if (isPrivateAttr === "0") return false; // firma
  if (isPrivateAttr === "1") return true; // privatno

  // fallback na stare provjere
  for (const a of attrs) {
    if (
      (a.name === "ORGNAME" && a.values?.[0]) ||
      (a.name === "COMPANY_NAME" && a.values?.[0]) ||
      (a.name === "CONTACT_COMPANY" && a.values?.[0])
    )
      return false;

    if (a.name === "SELLER_TYPE") {
      const v = a.values?.[0];
      if (v && v.toUpperCase() !== "PRIVATE") return false;
    }

    if (a.name === "CONTACT_NAME") {
      const v = a.values?.[0];
      if (v && /(gmbh|kg|ag|d\.o\.o|ltd|autohaus)/i.test(v)) return false;
    }
  }

  return true; // fizičko lice
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

      if (!isPrivateAd(attrs)) {
        continue; // sada legalno, jer smo unutar for…of
      }

      const getAttr = (name) =>
        attrs.find((a) => a.name === name)?.values?.[0] || null;
      console.log(ad.attributes.attribute, "ad unutar JSON scrapa");
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
        isPrivate: isPrivateAd(attrs) ? 1 : 0,
        postcode,
      });
    }
  } catch (e) {
    console.error("JSON parse error:", e.message);
  }

  return vehicles;
}

async function scrapeWillhaben() {
  const url =
    "https://www.willhaben.at/iad/gebrauchtwagen/auto/gebrauchtwagenboerse?sfId=ca53e21f-9a65-49d5-acbb-cc094c37d4ba&rows=30&isNavigation=true&DEALER=1&page=1&PRICE_FROM=0&PRICE_TO=10000";

  try {
    const html = await fetchPage(url);

    // ✅ SAMO JSON (najstabilnije)
    let vehicles = parseVehiclesFromJSON(html);
    if (vehicles.length === 0) {
      vehicles = parseVehiclesFromHTML(html);
    }
    // console.log(vehicles, "vozila iz scrapa");
    return vehicles.filter((v) => v.price === null || v.price <= 10000);
  } catch (e) {
    console.error("Scrape error:", e.message);
    return [];
  }
}

module.exports = { scrapeWillhaben };
