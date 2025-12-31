const express = require("express");
const {
  InteractionType,
  InteractionResponseType,
  verifyKeyMiddleware
} = require("discord-interactions");

const { Client, GatewayIntentBits } = require("discord.js");

// ✅ put these in config.json
const {
  publicKey,
  token,
  eclipseRoleId,
  picPermsRoleId
} = require("./config.json");

const app = express();

// Discord requires raw body for signature verification
app.use(express.raw({ type: "application/json" }));

// --- Webhook endpoint for slash command interactions (your current system) ---
app.post("/interactions", verifyKeyMiddleware(publicKey), (req, res) => {
  const interaction = req.body;

  // Required: respond to Discord's ping
  if (interaction.type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  // Handle /rules command
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    if (interaction.data.name === "rules") {
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [
            {
              title: "Server Rules",
              description: [
                "**Keep it simple. Don’t be weird, don’t ruin the server.**",
                "",
                "• Don’t harass, threaten, or target people. Arguing is fine.",
                "• Swearing is allowed. Hate speech and slurs aren’t.",
                "• Nothing illegal.",
                "• No NSFW images or videos (text is okay).",
                "• No spamming or flooding chat.",
                "• Don’t leak or share private info.",
                "• Use the right channels and respect staff decisions.",
                "",
                "**Discord rules still apply:**",
                "https://discord.com/terms",
                "https://discord.com/guidelines"
              ].join("\n"),
              color: 0x2f3136
            }
          ]
        }
      });
    }
  }

  return res.status(400).send("Unhandled interaction");
});

// --- REAL BOT CLIENT (needed for custom status → role) ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// When someone changes status / activity
client.on("presenceUpdate", async (oldPresence, newPresence) => {
  try {
    if (!newPresence?.member) return;

    const member = newPresence.member;

    // Must have /eclipse role
    const hasEclipse = member.roles.cache.has(eclipseRoleId);

    // Read custom status
    const customStatus = newPresence.activities?.find(a => a.type === 4); // CUSTOM_STATUS
    const hasTrigger = customStatus?.state?.includes("/eclipseK");

    const hasPicPerms = member.roles.cache.has(picPermsRoleId);

    if (hasEclipse && hasTrigger) {
      if (!hasPicPerms) await member.roles.add(picPermsRoleId);
    } else {
      if (hasPicPerms) await member.roles.remove(picPermsRoleId);
    }
  } catch (err) {
    console.log("presenceUpdate error:", err);
  }
});

client.once("ready", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

// ✅ Login the bot
client.login(token);
