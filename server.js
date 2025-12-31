// ================== STABILITY / DNS ==================
const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");

process.on("unhandledRejection", (e) =>
  console.error("unhandledRejection:", e)
);
process.on("uncaughtException", (e) =>
  console.error("uncaughtException:", e)
);

// ================== HTTP (RENDER KEEP-ALIVE) ==================
const http = require("http");
const PORT = process.env.PORT || 10000;

http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  })
  .listen(PORT, () => console.log("HTTP port open on", PORT));

// ================== DISCORD ==================
const {
  Client,
  GatewayIntentBits,
  ActivityType
} = require("discord.js");

// ================== ENV VARS ==================
const token = process.env.TOKEN;
const eclipseRoleId = process.env.ECLIPSE_ROLE_ID;
const picPermsRoleId = process.env.PICPERMS_ROLE_ID;
const guildId = process.env.GUILD_ID || null;

console.log("ENV CHECK:", {
  tokenLength: token ? token.length : 0,
  hasECLIPSE_ROLE_ID: !!eclipseRoleId,
  hasPICPERMS_ROLE_ID: !!picPermsRoleId,
  hasGUILD_ID: !!guildId
});

// ================== CLIENT ==================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// ================== GATEWAY EVENTS ==================
client.on("warn", (m) => console.log("WARN:", m));
client.on("error", (e) => console.error("ERROR:", e));
client.on("shardError", (e) => console.error("SHARD ERROR:", e));

client.on("shardDisconnect", (event) => {
  console.log("DISCONNECTED:", event?.code, event?.reason);
  setTimeout(() => process.exit(1), 2000); // force restart
});

client.on("shardReconnecting", () =>
  console.log("Reconnecting to Discord...")
);

client.on("shardResume", () =>
  console.log("Shard resumed")
);

client.on("invalidated", () => {
  console.log("Session invalidated → restarting");
  process.exit(1);
});

// ================== WATCHDOG ==================
let lastReadyAt = Date.now();

client.once("ready", () => {
  lastReadyAt = Date.now();
  console.log(`✅ Bot logged in as ${client.user.tag}`);
});

client.on("shardResume", () => {
  lastReadyAt = Date.now();
});

// Restart if stuck offline for >2 minutes
setInterval(() => {
  const ready = client.isReady?.() === true;
  const age = Date.now() - lastReadyAt;

  if (!ready && age > 2 * 60 * 1000) {
    console.log("WATCHDOG: bot offline >2m → restarting");
    process.exit(1);
  }
}, 30000);

// ================== ROLE LOGIC ==================
async function applyPicPerms(member, presence) {
  const hasEclipse = member.roles.cache.has(eclipseRoleId);

  const customStatus = presence?.activities?.find(
    (a) => a.type === ActivityType.Custom
  );
  const hasTrigger = customStatus?.state?.includes("/eclipseK");

  const hasPicPerms = member.roles.cache.has(picPermsRoleId);

  if (hasEclipse && hasTrigger) {
    if (!hasPicPerms) {
      await member.roles.add(picPermsRoleId);
      console.log("Added pic perms to", member.user.tag);
    }
  } else {
    if (hasPicPerms) {
      await member.roles.remove(picPermsRoleId);
      console.log("Removed pic perms from", member.user.tag);
    }
  }
}

client.on("presenceUpdate", async (_, newPresence) => {
  try {
    if (!newPresence?.member) return;
    if (guildId && newPresence.guild?.id !== guildId) return;

    await applyPicPerms(newPresence.member, newPresence);
  } catch (e) {
    console.error("presenceUpdate error:", e);
  }
});

// ================== LOGIN ==================
console.log("Trying Discord login...");
client
  .login(token)
  .then(() => console.log("Discord login OK"))
  .catch((err) => {
    console.error("Discord login FAILED:", err);
    process.exit(1);
  });
