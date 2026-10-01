CREATE TABLE "api_usage" (
	"day" date NOT NULL,
	"provider" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_usage_day_provider_pk" PRIMARY KEY("day","provider")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"blob_url" text NOT NULL,
	"blob_path" text,
	"mime_type" text NOT NULL,
	"file_name" text,
	"sha256" text NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"raw_extraction" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_trip_sha" UNIQUE("trip_id","sha256")
);
--> statement-breakpoint
CREATE TABLE "flight_history" (
	"flight_no" text NOT NULL,
	"dep_iata" text NOT NULL,
	"flight_date" date NOT NULL,
	"sched_dep" timestamp with time zone,
	"actual_dep" timestamp with time zone,
	"sched_arr" timestamp with time zone,
	"actual_arr" timestamp with time zone,
	"dep_tz" text,
	"arr_tz" text,
	"arr_delay_min" integer,
	"status" text NOT NULL,
	"aircraft" text,
	"provider" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "flight_history_flight_no_dep_iata_flight_date_pk" PRIMARY KEY("flight_no","dep_iata","flight_date")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trip_id" uuid NOT NULL,
	"document_id" uuid,
	"booking_group" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"start_at" timestamp with time zone,
	"start_tz" text,
	"end_at" timestamp with time zone,
	"end_tz" text,
	"origin" text,
	"destination" text,
	"address" text,
	"lat" double precision,
	"lng" double precision,
	"confirmation_code" text,
	"carrier" text,
	"number" text,
	"operating_carrier" text,
	"operating_number" text,
	"seat" text,
	"terminal" text,
	"gate" text,
	"travellers" text[],
	"notes" text,
	"field_confidence" jsonb,
	"user_edited" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"dates_inferred" text DEFAULT 'yes' NOT NULL,
	"share_token" text,
	"share_show_codes" text DEFAULT 'no' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_trip_start" ON "items" USING btree ("trip_id","start_at");