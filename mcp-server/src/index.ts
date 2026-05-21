import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { verifyLinkCode, resolveUser } from "./gembala-api";
import { processMessage } from "./agent";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const bot = new TelegramBot(TOKEN, { polling: true });

// Per-user conversation history (in-memory; production would use Redis)
const conversationHistory: Map<string, Array<{ role: "user" | "assistant"; content: string }>> =
  new Map();

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Welcome to Gembala! Use /link <code> to connect your account, then ask me anything about your group."
  );
});

bot.onText(/\/link (.+)/, async (msg, match) => {
  const code = match?.[1]?.trim();
  if (!code) {
    bot.sendMessage(msg.chat.id, "Usage: /link <code>");
    return;
  }

  const telegramId = String(msg.from!.id);
  const { ok, data } = await verifyLinkCode(code, telegramId);

  if (ok) {
    bot.sendMessage(
      msg.chat.id,
      "Your Telegram account is now linked to Gembala! You can now ask me about your members and attendance."
    );
  } else {
    bot.sendMessage(msg.chat.id, `Failed to link: ${(data as { error?: string })?.error || "Unknown error"}`);
  }
});

bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const telegramId = String(msg.from!.id);
  const chatId = msg.chat.id;

  const user = await resolveUser(telegramId);
  if (!user) {
    bot.sendMessage(
      chatId,
      "Your Telegram account is not linked. Generate a code in the Gembala web app under Settings → Integrations, then send /link <code>."
    );
    return;
  }

  // Get or init conversation history (reset if older than 30 min)
  const history = conversationHistory.get(telegramId) || [];

  bot.sendChatAction(chatId, "typing");

  try {
    const reply = await processMessage(msg.text, {
      userId: user.id,
      churchId: user.churchId,
      conversationHistory: history,
    });

    // Update history (keep last 10 turns)
    history.push({ role: "user", content: msg.text });
    history.push({ role: "assistant", content: reply });
    if (history.length > 20) history.splice(0, 2);
    conversationHistory.set(telegramId, history);

    bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Agent error:", err);
    bot.sendMessage(chatId, "Sorry, something went wrong. Please try again.");
  }
});

console.log("Gembala MCP bot running…");
