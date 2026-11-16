import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DIFFICULTY_PRICE_V1,
  DIFFICULTY_RATERS_DEFAULT,
  difficultyCanEditPrice,
  difficultyCanRate,
  difficultyPayingRuleOf,
  difficultyPriceProblems,
  difficultyPriceVersionWords,
  difficultyPriceWords,
  difficultyRaterOfRole,
  parseDifficultyPriceList,
  type DifficultyPriceList,
} from './difficultyPrice'

const MIGRATION = resolve(__dirname, '../../../supabase/migrations/20261115020000_difficulty_price_versions.sql')
/** v2.7468: the insert rule on gc_difficulty_ratings asks gc_difficulty_can_rate(), this kernel's twin. */
const GATE_MIGRATION = resolve(__dirname, '../../../supabase/migrations/20261116233000_gc_difficulty_raters_from_price_list.sql')

/** Every role an account can carry (the `user_role` enum), and one no account does. */
const ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers', 'owner', 'master', 'nobody'] as const
const V2: DifficultyPriceList = { ...DIFFICULTY_PRICE_V1, raters: ['office', 'estimator', 'master'] }
const canRate = (raters: readonly string[] | null) => ROLES.filter((r) => difficultyCanRate(raters ? { ...DIFFICULTY_PRICE_V1, raters: raters as never } : null, r))

describe('difficultyPrice (punch list #357, PR 4)', () => {
  it('version 1 in the kernel is the JSON the migration seeds', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    const m = /\$json\$(\{.*?\})\$json\$/s.exec(sql)
    expect(m).not.toBeNull()
    expect(JSON.parse(m![1]!)).toEqual(DIFFICULTY_PRICE_V1)
  })

  it('parses leniently: a missing number takes version 1, a typed string reads as a number, unknown raters drop', () => {
    expect(parseDifficultyPriceList(null)).toBeNull()
    expect(parseDifficultyPriceList([])).toBeNull()
    expect(parseDifficultyPriceList({})).toEqual({ ...DIFFICULTY_PRICE_V1, raters: [...DIFFICULTY_RATERS_DEFAULT] })
    expect(parseDifficultyPriceList({ raters: 'office' })?.raters).toEqual([...DIFFICULTY_RATERS_DEFAULT])
    expect(parseDifficultyPriceList({ raters: [] })?.raters).toEqual([])
    expect(parseDifficultyPriceList({ fieldPctPerPoint: '7.5', raters: ['office', 'janitor'] })).toEqual({ ...DIFFICULTY_PRICE_V1, fieldPctPerPoint: 7.5, raters: ['office'] })
    expect(parseDifficultyPriceList('{"capPct":12}')).toEqual({ ...DIFFICULTY_PRICE_V1, capPct: 12, raters: [...DIFFICULTY_RATERS_DEFAULT] })
  })

  it('names the rules a list breaks, one a person can act on each', () => {
    expect(difficultyPriceProblems(DIFFICULTY_PRICE_V1)).toEqual([])
    const bad = difficultyPriceProblems({ ...DIFFICULTY_PRICE_V1, fieldPctPerPoint: 120, payingMinBills: 0, raters: [] })
    expect(bad).toEqual([
      'The field percent is a percent from 0 to 100.',
      'The bills a read needs is a whole number from 1 to 50.',
      'Someone has to be able to rate a GC: pick at least one of the office, the estimators and the masters.',
    ])
  })

  it('the paying rule the reader takes', () => {
    expect(difficultyPayingRuleOf(DIFFICULTY_PRICE_V1)).toEqual({ daysPast: 45, lateBillsInYear: 2, minBills: 3 })
  })

  it('who may rate: the list says, a dev always may, a primary and a sub never', () => {
    expect(difficultyRaterOfRole('master_technician')).toBe('master')
    expect(difficultyRaterOfRole('assistant')).toBe('office')
    expect(difficultyRaterOfRole('estimator')).toBe('estimator')
    expect(difficultyRaterOfRole('primary')).toBeNull()
    expect(difficultyCanRate({ ...DIFFICULTY_PRICE_V1, raters: ['estimator'] }, 'estimator')).toBe(true)
    expect(difficultyCanRate({ ...DIFFICULTY_PRICE_V1, raters: ['estimator'] }, 'assistant')).toBe(false)
    expect(difficultyCanRate({ ...DIFFICULTY_PRICE_V1, raters: [] }, 'dev')).toBe(true)
    expect(difficultyCanRate(DIFFICULTY_PRICE_V1, 'subcontractor')).toBe(false)
  })

  it('who may rate, role by role: under version 2 the estimator rates with the office and the owner (v2.7468)', () => {
    const everyGroup = ['dev', 'master_technician', 'assistant', 'controller', 'estimator']
    // Version 2, the list the owner's word of 2026-11-16 published: every group.
    expect(canRate(V2.raters)).toEqual(everyGroup)
    // No list read (none published, or the read failed): every group, as the database's gate answers.
    expect(canRate(null)).toEqual(everyGroup)
    // Version 1: the office and the masters; the estimator reads.
    expect(canRate(DIFFICULTY_PRICE_V1.raters)).toEqual(['dev', 'master_technician', 'assistant', 'controller'])
    // The list is obeyed in both directions: a group taken off loses the press, and only a dev rates under an empty list.
    expect(canRate(['estimator'])).toEqual(['dev', 'estimator'])
    expect(canRate(['office'])).toEqual(['dev', 'assistant', 'controller'])
    expect(canRate(['master'])).toEqual(['dev', 'master_technician'])
    expect(canRate([])).toEqual(['dev'])
    expect(difficultyCanRate(V2, null)).toBe(false)
    expect(difficultyCanRate(V2, undefined)).toBe(false)
  })

  it("the database's gate carries the same default and the same groups (gc_difficulty_can_rate)", () => {
    const sql = readFileSync(GATE_MIGRATION, 'utf8')
    const fn = /CREATE OR REPLACE FUNCTION public\.gc_difficulty_can_rate\(\)[\s\S]*?\$fn\$([\s\S]*?)\$fn\$/.exec(sql)?.[1] ?? ''
    expect(fn).not.toBe('')
    // The default when no list says.
    const fallback = /'(\[[^']*\])'::jsonb/.exec(fn)
    expect(JSON.parse(fallback![1]!)).toEqual([...DIFFICULTY_RATERS_DEFAULT])
    // A dev always.
    expect(fn).toContain("u.role::text = 'dev'")
    // Each role's group, and no role the kernel leaves out.
    const groups = new Map([...fn.matchAll(/WHEN '(\w+)' THEN '(\w+)'/g)].map((m) => [m[1]!, m[2]!]))
    for (const role of ROLES) {
      if (role === 'dev') continue
      expect(groups.get(role) ?? null, role).toBe(difficultyRaterOfRole(role))
    }
    expect([...groups.keys()].sort()).toEqual(['assistant', 'controller', 'estimator', 'master_technician'])
    // The newest published list is the one read, and the insert rule asks the function.
    expect(fn).toMatch(/p\.status = 'published'\s+ORDER BY p\.version DESC\s+LIMIT 1/)
    expect(sql).toMatch(/CREATE POLICY gc_difficulty_ratings_insert_raters[\s\S]*?WITH CHECK \(public\.gc_difficulty_can_rate\(\)\)/)
    expect(sql).toContain('DROP POLICY IF EXISTS gc_difficulty_ratings_insert_office ON public.gc_difficulty_ratings')
  })

  it('the owner, the controller and a dev edit the list', () => {
    expect(difficultyCanEditPrice('master_technician')).toBe(true)
    expect(difficultyCanEditPrice('controller')).toBe(true)
    expect(difficultyCanEditPrice('dev')).toBe(true)
    expect(difficultyCanEditPrice('assistant')).toBe(false)
    expect(difficultyCanEditPrice('estimator')).toBe(false)
  })

  it('the list in sentences, and the version line', () => {
    expect(difficultyPriceWords(DIFFICULTY_PRICE_V1)).toEqual([
      "Each field point adds 5% of the bid's field hours at its labor rate.",
      'Each office point adds 12 office hours at $80 an hour.',
      "Each site point adds 4% of the bid's field hours at its labor rate.",
      'The paying point carries the price for the days past 45 at 1.5% a month.',
      "All lines together add at most 10% of the bid's own cost.",
      'Paying is read from the bills once a GC has 3 or more, or when 2 in a year ran past their calendar.',
    ])
    expect(difficultyPriceVersionWords({ version: 2, publishedAt: '2026-11-20T15:00:00Z', publishedByName: 'Taunya' })).toBe('price list version 2 · 2026-11-20 by Taunya')
    expect(difficultyPriceVersionWords({ version: 1, publishedAt: null, publishedByName: '' })).toBe('price list version 1')
  })
})
