


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."message_type" AS ENUM (
    'text',
    'video',
    'audio'
);


ALTER TYPE "public"."message_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_unique_message_category"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$BEGIN
    -- Вставляем или обновляем запись
    INSERT INTO public.unique_message_category (category, is_read)
    SELECT category, is_read
    FROM messages
    WHERE category != 'daily'
    GROUP BY category, is_read
    ON CONFLICT (category, is_read) DO NOTHING;
    
    -- Удаляем записи которых нет в messages
    DELETE FROM public.unique_message_category umc
    WHERE NOT EXISTS (
        SELECT 1 FROM messages m 
        WHERE m.category = umc.category 
        AND m.is_read = umc.is_read
    );
    
    RETURN NULL;
END;$$;


ALTER FUNCTION "public"."sync_unique_message_category"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "message_id" integer NOT NULL,
    "content" "text" NOT NULL,
    "on_day" "date",
    "type" "public"."message_type" DEFAULT 'text'::"public"."message_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "category" "text"
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."messages_messageid_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."messages_messageid_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."messages_messageid_seq" OWNED BY "public"."messages"."message_id";



CREATE TABLE IF NOT EXISTS "public"."messages_dev" (
    "message_id" integer DEFAULT "nextval"('"public"."messages_messageid_seq"'::"regclass") NOT NULL,
    "content" "text" NOT NULL,
    "on_day" "date",
    "type" "public"."message_type" DEFAULT 'text'::"public"."message_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "category" "text"
);


ALTER TABLE "public"."messages_dev" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages_dev" IS 'This is a duplicate of messages';



CREATE TABLE IF NOT EXISTS "public"."telegram_bot_sessions" (
    "chat_id" bigint NOT NULL,
    "state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."telegram_bot_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."unique_message_category" (
    "id" integer NOT NULL,
    "category" "text" NOT NULL,
    "is_read" boolean NOT NULL
);


ALTER TABLE "public"."unique_message_category" OWNER TO "postgres";


ALTER TABLE "public"."unique_message_category" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."unique_message_category_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."messages" ALTER COLUMN "message_id" SET DEFAULT "nextval"('"public"."messages_messageid_seq"'::"regclass");



ALTER TABLE ONLY "public"."messages_dev"
    ADD CONSTRAINT "messages_debug_on_day_key" UNIQUE ("on_day");



ALTER TABLE ONLY "public"."messages_dev"
    ADD CONSTRAINT "messages_debug_pkey" PRIMARY KEY ("message_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_on_day_key" UNIQUE ("on_day");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("message_id");



ALTER TABLE ONLY "public"."telegram_bot_sessions"
    ADD CONSTRAINT "telegram_bot_sessions_pkey" PRIMARY KEY ("chat_id");



ALTER TABLE ONLY "public"."unique_message_category"
    ADD CONSTRAINT "unique_message_category_category_is_read_key" UNIQUE ("category", "is_read");



ALTER TABLE ONLY "public"."unique_message_category"
    ADD CONSTRAINT "unique_message_category_pkey" PRIMARY KEY ("id");



CREATE OR REPLACE TRIGGER "sync_message_category_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."sync_unique_message_category"();



CREATE POLICY "Enable all operations for all users" ON "public"."unique_message_category" USING (true) WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."messages" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."messages_dev" FOR SELECT USING (true);



CREATE POLICY "Enable update access for all users" ON "public"."messages" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "Enable update access for all users" ON "public"."messages_dev" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages_dev" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."telegram_bot_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."unique_message_category" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."sync_unique_message_category"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_unique_message_category"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_unique_message_category"() TO "service_role";


















GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."messages_messageid_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."messages_messageid_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."messages_messageid_seq" TO "service_role";



GRANT ALL ON TABLE "public"."messages_dev" TO "anon";
GRANT ALL ON TABLE "public"."messages_dev" TO "authenticated";
GRANT ALL ON TABLE "public"."messages_dev" TO "service_role";



GRANT ALL ON TABLE "public"."telegram_bot_sessions" TO "anon";
GRANT ALL ON TABLE "public"."telegram_bot_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."telegram_bot_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."unique_message_category" TO "anon";
GRANT ALL ON TABLE "public"."unique_message_category" TO "authenticated";
GRANT ALL ON TABLE "public"."unique_message_category" TO "service_role";



GRANT ALL ON SEQUENCE "public"."unique_message_category_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."unique_message_category_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."unique_message_category_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";


