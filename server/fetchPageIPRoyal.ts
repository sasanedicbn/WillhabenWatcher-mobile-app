import "dotenv/config";
import { ProxyAgent, fetch } from "undici";

export async function fetchPageIPRoyal(url: string) {
  const proxyUrl = `http://${process.env.IPROYAL_USER}:${process.env.IPROYAL_PASS}@${process.env.IPROYAL_HOST}:${process.env.IPROYAL_PORT}`;

  if (proxyUrl.includes("undefined")) {
    throw new Error("IPRoyal ENV variables are missing");
  }


  const agent = new ProxyAgent(proxyUrl);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      dispatcher: agent,
      signal: controller.signal,
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
  } finally {
    clearTimeout(t);
  }
}
