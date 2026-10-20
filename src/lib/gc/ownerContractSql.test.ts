/**
 * Our contract to the customer's refusals (the Board's B6-d-i): the bed `supabase/tests/gc_owner_contract` (GitHub, the
 * whole schema) asserts each one word for word. This holds every refusal the bed asserts to the plain-words rules, as
 * `startSql.test.ts` does Start's, and checks the bed asserts every refusal the migration can raise: the office's words,
 * the price by line's (shared with Mark it signed), and the portal's keys with the reason the customer reads.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'

const BED = readFileSync(resolve(__dirname, '../../../supabase/tests/gc_owner_contract/20_scenario.sql'), 'utf8')
const SQL = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261010090000_gc_owner_contract_sends.sql'), 'utf8')

const unquote = (s: string) => s.replace(/''/g, "'")
/** Every refusal the bed asserts in words, as the person reads it. */
const refusals = [...BED.matchAll(/goc\.refused\('(?:[^']|'')*', \$q\$[\s\S]*?\$q\$,\s*'((?:[^']|'')*)'\);/g)].map((m) => unquote(m[1]!))
/** Every portal refusal the bed asserts: its key and the reason the customer reads. */
const keyed = [...BED.matchAll(/goc\.refused_key\('(?:[^']|'')*', \$q\$[\s\S]*?\$q\$,\s*'(\w+)', '((?:[^']|'')*)'\);/g)].map((m) => ({ key: m[1]!, detail: unquote(m[2]!) }))
/** Every refusal the migration words itself (not a key, not the pass-through `%`); `%` in one is the job's name or a day. */
const raised = [...SQL.matchAll(/RAISE EXCEPTION '((?:[^']|'')*)'(?!, *v_why)/g)]
  .map((m) => unquote(m[1]!))
  .filter((w) => w !== '%' && !/^\w+$/.test(w))
/** The price by line's words, which the send and the first sign raise through `gc_owner_contract_worth_problem`. */
const returned = [...SQL.matchAll(/RETURN '((?:[^']|'')*)';/g)].map((m) => unquote(m[1]!))
/** The portal's keys and their reasons, as the migration raises them. */
const keys = [...SQL.matchAll(/RAISE EXCEPTION '(\w+)' USING ERRCODE = 'P0001', DETAIL = '((?:[^']|'')*)'/g)].map((m) => ({ key: m[1]!, detail: unquote(m[2]!) }))

const shapeOf = (words: string) => new RegExp(`^${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.+')}$`)

describe('our contract to the customer’s refusals', () => {
  it('the bed asserts every refusal in words the migration can raise', () => {
    expect(raised).toHaveLength(22)
    for (const words of raised) expect(refusals.some((r) => shapeOf(words).test(r)), words).toBe(true)
  })

  it('the bed asserts every line of the price by line’s words', () => {
    expect(returned).toHaveLength(6)
    for (const words of returned) expect(refusals, words).toContain(words)
  })

  it('the bed asserts every portal key with the reason the customer reads', () => {
    expect(keys.map((k) => k.key)).toEqual(['notFound', 'notYours', 'lost', 'alreadySigned', 'notNewest', 'priceChanged', 'nameNeeded', 'tooLong'])
    for (const k of keys) expect(keyed, k.key).toContainEqual(k)
  })

  it.each([...new Set([...refusals, ...keyed.map((k) => k.detail)].filter((w) => !w.startsWith('permission denied') && !w.startsWith('new row')))])('“%s” is in plain words', (words) => {
    expect(plainWordsFailures(words)).toEqual([])
  })
})
