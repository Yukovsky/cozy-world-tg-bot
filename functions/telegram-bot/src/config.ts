type BotConfig = {
  telegramBotToken: string;
  telegramWebhookSecret: string | null;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  messagesTable: string;
  sessionsTable: string;
  timezoneOffsetMinutes: number;
  defaultType: string;
};

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function getRequiredEnvAny(names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value && value.trim()) {
      return value;
    }
  }
  throw new Error(`Missing required env var (one of): ${names.join(", ")}`);
}

export function loadConfig(): BotConfig {
  return {
    telegramBotToken: getRequiredEnv("TELEGRAM_BOT_TOKEN"),
    telegramWebhookSecret: Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? null,
    supabaseUrl: getRequiredEnvAny(["SB_URL", "SUPABASE_URL"]),
    supabaseServiceRoleKey: getRequiredEnvAny([
      "SB_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]),
    messagesTable: Deno.env.get("BOT_MESSAGES_TABLE")?.trim() || "messages",
    sessionsTable: Deno.env.get("BOT_SESSIONS_TABLE")?.trim() || "telegram_bot_sessions",
    timezoneOffsetMinutes: Number(Deno.env.get("BOT_TZ_OFFSET_MINUTES") || "180"),
    defaultType: Deno.env.get("BOT_DEFAULT_TYPE")?.trim() || "text",
  };
}

export type { BotConfig };
