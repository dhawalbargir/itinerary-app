ALTER TABLE "documents" ADD COLUMN "blob_access" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "processing_started_at" timestamp with time zone;