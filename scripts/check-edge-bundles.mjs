#!/usr/bin/env node
/**
 * Edge-function link and upload check. Every supabase/functions/<slug>/index.ts bundles with esbuild, its relative
 * imports followed and every remote or bare import (`https:`, `npm:`, `jsr:`, `node:`) left external,
 * writing nothing. Deno refuses a missing named export when a module loads, so a function that imports a
 * name its `_shared` module does not export answers 503 BOOT_ERROR from its first request after the deploy,
 * and the typecheck reads the app alone, so nothing else in CI sees it (v2.6294, 2026-11-01: job-drive-folders
 * and photo-save, for a `_shared/driveSettings.ts` export that never landed). And every function's upload stays under
 * `UPLOAD_CEILING_BYTES` (v2.7256): `supabase functions deploy` uploads each file a relative import names, a type-only
 * import too, and refuses 5 MB with HTTP 413 (dev-mcp at 5.02 MB on 2026-11-13), so the five biggest are printed and a
 * function past the ceiling fails with its biggest files (`lib/edgeUploadGraph.mjs`). Both take about a second for
 * the 190 functions, so ci.yml runs them on every pull request and merge-queue build.
 *
 *   node scripts/check-edge-bundles.mjs [functions-dir]    (default supabase/functions)
 *
 * esbuild is vite's own bundler, so `npm ci` installs it with the rest; this adds nothing to package.json.
 */

import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative, resolve } from 'node:path'
import { linkFunctions, linkReport } from './lib/edgeBundle.mjs'
import { edgeUploads, uploadReport } from './lib/edgeUploadGraph.mjs'

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
const uploads = uploadReport(edgeUploads(relDir, root).filter((u) => slugs.includes(u.slug)))

for (const w of warnings) console.warn(`warning: ${w}`)

if (failed.length > 0) {
  console.error(
    `\nEDGE FUNCTIONS DO NOT LINK: ${failed.length} of ${slugs.length} would answer 503 BOOT_ERROR once deployed ` +
      '(Deno refuses a missing named export when the module loads):\n' +
      lines.join('\n') +
      '\n\nFix the export or the import; `npm run check:edge-bundles` links every function the way the deploy will.\n',
  )
}

if (uploads.over.length > 0) {
  console.error(
    `\nEDGE FUNCTION UPLOADS TOO BIG: ${uploads.over.length} of ${slugs.length} would upload more than the ${uploads.ceiling} ceiling ` +
      '(the deploy uploads every file a relative import names, a type-only import too, and refuses 5 MB with HTTP 413):\n' +
      uploads.lines.join('\n') +
      '\n\nImport the one file a function needs instead of a file that reaches many (`node scripts/lib/edgeUploadGraph.mjs <slug>` ' +
      "lists an upload; its `via` names the chain to a file). The five biggest:\n" +
      uploads.biggest.join('\n') +
      '\n',
  )
}

if (failed.length > 0 || uploads.over.length > 0) process.exit(1)

console.log(`edge-function link check OK: all ${slugs.length} functions bundle (esbuild, remote imports external).`)
console.log(`edge-function upload check OK: every upload is under the ${uploads.ceiling} ceiling. The five biggest:\n${uploads.biggest.join('\n')}`)
