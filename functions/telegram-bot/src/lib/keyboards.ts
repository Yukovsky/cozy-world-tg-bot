import { formatMonth, formatYyyyMmDd, nextMonth, plusDays, prevMonth, startOfMonth } from "./date.ts";
import type { TelegramInlineKeyboardMarkup, TelegramInlineKeyboardButton, DbMessage } from "../types.ts";

export const DAILY_PAGE_SIZE = 6;
export const CATEGORY_MSG_PAGE_SIZE = 6;
export const CATEGORY_PICK_PAGE_SIZE = 8;

// ─── Main menu ─────────────────────────────────────────
export function mainMenuKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "📅 Ежедневное сообщение", callback_data: "menu:daily" }],
      [{ text: "📂 Категоризированное сообщение", callback_data: "menu:category" }],
      [{ text: "✏️ Изменить сообщение", callback_data: "menu:edit" }],
      [{ text: "🗑 Удалить сообщение", callback_data: "menu:delete" }],
      [{ text: "🧹 Очистить устаревшие", callback_data: "menu:cleanup" }],
      [{ text: "🔍 Проверка дат", callback_data: "menu:checkdates" }],
    ],
  };
}

// ─── Daily input (Use-case 1) ──────────────────────────
export function dailyInputKeyboard(hasContent = false): TelegramInlineKeyboardMarkup {
  const rows: TelegramInlineKeyboardButton[][] = [
    [{ text: "📅 Выбрать дату", callback_data: "daily:pickdate" }],
    [{ text: "🔄 Изменить тип сообщения", callback_data: "daily:picktype" }],
  ];
  if (hasContent) {
    rows.push([{ text: "✅ Отправить", callback_data: "daily:confirm" }]);
  }
  rows.push([{ text: "⬅️ Назад", callback_data: "menu:main" }]);
  return { inline_keyboard: rows };
}

// ─── Category input (Use-case 2) ───────────────────────
export function categoryListKeyboard(categories: string[], page = 0, pageSize = CATEGORY_PICK_PAGE_SIZE): TelegramInlineKeyboardMarkup {
  return buildCategoryPickKeyboard(categories, page, pageSize, "cat:pick", "cat:page", "menu:main");
}

export function categoryInputKeyboard(hasContent = false): TelegramInlineKeyboardMarkup {
  const rows: TelegramInlineKeyboardButton[][] = [
    [{ text: "📂 Выбрать категорию", callback_data: "cat:reselect" }],
    [{ text: "🔄 Изменить тип сообщения", callback_data: "cat:picktype" }],
  ];
  if (hasContent) {
    rows.push([{ text: "✅ Отправить", callback_data: "cat:confirm" }]);
  }
  rows.push([{ text: "⬅️ Назад", callback_data: "menu:main" }]);
  return { inline_keyboard: rows };
}

// ─── Type selection (shared) ───────────────────────────
export function typeKeyboard(prefix: string): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "📝 text", callback_data: `${prefix}:type:text` },
        { text: "🎬 video", callback_data: `${prefix}:type:video` },
        { text: "🎵 audio", callback_data: `${prefix}:type:audio` },
      ],
      [{ text: "⬅️ Назад", callback_data: `${prefix}:back` }],
    ],
  };
}

// ─── Delete flow (Use-case 3) ──────────────────────────
export function deleteKindKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "📅 Ежедневное", callback_data: "del:daily" }],
      [{ text: "📂 Категоризированное", callback_data: "del:cat" }],
      [{ text: "⬅️ Назад", callback_data: "menu:main" }],
    ],
  };
}

export function deleteDailyListKeyboard(messages: DbMessage[], page = 0, pageSize = DAILY_PAGE_SIZE): TelegramInlineKeyboardMarkup {
  return buildDailyListKeyboard(messages, page, pageSize, "del");
}

export function deleteCategoryPickKeyboard(categories: string[], page = 0, pageSize = CATEGORY_PICK_PAGE_SIZE): TelegramInlineKeyboardMarkup {
  return buildCategoryPickKeyboard(categories, page, pageSize, "del:ccat", "del:catpage", "del:back");
}

export function deleteCategoryListKeyboard(messages: DbMessage[], page = 0, pageSize = CATEGORY_MSG_PAGE_SIZE): TelegramInlineKeyboardMarkup {
  return buildCategoryMessagesKeyboard(messages, page, pageSize, "del");
}

export function deleteConfirmKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "🗑 Подтвердить удаление", callback_data: "del:confirm" }],
      [{ text: "⬅️ Назад", callback_data: "del:goback" }],
    ],
  };
}

// ─── Cleanup flow (Use-case 4) ─────────────────────────
export function cleanupPreviewKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "📤 Экспорт с удалением", callback_data: "cl:export" }],
      [{ text: "⬅️ Назад", callback_data: "menu:main" }],
    ],
  };
}

// ─── Edit flow (Use-case 5) ────────────────────────────
export function editKindKeyboard(): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "📅 Ежедневное", callback_data: "ed:daily" }],
      [{ text: "📂 Категоризированное", callback_data: "ed:cat" }],
      [{ text: "⬅️ Назад", callback_data: "menu:main" }],
    ],
  };
}

export function editDailyListKeyboard(messages: DbMessage[], page = 0, pageSize = DAILY_PAGE_SIZE): TelegramInlineKeyboardMarkup {
  return buildDailyListKeyboard(messages, page, pageSize, "ed");
}

export function editCategoryPickKeyboard(categories: string[], page = 0, pageSize = CATEGORY_PICK_PAGE_SIZE): TelegramInlineKeyboardMarkup {
  return buildCategoryPickKeyboard(categories, page, pageSize, "ed:ecat", "ed:catpage", "ed:back");
}

export function editCategoryListKeyboard(messages: DbMessage[], page = 0, pageSize = CATEGORY_MSG_PAGE_SIZE): TelegramInlineKeyboardMarkup {
  return buildCategoryMessagesKeyboard(messages, page, pageSize, "ed");
}

export function editInputKeyboard(isDaily: boolean): TelegramInlineKeyboardMarkup {
  const rows: TelegramInlineKeyboardButton[][] = [];
  if (isDaily) {
    rows.push([{ text: "📅 Изменить дату", callback_data: "ed:pickdate" }]);
  } else {
    rows.push([{ text: "📂 Изменить категорию", callback_data: "ed:pickcat" }]);
  }
  rows.push([{ text: "🔄 Изменить тип", callback_data: "ed:picktype" }]);
  rows.push([{ text: "📝 Изменить текст", callback_data: "ed:pickcontent" }]);
  rows.push([{ text: "✅ Сохранить", callback_data: "ed:confirm" }]);
  rows.push([{ text: "⬅️ Назад", callback_data: "ed:backtolist" }]);
  return { inline_keyboard: rows };
}

export function editCategoryReselect(categories: string[], page = 0, pageSize = CATEGORY_PICK_PAGE_SIZE): TelegramInlineKeyboardMarkup {
  return buildCategoryPickKeyboard(categories, page, pageSize, "ed:recat", "ed:recatpage", "ed:inputback");
}

// ─── Reusable builders for paginated keyboards ─────────
function buildDailyListKeyboard(
  messages: DbMessage[],
  page: number,
  pageSize: number,
  prefix: "ed" | "del",
): TelegramInlineKeyboardMarkup {
  const total = messages.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * pageSize;
  const pageSlice = messages.slice(start, start + pageSize);

  const rows: TelegramInlineKeyboardButton[][] = pageSlice.map((m, i) => [
    {
      text: `${start + i + 1}. 📅 ${m.on_day}`,
      callback_data: `${prefix}:dmsg:${m.message_id}`,
    },
  ]);

  if (totalPages > 1) {
    rows.push([
      safePage > 0
        ? { text: "◀ Назад", callback_data: `${prefix}:dpage:${safePage - 1}` }
        : { text: "·", callback_data: "noop" },
      { text: `${safePage + 1} / ${totalPages}`, callback_data: "noop" },
      safePage < totalPages - 1
        ? { text: "Вперёд ▶", callback_data: `${prefix}:dpage:${safePage + 1}` }
        : { text: "·", callback_data: "noop" },
    ]);
  }

  rows.push([{ text: "⬅️ Назад", callback_data: `${prefix}:back` }]);
  return { inline_keyboard: rows };
}

function buildCategoryMessagesKeyboard(
  messages: DbMessage[],
  page: number,
  pageSize: number,
  prefix: "ed" | "del",
): TelegramInlineKeyboardMarkup {
  const total = messages.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * pageSize;
  const pageSlice = messages.slice(start, start + pageSize);

  const rows: TelegramInlineKeyboardButton[][] = [];
  const numButtons: TelegramInlineKeyboardButton[] = pageSlice.map((m, i) => ({
    text: `${start + i + 1}`,
    callback_data: `${prefix}:${prefix === "ed" ? "emsg" : "cmsg"}:${m.message_id}`,
  }));

  for (let i = 0; i < numButtons.length; i += 3) {
    rows.push(numButtons.slice(i, i + 3));
  }

  if (totalPages > 1) {
    rows.push([
      safePage > 0
        ? { text: "◀ Назад", callback_data: `${prefix}:cpage:${safePage - 1}` }
        : { text: "·", callback_data: "noop" },
      { text: `${safePage + 1} / ${totalPages}`, callback_data: "noop" },
      safePage < totalPages - 1
        ? { text: "Вперёд ▶", callback_data: `${prefix}:cpage:${safePage + 1}` }
        : { text: "·", callback_data: "noop" },
    ]);
  }

  rows.push([{ text: "⬅️ Назад к категориям", callback_data: `${prefix}:cat` }]);
  return { inline_keyboard: rows };
}

function buildCategoryPickKeyboard(
  categories: string[],
  page: number,
  pageSize: number,
  pickPrefix: string,
  pagePrefix: string,
  backCallback: string,
): TelegramInlineKeyboardMarkup {
  const total = categories.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * pageSize;
  const pageSlice = categories.slice(start, start + pageSize);

  const rows: TelegramInlineKeyboardButton[][] = pageSlice.map((cat, i) => [
    {
      text: safeTruncate(cat, 32),
      callback_data: `${pickPrefix}:${start + i}`,
    },
  ]);

  if (totalPages > 1) {
    rows.push([
      safePage > 0
        ? { text: "◀", callback_data: `${pagePrefix}:${safePage - 1}` }
        : { text: "·", callback_data: "noop" },
      { text: `${safePage + 1} / ${totalPages}`, callback_data: "noop" },
      safePage < totalPages - 1
        ? { text: "▶", callback_data: `${pagePrefix}:${safePage + 1}` }
        : { text: "·", callback_data: "noop" },
    ]);
  }

  rows.push([{ text: "⬅️ Назад", callback_data: backCallback }]);
  return { inline_keyboard: rows };
}

// ─── Calendar (shared for daily / edit) ────────────────
const MONTH_NAMES_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function weekdayIndexMondayFirst(jsWeekday: number): number {
  return jsWeekday === 0 ? 6 : jsWeekday - 1;
}

export function calendarKeyboard(
  monthIso: string,
  selectedDate: string | null,
  callbackPrefix: string,
): TelegramInlineKeyboardMarkup {
  const monthStart = startOfMonth(monthIso);
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  const firstWeekday = weekdayIndexMondayFirst(monthStart.getUTCDay());
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const rows: TelegramInlineKeyboardButton[][] = [];

  rows.push([
    { text: `${MONTH_NAMES_RU[month]} ${year}`, callback_data: "noop" },
  ]);

  rows.push([
    { text: "Пн", callback_data: "noop" },
    { text: "Вт", callback_data: "noop" },
    { text: "Ср", callback_data: "noop" },
    { text: "Чт", callback_data: "noop" },
    { text: "Пт", callback_data: "noop" },
    { text: "Сб", callback_data: "noop" },
    { text: "Вс", callback_data: "noop" },
  ]);

  let currentDay = 1;
  for (let week = 0; week < 6; week += 1) {
    const row: TelegramInlineKeyboardButton[] = [];
    for (let wd = 0; wd < 7; wd += 1) {
      const cellIndex = week * 7 + wd;
      if (cellIndex < firstWeekday || currentDay > daysInMonth) {
        row.push({ text: "·", callback_data: "noop" });
      } else {
        const date = new Date(Date.UTC(year, month, currentDay));
        const iso = formatYyyyMmDd(date);
        const text = selectedDate === iso ? `[${currentDay}]` : String(currentDay);
        row.push({ text, callback_data: `${callbackPrefix}:date:${iso}` });
        currentDay += 1;
      }
    }
    rows.push(row);
    if (currentDay > daysInMonth) break;
  }

  rows.push([
    { text: "◀", callback_data: `${callbackPrefix}:cal:${prevMonth(monthIso)}` },
    { text: "Сегодня", callback_data: `${callbackPrefix}:today` },
    { text: "▶", callback_data: `${callbackPrefix}:cal:${nextMonth(monthIso)}` },
  ]);

  rows.push([
    { text: "📌 Ближайшая свободная", callback_data: `${callbackPrefix}:nextfree` },
  ]);

  rows.push([{ text: "⬅️ Назад", callback_data: `${callbackPrefix}:back` }]);

  return { inline_keyboard: rows };
}

// ─── Helpers & Formatters ──────────────────────────────
export function safeTruncate(text: string, maxLen = 60): string {
  if (!text) return "";
  const chars = Array.from(text);
  if (chars.length <= maxLen) {
    return typeof text.toWellFormed === "function" ? text.toWellFormed() : text;
  }
  const result = chars.slice(0, Math.max(0, maxLen - 1)).join("") + "…";
  return typeof result.toWellFormed === "function" ? result.toWellFormed() : result;
}

export const truncate = safeTruncate;

export function formatMessagePreview(m: DbMessage, index?: number): string {
  const prefix = index != null ? `${index}. ` : "";
  const readMark = m.is_read ? "✅" : "🆕";
  const type = `[${m.type}]`;
  const date = m.on_day ? `📅 ${m.on_day}` : "";
  const cat = m.category ? `📂 ${m.category}` : "";
  const meta = [type, date, cat, readMark].filter(Boolean).join(" ");
  const contentPreview = safeTruncate(m.content.replace(/\s+/g, " "), 80);
  return `${prefix}${meta}\n${contentPreview}`;
}

export function formatDailyMessagesPage(messages: DbMessage[], page: number, pageSize = DAILY_PAGE_SIZE): string {
  const total = messages.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * pageSize;
  const pageItems = messages.slice(start, start + pageSize);

  const header = `📅 Ежедневные сообщения (стр. ${safePage + 1} из ${totalPages}, всего: ${total}):\n`;
  const itemsText = pageItems.map((m, i) => {
    const num = start + i + 1;
    const preview = safeTruncate(m.content.replace(/\s+/g, " "), 50);
    return `${num}. 📅 ${m.on_day} [${m.type}] — ${preview}`;
  }).join("\n");

  return `${header}\n${itemsText}\n\nВыберите сообщение:`;
}

export function formatCategoryMessagesPage(category: string, messages: DbMessage[], page: number, pageSize = CATEGORY_MSG_PAGE_SIZE): string {
  const total = messages.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const start = safePage * pageSize;
  const pageItems = messages.slice(start, start + pageSize);

  const header = `📂 Сообщения в «${category}» (стр. ${safePage + 1} из ${totalPages}, всего: ${total}):\n`;
  const itemsText = pageItems.map((m, i) => {
    const num = start + i + 1;
    return formatMessagePreview(m, num);
  }).join("\n\n");

  return `${header}\n${itemsText}\n\nВыберите номер:`;
}

export function formatCleanupSummary(expired: DbMessage[], todayIso: string): string {
  const total = expired.length;
  if (!total) {
    return "Устаревших сообщений нет.";
  }
  const firstDate = expired[0]?.on_day ?? "—";
  const lastDate = expired[total - 1]?.on_day ?? "—";
  const previewItems = expired.slice(0, 5).map((m, i) => {
    const preview = safeTruncate(m.content.replace(/\s+/g, " "), 50);
    return `${i + 1}. 📅 ${m.on_day} [${m.type}] — ${preview}`;
  }).join("\n");

  const moreCount = total > 5 ? `\n...и ещё ${total - 5} сообщений.` : "";

  return [
    `🧹 Устаревшие сообщения (до ${todayIso})`,
    "",
    `Всего найдено: ${total} шт.`,
    `Период: с ${firstDate} по ${lastDate}`,
    "",
    "Примеры:",
    previewItems,
    moreCount,
    "",
    "Нажмите «Экспорт с удалением», чтобы скачать резервную копию (JSON) и удалить эти сообщения из базы данных.",
  ].filter(Boolean).join("\n");
}

export function formatMessageSummary(p: {
  date?: string | null;
  category?: string | null;
  type: string;
  content?: string | null;
}): string {
  const lines: string[] = [];
  if (p.date) lines.push(`📅 Дата: ${p.date}`);
  if (p.category) lines.push(`📂 Категория: ${p.category}`);
  lines.push(`📋 Тип: ${p.type}`);
  if (p.content) {
    const safeContent = safeTruncate(p.content, 3500);
    lines.push(`📝 Текст:\n${safeContent}`);
  } else {
    lines.push("📝 Текст сообщения: (ожидается ввод)");
  }
  return lines.join("\n");
}
