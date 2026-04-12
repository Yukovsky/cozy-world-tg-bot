import { mainMenuKeyboard } from "../lib/keyboards.ts";
import type { HandlerContext } from "./context.ts";

export async function sendMainMenu(ctx: HandlerContext, chatId: number): Promise<void> {
  await ctx.telegram.sendMessage({
    chatId,
    text: "Выберите действие:",
    replyMarkup: mainMenuKeyboard(),
  });
}
