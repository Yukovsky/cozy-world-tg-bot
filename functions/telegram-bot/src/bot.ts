import type { BotConfig } from "./config.ts";
import { formatError } from "./lib/errors.ts";
import { TelegramClient } from "./lib/telegram.ts";
import { createSupabase } from "./db/client.ts";
import { MessagesRepository } from "./db/messages.ts";
import { SessionsRepository } from "./db/sessions.ts";
import { handleCommand } from "./handlers/commands.ts";
import { handleCallback } from "./handlers/callbacks.ts";
import { handleText } from "./handlers/text.ts";
import { sendMainMenu } from "./handlers/shared.ts";
import type { TelegramUpdate } from "./types.ts";

export async function processUpdate(config: BotConfig, update: TelegramUpdate): Promise<void> {
  const telegram = new TelegramClient(config.telegramBotToken);
  const supabase = createSupabase(config);
  const messagesRepo = new MessagesRepository(supabase, config.messagesTable);
  const sessionsRepo = new SessionsRepository(supabase, config.sessionsTable);

  const ctx = {
    config,
    telegram,
    messagesRepo,
    sessionsRepo,
  };

  const message = update.message;
  const callback = update.callback_query;

  try {
    if (callback) {
      const handled = await handleCallback(ctx, callback);
      if (!handled && callback.message) {
        await telegram.sendMessage({
          chatId: callback.message.chat.id,
          text: "Неизвестное действие. Используйте /menu.",
        });
      }
      return;
    }

    if (!message) return;

    const commandHandled = await handleCommand(ctx, message);
    if (commandHandled) return;

    const textHandled = await handleText(ctx, message);
    if (textHandled) return;
  } catch (error) {
    const detail = formatError(error);
    console.error("telegram-bot runtime error:", detail);

    const chatId = callback?.message?.chat.id ?? message?.chat.id;
    if (chatId) {
      try {
        await telegram.sendMessage({
          chatId,
          text: `⚠️ Ошибка: ${detail}`,
        });
        await sendMainMenu(ctx, chatId);
      } catch (sendErr) {
        console.error("Failed to send error message:", formatError(sendErr));
      }
    }
  }
}
