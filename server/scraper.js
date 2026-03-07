import http from "http";
import https from "https";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getNextProxy } from "./proxy.js";
import { fetchPageIPRoyal } from "./fetchPageIPRoyal.js";

// =====================
// WORST-CASE (hard cap)
// =====================
const SCRAPE_BUDGET_MS = 9200; // ✅ maksimalno čekanje po scrape pozivu

// Webshare timeouts (kraći da ne “jede” budžet)
const WEBSHARE_FIRST_BYTE_MS = 1500;
const WEBSHARE_REQ_TIMEOUT_MS = 6000;
const WEBSHARE_HARD_TIMEOUT_MS = 6500;

// IPRoyal cap (da zajedno sa hedge delay ne pređe budget)
const IPROYAL_HEDGE_DELAY_MS = 2000;
const IPROYAL_TIMEOUT_MS = 7000;

// (Opcionalno) retry Webshare sa drugim proxyjem ako baš kasni
const WEBSHARE_RETRY_DELAY_MS = 3000;

const MAX_REDIRECTS = 5;

// lastGood: da ne “nestane lista” kad je loš network/proxy momenat
let lastGoodVehicles = [];
let lastGoodAt = 0;
const LAST_GOOD_TTL_MS = 15 * 60 * 1000;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label} timeout after ${ms}ms`)),
      ms,
    );
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

// Block detekcija: samo “tvrdi” signali (ne __NEXT_DATA__)
function looksBlocked(html) {
  if (!html) return true;
  const s = html.toLowerCase();
  return (
    s.includes("captcha") ||
    s.includes("access denied") ||
    s.includes("forbidden") ||
    s.includes("cloudflare") ||
    s.includes("verify you are human")
  );
}

// ===== Webshare fetch (sa FIRST-BYTE timeout) =====
function fetchPageWebshare(url, baseUrl = null, redirectCount = 0) {
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
    } catch {
      return reject(new Error(`Bad URL: ${fullUrl}`));
    }

    if (redirectCount > MAX_REDIRECTS) {
      return reject(new Error(`Too many redirects (${MAX_REDIRECTS})`));
    }

    const proxyString = getNextProxy();
    const [ip, port, user, pass] = (proxyString || "").split(":");
    if (!ip || !port || !user || !pass) {
      return reject(new Error("Proxy string invalid (ip:port:user:pass)"));
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
    let firstByteTimer = null;

    const doneResolve = (val) => {
      if (finished) return;
      finished = true;
      if (firstByteTimer) clearTimeout(firstByteTimer);
      clearTimeout(hardTimer);
      resolve(val);
    };

    const doneReject = (err) => {
      if (finished) return;
      finished = true;
      if (firstByteTimer) clearTimeout(firstByteTimer);
      clearTimeout(hardTimer);
      reject(err);
    };

    const hardTimer = setTimeout(() => {
      try {
        req?.destroy(
          new Error(`Hard timeout after ${WEBSHARE_HARD_TIMEOUT_MS}ms`),
        );
      } catch {}
      doneReject(new Error(`Hard timeout after ${WEBSHARE_HARD_TIMEOUT_MS}ms`));
    }, WEBSHARE_HARD_TIMEOUT_MS);

    req = protocol.get(options, (res) => {
      if (firstByteTimer) clearTimeout(firstByteTimer);

      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const next = res.headers.location;
        res.resume();
        fetchPageWebshare(next, fullUrl, redirectCount + 1)
          .then(doneResolve)
          .catch(doneReject);
        return;
      }

      // 4xx/5xx -> prazno
      if (res.statusCode && res.statusCode >= 400) {
        res.resume();
        doneResolve("");
        return;
      }

      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => doneResolve(Buffer.concat(chunks).toString("utf8")));
      res.on("aborted", () => doneReject(new Error("Response aborted")));
      res.on("error", doneReject);
    });

    firstByteTimer = setTimeout(() => {
      try {
        req?.destroy(
          new Error(`First byte timeout after ${WEBSHARE_FIRST_BYTE_MS}ms`),
        );
      } catch {}
      doneReject(
        new Error(`First byte timeout after ${WEBSHARE_FIRST_BYTE_MS}ms`),
      );
    }, WEBSHARE_FIRST_BYTE_MS);

    req.setTimeout(WEBSHARE_REQ_TIMEOUT_MS, () => {
      req.destroy(
        new Error(`Request timeout after ${WEBSHARE_REQ_TIMEOUT_MS}ms`),
      );
    });

    req.on("error", doneReject);
  });
}

// ===== parsing (tvoja logika) =====
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
  if (autdealerAttr === "1") return false;
  if (autdealerAttr === "0") return true;

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
        isPrivate: true,
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

function parseAny(html) {
  let vehicles = [];
  if (html && html.includes("__NEXT_DATA__")) {
    vehicles = parseVehiclesFromJSON(html);
  }
  if (vehicles.length === 0) vehicles = parseVehiclesFromHTML(html);
  return { vehicles, blocked: looksBlocked(html) };
}

// =====================
// MAIN (hard <= 9.0s)
// =====================
export async function scrapeWillhaben() {
  const url =
    "https://www.willhaben.at/iad/gebrauchtwagen/auto/gebrauchtwagenboerse?rows=30&PRICE_TO=10000&DEALER=1";

  const startedAt = Date.now();

  const budgetPromise = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error("SCRAPE_BUDGET_EXCEEDED")),
      SCRAPE_BUDGET_MS,
    ),
  );

  const attempt = async (label, htmlPromise) => {
    const html = await htmlPromise;
    const p = parseAny(html);
    const v = filterVehicles(p.vehicles);
    if (!p.blocked && v.length > 0) return v;
    throw new Error(`${label}: blocked/empty`);
  };

  // Webshare odmah
  const web1 = attempt("web1", fetchPageWebshare(url));

  // IPRoyal hedged (krene tek nakon 2s)
  const ip = (async () => {
    await delay(IPROYAL_HEDGE_DELAY_MS);
    return await attempt(
      "ip",
      withTimeout(fetchPageIPRoyal(url), IPROYAL_TIMEOUT_MS, "IPRoyal"),
    );
  })();

  // Webshare retry (drugi proxy) nakon 3s
  const web2 = (async () => {
    await delay(WEBSHARE_RETRY_DELAY_MS);
    return await attempt("web2", fetchPageWebshare(url));
  })();

  try {
    const winner = await Promise.race([
      Promise.any([web1, ip, web2]),
      budgetPromise,
    ]);

    // success
    lastGoodVehicles = winner;
    lastGoodAt = Date.now();
    return winner;
  } catch (e) {
    // hard cap – vraćamo lastGood da korisnik ne dobije “prazan ekran”
    const age = Date.now() - lastGoodAt;
    if (lastGoodVehicles.length > 0 && age <= LAST_GOOD_TTL_MS) {
      return lastGoodVehicles;
    }

    // Ako smo na startu i nemamo lastGood, nema šta – vrati []
    // (ovo se obično desi samo dok prvi put ne uhvatiš rezultate)
    return [];
  } finally {
    // samo da ne ostaviš unused var (debug)
    void startedAt;
  }
}
