import { ProxyAgent, fetch } from "undici";

const proxyUrl = `http://${process.env.IPROYAL_USER}:${process.env.IPROYAL_PASS}@${process.env.IPROYAL_HOST}:${process.env.IPROYAL_PORT}`;

const iproyalAgent = new ProxyAgent(proxyUrl);

export async function fetchPageIPRoyal(url:any) {
  const res = await fetch(url, {
    dispatcher: iproyalAgent,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
    },
  });

  if (!res.ok) {
    throw new Error(`IPRoyal status ${res.status}`);
  }

  return await res.text();
}
