CREATE TYPE "public"."actor_role" AS ENUM('owner', 'admin', 'operator', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."approval_state" AS ENUM('candidate', 'pending_approval', 'approved', 'executing', 'succeeded', 'failed', 'reverted', 'expired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'leased', 'running', 'succeeded', 'failed', 'retrying', 'dead_lettered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('uploaded', 'parsing', 'parsed', 'failed', 'retained', 'expired');--> statement-breakpoint
CREATE TABLE "actors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "actor_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"severity" "alert_severity" DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"related_order_id" text,
	"related_product_id" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_request_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"request_hash" text NOT NULL,
	"status_code" integer,
	"duration_ms" integer,
	"rate_limit_bucket" text,
	"redacted_request" jsonb,
	"redacted_response" jsonb,
	"redacted_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" "approval_state" DEFAULT 'candidate' NOT NULL,
	"action_type" text NOT NULL,
	"vendor_id" text NOT NULL,
	"target_ids" jsonb NOT NULL,
	"payload" jsonb NOT NULL,
	"approval_hash" text NOT NULL,
	"requested_by_actor_id" uuid,
	"approved_by_actor_id" uuid,
	"reason" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" uuid,
	"approval_id" uuid,
	"previous_state" text,
	"next_state" text,
	"request_hash" text,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dead_letters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_job_run_id" uuid,
	"reason" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"processed_rows" integer DEFAULT 0 NOT NULL,
	"total_rows" integer,
	"checkpoint" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"normalized" jsonb NOT NULL,
	"raw_payload_ref" text,
	"validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"display_name" text NOT NULL,
	"status" text DEFAULT 'not_configured' NOT NULL,
	"credential_ref" text,
	"last_smoke_test_at" timestamp with time zone,
	"last_smoke_test_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"status" "job_status" NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"checkpoint" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"error_message" text,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now(),
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"payload_ref" text,
	"idempotency_key" text NOT NULL,
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"checkpoint" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"target" text,
	"severity" "alert_severity" DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" text NOT NULL,
	"shipment_box_id" text,
	"vendor_item_id" text,
	"ownerclan_product_code" text,
	"order_status" text NOT NULL,
	"buyer_name_masked" text,
	"receiver_info_encrypted" text,
	"shipping_address_hash" text,
	"is_cancel_requested" boolean DEFAULT false NOT NULL,
	"is_return_requested" boolean DEFAULT false NOT NULL,
	"fulfillment_status" text DEFAULT 'pending' NOT NULL,
	"raw_payload_ref" text,
	"ordered_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_product_id" text NOT NULL,
	"vendor_item_id" text NOT NULL,
	"external_vendor_sku" text,
	"ownerclan_product_code" text,
	"ownerclan_option_code" text,
	"product_name" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"non_winner_count" integer DEFAULT 0 NOT NULL,
	"last_order_at" timestamp with time zone,
	"has_open_claim" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"coupang_order_id" text NOT NULL,
	"ownerclan_order_id" text,
	"shipment_box_id" text,
	"courier_code" text,
	"tracking_number_masked" text,
	"uploaded_to_coupang" boolean DEFAULT false NOT NULL,
	"upload_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"status" "upload_status" DEFAULT 'uploaded' NOT NULL,
	"blob_url" text NOT NULL,
	"blob_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text,
	"byte_size" integer NOT NULL,
	"checksum" text NOT NULL,
	"uploaded_by_actor_id" uuid,
	"retention_deadline" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_actor_id_actors_id_fk" FOREIGN KEY ("requested_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approved_by_actor_id_actors_id_fk" FOREIGN KEY ("approved_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dead_letters" ADD CONSTRAINT "dead_letters_source_job_run_id_job_runs_id_fk" FOREIGN KEY ("source_job_run_id") REFERENCES "public"."job_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_upload_id_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploaded_by_actor_id_actors_id_fk" FOREIGN KEY ("uploaded_by_actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "actors_email_unique" ON "actors" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "api_request_logs_hash_unique" ON "api_request_logs" USING btree ("request_hash");--> statement-breakpoint
CREATE INDEX "api_request_logs_provider_status_idx" ON "api_request_logs" USING btree ("provider","status_code");--> statement-breakpoint
CREATE UNIQUE INDEX "approvals_hash_unique" ON "approvals" USING btree ("approval_hash");--> statement-breakpoint
CREATE INDEX "approvals_state_idx" ON "approvals" USING btree ("state");--> statement-breakpoint
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "import_batches_status_idx" ON "import_batches" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "import_rows_batch_row_unique" ON "import_rows" USING btree ("batch_id","row_number");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_provider_unique" ON "integration_accounts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "job_runs_status_idx" ON "job_runs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_idempotency_unique" ON "jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "jobs_lease_idx" ON "jobs" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_id_unique" ON "orders" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("order_status");--> statement-breakpoint
CREATE INDEX "orders_fulfillment_status_idx" ON "orders" USING btree ("fulfillment_status");--> statement-breakpoint
CREATE UNIQUE INDEX "products_vendor_item_unique" ON "products" USING btree ("vendor_item_id");--> statement-breakpoint
CREATE INDEX "products_seller_product_idx" ON "products" USING btree ("seller_product_id");--> statement-breakpoint
CREATE INDEX "products_external_sku_idx" ON "products" USING btree ("external_vendor_sku");--> statement-breakpoint
CREATE INDEX "shipments_coupang_order_idx" ON "shipments" USING btree ("coupang_order_id");--> statement-breakpoint
CREATE INDEX "shipments_uploaded_idx" ON "shipments" USING btree ("uploaded_to_coupang");--> statement-breakpoint
CREATE UNIQUE INDEX "uploads_checksum_unique" ON "uploads" USING btree ("checksum");--> statement-breakpoint
CREATE INDEX "uploads_status_idx" ON "uploads" USING btree ("status");