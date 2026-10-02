import { assertEquals, assert, assertStringIncludes } from "jsr:@std/assert";
import {
  safeTruncate,
  formatDailyMessagesPage,
  formatCategoryMessagesPage,
  formatCleanupSummary,
  editDailyListKeyboard,
  deleteDailyListKeyboard,
  editCategoryListKeyboard,
  deleteCategoryListKeyboard,
  categoryListKeyboard,
  editCategoryPickKeyboard,
  deleteCategoryPickKeyboard,
  UNREAD_CATEGORY_VALUE,
} from "../src/lib/keyboards.ts";
import { toSafeUtf8String, sanitizeUtf8, truncateToLimit } from "../src/lib/telegram.ts";
import { handleCallback } from "../src/handlers/callbacks.ts";
import type { HandlerContext } from "../src/handlers/context.ts";
import type { DbMessage, BotSessionState } from "../src/types.ts";

function hasLoneSurrogates(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = str.charCodeAt(i + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) {
        return true;
      }
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      const prev = str.charCodeAt(i - 1);
      if (!(prev >= 0xD800 && prev <= 0xDBFF)) {
        return true;
      }
    }
  }
  return false;
}

Deno.test("UTF-8 safety - toSafeUtf8String handles lone surrogates", () => {
  const normalText = "Привет, мир! 🚀 🐱 ❤️";
  assertEquals(toSafeUtf8String(normalText), normalText);
  assertEquals(hasLoneSurrogates(toSafeUtf8String(normalText)), false);

  // String with a lone high surrogate
  const brokenHigh = "Test\uD83Dabc";
  const fixedHigh = toSafeUtf8String(brokenHigh);
  assertEquals(hasLoneSurrogates(fixedHigh), false);
  assertEquals(fixedHigh, "Test\uFFFDabc");

  // String with a lone low surrogate
  const brokenLow = "Test\uDC8Bdef";
  const fixedLow = toSafeUtf8String(brokenLow);
  assertEquals(hasLoneSurrogates(fixedLow), false);
  assertEquals(fixedLow, "Test\uFFFDdef");
});

Deno.test("UTF-8 safety - safeTruncate never slices surrogate pairs", () => {
  // Real messages from user's database that previously failed
  const msg296 = "мох мох мох мох мох!!! сёння каб пацалаваліся!!! 💋💋💋";
  const msg237 = "мох мох мох\n\nхацеў б я зараз вас пацалаваць, паабдымаць і кахаць кахаць кахаць ❤️💋";

  for (let len = 1; len <= 100; len++) {
    const t1 = safeTruncate(msg296, len);
    const t2 = safeTruncate(msg237, len);
    assertEquals(hasLoneSurrogates(t1), false, `Lone surrogate in t1 at len ${len}: ${t1}`);
    assertEquals(hasLoneSurrogates(t2), false, `Lone surrogate in t2 at len ${len}: ${t2}`);
  }
});

Deno.test("UTF-8 safety - sanitizeUtf8 sanitizes nested objects", () => {
  const obj = {
    chat_id: 12345,
    text: "Broken \uD83D text",
    reply_markup: {
      inline_keyboard: [
        [{ text: "Btn \uDC8B", callback_data: "data" }],
      ],
    },
  };

  const sanitized = sanitizeUtf8(obj);
  assertEquals(hasLoneSurrogates(sanitized.text), false);
  assertEquals(hasLoneSurrogates(sanitized.reply_markup.inline_keyboard[0][0].text), false);
});

Deno.test("Message length protection - truncateToLimit", () => {
  const hugeText = "А".repeat(5000);
  const truncated = truncateToLimit(hugeText, 4000);
  assert(truncated.length <= 4000);
  assertStringIncludes(truncated, "[...сообщение обрезано...]");
  assertEquals(hasLoneSurrogates(truncated), false);
});

Deno.test("Pagination - Daily messages pagination prevents MESSAGE_TOO_LONG", () => {
  // Create 95 messages (matching user's actual database count)
  const messages: DbMessage[] = Array.from({ length: 95 }, (_, i) => ({
    message_id: 1000 + i,
    content: `Тестовое ежедневное сообщение номер ${i + 1} с эмодзи 🌸✨ и описанием.`,
    on_day: `2026-05-${String(i + 1).padStart(2, "0")}`,
    type: "text",
    category: null,
    is_read: false,
    created_at: new Date().toISOString(),
  }));

  // Page 0
  const page0Text = formatDailyMessagesPage(messages, 0, 6);
  assert(page0Text.length < 1000, `Text too long: ${page0Text.length}`);
  assertStringIncludes(page0Text, "стр. 1 из 16, всего: 95");
  assertEquals(hasLoneSurrogates(page0Text), false);

  const kb0 = editDailyListKeyboard(messages, 0, 6);
  // 6 message rows + 1 pagination row + 1 back row = 8 rows
  assertEquals(kb0.inline_keyboard.length, 8);
  assertEquals(kb0.inline_keyboard[6][1].text, "1 / 16");

  // Page 15 (last page: 95 % 6 = 5 items)
  const page15Text = formatDailyMessagesPage(messages, 15, 6);
  assert(page15Text.length < 1000);
  assertStringIncludes(page15Text, "стр. 16 из 16, всего: 95");
  const kb15 = editDailyListKeyboard(messages, 15, 6);
  assertEquals(kb15.inline_keyboard.length, 7); // 5 items + 1 nav + 1 back
  assertEquals(kb15.inline_keyboard[5][1].text, "16 / 16");
});

Deno.test("Pagination - Category messages pagination prevents MESSAGE_TOO_LONG", () => {
  const messages: DbMessage[] = Array.from({ length: 40 }, (_, i) => ({
    message_id: 2000 + i,
    content: `Категоризированное сообщение ${i + 1} в категории любимое ❤️💋🐱.`,
    on_day: null,
    type: "text",
    category: "Любимое",
    is_read: false,
    created_at: new Date().toISOString(),
  }));

  const text = formatCategoryMessagesPage("Любимое", messages, 0, 6);
  assert(text.length < 2000, `Text too long: ${text.length}`);
  assertStringIncludes(text, "стр. 1 из 7, всего: 40");
  assertEquals(hasLoneSurrogates(text), false);

  const kb = deleteCategoryListKeyboard(messages, 0, 6);
  // 6 items split into rows of 3: 2 rows of items + 1 nav + 1 back = 4 rows
  assertEquals(kb.inline_keyboard.length, 4);
});

Deno.test("Cleanup summary - Prevents MESSAGE_TOO_LONG with 89 expired messages", () => {
  const expired: DbMessage[] = Array.from({ length: 89 }, (_, i) => ({
    message_id: 3000 + i,
    content: `Устаревшее сообщение ${i + 1} за прошедший день с длинным текстом.`,
    on_day: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
    type: "text",
    category: null,
    is_read: true,
    created_at: new Date().toISOString(),
  }));

  const summary = formatCleanupSummary(expired, "2026-10-02");
  assert(summary.length < 1000, `Summary too long: ${summary.length}`);
  assertStringIncludes(summary, "Всего найдено: 89 шт.");
  assertStringIncludes(summary, "...и ещё 84 сообщений.");
  assertEquals(hasLoneSurrogates(summary), false);
});

Deno.test("Handlers - Edit and Delete pagination callbacks work seamlessly", async () => {
  const mockMessages: DbMessage[] = Array.from({ length: 20 }, (_, i) => ({
    message_id: i + 1,
    content: `Сообщение ${i + 1}`,
    on_day: `2026-06-${String(i + 1).padStart(2, "0")}`,
    type: "text",
    category: null,
    is_read: false,
    created_at: new Date().toISOString(),
  }));

  let lastSentText = "";
  let sessionState: BotSessionState = {
    flow: "idle",
    step: "idle",
    selectedDate: null,
    selectedCategory: null,
    selectedType: "text",
    pendingContent: null,
    selectedMessageId: null,
    categoryOptions: [],
    page: 0,
  };

  const mockCtx: HandlerContext = {
    config: {
      telegramBotToken: "test",
      telegramWebhookSecret: "secret",
      supabaseUrl: "http://localhost",
      supabaseServiceRoleKey: "key",
      messagesTable: "messages",
      sessionsTable: "telegram_bot_sessions",
      timezoneOffsetMinutes: 180,
      defaultType: "text",
    },
    telegram: {
      editMessageText: (params: { text: string }) => {
        lastSentText = params.text;
        return Promise.resolve();
      },
      sendMessage: (params: { text: string }) => {
        lastSentText = params.text;
        return Promise.resolve();
      },
      answerCallbackQuery: () => Promise.resolve(),
      sendDocument: () => Promise.resolve(),
      deleteMessage: () => Promise.resolve(true),
    } as any,
    messagesRepo: {
      listDailyMessages: () => Promise.resolve(mockMessages),
      getMessage: (id: number) => Promise.resolve(mockMessages.find((m) => m.message_id === id) ?? null),
      listCategories: () => Promise.resolve(["Общее", "Праздники"]),
      listCategoryMessages: () => Promise.resolve(mockMessages),
      listExpiredDaily: () => Promise.resolve(mockMessages),
      deleteExpiredDaily: () => Promise.resolve(mockMessages.length),
      deleteMessage: () => Promise.resolve(),
      updateMessage: () => Promise.resolve(),
      insertMessage: () => Promise.resolve(),
      listDailyDates: () => Promise.resolve([]),
      checkDateCoverage: () => Promise.resolve({ maxDate: "2026-12-31", hasTodayOrTomorrow: { today: true, tomorrow: true } }),
    } as any,
    sessionsRepo: {
      get: () => Promise.resolve(sessionState),
      set: (_chatId: number, state: BotSessionState) => {
        sessionState = state;
        return Promise.resolve();
      },
      reset: () => {
        sessionState = {
          flow: "idle", step: "idle", selectedDate: null, selectedCategory: null,
          selectedType: "text", pendingContent: null, selectedMessageId: null,
          categoryOptions: [], page: 0,
        };
        return Promise.resolve();
      },
    } as any,
  };

  // Test opening edit daily list
  const res1 = await handleCallback(mockCtx, {
    id: "1",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "ed:daily",
  });
  assertEquals(res1, true);
  assertEquals(sessionState.step, "edit_daily_list");
  assertStringIncludes(lastSentText, "стр. 1 из 4, всего: 20");

  // Test navigating to page 2 (index 1)
  const res2 = await handleCallback(mockCtx, {
    id: "2",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "ed:dpage:1",
  });
  assertEquals(res2, true);
  assertEquals(sessionState.page, 1);
  assertStringIncludes(lastSentText, "стр. 2 из 4, всего: 20");

  // Test selecting message #7
  const res3 = await handleCallback(mockCtx, {
    id: "3",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "ed:dmsg:7",
  });
  assertEquals(res3, true);
  assertEquals(sessionState.step, "edit_input");
  assertEquals(sessionState.selectedMessageId, 7);
  assertStringIncludes(lastSentText, "Редактирование:");

  // Test navigating back to list (should restore page 1)
  const res4 = await handleCallback(mockCtx, {
    id: "4",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "ed:backtolist",
  });
  assertEquals(res4, true);
  assertEquals(sessionState.step, "edit_daily_list");
  assertStringIncludes(lastSentText, "стр. 2 из 4, всего: 20");

  // Test opening delete daily list
  const res5 = await handleCallback(mockCtx, {
    id: "5",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "del:daily",
  });
  assertEquals(res5, true);
  assertEquals(sessionState.step, "delete_daily_list");
  assertStringIncludes(lastSentText, "стр. 1 из 4, всего: 20");

  // Test cleanup preview
  const res6 = await handleCallback(mockCtx, {
    id: "6",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "menu:cleanup",
  });
  assertEquals(res6, true);
  assertEquals(sessionState.step, "cleanup_preview");
  assertStringIncludes(lastSentText, "Устаревшие сообщения");
  assertStringIncludes(lastSentText, "Всего найдено: 20 шт.");

  // Test delete confirmation and execution
  const res7 = await handleCallback(mockCtx, {
    id: "7",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "del:dmsg:5",
  });
  assertEquals(res7, true);
  assertEquals(sessionState.step, "delete_daily_confirm");
  assertStringIncludes(lastSentText, "Удалить это сообщение?");

  const res8 = await handleCallback(mockCtx, {
    id: "8",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "del:confirm",
  });
  assertEquals(res8, true);
  assertStringIncludes(lastSentText, "Сообщение удалено.");
});

Deno.test("Handlers - handleText validates length and handles content", async () => {
  let lastSentText = "";
  let sessionState: BotSessionState = {
    flow: "daily",
    step: "daily_input",
    selectedDate: "2026-10-05",
    selectedCategory: null,
    selectedType: "text",
    pendingContent: null,
    selectedMessageId: null,
    categoryOptions: [],
    page: 0,
  };

  const mockCtx: HandlerContext = {
    config: {
      telegramBotToken: "test",
      telegramWebhookSecret: "secret",
      supabaseUrl: "http://localhost",
      supabaseServiceRoleKey: "key",
      messagesTable: "messages",
      sessionsTable: "telegram_bot_sessions",
      timezoneOffsetMinutes: 180,
      defaultType: "text",
    },
    telegram: {
      sendMessage: (params: { text: string }) => {
        lastSentText = params.text;
        return Promise.resolve();
      },
    } as any,
    messagesRepo: {} as any,
    sessionsRepo: {
      get: () => Promise.resolve(sessionState),
      set: (_chatId: number, state: BotSessionState) => {
        sessionState = state;
        return Promise.resolve();
      },
    } as any,
  };

  const { handleText } = await import("../src/handlers/text.ts");

  // Too long text rejected
  const hugeText = "X".repeat(3501);
  const res1 = await handleText(mockCtx, {
    message_id: 1,
    chat: { id: 123, type: "private" },
    text: hugeText,
  });
  assertEquals(res1, true);
  assertStringIncludes(lastSentText, "Текст слишком длинный");

  // Valid text accepted
  const validText = "Хороший текст сообщения 🚀";
  const res2 = await handleText(mockCtx, {
    message_id: 2,
    chat: { id: 123, type: "private" },
    text: validText,
  });
  assertEquals(res2, true);
  assertEquals(sessionState.pendingContent, validText);
  assertStringIncludes(lastSentText, "Хороший текст сообщения 🚀");
});

Deno.test("Keyboards - Category pick includes unread button when count provided", () => {
  const categories = ["Общее", "Любовь", "Цитаты"];
  const editKb = editCategoryPickKeyboard(categories, 0, 8, 5);
  assertEquals(editKb.inline_keyboard[0][0].text, "🆕 Непрочитанные (5)");
  assertEquals(editKb.inline_keyboard[0][0].callback_data, "ed:unread");
  assertEquals(editKb.inline_keyboard[1][0].text, "Общее");

  const delKb = deleteCategoryPickKeyboard(categories, 0, 8, 3);
  assertEquals(delKb.inline_keyboard[0][0].text, "🆕 Непрочитанные (3)");
  assertEquals(delKb.inline_keyboard[0][0].callback_data, "del:unread");
  assertEquals(delKb.inline_keyboard[1][0].text, "Общее");
});

Deno.test("Handlers - Unread categorized messages edit and delete flow", async () => {
  const unreadMessages: DbMessage[] = [
    {
      message_id: 501,
      content: "Непрочитанное сообщение 1 🌸",
      on_day: null,
      type: "text",
      category: "Любовь",
      is_read: false,
      created_at: "2026-10-01T12:00:00Z",
    },
    {
      message_id: 502,
      content: "Непрочитанное сообщение 2 💫",
      on_day: null,
      type: "text",
      category: "Вдохновение",
      is_read: false,
      created_at: "2026-09-30T10:00:00Z",
    },
  ];

  let lastSentText = "";
  let sessionState: BotSessionState = {
    flow: "idle",
    step: "idle",
    selectedDate: null,
    selectedCategory: null,
    selectedType: "text",
    pendingContent: null,
    selectedMessageId: null,
    categoryOptions: [],
    page: 0,
    categoryFilter: null,
  };

  const mockCtx: HandlerContext = {
    config: {
      telegramBotToken: "test",
      telegramWebhookSecret: "secret",
      supabaseUrl: "http://localhost",
      supabaseServiceRoleKey: "key",
      messagesTable: "messages",
      sessionsTable: "telegram_bot_sessions",
      timezoneOffsetMinutes: 180,
      defaultType: "text",
    },
    telegram: {
      editMessageText: (params: { text: string }) => {
        lastSentText = params.text;
        return Promise.resolve();
      },
      sendMessage: (params: { text: string }) => {
        lastSentText = params.text;
        return Promise.resolve();
      },
      answerCallbackQuery: () => Promise.resolve(),
      sendDocument: () => Promise.resolve(),
      deleteMessage: () => Promise.resolve(true),
    } as any,
    messagesRepo: {
      listDailyMessages: () => Promise.resolve([]),
      getMessage: (id: number) => Promise.resolve(unreadMessages.find((m) => m.message_id === id) ?? null),
      listCategories: () => Promise.resolve(["Любовь", "Вдохновение"]),
      listCategoryMessages: (cat: string) => Promise.resolve(unreadMessages.filter((m) => m.category === cat)),
      listUnreadCategorized: () => Promise.resolve(unreadMessages),
      countUnreadCategorized: () => Promise.resolve(unreadMessages.length),
      deleteMessage: () => Promise.resolve(),
      updateMessage: () => Promise.resolve(),
    } as any,
    sessionsRepo: {
      get: () => Promise.resolve(sessionState),
      set: (_chatId: number, state: BotSessionState) => {
        sessionState = state;
        return Promise.resolve();
      },
      reset: () => {
        sessionState = {
          flow: "idle", step: "idle", selectedDate: null, selectedCategory: null,
          selectedType: "text", pendingContent: null, selectedMessageId: null,
          categoryOptions: [], page: 0, categoryFilter: null,
        };
        return Promise.resolve();
      },
    } as any,
  };

  // 1. Open edit categories list
  const res1 = await handleCallback(mockCtx, {
    id: "1",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "ed:cat",
  });
  assertEquals(res1, true);
  assertEquals(sessionState.step, "edit_cat_pick");
  assertStringIncludes(lastSentText, "Выберите категорию:");

  // 2. Select unread messages category
  const res2 = await handleCallback(mockCtx, {
    id: "2",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "ed:unread",
  });
  assertEquals(res2, true);
  assertEquals(sessionState.step, "edit_cat_list");
  assertEquals(sessionState.categoryFilter, UNREAD_CATEGORY_VALUE);
  assertStringIncludes(lastSentText, "Сообщения в «Непрочитанные»");

  // 3. Select unread message 501 for editing
  const res3 = await handleCallback(mockCtx, {
    id: "3",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "ed:emsg:501",
  });
  assertEquals(res3, true);
  assertEquals(sessionState.step, "edit_input");
  assertEquals(sessionState.selectedMessageId, 501);
  assertEquals(sessionState.selectedCategory, "Любовь"); // preserves actual DB category
  assertEquals(sessionState.categoryFilter, UNREAD_CATEGORY_VALUE);
  assertStringIncludes(lastSentText, "Редактирование:");

  // 4. Click back to list -> returns to unread list
  const res4 = await handleCallback(mockCtx, {
    id: "4",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "ed:backtolist",
  });
  assertEquals(res4, true);
  assertEquals(sessionState.step, "edit_cat_list");
  assertStringIncludes(lastSentText, "Сообщения в «Непрочитанные»");

  // 5. Test delete unread flow
  const res5 = await handleCallback(mockCtx, {
    id: "5",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "del:unread",
  });
  assertEquals(res5, true);
  assertEquals(sessionState.step, "delete_cat_list");
  assertEquals(sessionState.categoryFilter, UNREAD_CATEGORY_VALUE);
  assertStringIncludes(lastSentText, "Сообщения в «Непрочитанные»");

  // 6. Select message 502 for delete confirmation
  const res6 = await handleCallback(mockCtx, {
    id: "6",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "del:cmsg:502",
  });
  assertEquals(res6, true);
  assertEquals(sessionState.step, "delete_cat_confirm");
  assertStringIncludes(lastSentText, "Удалить это сообщение?");

  // 7. Click back -> returns to unread list
  const res7 = await handleCallback(mockCtx, {
    id: "7",
    from: { id: 123, first_name: "User" },
    message: { message_id: 99, chat: { id: 123, type: "private" } },
    data: "del:goback",
  });
  assertEquals(res7, true);
  assertEquals(sessionState.step, "delete_cat_list");
  assertStringIncludes(lastSentText, "Сообщения в «Непрочитанные»");
});


