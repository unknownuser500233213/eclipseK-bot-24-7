// ---------- DNS / stability tweaks ----------
const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));

const http = require("http");
const { Client, GatewayIntentBits, ActivityType } = require("discord.js");

// ---------- ENV VARS ----------
const token = process.env.TOKEN;
const eclipseRoleId = process.env.ECLIPSE_ROLE_ID;
const picPermsRoleId = process.env.PICPERMS_ROLE_ID;
const guildId = process.env.GUILD_ID || null; // optional but recommended

console.log("ENV CHECK:", {
  tokenLength: token ? token.length : 0,
  hasECLIPSE_ROLE_ID: !!eclipseRoleId,
  hasPICPERMS_ROLE_ID: !!picPermsRoleId,
  hasGUILD_ID: !!guildId
});

// ---------- Render needs an open port ----------
const PORT = process.env.PORT || 10000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
  })
  .listen(PORT, () => console.log("HTTP port open on", PORT));

// ---------- Discord client ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// ---------- Gateway logs + recovery ----------
client.on("warn", (m) => console.log("WARN:", m));
client.on("error", (e) => console.error("ERROR:", e));
client.on("shardError", (e) => console.error("SHARD ERROR:", e));

client.on("shardDisconnect", (event) => {
  console.log("DISCONNECTED from Discord:", event?.code, event?.reason);
  // Best-effort on Render free: force restart so it reconnects cleanly
  setTimeout(() => process.exit(1), 2000);
});

client.on("shardReconnecting", () => console.log("Reconnecting to Discord..."));
client.on("shardResume", () => console.log("Shard resumed"));

client.on("invalidated", () => {
  console.log("Session invalidated, exiting to restart");
  process.exit(1);
});

// ---------- Core logic ----------
async function applyPicPerms(member, presence) {
  // Must have the eclipse role
  const hasEclipse = member.roles.cache.has(eclipseRoleId);

  // Custom status text
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

client.on("presenceUpdate", async (oldPresence, newPresence) => {
  try {
    if (!newPresence?.member) return;

    // Only operate in your server (recommended)
    if (guildId && newPresence.guild?.id !== guildId) return;

    await applyPicPerms(newPresence.member, newPresence);
  } catch (err) {
    console.error("presenceUpdate error:", err);
  }
});

// Optional: scan members on startup (can be heavy on big servers)
// Uncomment if you want it to re-apply roles after restarts.
/*
client.once("ready", async () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  try {
    const g = guildId ? await client.guilds.fetch(guildId) : null;
    if (!g) return;

    const members = await g.members.fetch();
    for (const m of members.values()) {
      await applyPicPerms(m, m.presence);
    }
    console.log("Startup scan done.");
  } catch (e) {
    console.error("Startup scan error:", e);
  }
});
*/

client.once("ready", () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
});

// ---------- Login ----------
console.log("Trying Discord login...");
client
  .login(token)
  .then(() => console.log("Discord login OK"))
  .catch((err) => {
    console.error("Discord login FAILED:", err);
    process.exit(1);
  });
