const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");

process.env.NODE_OPTIONS = "--dns-result-order=ipv4first";

const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");

process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));

const { Client, GatewayIntentBits, ActivityType } = require("discord.js");

// ENV VARS (set these in Render -> Environment)
const token = process.env.TOKEN;
const eclipseRoleId = process.env.ECLIPSE_ROLE_ID;
const picPermsRoleId = process.env.PICPERMS_ROLE_ID;

// Optional: if you want to restrict to one server only (recommended)
const guildId = process.env.GUILD_ID; // optional

console.log("ENV CHECK:", {
  tokenLength: token ? token.length : 0,
  hasECLIPSE_ROLE_ID: !!eclipseRoleId,
  hasPICPERMS_ROLE_ID: !!picPermsRoleId,
  hasGUILD_ID: !!guildId
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// extra logs
client.on("warn", (m) => console.log("WARN:", m));
client.on("error", (e) => console.error("ERROR:", e));
client.on("shardError", (e) => console.error("SHARD ERROR:", e));
client.on("shardDisconnect", (event) =>
  console.log("DISCONNECT:", event?.code, event?.reason)
);
client.on("shardReconnecting", () => console.log("RECONNECTING..."));

async function applyPicPerms(member, presence) {
  // must have eclipse role
  const hasEclipse = member.roles.cache.has(eclipseRoleId);

  // read custom status
  const customStatus = presence?.activities?.find((a) => a.type === ActivityType.Custom);
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

    // optional: only act in one guild
    if (guildId && newPresence.guild?.id !== guildId) return;

    await applyPicPerms(newPresence.member, newPresence);
  } catch (err) {
    console.error("presenceUpdate error:", err);
  }
});

// OPTIONAL startup scan: fixes roles after restarts (recommended)
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  try {
    const guildsToScan = guildId
      ? [client.guilds.cache.get(guildId)].filter(Boolean)
      : Array.from(client.guilds.cache.values());

    for (const g of guildsToScan) {
      console.log("Startup scan guild:", g.name, g.id);

      // fetch members so roles/presences are available
      const members = await g.members.fetch();

      for (const member of members.values()) {
        const presence = member.presence; // might be undefined if offline/invisible
        await applyPicPerms(member, presence);
      }
    }

    console.log("Startup scan done.");
  } catch (err) {
    console.error("Startup scan error:", err);
  }
});

console.log("Trying Discord login...");
setTimeout(() => {
  console.log("Still not logged in after 15s (gateway hang/blocked).");
}, 15000);

client.login(token)
  .then(() => console.log("Discord login OK"))
  .catch((err) => console.error("Discord login FAILED:", err));
// Render Web Service needs an open port or it will keep scanning forever
const http = require("http");
const PORT = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ok");
}).listen(PORT, () => console.log("HTTP port open on", PORT));


