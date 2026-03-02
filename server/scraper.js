import http from "http";
import https from "https";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getNextProxy } from "./proxy.js";
import { fetchPageIPRoyal } from "./fetchPageIPRoyal.js";

const HARD_TIMEOUT_MS = 12000;
const REQ_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;

let webshareCooldownUntil = 0;
const WEBSHARE_COOLDOWN_MS = 5 * 60_000;

function inWebshareCooldown() {
  return Date.now() < webshareCooldownUntil;
}

function startWebshareCooldown(reason) {
  webshareCooldownUntil = Date.now() + WEBSHARE_COOLDOWN_MS;
  console.warn(
    `⚠️ Webshare issue (${reason}) → cooldown ${Math.round(
      WEBSHARE_COOLDOWN_MS / 1000,
    )}s → switching to IPRoyal`,
  );
}

function looksBlocked(html) {
  if (!html) return true;
  const s = html.toLowerCase();
  return (
    !s.includes("__next_data__") ||
    s.includes("captcha") ||
    s.includes("access denied") ||
    s.includes("cloudflare") ||
    s.includes("bot")
  );
}

function fetchPage(url, baseUrl = null, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    let fullUrl = url;

    if (!url.startsWith("http") && baseUrl) {
      const base = new URL(baseUrl);
      fullUrl = url.startsWith("/")
        ? `${base.protocol}//${base.host}${url}`
        : `${baseUrl}/${url}`;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(fullUrl);
    } catch (e) {
      return reject(new Error(`Bad URL: ${fullUrl}`));
    }

    if (redirectCount > MAX_REDIRECTS) {
      return reject(new Error(`Too many redirects (${MAX_REDIRECTS})`));
    }

    const proxyString = getNextProxy();
    if (!proxyString || typeof proxyString !== "string") {
      return reject(new Error("Proxy string is empty/invalid"));
    }

    const [ip, port, user, pass] = proxyString.split(":");
    if (!ip || !port || !user || !pass) {
      return reject(new Error("Proxy string format must be ip:port:user:pass"));
    }

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

    let finished = false;
    let req;

    const hardTimer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try {
        req?.destroy(new Error(`Hard timeout after ${HARD_TIMEOUT_MS}ms`));
      } catch {}
      reject(new Error(`Hard timeout after ${HARD_TIMEOUT_MS}ms`));
    }, HARD_TIMEOUT_MS);

    const doneResolve = (val) => {
      if (finished) return;
      finished = true;
      clearTimeout(hardTimer);
      resolve(val);
    };

    const doneReject = (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(hardTimer);
      reject(err);
    };

    req = protocol.get(options, (res) => {
      // Redirects: obavezno res.resume() da ne curi socket
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const next = res.headers.location;
        res.resume();
        fetchPage(next, fullUrl, redirectCount + 1)
          .then(doneResolve)
          .catch(doneReject);
        return;
      }

      // Fail-fast 4xx/5xx
      if (res.statusCode && res.statusCode >= 400) {
        res.resume();
        doneResolve("");
        return;
      }

      // ✅ brže i stabilnije od data += chunk
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => doneResolve(Buffer.concat(chunks).toString("utf8")));
      res.on("aborted", () => doneReject(new Error("Response aborted")));
      res.on("error", doneReject);
    });

    // inactivity timeout
    req.setTimeout(REQ_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timeout after ${REQ_TIMEOUT_MS}ms`));
    });

    req.on("error", doneReject);
  });
}

function extractPrice(text) {
  if (!text) return null;
  const match = text.replace(/[^\d]/g, "");
  return match ? parseInt(match, 10) : null;
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

    if (sellerName && /(gmbh|kg|ag|d\.o\.o|ltd|autohaus)/i.test(sellerName)) {
      continue;
    }

    const priceMatch = articleHtml.match(/€\s*([\d.,]+)/);
    const price = priceMatch ? extractPrice(priceMatch[0]) : null;

    const isPrivate = !(
      sellerName && /(gmbh|kg|ag|d\.o\.o|ltd|autohaus)/i.test(sellerName)
    );

    const linkMatch = articleHtml.match(/href="(\/iad\/[^"]+)"/);
    const willhabenPath = linkMatch ? linkMatch[1] : null;

    const cleanPath = willhabenPath ? willhabenPath.split("?")[0] : null;

    const willhabenUrl = cleanPath
      ? `https://www.willhaben.at${cleanPath}`
      : null;

    const stableId = cleanPath
      ? `wh-${cleanPath}`
      : `wh-${title}-${price || "na"}`;

    vehicles.push({
      id: stableId,
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
  const autdealerAttr = attrs.find((a) => a.name === "AUTDEALER")?.values?.[0];

  if (autdealerAttr === "1") return false; // firma
  if (autdealerAttr === "0") return true; // privatno

  const isPrivateAttr = attrs.find((a) => a.name === "ISPRIVATE")?.values?.[0];
  return isPrivateAttr === "1";
}

function parseVehiclesFromJSON(html) {
  const vehicles = [];

  try {
    const scriptMatch = html.match(
      /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
    );
    if (!scriptMatch) return vehicles;

    const jsonData = JSON.parse(scriptMatch[1]);
    const ads =
      jsonData?.props?.pageProps?.searchResult?.advertSummaryList
        ?.advertSummary || [];

    for (const ad of ads) {
      const attrs = ad.attributes?.attribute || [];

      const isPrivate = isPrivateAd(attrs);

      if (!isPrivate) continue;

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
        isPrivate: isPrivate,
        postcode,
      });
    }
  } catch (e) {
    console.error("JSON parse error:", e.message);
  }

  return vehicles;
}

function filterVehicles(vehicles) {
  return vehicles.filter(
    (v) => v.isPrivate === true && (!v.price || v.price <= 10000),
  );
}

export async function scrapeWillhaben() {
  const url =
    "https://www.willhaben.at/iad/gebrauchtwagen/auto/gebrauchtwagenboerse?rows=30&PRICE_TO=10000&DEALER=1";

  try {
    let html = "";
    let vehicles = [];

    // 1) Ako je Webshare u cooldown-u, idi direktno IPRoyal (štedi dupli fetch)
    if (inWebshareCooldown()) {
      html = await fetchPageIPRoyal(url);
      vehicles = parseVehiclesFromJSON(html);
      if (vehicles.length === 0) vehicles = parseVehiclesFromHTML(html);
      return filterVehicles(vehicles);
    }

    // 2) Webshare pokušaj
    html = await fetchPage(url);

    const blocked = looksBlocked(html);
    vehicles = parseVehiclesFromJSON(html);
    if (vehicles.length === 0) vehicles = parseVehiclesFromHTML(html);

    // 3) Fallback ako je blokirano ili prazno
    if (blocked || vehicles.length === 0) {
      startWebshareCooldown(blocked ? "blocked" : "empty");

      html = await fetchPageIPRoyal(url);
      vehicles = parseVehiclesFromJSON(html);
      if (vehicles.length === 0) vehicles = parseVehiclesFromHTML(html);
    } else {
      // uspjeh: reset cooldown
      webshareCooldownUntil = 0;
    }

    return filterVehicles(vehicles);
  } catch (err) {
    console.error("❌ Scrape error:", err?.message || err);

    // fail-safe: probaj IPRoyal jednom (bolje nego vratiti [] bez pokušaja)
    try {
      const html = await fetchPageIPRoyal(url);
      let vehicles = parseVehiclesFromJSON(html);
      if (vehicles.length === 0) vehicles = parseVehiclesFromHTML(html);
      return filterVehicles(vehicles);
    } catch (e2) {
      console.error("❌ IPRoyal error:", e2?.message || e2);
      return [];
    }
  }
}
