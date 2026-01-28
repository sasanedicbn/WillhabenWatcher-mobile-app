import { HttpsProxyAgent } from "https-proxy-agent";

// Testirajte prvi proxy
const proxy = "31.98.15.247:5424:winbpdqu:4slml8ycf7uu";
const [ip, port, user, pass] = proxy.split(":");
const proxyUrl = `http://${user}:${pass}@${ip}:${port}`;

const agent = new HttpsProxyAgent(proxyUrl);

fetch("https://www.willhaben.at", { agent })
  .then((res) => {
    console.log("✅ Webshare PROXY JOŠ RADI! Status:", res.status);
    if (res.status === 403 || res.status === 429) {
      console.log("❌ willhaben je BLOKIRAO proxy!");
    }
  })
  .catch((err) => {
    console.log("❌ Webshare proxy NE RADI:", err.message);
  });
