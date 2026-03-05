import http from "http";
import https from "https";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getNextProxy } from "./proxy.js";
import { fetchPageIPRoyal } from "./fetchPageIPRoyal.js";

// Webshare: zadrži “može do 20s” kako si tražila
const WEBSHARE_HARD_TIMEOUT_MS = 9000;
const WEBSHARE_REQ_TIMEOUT_MS = 8000;

// Ako Webshare ne da HEADER brzo -> odmah parallel fallback
const WEBSHARE_FIRST_BYTE_MS = 1500;

// IPRoyal: može do 20s (kako si tražila)
const IPROYAL_TIMEOUT_MS = 10000;

const MAX_REDIRECTS = 5;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
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

function isWebshareFastFail(errMsg) {
  const m = (errMsg || "").toLowerCase();
  return (
    m.includes("first byte timeout") ||
    m.includes("request timeout") ||
    m.includes("hard timeout") ||
    m.includes("aborted") ||
    m.includes("terminated")
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

      // 4xx/5xx tretiramo kao prazno -> gore će odmah preći na IPRoyal
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

    // FIRST BYTE timeout
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

// ===== parsing (netaknuto) =====
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
  let vehicles = parseVehiclesFromJSON(html);
  if (vehicles.length === 0) vehicles = parseVehiclesFromHTML(html);
  return { vehicles, blocked: looksBlocked(html) };
}

// ===== MAIN =====
export async function scrapeWillhaben() {
  const url =
    "https://www.willhaben.at/iad/gebrauchtwagen/auto/gebrauchtwagenboerse?rows=30&PRICE_TO=10000&DEALER=1";

  // Helper za IPRoyal (sa timeoutom)
  const ipPromise = () =>
    withTimeout(fetchPageIPRoyal(url), IPROYAL_TIMEOUT_MS, "IPRoyal");

  // 1) pokušaj Webshare
  try {
    const htmlWeb = await fetchPageWebshare(url);
    const p = parseAny(htmlWeb);

    // Webshare ok
    if (!p.blocked && p.vehicles.length > 0) {
      return filterVehicles(p.vehicles);
    }

    // Webshare blok/prazno -> odmah IPRoyal
    const htmlIp = await ipPromise();
    const p2 = parseAny(htmlIp);
    return filterVehicles(p2.vehicles);
  } catch (e) {
    const msg = e?.message || String(e);

    // 2) Ako Webshare fast-fail (first-byte/timeout/aborted) -> uradi:
    //    IPRoyal + Webshare retry paralelno, uzmi šta dođe prvo (smanjuje 14s tail)
    if (isWebshareFastFail(msg)) {
      const retryWeb = fetchPageWebshare(url).catch(() => null);
      const ip = ipPromise().catch(() => null);

      // čekaj prvi koji da html (ne preskačemo ciklus)
      const first = await Promise.any([
        retryWeb.then((h) => {
          if (!h) throw new Error("retry web failed");
          return { src: "web", html: h };
        }),
        ip.then((h) => {
          if (!h) throw new Error("ip failed");
          return { src: "ip", html: h };
        }),
      ]).catch(() => null);

      if (first?.html) {
        const p = parseAny(first.html);
        if (!p.blocked && p.vehicles.length > 0) {
          return filterVehicles(p.vehicles);
        }
        // ako prvi vrati block/empty, čekaj drugog
        const secondHtml = first.src === "web" ? await ip : await retryWeb;

        if (secondHtml) {
          const p2 = parseAny(secondHtml);
          return filterVehicles(p2.vehicles);
        }
      }

      console.error("❌ Both proxies failed: terminated");
      return [];
    }

    // 3) ostali webshare errori -> fallback na IPRoyal
    try {
      const htmlIp = await ipPromise();
      const p2 = parseAny(htmlIp);
      return filterVehicles(p2.vehicles);
    } catch (e2) {
      console.error("❌ Both proxies failed:", e2?.message || e2);
      return [];
    }
  }
}
