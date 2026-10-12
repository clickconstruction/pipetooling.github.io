/**
 * Cut 2's SQL (`20261012160000_messages_follow_up.sql`, and its addendum `20261013030000_messages_owed_sent_done.sql`)
 * writes the thread's gray lines and says its refusals in words.
 * The words are the kernels' (`queue.ts`, `owed.ts`, `promises.ts`), so this holds each `format()` the migration
 * renders to the kernel's own sentence, and checks the bed (`supabase/tests/messages_follow_up`, GitHub, the whole
 * schema) asserts every refusal the migration can raise, each in plain words, as `startSql.test.ts` does for its own.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { OWED_DONE_NEEDS_A_NOTE, owedDayChangedLine, owedMarkedLine, owedSentDoneLine, owedWhatChangedLine } from '../messages/owed'
import { askArchitectNote } from '../messages/promises'
import { GC_OFFICE_TEAM } from '../gc/access'
import { plainWordsFailures } from '../plainWords'
import { hasLine } from './queue'

const SQL = ['20261012160000_messages_follow_up.sql', '20261013030000_messages_owed_sent_done.sql']
  .map((f) => readFileSync(resolve(__dirname, '../../../supabase/migrations', f), 'utf8'))
  .join('\n')
const BED = readFileSync(resolve(__dirname, '../../../supabase/tests/messages_follow_up/20_scenario.sql'), 'utf8')

const unquote = (s: string) => s.replace(/''/g, "'")
/** Every format string the migration renders, by its first words. */
const formats = [...SQL.matchAll(/format\('((?:[^']|'')*)'/g)].map((m) => unquote(m[1]!))
const template = (startsWith: string) => {
  const hits = formats.filter((f) => f.startsWith(startsWith))
  expect(hits, startsWith).toHaveLength(1)
  return hits[0]!
}
/** SQL's format(): each %s takes the next argument. */
const render = (fmt: string, ...args: string[]) => {
  let i = 0
  return fmt.replace(/%s/g, () => args[i++] ?? '')
}

describe('the gray lines are the kernels’ words', () => {
  it('who has it (hasLine)', () => {
    expect(render(template('%s took %s.'), 'Robert', 'Greg Paulk')).toBe(hasLine('Robert', 'Greg Paulk', null, 'Robert'))
    expect(render(template('%s took %s from %s.'), 'Robert', 'Dr. Priya Raman', 'Rosa')).toBe(hasLine('Robert', 'Dr. Priya Raman', 'Rosa', 'Robert'))
    expect(render(template('%s gave %s to %s.'), 'Robert', 'Greg Paulk', 'Wendi')).toBe(hasLine('Robert', 'Greg Paulk', null, 'Wendi'))
    expect(render(template('%s handed %s to %s.'), 'Rosa', 'Greg Paulk', 'Wendi')).toBe(hasLine('Rosa', 'Greg Paulk', 'Robert', 'Wendi'))
    expect(render(template('%s put %s back'), 'Rosa', 'Greg Paulk')).toBe(hasLine('Rosa', 'Greg Paulk', 'Robert', null))
  })

  it('what we owe (owedMarkedLine, owedWhatChangedLine, owedDayChangedLine)', () => {
    const plans = { what: 'the plans or an addendum', byYmd: '2026-10-05', byWords: null }
    // owed_by_tail writes ' by ' and the day as follow_up_day does, or ', ' and the words, or nothing.
    expect(SQL).toContain(`WHEN p_day IS NOT NULL THEN ' by ' || public.follow_up_day(p_day)`)
    expect(SQL).toContain(`THEN ', ' || btrim(p_words)`)
    expect(SQL).toContain(`to_char(p_day, 'Dy Mon FMDD')`)
    expect(render(template('%s marked that we owe'), 'Robert', 'Greg Paulk', plans.what, ' by Mon Oct 5')).toBe(owedMarkedLine('Robert', 'Greg Paulk', plans))
    expect(render(template('%s marked that we owe'), 'Robert', 'Greg Paulk', plans.what, ', after the Board meets')).toBe(
      owedMarkedLine('Robert', 'Greg Paulk', { ...plans, byYmd: null, byWords: 'after the Board meets' }),
    )
    expect(render(template('%s changed what we owe'), 'Rosa', 'Dr. Priya Raman', 'a call back', 'the start date', ', by Mon Oct 5')).toBe(
      owedWhatChangedLine('Rosa', 'Dr. Priya Raman', { what: 'a call back', byYmd: '2026-10-05', byWords: null }, 'the start date'),
    )
    expect(render(template('%s set the day we owe'), 'Robert', 'Dr. Priya Raman', 'the start date', 'Mon Oct 12')).toBe(
      owedDayChangedLine('Robert', 'Dr. Priya Raman', { what: 'the start date', byYmd: '2026-10-12', byWords: null }),
    )
    expect(render(template('%s set the day we owe'), 'Robert', 'Dr. Priya Raman', 'the start date', 'no day')).toBe(
      owedDayChangedLine('Robert', 'Dr. Priya Raman', { what: 'the start date', byYmd: null, byWords: null }),
    )
  })

  it('a message we sent got it done (owedSentDoneLine, the addendum)', () => {
    expect(render(template('%s sent %s. It is done.'), 'Rosa', 'the start date')).toBe(owedSentDoneLine('Rosa', { what: 'the start date' }))
  })

  it('the plans question (askArchitectNote)', () => {
    const q = 'Is the detention pond in sitework?'
    expect(render(template('Sent to the architect'), q)).toBe(askArchitectNote(q))
  })

  it('the refusals the kernels also say', () => {
    expect(SQL).toContain(`RAISE EXCEPTION '${OWED_DONE_NEEDS_A_NOTE}'`)
    expect(SQL).toContain(`RAISE EXCEPTION 'Say what first. The day is optional.'`)
  })
})

/** Every refusal the bed asserts, as the person reads it. */
const refusals = [...BED.matchAll(/mfu\.refused\('(?:[^']|'')*',\s*\$q\$[\s\S]*?\$q\$,\s*'((?:[^']|'')*)'\);/g)].map((m) => unquote(m[1]!))
/** Every refusal the migration can raise; `%` is what the press does, or who makes the promise. */
const raised = [...SQL.matchAll(/RAISE EXCEPTION '((?:[^']|'')*)'/g)].map((m) => unquote(m[1]!))

describe('who a conversation can be handed to', () => {
  it('follow_up_user_known names the five roles of the office team, as GC_OFFICE_TEAM does', () => {
    const fn = SQL.slice(SQL.indexOf('FUNCTION public.follow_up_user_known'))
    const roles = /role IN \(([^)]*)\)/.exec(fn.slice(0, fn.indexOf('$$;')))?.[1] ?? ''
    expect([...roles.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual([...GC_OFFICE_TEAM].sort())
  })
})

describe('the refusals', () => {
  it('the bed asserts every refusal the migration can raise', () => {
    expect(raised.length).toBeGreaterThanOrEqual(25)
    for (const words of raised) {
      const shape = new RegExp(`^${words.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('%', '.+')}$`)
      expect(refusals.some((r) => shape.test(r) || (r.length > 20 && words.startsWith(r))), words).toBe(true)
    }
  })

  it.each([...new Set(refusals.filter((r) => /^[A-Z].*\.$/.test(r)))])('“%s” is in plain words', (words) => {
    expect(plainWordsFailures(words)).toEqual([])
  })
})
