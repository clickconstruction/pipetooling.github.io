#!/usr/bin/env node
/**
 * Edge-function link check: every supabase/functions/<slug>/index.ts bundles with esbuild, its relative
 * imports followed and every remote or bare import (`https:`, `npm:`, `jsr:`, `node:`) left external,
 * writing nothing. Deno refuses a missing named export when a module loads, so a function that imports a
 * name its `_shared` module does not export answers 503 BOOT_ERROR from its first request after the deploy,
 * and the typecheck reads the app alone, so nothing else in CI sees it (v2.6294, 2026-11-01: job-drive-folders
 * and photo-save, for a `_shared/driveSettings.ts` export that never landed). This links the 173 functions in
 * about half a second, so ci.yml runs it on every pull request and merge-queue build.
 *
 *   node scripts/check-edge-bundles.mjs [functions-dir]    (default supabase/functions)
 *
 * esbuild is vite's own bundler, so `npm ci` installs it with the rest; this adds nothing to package.json.
 */

import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative, resolve } from 'node:path'
import { linkFunctions, linkReport } from './lib/edgeBundle.mjs'

const esbuild = createRequire(import.meta.url)('esbuild')

const dir = resolve(process.argv[2] ?? 'supabase/functions')
// Paths in the report read from the folder above `supabase/`: `functions/_shared/x.ts` for the repo, the same for a copy.
const root = resolve(dir, '..', '..')
const relDir = relative(root, dir)

const slugs = readdirSync(dir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
  .filter((e) => existsSync(join(dir, e.name, 'index.ts')))
  .map((e) => e.name)
  .sort()

const results = await linkFunctions(root, relDir, slugs, esbuild)
const { failed, lines, warnings } = linkReport(results, relDir)

for (const w of warnings) console.warn(`warning: ${w}`)

if (failed.length > 0) {
  console.error(
    `\nEDGE FUNCTIONS DO NOT LINK: ${failed.length} of ${slugs.length} would answer 503 BOOT_ERROR once deployed ` +
      '(Deno refuses a missing named export when the module loads):\n' +
      lines.join('\n') +
      '\n\nFix the export or the import; `npm run check:edge-bundles` links every function the way the deploy will.\n',
  )
  process.exit(1)
}

console.log(`edge-function link check OK: all ${slugs.length} functions bundle (esbuild, remote imports external).`)
