#!/usr/bin/env node

/**
 * CLI script to backfill the search index (stripped_content and content_tsv)
 * for all existing documents.
 *
 * Usage:
 *   npm run backfill-search
 */

import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';
import { documents, vaults } from '../db/schema.js';
import * as filesystemService from '../services/filesystem.service.js';
import {
  extractFrontmatter,
  extractTitle,
  extractTags,
  stripMarkdown,
} from '../utils/markdown.js';

async function main() {
  console.log('Starting search index backfill...');

  // Fetch all documents with their vault info
  const allDocs = await db
    .select({
      id: documents.id,
      vaultId: documents.vaultId,
      path: documents.path,
      title: documents.title,
      tags: documents.tags,
    })
    .from(documents);

  console.log(`Found ${allDocs.length} documents to process.`);

  // Build a vault lookup for filesystem paths
  const allVaults = await db
    .select({
      id: vaults.id,
      userId: vaults.userId,
      slug: vaults.slug,
    })
    .from(vaults);

  const vaultMap = new Map(allVaults.map((v) => [v.id, v]));

  let processed = 0;
  let skipped = 0;
  let errored = 0;

  for (const doc of allDocs) {
    try {
      const vault = vaultMap.get(doc.vaultId);
      if (!vault) {
        console.warn(`  Skipping ${doc.path}: vault ${doc.vaultId} not found`);
        skipped++;
        continue;
      }

      // Read file content from disk
      const vaultPath = filesystemService.getVaultPath(vault.userId, vault.slug);
      let content: string;
      try {
        content = await filesystemService.readFile(vaultPath, doc.path);
      } catch {
        console.warn(`  Skipping ${doc.path}: file not found on disk`);
        skipped++;
        continue;
      }

      // Extract metadata and strip markdown
      const { data: frontmatterData, content: markdownContent } =
        extractFrontmatter(content);
      const title = extractTitle(frontmatterData, markdownContent);
      const tags = extractTags(frontmatterData, markdownContent);
      const strippedContent = stripMarkdown(markdownContent);
      const tagsText = (tags ?? []).join(' ');

      // Update the document record
      await db
        .update(documents)
        .set({
          title,
          tags,
          strippedContent,
          contentTsv: sql`to_tsvector('english', ${title ?? ''} || ' ' || ${tagsText} || ' ' || ${strippedContent})`,
        })
        .where(eq(documents.id, doc.id));

      processed++;

      if (processed % 100 === 0) {
        console.log(`  Processed ${processed}/${allDocs.length}...`);
      }
    } catch (err) {
      console.error(`  Error processing ${doc.path}:`, err);
      errored++;
    }
  }

  console.log('\nBackfill complete:');
  console.log(`  Processed: ${processed}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errored}`);
  console.log(`  Total:     ${allDocs.length}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
