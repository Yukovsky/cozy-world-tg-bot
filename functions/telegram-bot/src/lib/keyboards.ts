import { formatMonth, formatYyyyMmDd, nextMonth, parseYyyyMmDd, plusDays, prevMonth, startOfMonth } from "./date.ts";
import type { TelegramInlineKeyboardMarkup, DbMessage } from "../types.ts";

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
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
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
export function categoryListKeyboard(categories: string[]): TelegramInlineKeyboardMarkup {
  const rows = categories.slice(0, 20).map((cat, i) => [
    { text: cat, callback_data: `cat:pick:${i}` },
  ]);
  rows.push([{ text: "⬅️ Назад", callback_data: "menu:main" }]);
  return { inline_keyboard: rows };
}

export function categoryInputKeyboard(hasContent = false): TelegramInlineKeyboardMarkup {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
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

export function deleteDailyListKeyboard(messages: DbMessage[]): TelegramInlineKeyboardMarkup {
  const rows = messages.slice(0, 30).map((m) => [
    { text: `📅 ${m.on_day}`, callback_data: `del:dmsg:${m.message_id}` },
  ]);
  rows.push([{ text: "⬅️ Назад", callback_data: "del:back" }]);
  return { inline_keyboard: rows };
}

export function deleteCategoryPickKeyboard(categories: string[]): TelegramInlineKeyboardMarkup {
  const rows = categories.slice(0, 20).map((cat, i) => [
    { text: cat, callback_data: `del:ccat:${i}` },
  ]);
  rows.push([{ text: "⬅️ Назад", callback_data: "del:back" }]);
  return { inline_keyboard: rows };
}

export function deleteCategoryListKeyboard(messages: DbMessage[]): TelegramInlineKeyboardMarkup {
  const rows = messages.slice(0, 30).map((m, i) => [
    { text: `${i + 1}`, callback_data: `del:cmsg:${m.message_id}` },
  ]);
  rows.push([{ text: "⬅️ Назад к категориям", callback_data: "del:cat" }]);
  return { inline_keyboard: rows };
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

export function editDailyListKeyboard(messages: DbMessage[]): TelegramInlineKeyboardMarkup {
  const rows = messages.slice(0, 30).map((m) => [
    { text: `📅 ${m.on_day}`, callback_data: `ed:dmsg:${m.message_id}` },
  ]);
  rows.push([{ text: "⬅️ Назад", callback_data: "ed:back" }]);
  return { inline_keyboard: rows };
}

export function editCategoryPickKeyboard(categories: string[]): TelegramInlineKeyboardMarkup {
  const rows = categories.slice(0, 20).map((cat, i) => [
    { text: cat, callback_data: `ed:ecat:${i}` },
  ]);
  rows.push([{ text: "⬅️ Назад", callback_data: "ed:back" }]);
  return { inline_keyboard: rows };
}

export function editCategoryListKeyboard(messages: DbMessage[]): TelegramInlineKeyboardMarkup {
  const rows = messages.slice(0, 30).map((m, i) => [
    { text: `${i + 1}`, callback_data: `ed:emsg:${m.message_id}` },
  ]);
  rows.push([{ text: "⬅️ Назад к категориям", callback_data: "ed:cat" }]);
  return { inline_keyboard: rows };
}

export function editInputKeyboard(isDaily: boolean): TelegramInlineKeyboardMarkup {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (isDaily) {
    rows.push([{ text: "📅 Изменить дату", callback_data: "ed:pickdate" }]);
  } else {
    rows.push([{ text: "📂 Изменить категорию", callback_data: "ed:pickcat" }]);
  }
  rows.push([{ text: "🔄 Изменить тип", callback_data: "ed:picktype" }]);
  rows.push([{ text: "📝 Изменить текст", callback_data: "ed:pickcontent" }]);
  rows.push([{ text: "✅ Сохранить", callback_data: "ed:confirm" }]);
  rows.push([{ text: "⬅️ Назад", callback_data: "menu:main" }]);
  return { inline_keyboard: rows };
}

export function editCategoryReselect(categories: string[]): TelegramInlineKeyboardMarkup {
  const rows = categories.slice(0, 20).map((cat, i) => [
    { text: cat, callback_data: `ed:recat:${i}` },
  ]);
  rows.push([{ text: "⬅️ Назад", callback_data: "ed:inputback" }]);
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

  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  // Month + year header
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
    const row: Array<{ text: string; callback_data: string }> = [];
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

// ─── Helpers ───────────────────────────────────────────
export function truncate(text: string, maxLen = 60): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

export function formatMessagePreview(m: DbMessage, index?: number): string {
  const prefix = index != null ? `${index + 1}. ` : "";
  const readMark = m.is_read ? "✅" : "🆕";
  const type = `[${m.type}]`;
  const date = m.on_day ? `📅 ${m.on_day}` : "";
  const cat = m.category ? `📂 ${m.category}` : "";
  const meta = [type, date, cat, readMark].filter(Boolean).join(" ");
  return `${prefix}${meta}\n${truncate(m.content, 80)}`;
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
    lines.push(`📝 Текст:\n${p.content}`);
  } else {
    lines.push("📝 Текст сообщения: (ожидается ввод)");
  }
  return lines.join("\n");
}
