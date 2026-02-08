import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  inet,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { customType } from 'drizzle-orm/pg-core';

// ── Custom types ──────────────────────────────────────────────────────

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// ── Users ──────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
  lastFailedLoginAt: timestamp('last_failed_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  invitations: many(invitations),
  sessions: many(sessions),
  vaults: many(vaults),
  apiKeys: many(apiKeys),
}));

// ── Invitations ────────────────────────────────────────────────────────

export const invitations = pgTable('invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  invitedBy: uuid('invited_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invitationsRelations = relations(invitations, ({ one }) => ({
  inviter: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

// ── Sessions ───────────────────────────────────────────────────────────

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull(),
  userAgent: text('user_agent'),
  ipAddress: inet('ip_address'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ── Vaults ────────────────────────────────────────────────────────────

export const vaults = pgTable(
  'vaults',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('vaults_user_id_slug_idx').on(table.userId, table.slug),
  ],
);

export const vaultsRelations = relations(vaults, ({ one, many }) => ({
  user: one(users, {
    fields: [vaults.userId],
    references: [users.id],
  }),
  documents: many(documents),
  apiKeys: many(apiKeys),
}));

// ── Documents ─────────────────────────────────────────────────────────

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    vaultId: uuid('vault_id')
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    path: varchar('path', { length: 1000 }).notNull(),
    title: varchar('title', { length: 500 }),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    frontmatter: jsonb('frontmatter'),
    tags: text('tags').array(),
    strippedContent: text('stripped_content'),
    contentTsv: tsvector('content_tsv'),
    fileCreatedAt: timestamp('file_created_at', { withTimezone: true }),
    fileModifiedAt: timestamp('file_modified_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('documents_vault_id_path_idx').on(table.vaultId, table.path),
    index('idx_documents_tags').using('gin', table.tags),
    index('idx_documents_tsv').using('gin', table.contentTsv),
    index('idx_documents_frontmatter').using('gin', table.frontmatter),
  ],
);

export const documentsRelations = relations(documents, ({ one, many }) => ({
  vault: one(vaults, {
    fields: [documents.vaultId],
    references: [vaults.id],
  }),
  versions: many(documentVersions),
}));

// ── Document Versions ─────────────────────────────────────────────────

export const documentVersions = pgTable(
  'document_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    versionNum: integer('version_num').notNull(),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    changeSource: varchar('change_source', { length: 20 }).notNull(),
    changedBy: uuid('changed_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('document_versions_document_id_version_num_idx').on(
      table.documentId,
      table.versionNum,
    ),
  ],
);

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, {
    fields: [documentVersions.documentId],
    references: [documents.id],
  }),
  changedByUser: one(users, {
    fields: [documentVersions.changedBy],
    references: [users.id],
  }),
}));

// ── API Keys ─────────────────────────────────────────────────────────

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 8 }).notNull(),
    keyHash: varchar('key_hash', { length: 255 }).notNull(),
    scopes: text('scopes').array().notNull().default(['read', 'write']),
    vaultId: uuid('vault_id').references(() => vaults.id, { onDelete: 'cascade' }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_api_keys_user_id').on(table.userId),
    index('idx_api_keys_key_prefix').on(table.keyPrefix),
  ],
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
  vault: one(vaults, {
    fields: [apiKeys.vaultId],
    references: [vaults.id],
  }),
}));
