const https = require('https');
const http = require('http');

function fetchPage(url, baseUrl = null) {
  return new Promise((resolve, reject) => {
    let fullUrl = url;
    if (!url.startsWith('http') && baseUrl) {
      const base = new URL(baseUrl);
      fullUrl = url.startsWith('/') 
        ? `${base.protocol}//${base.host}${url}`
        : `${baseUrl}/${url}`;
    }
    
    if (!fullUrl.startsWith('http')) {
      reject(new Error(`Invalid URL: ${fullUrl}`));
      return;
    }
    
    const parsedUrl = new URL(fullUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'de-AT,de;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    };

    protocol.get(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        fetchPage(redirectUrl, fullUrl).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractPrice(text) {
  if (!text) return null;
  const match = text.replace(/[^\d]/g, '');
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
    return parseInt(match[1].replace(/\./g, ''), 10);
  }
  return null;
}

function parseVehiclesFromHTML(html) {
  const vehicles = [];
  
  const articleRegex = /<article[^>]*data-testid="search-result-entry-header-[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let articleMatch;
  
  while ((articleMatch = articleRegex.exec(html)) !== null) {
    const articleHtml = articleMatch[0];
    
    const idMatch = articleHtml.match(/data-testid="search-result-entry-header-(\d+)"/);
    const id = idMatch ? idMatch[1] : `wh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const titleMatch = articleHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    let title = '';
    if (titleMatch) {
      title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    }
    
    const priceMatch = articleHtml.match(/€\s*([\d.,]+)/);
    const price = priceMatch ? extractPrice(priceMatch[0]) : null;
    
    const imgMatch = articleHtml.match(/<img[^>]*src="([^"]+)"[^>]*>/i);
    let imageUrl = imgMatch ? imgMatch[1] : null;
    if (imageUrl && imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }
    
    const linkMatch = articleHtml.match(/href="(\/iad\/gebrauchtwagen\/d\/[^"]+)"/);
    const willhabenUrl = linkMatch 
      ? `https://www.willhaben.at${linkMatch[1]}`
      : null;
    
    const locationMatch = articleHtml.match(/<span[^>]*>([^<]*(?:Wien|Graz|Linz|Salzburg|Innsbruck|Klagenfurt|St\.\s*Pölten|Villach|Wels|Dornbirn|Bregenz)[^<]*)<\/span>/i);
    const location = locationMatch ? locationMatch[1].trim() : 'Österreich';
    
    const yearMatch = articleHtml.match(/\b(20[0-2]\d|19\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
    
    const mileageMatch = articleHtml.match(/([\d.]+)\s*km/i);
    const mileage = mileageMatch ? parseInt(mileageMatch[1].replace(/\./g, ''), 10) : null;
    
    const fuelMatch = articleHtml.match(/\b(Benzin|Diesel|Elektro|Hybrid|CNG|LPG)\b/i);
    const fuelType = fuelMatch ? fuelMatch[1] : null;

    if (title && title.length > 3) {
      vehicles.push({
        id: `wh-${id}`,
        title,
        price,
        year,
        mileage,
        location,
        fuelType,
        imageUrl,
        willhabenUrl,
        phone: null,
      });
    }
  }

  return vehicles;
}

const FUEL_TYPE_MAP = {
  '100001': 'Benzin',
  '100002': 'Benzin/Elektro',
  '100003': 'Diesel',
  '100004': 'Elektro',
  '100005': 'Erdgas (CNG)',
  '100006': 'Ethanol',
  '100007': 'Flüssiggas (LPG)',
  '100008': 'Hybrid (Benzin/Elektro)',
  '100009': 'Hybrid (Diesel/Elektro)',
  '100010': 'Wasserstoff',
};

function parseVehiclesFromJSON(html) {
  const vehicles = [];
  
  try {
    const scriptMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (scriptMatch) {
      const jsonData = JSON.parse(scriptMatch[1]);
      const searchResult = jsonData?.props?.pageProps?.searchResult;
      
      if (searchResult?.advertSummaryList?.advertSummary) {
        for (const ad of searchResult.advertSummaryList.advertSummary) {
          const attrs = ad.attributes?.attribute || [];
          
          const getAttr = (name) => {
            const attr = attrs.find((a) => a.name === name);
            return attr?.values?.[0] || null;
          };

          const priceAttr = getAttr('PRICE/AMOUNT') || getAttr('PRICE');
          const price = priceAttr ? Math.round(parseFloat(priceAttr)) : null;
          
          const yearAttr = getAttr('YEAR_MODEL') || getAttr('YEAR');
          const year = yearAttr ? parseInt(yearAttr, 10) : null;
          
          const mileageAttr = getAttr('MILEAGE');
          const mileage = mileageAttr ? parseInt(mileageAttr, 10) : null;
          
          const location = getAttr('LOCATION') || getAttr('DISTRICT') || getAttr('CITY') || getAttr('COUNTRY') || 'Österreich';
          
          const fuelCode = getAttr('ENGINE/FUEL');
          const fuelType = fuelCode ? (FUEL_TYPE_MAP[fuelCode] || fuelCode) : null;
          
          const mmoAttr = getAttr('MMO');
          let imageUrl = null;
          if (mmoAttr) {
            imageUrl = `https://cache.willhaben.at/mmo/${mmoAttr}`;
          }
          
          const seoUrl = getAttr('SEO_URL');
          const willhabenUrl = seoUrl 
            ? `https://www.willhaben.at/iad/${seoUrl}`
            : `https://www.willhaben.at/iad/gebrauchtwagen/d/auto/${ad.id}`;

          vehicles.push({
            id: `wh-${ad.id}`,
            title: ad.description || getAttr('HEADING') || 'Unknown Vehicle',
            price,
            year,
            mileage,
            location,
            fuelType,
            imageUrl,
            willhabenUrl,
            phone: null,
          });
        }
      }
    }
  } catch (e) {
    console.log('JSON parsing failed:', e.message);
  }

  return vehicles;
}

async function scrapeWillhaben() {
  const url = 'https://www.willhaben.at/iad/gebrauchtwagen/auto/gebrauchtwagenboerse';
  
  try {
    const html = await fetchPage(url);
    
    let vehicles = parseVehiclesFromJSON(html);
    
    if (vehicles.length === 0) {
      vehicles = parseVehiclesFromHTML(html);
    }
    
    return vehicles;
  } catch (error) {
    console.error('Scraping error:', error.message);
    return [];
  }
}

module.exports = { scrapeWillhaben };
