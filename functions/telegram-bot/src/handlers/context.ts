import type { BotConfig } from "../config.ts";
import type { MessagesRepository } from "../db/messages.ts";
import type { SessionsRepository } from "../db/sessions.ts";
import type { TelegramClient } from "../lib/telegram.ts";

export type HandlerContext = {
  config: BotConfig;
  telegram: TelegramClient;
  messagesRepo: MessagesRepository;
  sessionsRepo: SessionsRepository;
};
