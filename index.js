// 1️⃣ Importuri
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const express = require('express');

// 2️⃣ Server Express pentru keep-alive
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is alive ✅"));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// 3️⃣ Creezi clientul Discord
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ] 
});

// 4️⃣ Environment Variables
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const ANNOUNCE_CHANNEL = process.env.ANNOUNCE_CHANNEL_ID;
const SITE_URL = process.env.SITE_URL;
const SITE_USERNAME = process.env.SITE_USERNAME;
const SITE_PASSWORD = process.env.SITE_PASSWORD;
const INJURIES_API = process.env.INJURIES_API;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS) || 30000;

// 5️⃣ Funcții utile
function formatNumber(num) {
  try { return num.toLocaleString(); } catch { return "0"; }
}

let lastHitId = null;

// 6️⃣ Funcție monitorizare site și embed live
async function monitorSite() {
  const channel = client.channels.cache.get(ANNOUNCE_CHANNEL);
  if (!channel) return console.log("❌ Announce channel not found");

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // login
  await page.goto(SITE_URL, { waitUntil: 'networkidle2' });
  await page.type('#username', SITE_USERNAME);
  await page.type('#password', SITE_PASSWORD);
  await page.click('#login-button');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  console.log("✅ Logged in to site, starting monitoring...");

  while (true) {
    try {
      await page.reload({ waitUntil: 'networkidle2' });

      // Extrage info despre ultima hit
      const hits = await page.evaluate(() => {
        // Modifică selectorul conform site-ului tău
        const row = document.querySelector('.last-hit-row');
        if (!row) return null;
        return {
          hitId: row.getAttribute('data-hit-id'),
          username: row.querySelector('.username').innerText,
          robux: row.querySelector('.robux').innerText,
          summary: row.querySelector('.summary').innerText
        };
      });

      if (hits && hits.hitId !== lastHitId) {
        lastHitId = hits.hitId;

        // Ia stats user de la API
        const res = await fetch(`${INJURIES_API}&username=${hits.username}`);
        const stats = await res.json();

        const embed = new EmbedBuilder()
          .setColor(0xFFFF00)
          .setTitle(`💥 Hit now!`)
          .setDescription(`**User:** ${hits.username}\n**Robux:** ${hits.robux}\n**Summary:** ${hits.summary}`)
          .addFields(
            { name: 'API Stats', value: `Hits: ${stats.Hits || 0}\nVisits: ${stats.Visits || 0}\nClicks: ${stats.Clicks || 0}`, inline: true }
          )
          .setFooter({ text: 'Live Hit Monitor' });

        await channel.send({ embeds: [embed] });
      }

    } catch (err) {
      console.error("Error monitoring site:", err);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

// 7️⃣ Eveniment ready
client.once('ready', () => {
  console.log(`✅ Bot ready as ${client.user.tag}`);
  monitorSite();
});

// 8️⃣ Verificare token
if (!TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN is not set!');
  process.exit(1);
}

// 9️⃣ Login bot
client.login(TOKEN);
