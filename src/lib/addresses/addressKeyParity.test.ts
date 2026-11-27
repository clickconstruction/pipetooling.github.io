/**
 * The address rule lives twice (punch list #439, piece 4): `normalizeAddressKey` in the app, and `address_key(text)`
 * in the database, which the gate needs to tell which jobs are at a site. Nothing imports one into the other, so one
 * list holds them together. The list sits in the site's SQL bed (`supabase/tests/site_secrecy/20_scenario.sql`): each
 * pair is an address and its key. The bed proves the database writes every key of the list. This test proves the app
 * writes the same keys, and that the two tables of street words are one table. A change to either rule that the other
 * does not follow turns one of the two red.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeAddressKey } from '../developments/notInIt'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const unquote = (s: string) => s.replace(/''/g, "'")

/** The pairs between the bed's two markers: `('<address>', '<key>')`, a quote inside written twice. */
function parityPairs(): Array<{ address: string; want: string }> {
  const bed = read('supabase/tests/site_secrecy/20_scenario.sql')
  const from = bed.indexOf('-- address-key-parity:begin')
  const to = bed.indexOf('-- address-key-parity:end')
  expect(from).toBeGreaterThan(-1)
  expect(to).toBeGreaterThan(from)
  const pairs: Array<{ address: string; want: string }> = []
  for (const m of bed.slice(from, to).matchAll(/^\s*\('((?:[^']|'')*)', '((?:[^']|'')*)'\)[,;]$/gm)) {
    pairs.push({ address: unquote(m[1] ?? ''), want: unquote(m[2] ?? '') })
  }
  return pairs
}

describe('the address rule, in the app and in the database', () => {
  it('the app writes every key of the list the database is held to', () => {
    const pairs = parityPairs()
    expect(pairs.length).toBeGreaterThanOrEqual(40)
    const wrong = pairs.filter((p) => normalizeAddressKey(p.address) !== p.want).map((p) => `${JSON.stringify(p.address)} gave ${JSON.stringify(normalizeAddressKey(p.address))}, the list says ${JSON.stringify(p.want)}`)
    expect(wrong).toEqual([])
  })

  it('the list walks every step of the rule', () => {
    const pairs = parityPairs()
    const has = (test: (p: { address: string; want: string }) => boolean) => pairs.some(test)
    // A zip dropped, a zip plus four dropped, and a number that only looks like one kept.
    expect(has((p) => /\s\d{5}$/.test(p.address) && !/\d{5}$/.test(p.want))).toBe(true)
    expect(has((p) => /\s\d{5}-\d{4}$/.test(p.address))).toBe(true)
    expect(has((p) => p.address === '78701' && p.want === '78701')).toBe(true)
    // Punctuation, a hyphen, a character outside the plain alphabet, and a blank.
    expect(has((p) => p.address.includes('#'))).toBe(true)
    expect(has((p) => p.address.includes('-') && !p.want.includes('-'))).toBe(true)
    expect(has((p) => /[^\x20-\x7e]/.test(p.address))).toBe(true)
    expect(has((p) => p.address.trim() === '' && p.want === '')).toBe(true)
  })

  it('the database spells out the same street words as the app, and no other', () => {
    const migration = read('supabase/migrations/20261127052337_site_secrecy.sql')
    const body = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.address_key'), migration.indexOf('COMMENT ON FUNCTION public.address_key'))
    const sqlWords = [...body.matchAll(/\('([a-z]+)', '([a-z]+)'\)/g)].map((m) => `${m[1]} ${m[2]}`).sort()
    const app = read('src/lib/developments/notInIt.ts')
    const table = app.slice(app.indexOf('const SUFFIXES'), app.indexOf('}', app.indexOf('const SUFFIXES')))
    const appWords = [...table.matchAll(/^\s*([a-z]+): '([a-z]+)',$/gm)].map((m) => `${m[1]} ${m[2]}`).sort()
    expect(appWords.length).toBeGreaterThanOrEqual(22)
    expect(sqlWords).toEqual(appWords)
    // Each short word of the table is on the list, so the database is tried on every one of them.
    const tried = new Set(parityPairs().flatMap((p) => p.address.toLowerCase().split(/[^a-z0-9]+/)))
    expect(appWords.map((w) => w.split(' ')[0]).filter((short) => !tried.has(short ?? ''))).toEqual([])
  })
})
