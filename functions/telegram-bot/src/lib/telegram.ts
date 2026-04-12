import type { TelegramInlineKeyboardMarkup } from "../types.ts";

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
    await this.#post("sendMessage", {
      chat_id: params.chatId,
      text: params.text,
      reply_markup: params.replyMarkup,
      parse_mode: params.parseMode,
    });
  }

  async editMessageText(params: {
    chatId: number;
    messageId: number;
    text: string;
    replyMarkup?: TelegramInlineKeyboardMarkup;
  }): Promise<void> {
    try {
      await this.#post("editMessageText", {
        chat_id: params.chatId,
        message_id: params.messageId,
        text: params.text,
        reply_markup: params.replyMarkup,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("message is not modified")) {
        return;
      }
      throw error;
    }
  }

  async answerCallbackQuery(params: { callbackQueryId: string; text?: string }): Promise<void> {
    await this.#post("answerCallbackQuery", {
      callback_query_id: params.callbackQueryId,
      text: params.text,
      show_alert: false,
    });
  }

  async sendDocument(params: {
    chatId: number;
    fileName: string;
    content: string;
    caption?: string;
  }): Promise<void> {
    const blob = new Blob([params.content], { type: "application/json" });
    const formData = new FormData();
    formData.append("chat_id", String(params.chatId));
    formData.append("document", blob, params.fileName);
    if (params.caption) {
      formData.append("caption", params.caption);
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
    const res = await fetch(`${this.#baseUrl}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload.ok === false) {
      const detail = payload?.description || res.statusText;
      throw new Error(`Telegram API error in ${method}: ${detail}`);
    }
  }
}
