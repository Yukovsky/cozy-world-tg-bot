import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { BotSessionRecord, BotSessionState } from "../types.ts";

export const initialSessionState: BotSessionState = {
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

export class SessionsRepository {
  #supabase: SupabaseClient;
  #table: string;

  constructor(supabase: SupabaseClient, table: string) {
    this.#supabase = supabase;
    this.#table = table;
  }

  async get(chatId: number): Promise<BotSessionState> {
    const { data, error } = await this.#supabase
      .from(this.#table)
      .select("chat_id, state")
      .eq("chat_id", chatId)
      .maybeSingle();

    if (error) {
      throw new Error(`Session read error: ${error.message}`);
    }

    if (!data) {
      return { ...initialSessionState };
    }

    const row = data as BotSessionRecord;
    return {
      ...initialSessionState,
      ...(row.state ?? {}),
    };
  }

  async set(chatId: number, state: BotSessionState): Promise<void> {
    const payload: BotSessionRecord = {
      chat_id: chatId,
      state,
    };

    const { error } = await this.#supabase.from(this.#table).upsert(payload);
    if (error) {
      throw new Error(`Session upsert error: ${error.message}`);
    }
  }

  async reset(chatId: number): Promise<void> {
    await this.set(chatId, { ...initialSessionState });
  }
}
