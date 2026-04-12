# Telegram Bot — Supabase Edge Function

Telegram-бот для управления базой данных сообщений для проекта [cozy-world](https://github.com/Yukovsky/cozy-world/). Работает как [Supabase Edge Function](https://supabase.com/docs/guides/functions) на Deno, использует Telegram Bot API через Webhook.

---

## Возможности

| Функция | Описание |
|---|---|
| 📅 **Ежедневные сообщения** | Добавить сообщение на конкретную дату. Автоматически предлагает ближайший свободный день. |
| 📂 **Категоризированные сообщения** | Добавить сообщение в одну из существующих категорий или создать новую. |
| ✏️ **Редактирование** | Изменить текст, дату, тип или категорию существующего сообщения. |
| 🗑 **Удаление** | Удалить любое сообщение (ежедневное или категоризированное). |
| 🧹 **Очистка устаревших** | Экспортировать в чат и удалить все сообщения с прошедшими датами. |
| 🔍 **Проверка дат** | Показывает, есть ли сообщения на сегодня и завтра, и до какого дня заполнен календарь. |

---

## Технологии

- **Runtime:** [Deno](https://deno.com/) (Supabase Edge Runtime)
- **Backend:** [Supabase](https://supabase.com/) (PostgreSQL + Edge Functions)
- **Telegram API:** нативные HTTP-запросы (без фреймворков)
- **Архитектура:** Webhook-based, stateful через таблицу сессий в БД

---

## Быстрый старт (локально)

Подробно всё описано в файле [DEPLOY.md](DEPLOY.md).

### Требования

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started): `npm i -g supabase`
- Telegram-бот от [@BotFather](https://t.me/BotFather)
- [ngrok](https://ngrok.com/) или аналог для публичного туннеля

### 1. Запустить Supabase

```bash
cd supabase
supabase start
supabase db reset
```

### 2. Создать файл окружения

```bash
cp functions/telegram-bot/.env.example functions/telegram-bot/.env.local
```

Заполнить `.env.local`:

```env
TELEGRAM_BOT_TOKEN=<токен от BotFather>
TELEGRAM_WEBHOOK_SECRET=<любая случайная строка>
SB_URL=http://host.docker.internal:54321
SB_SERVICE_ROLE_KEY=<service_role key из вывода supabase start>
BOT_MESSAGES_TABLE=messages
BOT_SESSIONS_TABLE=telegram_bot_sessions
BOT_TZ_OFFSET_MINUTES=180
BOT_DEFAULT_TYPE=text
```

### 3. Запустить функцию

```bash
supabase functions serve --env-file functions/telegram-bot/.env.local
```

### 4. Открыть туннель

```bash
ngrok http 54321
```

### 5. Зарегистрировать Webhook

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<ngrok-id>.ngrok.io/functions/v1/telegram-bot", "secret_token": "<WEBHOOK_SECRET>"}'
```

Готово — откройте бота в Telegram и отправьте `/start`.

---

## Деплой в продакшен

Подробное руководство: [DEPLOY_SUPABASE.md](./DEPLOY_SUPABASE.md)

Краткая последовательность:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
supabase secrets set TELEGRAM_BOT_TOKEN="..." SB_URL="https://<ref>.supabase.co" ...
supabase functions deploy telegram-bot --no-verify-jwt
```

---

## Структура проекта

```
supabase/
├── config.toml                         # Конфигурация Supabase CLI
├── DEPLOY.md                           # Руководство по деплою
├── migrations/
│   └── 20260412145237_remote_schema.sql
├── .github/
│   └── workflows/
│       └── deploy.yml
├── functions/
│   └── telegram-bot/
│       ├── index.ts                    # Точка входа (Webhook handler)
│       ├── .env.example                # Шаблон переменных окружения (в репозитории)
│       └── src/
│           ├── bot.ts                  # Основной роутер бота
│           ├── config.ts               # Чтение env-переменных
│           ├── types.ts                # TypeScript-типы
│           ├── db/
│           │   ├── client.ts           # Инициализация клиента БД
│           │   ├── messages.ts         # Репозиторий сообщений
│           │   └── sessions.ts         # Репозиторий сессий
│           ├── handlers/
│           │   ├── callbacks.ts        # Обработчики inline-кнопок
│           │   ├── commands.ts         # Обработчики команд
│           │   ├── context.ts          # Контекст запроса
│           │   ├── shared.ts           # Общие хелперы
│           │   └── text.ts             # Обработчик текстовых сообщений
│           └── lib/
│               ├── date.ts             # Утилиты для работы с датами
│               ├── errors.ts           # Обработчики ошибок
│               ├── keyboards.ts        # Все inline-клавиатуры
│               └── telegram.ts         # HTTP-клиент Telegram API
```

---

## Схема базы данных

### `messages`

| Поле | Тип | Описание |
|---|---|---|
| `message_id` | `integer` PK | Автоинкремент |
| `content` | `text` | Текст сообщения |
| `on_day` | `date` UNIQUE | Дата (только для ежедневных) |
| `type` | `message_type` | `text` / `video` / `audio` |
| `category` | `text` | Категория (только для категоризированных) |
| `is_read` | `boolean` | Прочитано ли |
| `created_at` | `timestamptz` | Время создания |

### `telegram_bot_sessions`

| Поле | Тип | Описание |
|---|---|---|
| `chat_id` | `bigint` PK | ID чата в Telegram |
| `state` | `jsonb` | Текущее состояние сессии |

### `unique_message_category`

View, поддерживаемый триггером — содержит уникальные категории.

---

## Безопасность

- Все запросы от Telegram проверяются по заголовку `X-Telegram-Bot-Api-Secret-Token`
- Бот рассчитан на **одного пользователя** — дополнительная проверка `chat_id` опциональна
- Edge Function использует `service_role` ключ — никогда не передавайте его клиентам

---

## Переменные окружения

Все переменные описаны в [`functions/telegram-bot/.env.example`](./functions/telegram-bot/.env.example).  
Для продакшена устанавливаются через `supabase secrets set`.

---

## Лицензия

MIT
