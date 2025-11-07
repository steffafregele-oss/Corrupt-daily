// 1️⃣ Importuri
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const fetch = require("node-fetch");
const puppeteer = require("puppeteer-core");
require("dotenv").config();
const express = require("express");

// 2️⃣ Server Express keep-alive
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is alive ✅"));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// 3️⃣ Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// 4️⃣ Variables din Render
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID;
const SITE_URL = process.env.SITE_URL; // ex: https://www.logged.tg/auth/corrupteds
const INJURIES_API = process.env.INJURIES_API; // ex: https://api.injuries.lu/v2/daily?type=0x2&cs=3&ref=corrupteds
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 30000;
const DISCORD_EMAIL = process.env.DISCORD_EMAIL;
const DISCORD_PASSWORD = process.env.DISCORD_PASSWORD;

let lastHitId = null;

// 5️⃣ Funcții utile
function formatNumber(num) {
  try { return num.toLocaleString(); } catch { return "0"; }
}

// 6️⃣ Fetch latest hit de pe site folosind Puppeteer
async function getLatestHit() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    executablePath: process.env.CHROMIUM_PATH // folosește Chromium-ul deja instalat pe Render
  });

  const page = await browser.newPage();
  try {
    await page.goto("https://www.logged.tg/auth/discord", { waitUntil: "networkidle2" });
    await page.type('input[name="email"]', DISCORD_EMAIL, { delay: 50 });
    await page.type('input[name="password"]', DISCORD_PASSWORD, { delay: 50 });
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    await page.goto(SITE_URL, { waitUntil: "networkidle2" });

    const data = await page.evaluate(() => {
      try {
        return JSON.parse(document.querySelector("pre").innerText);
      } catch {
        return null;
      }
    });

    await browser.close();
    return data;
  } catch (err) {
    await browser.close();
    console.error("Error fetching site:", err);
    return null;
  }
}

// 7️⃣ Fetch stats user
async function getUserStats(userId) {
  try {
    const res = await fetch(`${INJURIES_API}&userId=${userId}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error fetching stats:", err);
    return null;
  }
}

// 8️⃣ Trimitere embed Discord
async function sendHitEmbed(hit) {
  const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID);
  if (!channel) return;

  const stats = await getUserStats(hit.userId);
  const profile = stats?.Profile || {};

  const embed = new EmbedBuilder()
    .setColor(0x000000)
    .setTitle(`<a:blackverified:1435093657010176071> LIVE HIT!`)
    .setDescription(
      `**User:** ${profile.userName || hit.username}\n` +
      `**Robux:** ${hit.robux || 0}\n` +
      `**Summary:** ${hit.summary || 0}`
    )
    .setThumbnail(profile.avatarUrl || "")
    .setFooter({ text: "Live Hits Monitor" });

  await channel.send({ embeds: [embed] });
}

// 9️⃣ Polling loop
async function pollSite() {
  try {
    const data = await getLatestHit();
    if (!data || !data.latestHit) return;

    const hit = data.latestHit;
    if (hit.id !== lastHitId) {
      lastHitId = hit.id;
      console.log(`New hit detected: ${hit.username}`);
      await sendHitEmbed(hit);
    }
  } catch (err) {
    console.error("Polling error:", err);
  }
}

// 🔟 Discord ready
client.once("ready", () => {
  console.log(`✅ Bot ready as ${client.user.tag}`);
  setInterval(pollSite, POLL_INTERVAL_MS);
});

// 1️⃣1️⃣ Error handler
client.on("error", (error) => console.error("Discord client error:", error));

// 1️⃣2️⃣ Login bot
if (!TOKEN) {
  console.error("❌ DISCORD_BOT_TOKEN is not set!");
  process.exit(1);
}
client.login(TOKEN);
