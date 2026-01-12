CREATE TABLE "allowances" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"connection_id" text NOT NULL,
	"sats" integer NOT NULL,
	"frequency" text NOT NULL,
	"last_paid_date" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "balance_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"peer_id" integer NOT NULL,
	"connection_id" text NOT NULL,
	"balance" integer NOT NULL,
	"btc_price_eur" integer NOT NULL,
	"value_eur" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthday_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"created_by" integer NOT NULL,
	"person_name" text NOT NULL,
	"birth_month" integer NOT NULL,
	"birth_day" integer NOT NULL,
	"birth_year" integer,
	"relation" text,
	"notify_days_before" integer[] DEFAULT '{0,1,7}',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"from_peer_id" integer NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_bitcoin_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"peer_id" integer NOT NULL,
	"connection_id" text NOT NULL,
	"value_eur" integer NOT NULL,
	"satoshi_amount" integer NOT NULL,
	"cumulative_sats" integer DEFAULT 0 NOT NULL,
	"cumulative_euro" integer DEFAULT 0 NOT NULL,
	"btc_price" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"peer_id" integer NOT NULL,
	"challenge_date" text NOT NULL,
	"challenge_type" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emergency_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"created_by" integer NOT NULL,
	"label" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"notes" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_rsvps" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"peer_id" integer NOT NULL,
	"response" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failed_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"from_peer_id" integer NOT NULL,
	"to_peer_id" integer NOT NULL,
	"to_name" text NOT NULL,
	"to_lightning_address" text,
	"sats" integer NOT NULL,
	"payment_type" text NOT NULL,
	"task_id" integer,
	"error_message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_retry_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_board_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"created_by" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"tags" text[] DEFAULT '{}',
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"created_by" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"location" text,
	"color" text DEFAULT 'primary',
	"event_type" text DEFAULT 'appointment',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"peer_id" integer NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_activity_date" timestamp,
	"completed_modules" text[] DEFAULT '{}' NOT NULL,
	"unlocked_achievements" text[] DEFAULT '{}' NOT NULL,
	"total_quizzes_passed" integer DEFAULT 0 NOT NULL,
	"total_sats_earned" integer DEFAULT 0 NOT NULL,
	"daily_challenges_completed" integer DEFAULT 0 NOT NULL,
	"graduated_at" timestamp,
	"guardian_level" integer DEFAULT 0 NOT NULL,
	"mastery_streak_count" integer DEFAULT 0 NOT NULL,
	"graduation_bonus_claimed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "level_bonus_payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"child_id" integer NOT NULL,
	"connection_id" text NOT NULL,
	"level" integer NOT NULL,
	"sats" integer NOT NULL,
	"paid_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "level_bonus_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_id" integer NOT NULL,
	"connection_id" text NOT NULL,
	"bonus_sats" integer DEFAULT 210 NOT NULL,
	"milestone_interval" integer DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_pings" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"child_id" integer NOT NULL,
	"latitude" text,
	"longitude" text,
	"accuracy" integer,
	"note" text,
	"map_url" text,
	"status" text DEFAULT 'arrived' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"parent_id" integer NOT NULL,
	"child_id" integer NOT NULL,
	"child_name" text NOT NULL,
	"sats" integer NOT NULL,
	"memo" text,
	"bolt11" text NOT NULL,
	"payment_hash" text,
	"expires_at" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_type" text NOT NULL,
	"task_id" integer,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_savings_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"peer_id" integer NOT NULL,
	"connection_id" text NOT NULL,
	"value_eur" integer NOT NULL,
	"satoshi_amount" integer NOT NULL,
	"interest_earned" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_safe_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"created_by" integer NOT NULL,
	"label" text NOT NULL,
	"username" text,
	"password_enc" text NOT NULL,
	"url" text,
	"notes_enc" text,
	"category" text DEFAULT 'general',
	"last_rotated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"pin" text NOT NULL,
	"connection_id" text NOT NULL,
	"family_name" text,
	"balance" integer DEFAULT 0 NOT NULL,
	"lnbits_url" text,
	"lnbits_admin_key" text,
	"nwc_connection_string" text,
	"wallet_type" text,
	"lightning_address" text,
	"donation_address" text,
	"favorite_color" text,
	"seed_phrase_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"peer_id" integer NOT NULL,
	"connection_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"created_by" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"sats" integer NOT NULL,
	"frequency" text NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"time" text DEFAULT '09:00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_created_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_list" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"created_by" integer NOT NULL,
	"item" text NOT NULL,
	"quantity" text,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" text NOT NULL,
	"created_by" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"sats" integer NOT NULL,
	"status" text NOT NULL,
	"assigned_to" integer,
	"assigned_for" integer,
	"proof" text,
	"payment_hash" text,
	"is_required" boolean DEFAULT false NOT NULL,
	"minimum_required_tasks" integer DEFAULT 0 NOT NULL,
	"bypass_ratio" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_peer_id" integer NOT NULL,
	"to_peer_id" integer NOT NULL,
	"sats" integer NOT NULL,
	"task_id" integer,
	"type" text NOT NULL,
	"payment_hash" text,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
