import type { TelegramMessage } from "../types.ts";
import type { HandlerContext } from "./context.ts";
import { sendMainMenu } from "./shared.ts";
import {
  dailyInputKeyboard,
  categoryInputKeyboard,
  formatMessageSummary,
  editInputKeyboard,
} from "../lib/keyboards.ts";

export async function handleText(ctx: HandlerContext, message: TelegramMessage): Promise<boolean> {
  const text = message.text?.trim();
  if (!text) return false;

  const chatId = message.chat.id;
  const session = await ctx.sessionsRepo.get(chatId);

  // ── Daily flow: content input ──────────────────────
  if (session.step === "daily_input" && session.flow === "daily") {
    if (text.length > 4000) {
      await ctx.telegram.sendMessage({ chatId, text: "Текст слишком длинный (макс. 4000 символов)." });
      return true;
    }

    await ctx.sessionsRepo.set(chatId, { ...session, pendingContent: text });

    await ctx.telegram.sendMessage({
      chatId,
      text: formatMessageSummary({
        date: session.selectedDate,
        type: session.selectedType,
        content: text,
      }),
      replyMarkup: dailyInputKeyboard(true),
    });
    return true;
  }

  // ── Category flow: new category name (from empty state OR typed on pick screen) ──
  if ((session.step === "category_new" || session.step === "category_pick") && session.flow === "category") {
    if (text.length > 100) {
      await ctx.telegram.sendMessage({ chatId, text: "Название категории слишком длинное (макс. 100)." });
      return true;
    }

    await ctx.sessionsRepo.set(chatId, {
      ...session, step: "category_input", selectedCategory: text,
    });

    await ctx.telegram.sendMessage({
      chatId,
      text: formatMessageSummary({ category: text, type: session.selectedType, content: session.pendingContent }),
      replyMarkup: categoryInputKeyboard(!!session.pendingContent),
    });
    return true;
  }

  // ── Category flow: content input ───────────────────
  if (session.step === "category_input" && session.flow === "category") {
    if (text.length > 4000) {
      await ctx.telegram.sendMessage({ chatId, text: "Текст слишком длинный (макс. 4000 символов)." });
      return true;
    }

    await ctx.sessionsRepo.set(chatId, { ...session, pendingContent: text });

    await ctx.telegram.sendMessage({
      chatId,
      text: formatMessageSummary({
        category: session.selectedCategory,
        type: session.selectedType,
        content: text,
      }),
      replyMarkup: categoryInputKeyboard(true),
    });
    return true;
  }

  // ── Edit flow: new content ─────────────────────────
  if (session.step === "edit_content" && session.flow === "edit") {
    if (text.length > 4000) {
      await ctx.telegram.sendMessage({ chatId, text: "Текст слишком длинный (макс. 4000 символов)." });
      return true;
    }

    const isDaily = session.selectedDate != null;
    await ctx.sessionsRepo.set(chatId, {
      ...session, step: "edit_input", pendingContent: text,
    });

    await ctx.telegram.sendMessage({
      chatId,
      text: `Редактирование:\n\n${formatMessageSummary({
        date: session.selectedDate,
        category: session.selectedCategory,
        type: session.selectedType,
        content: text,
      })}`,
      replyMarkup: editInputKeyboard(isDaily),
    });
    return true;
  }

  // ── No active input expected ───────────────────────
  if (session.step === "idle") {
    await ctx.telegram.sendMessage({
      chatId,
      text: "Используйте кнопки или отправьте /menu для начала.",
    });
    await sendMainMenu(ctx, chatId);
    return true;
  }

  return false;
}
