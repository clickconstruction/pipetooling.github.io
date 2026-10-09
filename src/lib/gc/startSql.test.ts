/**
 * `gc_start_project`'s refusals (the Board's B6-c-i): the bed `supabase/tests/gc_start` (GitHub, the whole schema)
 * asserts each one word for word. This holds every refusal the bed asserts to the plain-words rules, as
 * `awardSql.test.ts` does award's, and checks the bed asserts every refusal the function can raise, so a new one
 * cannot ship untried.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'

const BED = readFileSync(resolve(__dirname, '../../../supabase/tests/gc_start/20_scenario.sql'), 'utf8')
const SQL = readFileSync(resolve(__dirname, '../../../supabase/migrations/20261010011000_gc_start_project.sql'), 'utf8')

const unquote = (s: string) => s.replace(/''/g, "'")
/** Every refusal the bed asserts, as the person reads it. */
const refusals = [...BED.matchAll(/gst\.refused\('[^']*', \$q\$[\s\S]*?\$q\$,\s*'((?:[^']|'')*)'\);/g)].map((m) => unquote(m[1]!))
/** Every refusal the function can raise; `%` is the job's name. */
const raised = [...SQL.matchAll(/RAISE EXCEPTION '((?:[^']|'')*)'/g)].map((m) => unquote(m[1]!))

describe('gc_start_project’s refusals', () => {
  it('the bed asserts every refusal the function can raise', () => {
    expect(raised).toHaveLength(12)
    for (const words of raised) {
      const shape = new RegExp(`^${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('%', '.+')}$`)
      expect(refusals.some((r) => shape.test(r)), words).toBe(true)
    }
  })

  it.each([...new Set(refusals)])('“%s” is in plain words', (words) => {
    expect(plainWordsFailures(words)).toEqual([])
  })
})
