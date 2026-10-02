import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { BotMessageInsert, DbMessage } from "../types.ts";
import { formatYyyyMmDd, parseYyyyMmDd, plusDays } from "../lib/date.ts";

export class MessagesRepository {
  #supabase: SupabaseClient;
  #table: string;

  constructor(supabase: SupabaseClient, table: string) {
    this.#supabase = supabase;
    this.#table = table;
  }

  async insertMessage(input: BotMessageInsert): Promise<void> {
    const payload = {
      content: input.content,
      on_day: input.on_day ?? null,
      category: input.category ?? null,
      type: input.type ?? "text",
    };

    const { error } = await this.#supabase.from(this.#table).insert(payload);
    if (error) {
      if (error.message?.includes("unique") || error.message?.includes("duplicate") || error.code === "23505") {
        throw new Error(`На дату ${input.on_day} уже существует сообщение.`);
      }
      throw new Error(`Ошибка записи в БД: ${error.message}`);
    }
  }

  async getMessage(messageId: number): Promise<DbMessage | null> {
    const { data, error } = await this.#supabase
      .from(this.#table)
      .select("message_id, content, on_day, type, category, is_read, created_at")
      .eq("message_id", messageId)
      .maybeSingle();

    if (error) throw new Error(`Ошибка чтения из БД: ${error.message}`);
    return data as DbMessage | null;
  }

  async updateMessage(
    messageId: number,
    updates: Partial<Pick<DbMessage, "content" | "on_day" | "type" | "category">>,
  ): Promise<void> {
    const { error } = await this.#supabase
      .from(this.#table)
      .update(updates)
      .eq("message_id", messageId);

    if (error) {
      if (error.message?.includes("unique") || error.message?.includes("duplicate") || error.code === "23505") {
        throw new Error(`На дату ${updates.on_day} уже существует сообщение.`);
      }
      throw new Error(`Ошибка обновления в БД: ${error.message}`);
    }
  }

  async deleteMessage(messageId: number): Promise<void> {
    const { error } = await this.#supabase
      .from(this.#table)
      .delete()
      .eq("message_id", messageId);

    if (error) throw new Error(`Ошибка удаления: ${error.message}`);
  }

  async listExpiredDaily(todayIso: string): Promise<DbMessage[]> {
    const { data, error } = await this.#supabase
      .from(this.#table)
      .select("message_id, content, on_day, type, category, is_read, created_at")
      .lt("on_day", todayIso)
      .not("on_day", "is", null)
      .order("on_day", { ascending: true });

    if (error) throw new Error(`Ошибка чтения устаревших: ${error.message}`);
    return (data ?? []) as DbMessage[];
  }

  async deleteExpiredDaily(todayIso: string): Promise<number> {
    const { data, error } = await this.#supabase
      .from(this.#table)
      .delete()
      .lt("on_day", todayIso)
      .not("on_day", "is", null)
      .select("message_id");

    if (error) throw new Error(`Ошибка очистки: ${error.message}`);
    return data?.length ?? 0;
  }

  async listDailyMessages(descending = true): Promise<DbMessage[]> {
    const { data, error } = await this.#supabase
      .from(this.#table)
      .select("message_id, content, on_day, type, category, is_read, created_at")
      .not("on_day", "is", null)
      .order("on_day", { ascending: !descending });

    if (error) throw new Error(`Ошибка чтения ежедневных: ${error.message}`);
    return (data ?? []) as DbMessage[];
  }

  async listCategoryMessages(category: string, descending = true): Promise<DbMessage[]> {
    const { data, error } = await this.#supabase
      .from(this.#table)
      .select("message_id, content, on_day, type, category, is_read, created_at")
      .eq("category", category)
      .order("created_at", { ascending: !descending });

    if (error) throw new Error(`Ошибка чтения сообщений категории: ${error.message}`);
    return (data ?? []) as DbMessage[];
  }

  async listUnreadCategorized(): Promise<DbMessage[]> {
    const { data, error } = await this.#supabase
      .from(this.#table)
      .select("message_id, content, on_day, type, category, is_read, created_at")
      .not("category", "is", null)
      .eq("is_read", false)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Ошибка чтения непрочитанных сообщений: ${error.message}`);
    return (data ?? []) as DbMessage[];
  }

  async countUnreadCategorized(): Promise<number> {
    const { count, error } = await this.#supabase
      .from(this.#table)
      .select("*", { count: "exact", head: true })
      .not("category", "is", null)
      .eq("is_read", false);

    if (error) return 0;
    return count ?? 0;
  }

  async listDailyDates(): Promise<string[]> {
    const { data, error } = await this.#supabase
      .from(this.#table)
      .select("on_day")
      .not("on_day", "is", null)
      .order("on_day", { ascending: true });

    if (error) throw new Error(`Ошибка чтения дат: ${error.message}`);

    const unique = new Set<string>();
    for (const row of data ?? []) {
      const onDay = (row as { on_day?: string | null }).on_day;
      if (onDay) unique.add(onDay);
    }
    return Array.from(unique).sort();
  }

  async checkDateCoverage(todayIso: string): Promise<{ maxDate: string | null; hasTodayOrTomorrow: { today: boolean; tomorrow: boolean } }> {
    const { data, error } = await this.#supabase
      .from(this.#table)
      .select("on_day")
      .not("on_day", "is", null)
      .gte("on_day", todayIso)
      .order("on_day", { ascending: false })
      .limit(1000);

    if (error) throw new Error(`Ошибка проверки дат: ${error.message}`);

    const dates = new Set<string>();
    for (const row of data ?? []) {
      const onDay = (row as { on_day?: string | null }).on_day;
      if (onDay) dates.add(onDay);
    }

    const tomorrowIso = formatYyyyMmDd(plusDays(parseYyyyMmDd(todayIso)!, 1));
    const maxDate = dates.size > 0 ? Array.from(dates).sort().at(-1)! : null;

    return {
      maxDate,
      hasTodayOrTomorrow: {
        today: dates.has(todayIso),
        tomorrow: dates.has(tomorrowIso),
      },
    };
  }

  async listCategories(): Promise<string[]> {
    const { data, error } = await this.#supabase
      .from("unique_message_category")
      .select("category")
      .order("category", { ascending: true });

    if (error) {
      // Fallback: query messages table directly
      return this.#listCategoriesFromMessages();
    }

    const unique = new Set<string>();
    for (const row of data ?? []) {
      const category = (row as { category?: string }).category?.trim();
      if (category) unique.add(category);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }

  async #listCategoriesFromMessages(): Promise<string[]> {
    const { data, error } = await this.#supabase
      .from(this.#table)
      .select("category")
      .not("category", "is", null)
      .order("category", { ascending: true });

    if (error) throw new Error(`Ошибка чтения категорий: ${error.message}`);

    const unique = new Set<string>();
    for (const row of data ?? []) {
      const category = (row as { category?: string | null }).category?.trim();
      if (category) unique.add(category);
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }
}
