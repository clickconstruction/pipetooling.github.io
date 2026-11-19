/**
 * The e-sign ledger's kinds, held together (v2.7924). `esign_consents.record_type` is checked by
 * `esign_consents_record_type_check`, and every migration that adds a kind restates the whole list. One restatement
 * (20261030030000) began from an older list and dropped `gc_owner_contract`; the signing function's write is
 * best-effort, so the check refused the consent row and nothing said so. This reads the newest restatement in
 * `supabase/migrations` and fails when it and the functions' union differ, or when a function writes a kind the check
 * refuses. The whole-schema bed `supabase/tests/gc_owner_contract` inserts every kind against the real check.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const MIGRATIONS = join(ROOT, 'supabase/migrations')
const FUNCTIONS = join(ROOT, 'supabase/functions')

const quoted = (s: string) => [...s.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!)
const CHECK = /ADD CONSTRAINT esign_consents_record_type_check\s+CHECK \(record_type IN \(([^)]*)\)\)/g

/** The list of the newest migration that restates the check, with that migration's name. */
function newestCheck(): { file: string; kinds: string[] } {
  let found: { file: string; kinds: string[] } | null = null
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    const all = [...readFileSync(join(MIGRATIONS, file), 'utf8').matchAll(CHECK)]
    const last = all[all.length - 1]
    if (last) found = { file, kinds: quoted(last[1]!) }
  }
  if (!found) throw new Error('no migration states esign_consents_record_type_check')
  return found
}

function functionSources(dir: string): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...functionSources(path))
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts') && name !== 'catalog.ts') out.push({ path: path.slice(ROOT.length + 1), text: readFileSync(path, 'utf8') })
  }
  return out
}

const check = newestCheck()
const sources = functionSources(FUNCTIONS)
const shared = readFileSync(join(FUNCTIONS, '_shared/esignConsent.ts'), 'utf8')
const union = quoted(/export type EsignConsentRecordType = ([^\n]+)/.exec(shared)?.[1] ?? '')

/** Every `recordType:` a function hands the ledger: its file, and the kinds written on that line. */
const writes = sources
  .filter((s) => s.path !== 'supabase/functions/_shared/esignConsent.ts')
  .flatMap((s) => s.text.split('\n').filter((line) => /\brecordType:/.test(line)).map((line) => ({ path: s.path, line: line.trim(), kinds: quoted(line) })))

describe('the e-sign ledger’s kinds', () => {
  it('the newest restatement of the check is the functions’ union, kind for kind', () => {
    expect(union.length).toBeGreaterThan(0)
    expect([...check.kinds].sort(), `${check.file} against EsignConsentRecordType`).toEqual([...union].sort())
    expect(new Set(check.kinds).size).toBe(check.kinds.length)
  })

  it('the check takes our contract to the customer and the hours statement', () => {
    expect(check.kinds).toContain('gc_owner_contract')
    expect(check.kinds).toContain('hours_statement')
  })

  it('no function writes a kind the check refuses', () => {
    expect(writes.length).toBeGreaterThanOrEqual(8)
    for (const w of writes) for (const kind of w.kinds) expect(check.kinds, `${w.path}: ${w.line}`).toContain(kind)
  })

  it('a write that names no kind on its line takes it from the trade portal’s three, which the check takes', () => {
    const unnamed = writes.filter((w) => w.kinds.length === 0)
    expect(unnamed.map((w) => `${w.path}: ${w.line}`)).toEqual(['supabase/functions/submit-gc-trade-portal/index.ts: recordType: sign.record.type,'])
    const trade = readFileSync(join(FUNCTIONS, '_shared/gcTradeSubmit.ts'), 'utf8')
    const kinds = quoted(/record: \{ type: ([^;]+); id:/.exec(trade)?.[1] ?? '')
    expect(kinds.length).toBeGreaterThan(0)
    for (const kind of kinds) expect(check.kinds, `gcTradeSubmit: ${kind}`).toContain(kind)
    for (const kind of [...trade.matchAll(/=> \(\{ type: '([a-z_]+)', id:/g)].map((m) => m[1]!)) expect(kinds).toContain(kind)
  })

  it('the client reads only kinds the ledger can hold', () => {
    const hook = readFileSync(join(ROOT, 'src/hooks/useEsignConsent.ts'), 'utf8')
    const reads = quoted(/export type EsignConsentRecordType = ([^\n]+)/.exec(hook)?.[1] ?? '')
    expect(reads.length).toBeGreaterThan(0)
    for (const kind of reads) expect(check.kinds, kind).toContain(kind)
  })
})
