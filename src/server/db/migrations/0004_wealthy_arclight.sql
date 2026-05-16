CREATE TABLE "auth_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_rate_limits_action_updated_idx" ON "auth_rate_limits" USING btree ("action","updated_at");--> statement-breakpoint
CREATE INDEX "auth_rate_limits_locked_until_idx" ON "auth_rate_limits" USING btree ("locked_until");