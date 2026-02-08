CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version_num" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"size_bytes" integer NOT NULL,
	"change_source" varchar(20) NOT NULL,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"path" varchar(1000) NOT NULL,
	"title" varchar(500),
	"content_hash" varchar(64) NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"frontmatter" jsonb,
	"tags" text[],
	"stripped_content" text,
	"content_tsv" "tsvector",
	"file_created_at" timestamp with time zone,
	"file_modified_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaults" ADD CONSTRAINT "vaults_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "document_versions_document_id_version_num_idx" ON "document_versions" USING btree ("document_id","version_num");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_vault_id_path_idx" ON "documents" USING btree ("vault_id","path");--> statement-breakpoint
CREATE INDEX "idx_documents_vault_id" ON "documents" USING btree ("vault_id");--> statement-breakpoint
CREATE INDEX "idx_documents_path" ON "documents" USING btree ("vault_id","path");--> statement-breakpoint
CREATE INDEX "idx_documents_tags" ON "documents" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "idx_documents_tsv" ON "documents" USING gin ("content_tsv");--> statement-breakpoint
CREATE INDEX "idx_documents_frontmatter" ON "documents" USING gin ("frontmatter");--> statement-breakpoint
CREATE UNIQUE INDEX "vaults_user_id_slug_idx" ON "vaults" USING btree ("user_id","slug");