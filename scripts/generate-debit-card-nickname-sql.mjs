#!/usr/bin/env node
/**
 * Reads a mapping file and prints a single INSERT ... ON CONFLICT upsert for
 * public.mercury_debit_card_nicknames.
 *
 * Format (one row per line):
 *   • Tab-separated: uuid<TAB>nickname  (recommended if nickname contains commas)
 *   • Or: uuid,nickname — first comma splits uuid from rest (nickname may contain commas)
 *
 * Lines starting with # and empty lines are skipped.
 *
 * Usage:
 *   node scripts/generate-debit-card-nickname-sql.mjs mapping.tsv
 *   node scripts/generate-debit-card-nickname-sql.mjs mapping.tsv | pbcopy
 */

import { readFileSync } from 'fs'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sqlStringLiteral(s) {
  return "'" + s.replace(/'/g, "''") + "'"
}

function parseLine(line, lineNo) {
  const t = line.trim()
  if (!t || t.startsWith('#')) return null

  let uuidStr
  let nickname
  if (t.includes('\t')) {
    const parts = t.split('\t')
    uuidStr = parts[0]?.trim() ?? ''
    nickname = parts.slice(1).join('\t').trim()
  } else {
    const i = t.indexOf(',')
    if (i < 0) {
      console.error(`Line ${lineNo}: expected tab or comma separator`)
      process.exit(1)
    }
    uuidStr = t.slice(0, i).trim()
    nickname = t.slice(i + 1).trim()
  }

  if (!UUID_RE.test(uuidStr)) {
    console.error(`Line ${lineNo}: invalid UUID: ${uuidStr}`)
    process.exit(1)
  }
  const uuidLower = uuidStr.toLowerCase()
  if (nickname.length < 1 || nickname.length > 120) {
    console.error(`Line ${lineNo}: nickname must be 1–120 chars after trim (got ${nickname.length})`)
    process.exit(1)
  }
  return { uuidLower, nickname }
}

const file = process.argv[2]
if (!file) {
  console.error('Usage: node scripts/generate-debit-card-nickname-sql.mjs <mapping.tsv|csv>')
  process.exit(1)
}

let raw
try {
  raw = readFileSync(file, 'utf8')
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
}

const pairs = []
const indexByUuid = new Map()
let lineNo = 0
for (const line of raw.split(/\r?\n/)) {
  lineNo += 1
  const row = parseLine(line, lineNo)
  if (!row) continue
  if (indexByUuid.has(row.uuidLower)) {
    console.error(`Line ${lineNo}: duplicate uuid ${row.uuidLower}; later row wins (warning)`)
    pairs[indexByUuid.get(row.uuidLower)] = row
  } else {
    indexByUuid.set(row.uuidLower, pairs.length)
    pairs.push(row)
  }
}

if (pairs.length === 0) {
  console.error('No data rows found.')
  process.exit(1)
}

const valueLines = pairs.map(
  ({ uuidLower, nickname }) =>
    `  (${sqlStringLiteral(uuidLower)}::uuid, ${sqlStringLiteral(nickname)}, now())`,
)

const out = `INSERT INTO public.mercury_debit_card_nicknames (mercury_debit_card_id, nickname, updated_at)
VALUES
${valueLines.join(',\n')}
ON CONFLICT (mercury_debit_card_id) DO UPDATE SET
  nickname = EXCLUDED.nickname,
  updated_at = now();
`

process.stdout.write(out)
