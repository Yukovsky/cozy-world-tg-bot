# Деплой на Supabase

Полное руководство по внедрению Telegram-бота в Supabase (локально и в продакшене).

---

## Содержание

1. [Предварительные требования](#1-предварительные-требования)
2. [Локальный запуск](#2-локальный-запуск)
3. [Деплой в продакшен](#3-деплой-в-продакшен)
4. [Настройка Telegram Webhook](#4-настройка-telegram-webhook)
5. [Переменные окружения](#5-переменные-окружения)
6. [Схема базы данных](#6-схема-базы-данных)
7. [RLS (Row Level Security)](#7-rls-row-level-security)
8. [Проверка работы](#8-проверка-работы)
9. [Обновление функции](#9-обновление-функции)

---

## 1. Предварительные требования

- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (для локального запуска)
- [ngrok](https://ngrok.com/) (или аналог для локального запуска)
- [Deno](https://deno.com/) v1.40+ (опционально, для проверки типов локально)
- Аккаунт на [supabase.com](https://supabase.com) и созданный проект
- Telegram-бот, созданный через [@BotFather](https://t.me/BotFather)

---

## 2. Локальный запуск

### 2.1. Инициализация

```bash
# Клонировать репозиторий и перейти в папку supabase
cd supabase

# Запустить локальный Supabase (поднимет Docker-контейнеры)
supabase start
```

После запуска в консоли появятся ключи:
```
API URL: http://127.0.0.1:54321
anon key: eyJ...
service_role key: eyJ...
```

### 2.2. Применить миграции

```bash
# Применяет все файлы из migrations/ к локальной БД
supabase db reset
```

### 2.3. Настроить переменные окружения

Создать файл `functions/telegram-bot/.env.local`:

```env
TELEGRAM_BOT_TOKEN=<ваш токен от BotFather>
TELEGRAM_WEBHOOK_SECRET=<любая случайная строка>

# Важно: именно host.docker.internal, а не 127.0.0.1
# Edge Functions запускаются в Docker и не видят localhost хоста
SB_URL=http://host.docker.internal:54321
SB_SERVICE_ROLE_KEY=<service_role key из вывода supabase start>

BOT_MESSAGES_TABLE=messages
BOT_SESSIONS_TABLE=telegram_bot_sessions
BOT_TZ_OFFSET_MINUTES=180
BOT_DEFAULT_TYPE=text
```

> ⚠️ **Никогда не коммитьте `.env.local`!** Убедитесь, что он в `.gitignore`.

### 2.4. Запустить Edge Functions

```bash
supabase functions serve --env-file functions/telegram-bot/.env.local
```

Функция будет доступна по адресу:  
`http://127.0.0.1:54321/functions/v1/telegram-bot`

### 2.5. Открыть туннель для Webhook (ngrok или аналог)

Telegram не может достучаться до `127.0.0.1`, поэтому нужен публичный URL.

**Вариант A: ngrok**
```bash
ngrok http 54321
# Запомнить выданный URL, например: https://abc123.ngrok.io
```

**Вариант B: Cloudflare Tunnel**
```bash
cloudflared tunnel --url http://localhost:54321
```

### 2.6. Зарегистрировать Webhook

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://abc123.ngrok.io/functions/v1/telegram-bot",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET из .env.local>"
  }'
```

Ожидаемый ответ:
```json
{"ok": true, "result": true, "description": "Webhook was set"}
```

### 2.7. Проверка

Откройте бота в Telegram и отправьте `/start` или `/menu`.

---

## 3. Деплой в продакшен

### 3.1. Войти в Supabase CLI

```bash
supabase login
```

### 3.2. Привязать к проекту

```bash
# project-ref — ID проекта из URL: https://app.supabase.com/project/<project-ref>
supabase link --project-ref <project-ref>
```

### 3.3. Применить миграции в прод

К этой команде стоит относиться с осторожностью, так как, если данные в БД уже актуальные, её выполять **не стоит**.

```bash
supabase db push
```

Это выполнит все файлы из `migrations/` против продакшен-базы.

### 3.4. Задать секреты для Edge Functions

```bash
supabase secrets set \
  TELEGRAM_BOT_TOKEN="<токен>" \
  TELEGRAM_WEBHOOK_SECRET="<секрет>" \
  SB_URL="https://<project-ref>.supabase.co" \
  SB_SERVICE_ROLE_KEY="<service_role key из Dashboard → Settings → API>" \
  BOT_MESSAGES_TABLE="messages" \
  BOT_SESSIONS_TABLE="telegram_bot_sessions" \
  BOT_TZ_OFFSET_MINUTES="180" \
  BOT_DEFAULT_TYPE="text"
```

> Просмотреть заданные секреты: `supabase secrets list`

### 3.5. Задеплоить функцию

```bash
supabase functions deploy telegram-bot --no-verify-jwt
```

Флаг `--no-verify-jwt` критически важен: Telegram не отправляет JWT-токены, а подлинность запросов проверяется через `X-Telegram-Bot-Api-Secret-Token`.

После деплоя URL функции:
```
https://<project-ref>.supabase.co/functions/v1/telegram-bot
```

### 3.6. Зарегистрировать Webhook на продакшен URL

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<project-ref>.supabase.co/functions/v1/telegram-bot",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

---

## 4. Настройка Telegram Webhook

### Проверить текущий Webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

### Удалить Webhook (для перехода на polling/тестирование)

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/deleteWebhook"
```

### Webhook Secret

Каждый запрос от Telegram содержит заголовок:
```
X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>
```

Бот проверяет этот заголовок в `index.ts` — запросы без правильного секрета отклоняются со статусом `403`.

---

## 5. Переменные окружения

| Переменная | Описание | Пример |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен бота от BotFather | `123456:ABC-DEF...` |
| `TELEGRAM_WEBHOOK_SECRET` | Секрет для проверки запросов Telegram | `my_random_secret_42` |
| `SB_URL` | URL Supabase (локально: `http://host.docker.internal:54321`) | `https://xxx.supabase.co` |
| `SB_SERVICE_ROLE_KEY` | Service role ключ (обходит RLS) | `eyJ...` |
| `BOT_MESSAGES_TABLE` | Название таблицы сообщений | `messages` |
| `BOT_SESSIONS_TABLE` | Название таблицы сессий | `telegram_bot_sessions` |
| `BOT_TZ_OFFSET_MINUTES` | Смещение часового пояса в минутах | `180` (UTC+3) |
| `BOT_DEFAULT_TYPE` | Тип сообщения по умолчанию | `text` |

---

## 6. Схема базы данных

Миграция применяется автоматически. Ключевые объекты:

### Таблица `messages`
```sql
CREATE TABLE messages (
  message_id  integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  content     text NOT NULL,
  on_day      date UNIQUE,          -- только для ежедневных
  type        message_type NOT NULL DEFAULT 'text',
  category    text,                 -- только для категоризированных
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

### Таблица `telegram_bot_sessions`
```sql
CREATE TABLE telegram_bot_sessions (
  chat_id  bigint PRIMARY KEY,
  state    jsonb NOT NULL DEFAULT '{}'
);
```

### View `unique_message_category`
Автоматически поддерживается триггером `sync_unique_message_category`. Содержит уникальные категории сообщений.

---

## 7. RLS (Row Level Security)

По умолчанию бот использует `service_role` ключ, который **автоматически обходит RLS**. Таблицы можно защитить от прямого доступа через `anon` ключ:

```sql
-- Включить RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_bot_sessions ENABLE ROW LEVEL SECURITY;

-- Запретить всё для анонимных пользователей
-- (service_role обходит RLS автоматически, ничего больше не нужно)
```

После этого таблицы перестанут быть `unrestricted` в Dashboard, но Edge Function продолжит работать без изменений.

---

## 8. Проверка работы

### Локально

1. `supabase start` → `supabase db reset` → `supabase functions serve --env-file functions/telegram-bot/.env.local`
2. Запустить ngrok: `ngrok http 54321`
3. Зарегистрировать webhook с ngrok URL
4. Отправить `/start` в бот
5. Логи: `supabase functions serve` выводит их в реальном времени

### В продакшене

Логи в Dashboard: **Edge Functions → telegram-bot → Logs**

Или через CLI:
```bash
supabase functions logs telegram-bot --tail
```

---

## 9. Обновление функции

```bash
# Внести изменения в код, затем:
supabase functions deploy telegram-bot --no-verify-jwt
```

Деплой занимает ~30 секунд. Webhook перезапускать не нужно — URL остаётся тем же.
