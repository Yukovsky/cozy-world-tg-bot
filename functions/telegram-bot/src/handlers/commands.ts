import type { TelegramMessage } from "../types.ts";
import type { HandlerContext } from "./context.ts";
import { sendMainMenu } from "./shared.ts";

export async function handleCommand(ctx: HandlerContext, message: TelegramMessage): Promise<boolean> {
  const text = message.text?.trim() ?? "";
  const chatId = message.chat.id;

  if (!text.startsWith("/")) return false;

  const rawCommand = text.split(/\s+/, 1)[0];
  const command = rawCommand.split("@", 1)[0];

  if (command === "/start" || command === "/menu" || command === "/help") {
    try {
      await ctx.sessionsRepo.reset(chatId);
    } catch {
      // Session table might not exist yet — still show menu
    }
    await sendMainMenu(ctx, chatId);
    return true;
  }

  // Unknown command — show menu
  await ctx.telegram.sendMessage({
    chatId,
    text: "Неизвестная команда. Используйте кнопки ниже.",
  });
  await sendMainMenu(ctx, chatId);
  return true;
}
