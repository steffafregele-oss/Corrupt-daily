const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
const express = require('express');

// Keep-alive server
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is alive ✅"));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// Environment variables
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID;
const SITE_URL = process.env.SITE_URL; // ex: site-ul tău
const INJURIES_API = process.env.INJURIES_API; // ex: https://api.injuries.lu/v2/daily?type=0x2&cs=3&ref=corrupteds
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 30000; // 30 sec default

// Ultimul hit procesat
let lastHitId = null;

// Funcție utilă
function formatNumber(num) {
  try { return num.toLocaleString(); } catch { return "0"; }
}

// Monitor site-ul la interval
async function pollSite() {
  try {
    const res = await fetch(SITE_URL);
    const data = await res.json();

    // presupunem că site-ul returnează un array de hits sau obiect cu id
    const latestHit = data.latestHit; // trebuie să fie prezent în JSON-ul site-ului

    if (!latestHit) return;

    if (latestHit.id !== lastHitId) {
      lastHitId = latestHit.id;

      const username = latestHit.username; // username-ul userului care a dat hit

      // Request la API-ul injuries.lu pentru user
      const apiRes = await fetch(`${INJURIES_API}&userId=${latestHit.userId}`);
      const apiData = await apiRes.json();

      let robux = 0, summary = 0;
      if (apiData && apiData.success) {
        const daily = apiData.Daily || {};
        robux = daily.Highest?.Balance || 0;
        summary = daily.Highest?.Summary || 0;
      }

      // Embed pe Discord
      const channel = client.channels.cache.get(ANNOUNCE_CHANNEL_ID);
      if (channel) {
        const embed = new EmbedBuilder()
          .setColor(0xFFFF00)
          .setTitle("<a:Black_hear:1435093893061541920> HIT ALERT")
          .setDescription(`<a:blackverified:1435093657010176071> User **${username}** has just hit this account!\n\nRobux: ${robux}\nSummary: ${summary}`)
          .setImage("https://cdn.discordapp.com/attachments/1436416072252260362/1436418034352001124/standard-3.gif")
          .setFooter({ text: "Live Hits Bot", iconURL: "https://cdn.discordapp.com/emojis/1435132470742749266.png" });

        channel.send({ embeds: [embed] });
      }
    }

  } catch (err) {
    console.error("Error polling site:", err);
  }
}

// Start polling
setInterval(pollSite, POLL_INTERVAL_MS);

// Discord ready
client.once('ready', () => {
  console.log(`✅ Bot ready as ${client.user.tag}`);
});

// Login
if (!TOKEN) {
  console.error("❌ DISCORD_BOT_TOKEN is not set!");
  process.exit(1);
}
client.login(TOKEN);
