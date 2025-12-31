const express = require("express");
const {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware
} = require("discord-interactions");

const { Client, GatewayIntentBits } = require("discord.js");

/* ===============================
   EXTRA DEBUG (SHOW REAL ERRORS)
================================ */
process.on("unhandledRejection", (e) =>
  console.error("unhandledRejection:", e)
);
process.on("uncaughtException", (e) =>
  console.error("uncaughtException:", e)
);

/* ===============================
   ENV VARIABLES (Render)
================================ */
const publicKey = process.env.PUBLIC_KEY;
const token = process.env.TOKEN;
const eclipseRoleId = process.env.ECLIPSE_ROLE_ID;
const picPermsRoleId = process.env.PICPERMS_ROLE_ID;

/* DEBUG ENV CHECK */
console.log("ENV CHECK:", {
  hasPUBLIC_KEY: !!publicKey,
  tokenLength: token ? token.length : 0,
  hasECLIPSE_ROLE_ID: !!eclipseRoleId,
  hasPICPERMS_ROLE_ID: !!picPermsRoleId
});

const app = express();

/* Discord requires raw body */
app.use(express.raw({ type: "application/json" }));

/* ===============================
   INTERACTIONS ENDPOINT
================================ */
app.post("/interactions", verifyKeyMiddleware(publicKey), (req, res) => {
  const interaction = req.body;

  if (interaction.type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  if (
    interaction.type === InteractionType.APPLICATION_COMMAND &&
    interaction.data.name === "rules"
  ) {
    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [
          {
            title: "Server Rules",
            description: [
              "**Keep it simple. Don’t be weird, don’t ruin the server.**",
              "",
              "• Don’t harass, threaten, or target people.",
              "• No hate speech or slurs.",
              "• Nothing illegal.",
              "• No NSFW images or videos.",
              "• No spamming.",
              "",
              "Discord rules apply:",
              "https://discord.com/terms",
              "https://discord.com/guidelines"
            ].join("\n"),
            color: 0x2f3136
          }
        ]
      }
    });
  }

  return res.status(400).send("Unhandled interaction");
});

/* ===============================
   DISCORD BOT CLIENT
================================ */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

/* Gateway / shard debug */
client.on("error", (e) => console.error("client error:", e));
client.on("warn", (m) => console.log("client warn:", m));
client.on("shardError", (e) => console.error("shardError:", e));
client.on("shardDisconnect", (event) =>
  console.log("shardDisconnect:", event?.code, event?.reason)
);
client.on("shardReconnecting", () => console.log("shardReconnecting..."));

/* Presence → role logic */
client.on("presenceUpdate", async (oldPresence, newPresence) => {
  try {
    if (!newPresence?.member) return;

    const member = newPresence.member;
    const hasEclipse = member.roles.cache.has(eclipseRoleId);

    const customStatus = newPresence.activities?.find(
      (a) => a.type === 4 // CUSTOM_STATUS
    );

    const hasTrigger = customStatus?.state?.includes("/eclipseK");
    const hasPicPerms = member.roles.cache.has(picPermsRoleId);

    if (hasEclipse && hasTrigger) {
      if (!hasPicPerms) await member.roles.add(picPermsRoleId);
    } else {
      if (hasPicPerms) await member.roles.remove(picPermsRoleId);
    }
  } catch (err) {
    console.error("presenceUpdate error:", err);
  }
});

client.once("ready", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

/* ===============================
   LOGIN BOT (WITH DEBUG)
================================ */
console.log("Trying Discord login...");

setTimeout(() => {
  console.log(
    "Still not logged in after 10s. This usually means the Discord gateway connection is hanging/blocked."
  );
}, 10000);

client
  .login(token)
  .then(() => console.log("Discord login OK"))
  .catch((err) => console.error("Discord login FAILED:", err));

