import type { TelegramInlineKeyboardMarkup } from "../types.ts";

export function toSafeUtf8String(str: string): string {
  if (typeof str.toWellFormed === "function") {
    return str.toWellFormed();
  }
  return str.replace(
    /([\uD800-\uDBFF])(?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])([\uDC00-\uDFFF])/g,
    "\uFFFD"
  );
}

export function sanitizeUtf8<T>(val: T): T {
  if (typeof val === "string") {
    return toSafeUtf8String(val) as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeUtf8) as unknown as T;
  }
  if (val !== null && typeof val === "object") {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = sanitizeUtf8(v);
    }
    return res as unknown as T;
  }
  return val;
}

export function truncateToLimit(text: string, maxLen = 4000): string {
  const chars = Array.from(text ?? "");
  if (chars.length <= maxLen) return toSafeUtf8String(text);
  const truncated = chars.slice(0, maxLen - 30).join("");
  return toSafeUtf8String(`${truncated}\n\n[...сообщение обрезано...]`);
}

export class TelegramClient {
  #baseUrl: string;

  constructor(token: string) {
    this.#baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(params: {
    chatId: number;
    text: string;
    replyMarkup?: TelegramInlineKeyboardMarkup;
    parseMode?: string;
  }): Promise<void> {
    const text = truncateToLimit(params.text, 4000);
    await this.#post("sendMessage", {
      chat_id: params.chatId,
      text,
      reply_markup: params.replyMarkup,
      parse_mode: params.parseMode,
    });
  }

  async editMessageText(params: {
    chatId: number;
    messageId: number;
    text: string;
    replyMarkup?: TelegramInlineKeyboardMarkup;
    parseMode?: string;
  }): Promise<void> {
    const text = truncateToLimit(params.text, 4000);
    try {
      await this.#post("editMessageText", {
        chat_id: params.chatId,
        message_id: params.messageId,
        text,
        reply_markup: params.replyMarkup,
        parse_mode: params.parseMode,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("message is not modified")) {
        return;
      }
      throw error;
    }
  }

  async deleteMessage(params: { chatId: number; messageId: number }): Promise<boolean> {
    try {
      await this.#post("deleteMessage", {
        chat_id: params.chatId,
        message_id: params.messageId,
      });
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("message to delete not found") ||
          error.message.includes("message can't be deleted"))
      ) {
        return false;
      }
      throw error;
    }
  }

  async answerCallbackQuery(params: { callbackQueryId: string; text?: string }): Promise<void> {
    await this.#post("answerCallbackQuery", {
      callback_query_id: params.callbackQueryId,
      text: params.text ? toSafeUtf8String(params.text) : undefined,
      show_alert: false,
    });
  }

  async sendDocument(params: {
    chatId: number;
    fileName: string;
    content: string;
    caption?: string;
  }): Promise<void> {
    const safeContent = toSafeUtf8String(params.content);
    const blob = new Blob([safeContent], { type: "application/json;charset=utf-8" });
    const formData = new FormData();
    formData.append("chat_id", String(params.chatId));
    formData.append("document", blob, params.fileName);
    if (params.caption) {
      formData.append("caption", truncateToLimit(params.caption, 1024));
    }

    const res = await fetch(`${this.#baseUrl}/sendDocument`, {
      method: "POST",
      body: formData,
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload.ok === false) {
      const detail = payload?.description || res.statusText;
      throw new Error(`Telegram API error in sendDocument: ${detail}`);
    }
  }

  async #post(method: string, body: unknown): Promise<void> {
    const sanitizedBody = sanitizeUtf8(body);
    const res = await fetch(`${this.#baseUrl}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(sanitizedBody),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload.ok === false) {
      const detail = payload?.description || res.statusText;
      throw new Error(`Telegram API error in ${method}: ${detail}`);
    }
  }
}
