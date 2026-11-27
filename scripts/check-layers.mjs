#!/usr/bin/env node
/**
 * A lower layer of `src` reads nothing from one above it (punch list #434, the split's step 1).
 *
 * The rule, the reason and the list's meaning are in scripts/lib/layers.mjs. This reads every file a rule speaks
 * for, takes its imports from the TypeScript scanner (`import`, `import type`, `export … from`, `import('…')`,
 * so a name inside a string or a comment is never one), and holds them against `scripts/layers-allowed.txt`.
 *
 *   npm run check:layers             exits 1 on an import that reaches up and is not on the list
 *   npm run check:layers -- --write  takes off the list every row whose import is gone; it never adds one
 *   npm run check:layers -- --list   prints every import that reaches up today, one a row, and exits 0
 *
 * A row that is mended and still listed is a notice, never a failure: a change that makes things better is
 * not stopped for it.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { ALLOWED_FILE, compareRows, outcomeLines, parseAllowed, ruleFor, upwardRows, withoutRows } from './lib/layers.mjs'

const ROOT = process.cwd()
const ts = createRequire(path.join(ROOT, 'package.json'))('typescript')
const WRITE = process.argv.includes('--write')
const LIST = process.argv.includes('--list')

// Tracked files and new ones not yet added, so a run before the commit sees the file being written.
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', 'src'], { cwd: ROOT, maxBuffer: 1 << 28 })
  .toString()
  .split('\0')
  .filter((file) => file && existsSync(path.join(ROOT, file)))
const known = new Set(files)
const has = (file) => known.has(file)

const found = []
for (const file of files) {
  if (!ruleFor(file)) continue
  const text = readFileSync(path.join(ROOT, file), 'utf8')
  const specifiers = ts.preProcessFile(text, true, false).importedFiles.map((entry) => entry.fileName)
  found.push(...upwardRows(file, specifiers, has))
}

if (LIST) {
  console.log(found.sort().join('\n'))
  process.exit(0)
}

const listPath = path.join(ROOT, ALLOWED_FILE)
const listText = readFileSync(listPath, 'utf8')
const result = compareRows(found, parseAllowed(listText))

if (WRITE && result.mended.length) {
  writeFileSync(listPath, withoutRows(listText, result.mended))
  console.log(`check:layers: took ${result.mended.length} mended ${result.mended.length === 1 ? 'row' : 'rows'} off ${ALLOWED_FILE}.`)
  result.mended = []
}

for (const line of outcomeLines(result)) console.log(line)
if (result.mended.length && process.env.GITHUB_ACTIONS) {
  console.log(`::notice::check:layers: ${result.mended.length} mended ${result.mended.length === 1 ? 'row is' : 'rows are'} still on ${ALLOWED_FILE}. Take them off with npm run check:layers -- --write`)
}
process.exit(result.added.length ? 1 : 0)
