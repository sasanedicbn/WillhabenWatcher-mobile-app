import http from "http";
import https from "https";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getNextProxy } from "./proxy.js";
import { fetchPageIPRoyal } from "./fetchPageIPRoyal.js";

// =====================
// RISKY MODE SETTINGS
// =====================
const SCRAPE_BUDGET_MS = 9500; // maksimalno čekanje po scrape pozivu (hard cap)

const WEBSHARE_FIRST_BYTE_MS = 1500;
const WEBSHARE_REQ_TIMEOUT_MS = 5500;
const WEBSHARE_HARD_TIMEOUT_MS = 6500;

// IPRoyal pozivaj rijetko:
// - ako Webshare padne, pozovi odmah
// - ako Webshare traje predugo, pozovi nakon ovog praga
const IPROYAL_SLOW_START_MS = 4800; // "tek kad baš kasni"
const IPROYAL_MAX_WAIT_MS = 4400; // koliko max čekamo iproyal kad se upali (budget-friendly)

// Sticky + blacklist
const STICKY_MAX_USES = 500; // drži se istog proxyja dugo (rizično, ali brzo)
const STICKY_MAX_AGE_MS = 15 * 60_000; // max 15 min na istom proxyju pa rotate (da ne pregori)
const DEAD_PROXY_COOLDOWN_MS = 20 * 60_000; // mrtav proxy pauziraj 20 min
const BLOCKED_PROXY_COOLDOWN_MS = 5 * 60_000; // ako ispadne block, pauziraj 5 min

const MAX_REDIRECTS = 5;

// ---------------------
// Helpers: timing
// ---------------------
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

function isNetworkFail(errMsg) {
  const m = (errMsg || "").toLowerCase();
  return (
    m.includes("first byte timeout") ||
    m.includes("request timeout") ||
    m.includes("hard timeout") ||
    m.includes("aborted") ||
    m.includes("terminated") ||
    m.includes("socket hang up") ||
    m.includes("econnreset") ||
    m.includes("etimedout") ||
    m.includes("eai_again") ||
    m.includes("enotfound")
  );
}

// ---------------------
// Sticky proxy + blacklist
// ---------------------
const badProxyUntil = new Map(); // proxyString -> timestamp

let stickyProxy = null;
let stickyUses = 0;
let stickySince = 0;

function isProxyBad(proxyString) {
  const until = badProxyUntil.get(proxyString);
  return until && until > Date.now();
}

function markProxyBad(proxyString, cooldownMs) {
  if (!proxyString) return;
  badProxyUntil.set(proxyString, Date.now() + cooldownMs);
  if (stickyProxy === proxyString) {
    stickyProxy = null;
    stickyUses = 0;
    stickySince = 0;
  }
}

function pickWebshareProxy({ forceRotate = false } = {}) {
  const now = Date.now();

  // ako sticky ok, koristi ga
  if (
    !forceRotate &&
    stickyProxy &&
    !isProxyBad(stickyProxy) &&
    stickyUses < STICKY_MAX_USES &&
    now - stickySince < STICKY_MAX_AGE_MS
  ) {
    stickyUses++;
    return stickyProxy;
  }

  // inače nađi prvi koji nije u cooldown-u
  for (let i = 0; i < 120; i++) {
    const p = getNextProxy();
    if (p && !isProxyBad(p)) {
      stickyProxy = p;
      stickyUses = 1;
      stickySince = now;
      return stickyProxy;
    }
  }

  // fallback: uzmi šta god (ako su svi u cooldownu)
  stickyProxy = getNextProxy();
  stickyUses = 1;
  stickySince = now;
  return stickyProxy;
}

// ---------------------
// Agent cache (manje overhead-a)
// ---------------------
const agentCache = new Map(); // key -> agent

function getAgent(parsedUrl, proxyUrl) {
  const key = `${parsedUrl.protocol}//${proxyUrl}`;
  const cached = agentCache.get(key);
  if (cached) return cached;

  const agent =
    parsedUrl.protocol === "https:"
      ? new HttpsProxyAgent(proxyUrl)
      : new HttpProxyAgent(proxyUrl);

  agentCache.set(key, agent);
  return agent;
}

// ---------------------
// Webshare fetch (sticky proxy)
// ---------------------
function fetchPageWebshare(
  url,
  baseUrl = null,
  redirectCount = 0,
  proxyString = null,
) {
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

    const pStr = proxyString || pickWebshareProxy({ forceRotate: false });
    const [ip, port, user, pass] = (pStr || "").split(":");
    if (!ip || !port || !user || !pass) {
      return reject(new Error("Proxy string invalid (ip:port:user:pass)"));
    }

    const proxyUrl = `http://${user}:${pass}@${ip}:${port}`;
    const agent = getAgent(parsedUrl, proxyUrl);

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
      resolve({ html: val, proxyString: pStr });
    };

    const doneReject = (err) => {
      if (finished) return;
      finished = true;
      if (firstByteTimer) clearTimeout(firstByteTimer);
      clearTimeout(hardTimer);
      reject({ err, proxyString: pStr });
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
        fetchPageWebshare(next, fullUrl, redirectCount + 1, pStr)
          .then(({ html }) => doneResolve(html))
          .catch(({ err }) => doneReject(err));
        return;
      }

      if (res.statusCode && res.statusCode >= 400) {
        res.resume();
        doneResolve("");
        return;
      }

      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => doneResolve(Buffer.concat(chunks).toString("utf8")));
      res.on("aborted", () => doneReject(new Error("Response aborted")));
      res.on("error", (e) => doneReject(e));
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

    req.on("error", (e) => doneReject(e));
  });
}

// ===== parsing (tvoja logika - ostavljeno) =====
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

// lastGood (da UI ne "prazni" kad naleti loš momenat)
let lastGoodFiltered = [];
let lastGoodAt2 = 0;

// =====================
// MAIN
// =====================
export async function scrapeWillhaben() {
  const url =
    "https://www.willhaben.at/iad/gebrauchtwagen/auto/gebrauchtwagenboerse?rows=30&PRICE_TO=10000&DEALER=1";

  const deadline = Date.now() + SCRAPE_BUDGET_MS;
  const timeLeft = () => Math.max(1, deadline - Date.now());

  // 1) Webshare pokušaj (sticky proxy)
  let slowTimerFired = false;
  let startIP = null;

  const slowTimer = setTimeout(() => {
    slowTimerFired = true;
    startIP?.();
  }, IPROYAL_SLOW_START_MS);

  let ipPromise = null;
  const startIPRoyal = () => {
    if (ipPromise) return;
    const wait = Math.min(IPROYAL_MAX_WAIT_MS, timeLeft());
    ipPromise = withTimeout(fetchPageIPRoyal(url), wait, "IPRoyal");
  };
  startIP = startIPRoyal;

  try {
    const { html, proxyString } = await withTimeout(
      fetchPageWebshare(url),
      timeLeft(),
      "WEB_BUDGET",
    );

    clearTimeout(slowTimer);

    const p = parseAny(html);
    const filtered = filterVehicles(p.vehicles);

    if (!p.blocked) {
      // uspeh: drži sticky
      lastGoodFiltered = filtered;
      lastGoodAt2 = Date.now();
      return filtered;
    }

    // block: ovaj proxy pauziraj kratko i probaj jednom rotate Webshare
    markProxyBad(proxyString, BLOCKED_PROXY_COOLDOWN_MS);

    const remaining = timeLeft();
    if (remaining > 1200) {
      const { html: html2, proxyString: p2 } = await withTimeout(
        fetchPageWebshare(
          url,
          null,
          0,
          pickWebshareProxy({ forceRotate: true }),
        ),
        remaining,
        "WEB_RETRY",
      );
      const pp = parseAny(html2);
      const f2 = filterVehicles(pp.vehicles);
      if (!pp.blocked) {
        lastGoodFiltered = f2;
        lastGoodAt2 = Date.now();
        return f2;
      }
      markProxyBad(p2, BLOCKED_PROXY_COOLDOWN_MS);
    }

    // Ako smo blockovani i dalje: tek sad IP (rijetko)
    startIPRoyal();
    if (ipPromise) {
      const htmlIp = await ipPromise.catch(() => null);
      if (htmlIp) {
        const pi = parseAny(htmlIp);
        const fi = filterVehicles(pi.vehicles);
        if (!pi.blocked) {
          lastGoodFiltered = fi;
          lastGoodAt2 = Date.now();
          return fi;
        }
      }
    }

    // fallback lastGood
    if (
      lastGoodFiltered.length > 0 &&
      Date.now() - lastGoodAt2 <= LAST_GOOD_TTL_MS
    ) {
      return lastGoodFiltered;
    }
    return [];
  } catch ({ err, proxyString }) {
    clearTimeout(slowTimer);

    const msg = err?.message || String(err || "");

    // mrežni fail -> proxy je mrtav, cooldown
    if (proxyString && isNetworkFail(msg)) {
      markProxyBad(proxyString, DEAD_PROXY_COOLDOWN_MS);
    }

    // 2) Brzi Webshare retry sa novim proxyjem (IPRoyal još ne zovemo)
    const remaining = timeLeft();
    if (remaining > 1500) {
      try {
        const forced = pickWebshareProxy({ forceRotate: true });
        const { html: html2, proxyString: p2 } = await withTimeout(
          fetchPageWebshare(url, null, 0, forced),
          remaining,
          "WEB_RETRY",
        );

        const pp = parseAny(html2);
        const f2 = filterVehicles(pp.vehicles);

        if (!pp.blocked) {
          lastGoodFiltered = f2;
          lastGoodAt2 = Date.now();
          return f2;
        }

        markProxyBad(p2, BLOCKED_PROXY_COOLDOWN_MS);
      } catch (e2) {
        const m2 = e2?.err?.message || e2?.message || String(e2 || "");
        if (e2?.proxyString && isNetworkFail(m2)) {
          markProxyBad(e2.proxyString, DEAD_PROXY_COOLDOWN_MS);
        }
      }
    }

    // 3) IPRoyal samo ako mora (Webshare pukao)
    startIPRoyal();
    if (ipPromise) {
      const htmlIp = await ipPromise.catch(() => null);
      if (htmlIp) {
        const pi = parseAny(htmlIp);
        const fi = filterVehicles(pi.vehicles);
        if (!pi.blocked) {
          lastGoodFiltered = fi;
          lastGoodAt2 = Date.now();
          return fi;
        }
      }
    }

    // lastGood fallback
    if (
      lastGoodFiltered.length > 0 &&
      Date.now() - lastGoodAt2 <= LAST_GOOD_TTL_MS
    ) {
      return lastGoodFiltered;
    }

    return [];
  }
}
