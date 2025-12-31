const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));

const http = require("http");
const { Client, GatewayIntentBits, ActivityType } = require("discord.js");

// ENV VARS
const token = process.env.TOKEN;
const eclipseRoleId = process.env.ECLIPSE_ROLE_ID;
const picPermsRoleId = process.env.PICPERMS_ROLE_ID;
const guildId = process.env.GUILD_ID || null; // optional

console.log("ENV CHECK:", {
  tokenLength: token ? token.length : 0,
  hasECLIPSE_ROLE_ID: !!eclipseRoleId,
  hasPICPERMS_ROLE_ID: !!picPermsRoleId,
  hasGUILD_ID: !!guildId
});

// ---- Render needs an open port (keep-alive HTTP)
const PORT = process.env.PORT || 10000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  })
  .listen(PORT, () => console.log("HTTP port open on", PORT));

// ---- Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// Logs that matter
client.on("warn", (m) => console.log("WARN:", m));
client.on("error", (e) => console.error("ERROR:", e));
client.on("shardError", (e) => console.error("SHARD ERROR:", e));
client.on("shardDisconnect", (event) =>
  console.log("DISCONNECT:", event?.code, event?.reason)
);
client.on("shardReconnecting", () => console.log("RECONNECTING..."));

async function applyPicPerms(member, presence) {
  const hasEclipse = member.roles.cache.has(eclipseRoleId);

  const customStatus = presence?.activities?.find(
    (a) => a.type === ActivityType.Custom
  );
  const hasTrigger = customStatus?.state?.includes("/eclipseK");

  const hasPicPerms = member.roles.cache.has(picPermsRoleId);

  if (hasEclipse && hasTrigger) {
    if (!hasPicPerms) await member.roles.add(picPermsRoleId);
  } else {
    if (hasPicPerms) await member.roles.remove(picPermsRoleId);
  }
}

client.on("presenceUpdate", async (oldPresence, newPresence) => {
  try {
    if (!newPresence?.member) return;
    if (guildId && newPresence.guild?.id !== guildId) return;
    await applyPicPerms(newPresence.member, newPresence);
  } catch (err) {
    console.error("presenceUpdate error:", err);
  }
});

client.once("ready", () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
});

// ---- Login with watchdog (if it hangs, restart process)
console.log("Trying Discord login...");

const watchdog = setTimeout(() => {
  console.log("❌ Discord login hung >20s. Exiting so Render restarts the instance...");
  process.exit(1);
}, 20000);

client
  .login(token)
  .then(() => {
    clearTimeout(watchdog);
    console.log("Discord login OK");
  })
  .catch((err) => {
    clearTimeout(watchdog);
    console.error("Discord login FAILED:", err);
    process.exit(1);
  });

