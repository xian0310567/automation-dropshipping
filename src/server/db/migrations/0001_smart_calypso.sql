CREATE TABLE "non_winner_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_batch_id" uuid,
	"product_id" uuid,
	"vendor_id" text NOT NULL,
	"seller_product_id" text NOT NULL,
	"vendor_item_id" text NOT NULL,
	"action_type" text DEFAULT 'sales_stop' NOT NULL,
	"status" text DEFAULT 'pending_approval' NOT NULL,
	"reason" text NOT NULL,
	"risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"approval_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "non_winner_candidates" ADD CONSTRAINT "non_winner_candidates_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "non_winner_candidates" ADD CONSTRAINT "non_winner_candidates_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "non_winner_candidates_approval_hash_unique" ON "non_winner_candidates" USING btree ("approval_hash");--> statement-breakpoint
CREATE INDEX "non_winner_candidates_status_idx" ON "non_winner_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "non_winner_candidates_vendor_item_idx" ON "non_winner_candidates" USING btree ("vendor_item_id");