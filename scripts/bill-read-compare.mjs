#!/usr/bin/env node
/**
 * The live trial of `bill-read` on the made-up set (punch list #179 PR 2, v2.6088): each fixture PDF in
 * src/test/fixtures/bills/ is sent to the deployed function as a dropped-in file, and the answer is scored against the
 * answer beside it. Run it once with each model to compare them (the card's call 4).
 *
 *   node scripts/bill-read-compare.mjs --jwt <access token> --house <supply_house_id> [--model claude-haiku-5-5] [--url <supabase url>]
 *
 * The token is the dev's own session, signed in on the app: in the browser console,
 *   JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.endsWith('-auth-token')))).access_token
 * The house is a ZZ test house's id: the files land in the bucket under it, and the ledger rows name it. The URL comes
 * from VITE_SUPABASE_URL in .env.local when not given. Nothing is written to an invoice; each run writes one
 * supply_bill_reads row per fixture and costs cents.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FIXTURES = join(root, 'src/test/fixtures/bills')

const arg = (name, fallback = '') => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
const jwt = arg('jwt', process.env.BILL_READ_JWT ?? '')
const house = arg('house', process.env.BILL_READ_HOUSE ?? '')
const model = arg('model', 'claude-sonnet-5-5')
let url = arg('url', process.env.SUPABASE_URL ?? '')
if (!url && existsSync(join(root, '.env.local'))) {
  const m = /^VITE_SUPABASE_URL=(.+)$/m.exec(readFileSync(join(root, '.env.local'), 'utf8'))
  url = m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
}
if (!jwt || !house || !url) {
  console.error('usage: node scripts/bill-read-compare.mjs --jwt <access token> --house <supply_house_id> [--model claude-haiku-5-5] [--url <supabase url>]')
  process.exit(2)
}

const cents = (s) => {
  const t = String(s ?? '').replace(/[\s$,()]/g, '').replace(/^-/, '')
  return /^\d+(?:\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : null
}
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const kindOf = (k) => (k === 'credit_memo' ? 'credit' : k)

const index = JSON.parse(readFileSync(join(FIXTURES, 'index.json'), 'utf8'))
let right = 0
let asked = 0
let spent = 0
for (const f of index) {
  const want = JSON.parse(readFileSync(join(FIXTURES, f.answer), 'utf8'))
  const base64 = readFileSync(join(FIXTURES, f.pdf)).toString('base64')
  const started = Date.now()
  const res = await fetch(`${url.replace(/\/+$/, '')}/functions/v1/bill-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ supply_house_id: house, model, file: { name: f.pdf, mime: 'application/pdf', base64 } }),
  })
  const body = await res.json().catch(() => ({}))
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  if (!res.ok || !body.ok) {
    console.log(`${f.slug}: ${res.status} ${body.error ?? ''} ${body.words ?? ''} ${body.why ?? ''}`)
    continue
  }
  const got = body.read
  spent += body.cents ?? 0
  const checks = [
    ['house', norm(got.houseName) === norm(want.house_name)],
    ['kind', got.kind === kindOf(want.document_kind)],
    ['number', norm(got.number) === norm(want.number)],
    ['date', got.dateYmd === want.date],
    ['total', got.totalCents === cents(want.total)],
    ['tax', got.taxCents === cents(want.tax)],
    ['lines', got.lines.length === want.lines.length],
    ['line sum', got.lines.reduce((s, l) => s + (l.extendedCents ?? 0), 0) === want.lines.reduce((s, l) => s + (cents(l.extended) ?? 0), 0)],
    ['PO', norm(got.poText) === norm(want.po_text)],
    ['RE', norm(got.referencesNumber) === norm(want.references_number)],
    ['statement numbers', got.statementNumbers.join('|') === want.statement_numbers.join('|')],
  ]
  const ok = checks.filter(([, r]) => r).length
  right += ok
  asked += checks.length
  const wrong = checks.filter(([, r]) => !r).map(([name]) => name)
  console.log(`${f.slug}: ${ok}/${checks.length} right · ${seconds}s · ${body.cents ?? '?'}¢ · ${body.model}${wrong.length ? ` · wrong: ${wrong.join(', ')}` : ''}`)
}
console.log(`\n${model}: ${right}/${asked} fields right across ${index.length} papers, ${spent.toFixed(2)}¢ in all.`)
