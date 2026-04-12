import "@supabase/functions-js/edge-runtime.d.ts"
import { loadConfig } from "./src/config.ts";
import { processUpdate } from "./src/bot.ts";
import type { TelegramUpdate } from "./src/types.ts";

const config = loadConfig();

function isValidWebhookSecret(req: Request): boolean {
  if (!config.telegramWebhookSecret) return true;
  const provided = req.headers.get("x-telegram-bot-api-secret-token");
  return provided === config.telegramWebhookSecret;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!isValidWebhookSecret(req)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const update = await req.json() as TelegramUpdate;
    await processUpdate(config, update);
    return new Response("ok", { status: 200 });
  } catch (error) {
    console.error("Fatal webhook parse/dispatch error", error);
    return new Response("Bad Request", { status: 400 });
  }
});
