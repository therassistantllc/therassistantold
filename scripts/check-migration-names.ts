#!/usr/bin/env tsx
/**
 * Validates that all Supabase migration files use the YYYYMMDDHHMMSS prefix format
 * required by supabase db push. Files using the shorter YYYYMMDD prefix cause
 * duplicate-version errors when multiple migrations share the same date.
 *
 * Usage: tsx scripts/check-migration-names.ts
 * Exit code 0 = all valid. Exit code 1 = invalid filenames found.
 */

import * as fs from "fs";
import * as path from "path";

const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");
const VALID_PREFIX = /^\d{14}_/; // YYYYMMDDHHMMSS_
const SHORT_PREFIX = /^\d{8}_/;  // YYYYMMDD_ (the broken pattern)

const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

const invalid: string[] = [];
const warnings: string[] = [];

for (const file of files) {
  if (!VALID_PREFIX.test(file)) {
    if (SHORT_PREFIX.test(file)) {
      invalid.push(`  ${file}  ← uses 8-digit prefix (YYYYMMDD); rename to YYYYMMDDHHMMSS_name.sql`);
    } else {
      warnings.push(`  ${file}  ← does not start with a 14-digit timestamp`);
    }
  }
}

if (invalid.length === 0 && warnings.length === 0) {
  console.log(`✓ All ${files.length} migration files use YYYYMMDDHHMMSS prefix format.`);
  process.exit(0);
}

if (invalid.length > 0) {
  console.error(`✗ ${invalid.length} migration file(s) use the short YYYYMMDD prefix — db push will fail:`);
  invalid.forEach((msg) => console.error(msg));
}

if (warnings.length > 0) {
  console.warn(`⚠ ${warnings.length} migration file(s) have non-standard names:`);
  warnings.forEach((msg) => console.warn(msg));
}

process.exit(invalid.length > 0 ? 1 : 0);
