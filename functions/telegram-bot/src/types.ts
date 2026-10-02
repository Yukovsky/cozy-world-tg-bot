export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

export type TelegramChat = {
  id: number;
  type: string;
};

export type TelegramUser = {
  id: number;
  first_name: string;
  username?: string;
};

export type TelegramMessage = {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
};

export type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

export type TelegramInlineKeyboardButton = {
  text: string;
  callback_data?: string;
};

export type TelegramInlineKeyboardMarkup = {
  inline_keyboard: TelegramInlineKeyboardButton[][];
};

export const MESSAGE_TYPES = ["text", "video", "audio"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export type SessionFlow = "idle" | "daily" | "category" | "delete" | "cleanup" | "edit";

export type SessionStep =
  | "idle"
  // Daily (Use-case 1)
  | "daily_input"
  | "daily_date_pick"
  | "daily_confirm"
  // Category (Use-case 2)
  | "category_pick"
  | "category_new"
  | "category_input"
  | "category_confirm"
  // Delete (Use-case 3)
  | "delete_kind"
  | "delete_daily_list"
  | "delete_daily_confirm"
  | "delete_cat_pick"
  | "delete_cat_list"
  | "delete_cat_confirm"
  // Cleanup (Use-case 4)
  | "cleanup_preview"
  // Edit (Use-case 5)
  | "edit_kind"
  | "edit_daily_list"
  | "edit_cat_pick"
  | "edit_cat_list"
  | "edit_input"
  | "edit_date_pick"
  | "edit_content"
  | "edit_confirm";

export type BotSessionState = {
  flow: SessionFlow;
  step: SessionStep;
  selectedDate: string | null;
  selectedCategory: string | null;
  selectedType: string;
  pendingContent: string | null;
  selectedMessageId: number | null;
  categoryOptions: string[];
  page?: number;
  categoryFilter?: string | null;
};

export type BotSessionRecord = {
  chat_id: number;
  state: BotSessionState;
  updated_at?: string;
};

export type BotMessageInsert = {
  content: string;
  on_day?: string | null;
  category?: string | null;
  type?: string;
};

export type DbMessage = {
  message_id: number;
  content: string;
  on_day: string | null;
  type: string;
  category: string | null;
  is_read: boolean;
  created_at: string;
};
