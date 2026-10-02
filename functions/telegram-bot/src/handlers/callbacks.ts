import { firstMissingDay, formatMonth, formatYyyyMmDd, isValidYyyyMmDd, nowInOffset } from "../lib/date.ts";
import {
  calendarKeyboard,
  categoryInputKeyboard,
  categoryListKeyboard,
  cleanupPreviewKeyboard,
  dailyInputKeyboard,
  deleteCategoryListKeyboard,
  deleteCategoryPickKeyboard,
  deleteConfirmKeyboard,
  deleteDailyListKeyboard,
  deleteKindKeyboard,
  editCategoryListKeyboard,
  editCategoryPickKeyboard,
  editCategoryReselect,
  editDailyListKeyboard,
  editInputKeyboard,
  editKindKeyboard,
  formatCategoryMessagesPage,
  formatCleanupSummary,
  formatDailyMessagesPage,
  formatMessagePreview,
  formatMessageSummary,
  mainMenuKeyboard,
  typeKeyboard,
} from "../lib/keyboards.ts";
import type { BotSessionState, TelegramCallbackQuery } from "../types.ts";
import type { HandlerContext } from "./context.ts";

// Helper: edit current message to show main menu (with optional success prefix)
async function editToMenu(ctx: HandlerContext, chatId: number, mid: number, prefix?: string): Promise<void> {
  const text = prefix ? `${prefix}\n\nВыберите действие:` : "Выберите действие:";
  await ctx.telegram.editMessageText({ chatId, messageId: mid, text, replyMarkup: mainMenuKeyboard() });
}

// ═══════════════════════════════════════════════════════
// Main callback router
// ═══════════════════════════════════════════════════════
export async function handleCallback(ctx: HandlerContext, callback: TelegramCallbackQuery): Promise<boolean> {
  const data = callback.data;
  const message = callback.message;
  if (!data || !message) return false;

  const chatId = message.chat.id;
  const mid = message.message_id;
  await ctx.telegram.answerCallbackQuery({ callbackQueryId: callback.id });

  if (data === "noop") return true;

  if (data === "menu:main") {
    await ctx.sessionsRepo.reset(chatId);
    await editToMenu(ctx, chatId, mid);
    return true;
  }

  if (data === "menu:daily") return handleStartDaily(ctx, chatId, mid);
  if (data === "menu:category") return handleStartCategory(ctx, chatId, mid);
  if (data === "menu:delete") return handleStartDelete(ctx, chatId, mid);
  if (data === "menu:cleanup") return handleStartCleanup(ctx, chatId, mid);
  if (data === "menu:edit") return handleStartEdit(ctx, chatId, mid);
  if (data === "menu:checkdates") return handleCheckDates(ctx, chatId, mid);

  const session = await ctx.sessionsRepo.get(chatId);

  if (data.startsWith("daily:")) return handleDailyCallback(ctx, chatId, mid, data, session);
  if (data.startsWith("cat:")) return handleCategoryCallback(ctx, chatId, mid, data, session);
  if (data.startsWith("del:")) return handleDeleteCallback(ctx, chatId, mid, data, session);
  if (data.startsWith("cl:")) return handleCleanupCallback(ctx, chatId, mid, data, session);
  if (data.startsWith("ed:")) return handleEditCallback(ctx, chatId, mid, data, session);

  return false;
}

// ═══════════════════════════════════════════════════════
// Use-case 1: Daily message
// ═══════════════════════════════════════════════════════
async function handleStartDaily(ctx: HandlerContext, chatId: number, mid: number): Promise<boolean> {
  const dates = await ctx.messagesRepo.listDailyDates();
  const todayIso = formatYyyyMmDd(nowInOffset(ctx.config.timezoneOffsetMinutes));
  const nextFree = firstMissingDay(dates, todayIso);

  await ctx.sessionsRepo.set(chatId, {
    flow: "daily", step: "daily_input",
    selectedDate: nextFree, selectedCategory: null, selectedType: "text",
    pendingContent: null, selectedMessageId: null, categoryOptions: [],
    page: 0,
  });

  await ctx.telegram.editMessageText({
    chatId, messageId: mid,
    text: formatMessageSummary({ date: nextFree, type: "text" }),
    replyMarkup: dailyInputKeyboard(false),
  });
  return true;
}

async function handleDailyCallback(
  ctx: HandlerContext, chatId: number, mid: number,
  data: string, session: BotSessionState,
): Promise<boolean> {

  if (data === "daily:pickdate") {
    const month = formatMonth(nowInOffset(ctx.config.timezoneOffsetMinutes));
    await ctx.sessionsRepo.set(chatId, { ...session, step: "daily_date_pick" });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите дату:",
      replyMarkup: calendarKeyboard(month, session.selectedDate, "daily"),
    });
    return true;
  }

  if (data.startsWith("daily:cal:")) {
    const month = data.replace("daily:cal:", "");
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите дату:",
      replyMarkup: calendarKeyboard(month, session.selectedDate, "daily"),
    });
    return true;
  }

  if (data === "daily:today") {
    const today = formatYyyyMmDd(nowInOffset(ctx.config.timezoneOffsetMinutes));
    return applyDailyDate(ctx, chatId, mid, session, today);
  }

  if (data === "daily:nextfree") {
    const dates = await ctx.messagesRepo.listDailyDates();
    const today = formatYyyyMmDd(nowInOffset(ctx.config.timezoneOffsetMinutes));
    return applyDailyDate(ctx, chatId, mid, session, firstMissingDay(dates, today));
  }

  if (data.startsWith("daily:date:")) {
    const date = data.replace("daily:date:", "");
    if (!isValidYyyyMmDd(date)) return true;
    return applyDailyDate(ctx, chatId, mid, session, date);
  }

  if (data === "daily:picktype") {
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите тип сообщения:",
      replyMarkup: typeKeyboard("daily"),
    });
    return true;
  }

  if (data.startsWith("daily:type:")) {
    const type = data.replace("daily:type:", "");
    await ctx.sessionsRepo.set(chatId, { ...session, selectedType: type });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatMessageSummary({ date: session.selectedDate, type, content: session.pendingContent }),
      replyMarkup: dailyInputKeyboard(!!session.pendingContent),
    });
    return true;
  }

  if (data === "daily:back") {
    await ctx.sessionsRepo.set(chatId, { ...session, step: "daily_input" });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatMessageSummary({
        date: session.selectedDate, type: session.selectedType, content: session.pendingContent,
      }),
      replyMarkup: dailyInputKeyboard(!!session.pendingContent),
    });
    return true;
  }

  if (data === "daily:confirm") {
    if (!session.selectedDate || !session.pendingContent) return true;

    try {
      await ctx.messagesRepo.insertMessage({
        content: session.pendingContent,
        on_day: session.selectedDate,
        category: null,
        type: session.selectedType || "text",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("уже существует")) {
        await ctx.sessionsRepo.set(chatId, { ...session, step: "daily_input" });
        await ctx.telegram.editMessageText({
          chatId, messageId: mid,
          text: `⚠️ На дату ${session.selectedDate} уже есть сообщение — выберите другую дату.\n\n${formatMessageSummary({ date: session.selectedDate, type: session.selectedType, content: session.pendingContent })}`,
          replyMarkup: dailyInputKeyboard(true),
        });
        return true;
      }
      throw err;
    }

    await ctx.sessionsRepo.reset(chatId);
    await editToMenu(ctx, chatId, mid, `✅ Ежедневное сообщение сохранено на ${session.selectedDate}.`);
    return true;
  }

  return false;
}

async function applyDailyDate(
  ctx: HandlerContext, chatId: number, mid: number,
  session: BotSessionState, date: string,
): Promise<boolean> {
  await ctx.sessionsRepo.set(chatId, { ...session, step: "daily_input" as const, selectedDate: date });
  await ctx.telegram.editMessageText({
    chatId, messageId: mid,
    text: formatMessageSummary({ date, type: session.selectedType, content: session.pendingContent }),
    replyMarkup: dailyInputKeyboard(!!session.pendingContent),
  });
  return true;
}

// ═══════════════════════════════════════════════════════
// Use-case 2: Category message
// ═══════════════════════════════════════════════════════
async function handleStartCategory(ctx: HandlerContext, chatId: number, mid: number): Promise<boolean> {
  const categories = await ctx.messagesRepo.listCategories();

  if (!categories.length) {
    await ctx.sessionsRepo.set(chatId, {
      flow: "category", step: "category_new",
      selectedDate: null, selectedCategory: null, selectedType: "text",
      pendingContent: null, selectedMessageId: null, categoryOptions: [],
      page: 0,
    });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Категорий пока нет. Введите название новой категории:",
      replyMarkup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "menu:main" }]] },
    });
  } else {
    await ctx.sessionsRepo.set(chatId, {
      flow: "category", step: "category_pick",
      selectedDate: null, selectedCategory: null, selectedType: "text",
      pendingContent: null, selectedMessageId: null, categoryOptions: categories,
      page: 0,
    });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите категорию:",
      replyMarkup: categoryListKeyboard(categories, 0),
    });
  }
  return true;
}

async function handleCategoryCallback(
  ctx: HandlerContext, chatId: number, mid: number,
  data: string, session: BotSessionState,
): Promise<boolean> {

  if (data.startsWith("cat:page:")) {
    const page = Number(data.replace("cat:page:", ""));
    const categories = session.categoryOptions?.length ? session.categoryOptions : await ctx.messagesRepo.listCategories();
    await ctx.sessionsRepo.set(chatId, { ...session, page, categoryOptions: categories });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите категорию:",
      replyMarkup: categoryListKeyboard(categories, page),
    });
    return true;
  }

  if (data.startsWith("cat:pick:")) {
    const index = Number(data.replace("cat:pick:", ""));
    const category = session.categoryOptions[index];
    if (!category) return true;

    await ctx.sessionsRepo.set(chatId, {
      ...session, step: "category_input", selectedCategory: category,
    });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatMessageSummary({ category, type: session.selectedType, content: session.pendingContent }),
      replyMarkup: categoryInputKeyboard(!!session.pendingContent),
    });
    return true;
  }

  if (data === "cat:reselect") {
    const categories = await ctx.messagesRepo.listCategories();
    const page = session.page ?? 0;
    await ctx.sessionsRepo.set(chatId, {
      ...session, step: "category_pick", categoryOptions: categories,
    });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите категорию:",
      replyMarkup: categoryListKeyboard(categories, page),
    });
    return true;
  }

  if (data === "cat:picktype") {
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите тип сообщения:",
      replyMarkup: typeKeyboard("cat"),
    });
    return true;
  }

  if (data.startsWith("cat:type:")) {
    const type = data.replace("cat:type:", "");
    await ctx.sessionsRepo.set(chatId, { ...session, selectedType: type });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatMessageSummary({ category: session.selectedCategory, type, content: session.pendingContent }),
      replyMarkup: categoryInputKeyboard(!!session.pendingContent),
    });
    return true;
  }

  if (data === "cat:back") {
    await ctx.sessionsRepo.set(chatId, { ...session, step: "category_input" });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatMessageSummary({
        category: session.selectedCategory, type: session.selectedType, content: session.pendingContent,
      }),
      replyMarkup: categoryInputKeyboard(!!session.pendingContent),
    });
    return true;
  }

  if (data === "cat:confirm") {
    if (!session.selectedCategory || !session.pendingContent) return true;

    await ctx.messagesRepo.insertMessage({
      content: session.pendingContent,
      on_day: null,
      category: session.selectedCategory,
      type: session.selectedType || "text",
    });

    await ctx.sessionsRepo.reset(chatId);
    await editToMenu(ctx, chatId, mid, `✅ Сообщение в категории «${session.selectedCategory}» сохранено.`);
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════
// Use-case 3: Delete message
// ═══════════════════════════════════════════════════════
async function handleStartDelete(ctx: HandlerContext, chatId: number, mid: number): Promise<boolean> {
  await ctx.sessionsRepo.set(chatId, {
    flow: "delete", step: "delete_kind",
    selectedDate: null, selectedCategory: null, selectedType: "text",
    pendingContent: null, selectedMessageId: null, categoryOptions: [],
    page: 0,
  });

  await ctx.telegram.editMessageText({
    chatId, messageId: mid,
    text: "Какое сообщение удалить?",
    replyMarkup: deleteKindKeyboard(),
  });
  return true;
}

async function handleDeleteCallback(
  ctx: HandlerContext, chatId: number, mid: number,
  data: string, session: BotSessionState,
): Promise<boolean> {

  if (data === "del:back") {
    await ctx.sessionsRepo.set(chatId, { ...session, step: "delete_kind", page: 0 });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Какое сообщение удалить?",
      replyMarkup: deleteKindKeyboard(),
    });
    return true;
  }

  if (data === "del:daily") {
    const messages = await ctx.messagesRepo.listDailyMessages();
    if (!messages.length) {
      await ctx.sessionsRepo.reset(chatId);
      await editToMenu(ctx, chatId, mid, "Ежедневных сообщений нет.");
      return true;
    }

    const page = 0;
    await ctx.sessionsRepo.set(chatId, { ...session, step: "delete_daily_list", page });

    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatDailyMessagesPage(messages, page),
      replyMarkup: deleteDailyListKeyboard(messages, page),
    });
    return true;
  }

  if (data.startsWith("del:dpage:")) {
    const page = Number(data.replace("del:dpage:", ""));
    const messages = await ctx.messagesRepo.listDailyMessages();
    await ctx.sessionsRepo.set(chatId, { ...session, step: "delete_daily_list", page });

    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatDailyMessagesPage(messages, page),
      replyMarkup: deleteDailyListKeyboard(messages, page),
    });
    return true;
  }

  if (data.startsWith("del:dmsg:")) {
    const msgId = Number(data.replace("del:dmsg:", ""));
    const msg = await ctx.messagesRepo.getMessage(msgId);
    if (!msg) {
      await ctx.telegram.editMessageText({
        chatId, messageId: mid, text: "Сообщение не найдено.",
        replyMarkup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "del:daily" }]] },
      });
      return true;
    }

    await ctx.sessionsRepo.set(chatId, {
      ...session, step: "delete_daily_confirm", selectedMessageId: msgId,
    });

    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: `Удалить это сообщение?\n\n${formatMessagePreview(msg)}`,
      replyMarkup: deleteConfirmKeyboard(),
    });
    return true;
  }

  if (data === "del:cat") {
    const categories = await ctx.messagesRepo.listCategories();
    if (!categories.length) {
      await ctx.sessionsRepo.reset(chatId);
      await editToMenu(ctx, chatId, mid, "Категорий нет.");
      return true;
    }

    await ctx.sessionsRepo.set(chatId, {
      ...session, step: "delete_cat_pick", categoryOptions: categories, page: 0,
    });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите категорию:",
      replyMarkup: deleteCategoryPickKeyboard(categories, 0),
    });
    return true;
  }

  if (data.startsWith("del:catpage:")) {
    const page = Number(data.replace("del:catpage:", ""));
    const categories = session.categoryOptions?.length ? session.categoryOptions : await ctx.messagesRepo.listCategories();
    await ctx.sessionsRepo.set(chatId, { ...session, page, categoryOptions: categories });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите категорию:",
      replyMarkup: deleteCategoryPickKeyboard(categories, page),
    });
    return true;
  }

  if (data.startsWith("del:ccat:")) {
    const index = Number(data.replace("del:ccat:", ""));
    const category = session.categoryOptions[index];
    if (!category) return true;

    const messages = await ctx.messagesRepo.listCategoryMessages(category);
    if (!messages.length) {
      await ctx.telegram.editMessageText({
        chatId, messageId: mid,
        text: `В категории «${category}» нет сообщений.`,
        replyMarkup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "del:cat" }]] },
      });
      return true;
    }

    await ctx.sessionsRepo.set(chatId, {
      ...session, step: "delete_cat_list", selectedCategory: category, page: 0,
    });

    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatCategoryMessagesPage(category, messages, 0),
      replyMarkup: deleteCategoryListKeyboard(messages, 0),
    });
    return true;
  }

  if (data.startsWith("del:cpage:")) {
    const page = Number(data.replace("del:cpage:", ""));
    const category = session.selectedCategory;
    if (!category) return true;

    const messages = await ctx.messagesRepo.listCategoryMessages(category);
    await ctx.sessionsRepo.set(chatId, { ...session, page });

    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatCategoryMessagesPage(category, messages, page),
      replyMarkup: deleteCategoryListKeyboard(messages, page),
    });
    return true;
  }

  if (data.startsWith("del:cmsg:")) {
    const msgId = Number(data.replace("del:cmsg:", ""));
    const msg = await ctx.messagesRepo.getMessage(msgId);
    if (!msg) {
      await ctx.telegram.editMessageText({
        chatId, messageId: mid, text: "Сообщение не найдено.",
        replyMarkup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "del:cat" }]] },
      });
      return true;
    }

    await ctx.sessionsRepo.set(chatId, {
      ...session, step: "delete_cat_confirm", selectedMessageId: msgId,
    });

    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: `Удалить это сообщение?\n\n${formatMessagePreview(msg)}`,
      replyMarkup: deleteConfirmKeyboard(),
    });
    return true;
  }

  if (data === "del:goback") {
    if (session.step === "delete_daily_confirm") {
      const messages = await ctx.messagesRepo.listDailyMessages();
      const page = session.page ?? 0;
      await ctx.sessionsRepo.set(chatId, { ...session, step: "delete_daily_list" });
      await ctx.telegram.editMessageText({
        chatId, messageId: mid,
        text: formatDailyMessagesPage(messages, page),
        replyMarkup: deleteDailyListKeyboard(messages, page),
      });
      return true;
    }
    if (session.step === "delete_cat_confirm" && session.selectedCategory) {
      const messages = await ctx.messagesRepo.listCategoryMessages(session.selectedCategory);
      const page = session.page ?? 0;
      await ctx.sessionsRepo.set(chatId, { ...session, step: "delete_cat_list" });
      await ctx.telegram.editMessageText({
        chatId, messageId: mid,
        text: formatCategoryMessagesPage(session.selectedCategory, messages, page),
        replyMarkup: deleteCategoryListKeyboard(messages, page),
      });
      return true;
    }
    return handleDeleteCallback(ctx, chatId, mid, "del:back", session);
  }

  if (data === "del:confirm") {
    if (!session.selectedMessageId) return true;

    await ctx.messagesRepo.deleteMessage(session.selectedMessageId);
    await ctx.sessionsRepo.reset(chatId);
    await editToMenu(ctx, chatId, mid, "✅ Сообщение удалено.");
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════
// Use-case 4: Cleanup expired with export
// ═══════════════════════════════════════════════════════
async function handleStartCleanup(ctx: HandlerContext, chatId: number, mid: number): Promise<boolean> {
  const todayIso = formatYyyyMmDd(nowInOffset(ctx.config.timezoneOffsetMinutes));
  const expired = await ctx.messagesRepo.listExpiredDaily(todayIso);

  if (!expired.length) {
    await editToMenu(ctx, chatId, mid, "Устаревших сообщений нет.");
    return true;
  }

  await ctx.sessionsRepo.set(chatId, {
    flow: "cleanup", step: "cleanup_preview",
    selectedDate: todayIso, selectedCategory: null, selectedType: "text",
    pendingContent: null, selectedMessageId: null, categoryOptions: [],
    page: 0,
  });

  const text = formatCleanupSummary(expired, todayIso);

  await ctx.telegram.editMessageText({
    chatId, messageId: mid,
    text,
    replyMarkup: cleanupPreviewKeyboard(),
  });
  return true;
}

async function handleCleanupCallback(
  ctx: HandlerContext, chatId: number, mid: number,
  data: string, session: BotSessionState,
): Promise<boolean> {

  if (data === "cl:export") {
    const todayIso = session.selectedDate || formatYyyyMmDd(nowInOffset(ctx.config.timezoneOffsetMinutes));
    const expired = await ctx.messagesRepo.listExpiredDaily(todayIso);

    if (!expired.length) {
      await ctx.sessionsRepo.reset(chatId);
      await editToMenu(ctx, chatId, mid, "Устаревших сообщений больше нет.");
      return true;
    }

    const exportData = expired.map((m) => ({
      message_id: m.message_id, content: m.content, on_day: m.on_day,
      type: m.type, category: m.category, is_read: m.is_read, created_at: m.created_at,
    }));

    const jsonStr = JSON.stringify(exportData, null, 2);
    const fileName = `export_${todayIso}.json`;

    await ctx.telegram.sendDocument({
      chatId, fileName, content: jsonStr,
      caption: `Экспорт ${expired.length} устаревших сообщений`,
    });

    const deleted = await ctx.messagesRepo.deleteExpiredDaily(todayIso);
    await ctx.sessionsRepo.reset(chatId);
    await ctx.telegram.sendMessage({
      chatId,
      text: `✅ Экспортировано и удалено: ${deleted} сообщений.\n\nВыберите действие:`,
      replyMarkup: mainMenuKeyboard(),
    });
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════
// Use-case 5: Edit message
// ═══════════════════════════════════════════════════════
async function handleStartEdit(ctx: HandlerContext, chatId: number, mid: number): Promise<boolean> {
  await ctx.sessionsRepo.set(chatId, {
    flow: "edit", step: "edit_kind",
    selectedDate: null, selectedCategory: null, selectedType: "text",
    pendingContent: null, selectedMessageId: null, categoryOptions: [],
    page: 0,
  });

  await ctx.telegram.editMessageText({
    chatId, messageId: mid,
    text: "Какое сообщение изменить?",
    replyMarkup: editKindKeyboard(),
  });
  return true;
}

async function handleEditCallback(
  ctx: HandlerContext, chatId: number, mid: number,
  data: string, session: BotSessionState,
): Promise<boolean> {

  if (data === "ed:back") {
    await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_kind", page: 0 });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Какое сообщение изменить?",
      replyMarkup: editKindKeyboard(),
    });
    return true;
  }

  if (data === "ed:daily") {
    const messages = await ctx.messagesRepo.listDailyMessages();
    if (!messages.length) {
      await ctx.sessionsRepo.reset(chatId);
      await editToMenu(ctx, chatId, mid, "Ежедневных сообщений нет.");
      return true;
    }

    const page = 0;
    await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_daily_list", page });

    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatDailyMessagesPage(messages, page),
      replyMarkup: editDailyListKeyboard(messages, page),
    });
    return true;
  }

  if (data.startsWith("ed:dpage:")) {
    const page = Number(data.replace("ed:dpage:", ""));
    const messages = await ctx.messagesRepo.listDailyMessages();
    await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_daily_list", page });

    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatDailyMessagesPage(messages, page),
      replyMarkup: editDailyListKeyboard(messages, page),
    });
    return true;
  }

  if (data.startsWith("ed:dmsg:")) {
    const msgId = Number(data.replace("ed:dmsg:", ""));
    const msg = await ctx.messagesRepo.getMessage(msgId);
    if (!msg) {
      await ctx.telegram.editMessageText({
        chatId, messageId: mid, text: "Сообщение не найдено.",
        replyMarkup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "ed:daily" }]] },
      });
      return true;
    }

    await ctx.sessionsRepo.set(chatId, {
      ...session, step: "edit_input", selectedMessageId: msgId,
      selectedDate: msg.on_day, selectedType: msg.type,
      pendingContent: msg.content, selectedCategory: msg.category,
    });

    await editSummary(ctx, chatId, mid, msg.on_day != null);
    return true;
  }

  if (data === "ed:cat") {
    const categories = await ctx.messagesRepo.listCategories();
    if (!categories.length) {
      await ctx.sessionsRepo.reset(chatId);
      await editToMenu(ctx, chatId, mid, "Категорий нет.");
      return true;
    }

    await ctx.sessionsRepo.set(chatId, {
      ...session, step: "edit_cat_pick", categoryOptions: categories, page: 0,
    });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите категорию:",
      replyMarkup: editCategoryPickKeyboard(categories, 0),
    });
    return true;
  }

  if (data.startsWith("ed:catpage:")) {
    const page = Number(data.replace("ed:catpage:", ""));
    const categories = session.categoryOptions?.length ? session.categoryOptions : await ctx.messagesRepo.listCategories();
    await ctx.sessionsRepo.set(chatId, { ...session, page, categoryOptions: categories });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите категорию:",
      replyMarkup: editCategoryPickKeyboard(categories, page),
    });
    return true;
  }

  if (data.startsWith("ed:ecat:")) {
    const index = Number(data.replace("ed:ecat:", ""));
    const category = session.categoryOptions[index];
    if (!category) return true;

    const messages = await ctx.messagesRepo.listCategoryMessages(category);
    if (!messages.length) {
      await ctx.telegram.editMessageText({
        chatId, messageId: mid,
        text: `В категории «${category}» нет сообщений.`,
        replyMarkup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "ed:cat" }]] },
      });
      return true;
    }

    await ctx.sessionsRepo.set(chatId, {
      ...session, step: "edit_cat_list", selectedCategory: category, page: 0,
    });

    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatCategoryMessagesPage(category, messages, 0),
      replyMarkup: editCategoryListKeyboard(messages, 0),
    });
    return true;
  }

  if (data.startsWith("ed:cpage:")) {
    const page = Number(data.replace("ed:cpage:", ""));
    const category = session.selectedCategory;
    if (!category) return true;

    const messages = await ctx.messagesRepo.listCategoryMessages(category);
    await ctx.sessionsRepo.set(chatId, { ...session, page });

    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: formatCategoryMessagesPage(category, messages, page),
      replyMarkup: editCategoryListKeyboard(messages, page),
    });
    return true;
  }

  if (data.startsWith("ed:emsg:")) {
    const msgId = Number(data.replace("ed:emsg:", ""));
    const msg = await ctx.messagesRepo.getMessage(msgId);
    if (!msg) {
      await ctx.telegram.editMessageText({
        chatId, messageId: mid, text: "Сообщение не найдено.",
        replyMarkup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "ed:cat" }]] },
      });
      return true;
    }

    await ctx.sessionsRepo.set(chatId, {
      ...session, step: "edit_input", selectedMessageId: msgId,
      selectedDate: msg.on_day, selectedType: msg.type,
      pendingContent: msg.content, selectedCategory: msg.category,
    });

    await editSummary(ctx, chatId, mid, msg.on_day != null);
    return true;
  }

  if (data === "ed:backtolist") {
    if (session.selectedDate != null) {
      const messages = await ctx.messagesRepo.listDailyMessages();
      const page = session.page ?? 0;
      await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_daily_list" });
      await ctx.telegram.editMessageText({
        chatId, messageId: mid,
        text: formatDailyMessagesPage(messages, page),
        replyMarkup: editDailyListKeyboard(messages, page),
      });
      return true;
    }
    if (session.selectedCategory != null) {
      const messages = await ctx.messagesRepo.listCategoryMessages(session.selectedCategory);
      const page = session.page ?? 0;
      await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_cat_list" });
      await ctx.telegram.editMessageText({
        chatId, messageId: mid,
        text: formatCategoryMessagesPage(session.selectedCategory, messages, page),
        replyMarkup: editCategoryListKeyboard(messages, page),
      });
      return true;
    }
    return handleEditCallback(ctx, chatId, mid, "ed:back", session);
  }

  if (data === "ed:inputback") {
    const isDaily = session.selectedDate != null;
    await editSummary(ctx, chatId, mid, isDaily);
    return true;
  }

  if (data === "ed:pickdate") {
    const month = formatMonth(nowInOffset(ctx.config.timezoneOffsetMinutes));
    await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_date_pick" });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите новую дату:",
      replyMarkup: calendarKeyboard(month, session.selectedDate, "ed"),
    });
    return true;
  }

  if (data.startsWith("ed:cal:")) {
    const month = data.replace("ed:cal:", "");
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите новую дату:",
      replyMarkup: calendarKeyboard(month, session.selectedDate, "ed"),
    });
    return true;
  }

  if (data === "ed:today") {
    const today = formatYyyyMmDd(nowInOffset(ctx.config.timezoneOffsetMinutes));
    await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_input", selectedDate: today });
    await editSummary(ctx, chatId, mid, true);
    return true;
  }

  if (data === "ed:nextfree") {
    const dates = await ctx.messagesRepo.listDailyDates();
    const today = formatYyyyMmDd(nowInOffset(ctx.config.timezoneOffsetMinutes));
    const date = firstMissingDay(dates, today);
    await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_input", selectedDate: date });
    await editSummary(ctx, chatId, mid, true);
    return true;
  }

  if (data.startsWith("ed:date:")) {
    const date = data.replace("ed:date:", "");
    if (!isValidYyyyMmDd(date)) return true;
    await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_input", selectedDate: date });
    await editSummary(ctx, chatId, mid, true);
    return true;
  }

  if (data === "ed:picktype") {
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите новый тип:",
      replyMarkup: typeKeyboard("ed"),
    });
    return true;
  }

  if (data.startsWith("ed:type:")) {
    const type = data.replace("ed:type:", "");
    await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_input", selectedType: type });
    await editSummary(ctx, chatId, mid, session.selectedDate != null);
    return true;
  }

  if (data === "ed:pickcontent") {
    await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_content" });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Введите новый текст сообщения:",
      replyMarkup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "ed:inputback" }]] },
    });
    return true;
  }

  if (data === "ed:pickcat") {
    const categories = await ctx.messagesRepo.listCategories();
    await ctx.sessionsRepo.set(chatId, { ...session, categoryOptions: categories, page: 0 });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите новую категорию:",
      replyMarkup: editCategoryReselect(categories, 0),
    });
    return true;
  }

  if (data.startsWith("ed:recatpage:")) {
    const page = Number(data.replace("ed:recatpage:", ""));
    const categories = session.categoryOptions?.length ? session.categoryOptions : await ctx.messagesRepo.listCategories();
    await ctx.sessionsRepo.set(chatId, { ...session, page, categoryOptions: categories });
    await ctx.telegram.editMessageText({
      chatId, messageId: mid,
      text: "Выберите новую категорию:",
      replyMarkup: editCategoryReselect(categories, page),
    });
    return true;
  }

  if (data.startsWith("ed:recat:")) {
    const index = Number(data.replace("ed:recat:", ""));
    const category = session.categoryOptions[index];
    if (!category) return true;
    await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_input", selectedCategory: category });
    await editSummary(ctx, chatId, mid, false);
    return true;
  }

  if (data === "ed:confirm") {
    if (!session.selectedMessageId) return true;

    const updates: Record<string, unknown> = {};
    if (session.pendingContent) updates.content = session.pendingContent;
    if (session.selectedDate !== undefined) updates.on_day = session.selectedDate;
    if (session.selectedType) updates.type = session.selectedType;
    if (session.selectedCategory !== undefined) updates.category = session.selectedCategory;

    try {
      await ctx.messagesRepo.updateMessage(session.selectedMessageId, updates);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("уже существует")) {
        await ctx.sessionsRepo.set(chatId, { ...session, step: "edit_input" });
        await editSummary(ctx, chatId, mid, session.selectedDate != null, `⚠️ На дату ${session.selectedDate} уже есть сообщение — выберите другую дату.\n\n`);
        return true;
      }
      throw err;
    }

    await ctx.sessionsRepo.reset(chatId);
    await editToMenu(ctx, chatId, mid, "✅ Сообщение обновлено.");
    return true;
  }

  return false;
}

async function handleCheckDates(ctx: HandlerContext, chatId: number, mid: number): Promise<true> {
  await ctx.sessionsRepo.reset(chatId);

  const today = formatYyyyMmDd(nowInOffset(ctx.config.timezoneOffsetMinutes));
  const { maxDate, hasTodayOrTomorrow } = await ctx.messagesRepo.checkDateCoverage(today);

  const lines: string[] = ["🔍 Проверка дат\n"];

  if (!hasTodayOrTomorrow.today) {
    lines.push("⚠️ Сообщения на сегодня нет!");
  } else {
    lines.push("✅ На сегодня сообщение есть.");
  }

  if (!hasTodayOrTomorrow.tomorrow) {
    lines.push("⚠️ Сообщения на завтра нет!");
  } else {
    lines.push("✅ На завтра сообщение есть.");
  }

  if (maxDate) {
    lines.push(`\n📆 Сообщения заполнены до: ${maxDate}`);
  } else {
    lines.push("\n📭 Нет запланированных сообщений начиная с сегодня.");
  }

  await ctx.telegram.editMessageText({
    chatId, messageId: mid,
    text: lines.join("\n"),
    replyMarkup: { inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "menu:main" }]] },
  });
  return true;
}

async function editSummary(ctx: HandlerContext, chatId: number, mid: number, isDaily: boolean, prefix = ""): Promise<void> {
  const session = await ctx.sessionsRepo.get(chatId);
  await ctx.telegram.editMessageText({
    chatId, messageId: mid,
    text: `${prefix}Редактирование:\n\n${formatMessageSummary({
      date: session.selectedDate, category: session.selectedCategory,
      type: session.selectedType, content: session.pendingContent,
    })}`,
    replyMarkup: editInputKeyboard(isDaily),
  });
}
