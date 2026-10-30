import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isMovableAgingInvoice, movableCandidates, moveStripSummary } from './supplyHouseAging'

/**
 * The move window's two readers held to one answer (punch list #132, the Needs You line):
 * count_supply_house_move_window() on the database (20261021220000) and the tab's kernel —
 * movableCandidates + isMovableAgingInvoice + moveStripSummary, composed as SupplyHousesTab
 * composes them — read the SAME rows, the $rows$ block of the SQL bed's scenario file, and must
 * give the $expect$ block's four numbers. The bed asserts the function (npm run
 * test:pg:supply-house-move-window; CI's sql-beds); this test asserts the kernel. Change the
 * rows or the expectation in one place and both readers are re-tried.
 */
const SCENARIO = fileURLToPath(new URL('../../supabase/tests/supply_house_move_window/20_scenarios.sql', import.meta.url))

type BedRow = {
  id: string
  amount: number
  due_in_days: number | null
  on_job_account: boolean
  is_paid: boolean
  jobs: number
  open_ask: boolean
  confirmed_ask: boolean
  /** The job's account at the house is on record as not needed (20261029220000): never counted. */
  account_not_needed: boolean
  why: string
}
type BedExpect = { count: number; dollars: number; asked: number; soonest_in_days: number }

function block(tag: string): string {
  const src = readFileSync(SCENARIO, 'utf8')
  // The real block opens inside jsonb_to_record(set)( and closes with ::jsonb — the header comment names the tags too.
  const m = new RegExp(`\\(\\$${tag}\\$([\\s\\S]*?)\\$${tag}\\$::jsonb`).exec(src)
  if (!m) throw new Error(`no $${tag}$ block in ${SCENARIO}`)
  return m[1]!
}

/** A fixed today; the bed uses app_today(). Only the distance to each due date matters. */
const TODAY = '2026-10-21'
function ymdPlus(days: number): string {
  const [y, m, d] = TODAY.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10)
}

describe('the move window: the kernel over the SQL bed’s rows', () => {
  const rows = JSON.parse(block('rows')) as BedRow[]
  const expected = JSON.parse(block('expect')) as BedExpect

  it('the bed’s rows cover every edge the predicate has', () => {
    const whys = rows.map((r) => r.why).join(' | ')
    for (const edge of ['due today', 'due yesterday', 'already on the job account', 'a credit', 'no due date', 'two jobs', 'no job', 'paid', 'confirmed', 'marked not needed']) {
      expect(whys).toContain(edge)
    }
  })

  it('gives the $expect$ numbers the bed asserts of count_supply_house_move_window()', () => {
    // The tab: the unpaid book → movableCandidates → exactly one job → moveStripSummary over the open asks.
    const unpaid = rows
      .filter((r) => !r.is_paid)
      .map((r) => ({ id: r.id, amount: r.amount, due_date: r.due_in_days == null ? null : ymdPlus(r.due_in_days), on_job_account: r.on_job_account }))
    const allocationCount = new Map(rows.map((r) => [r.id, r.jobs]))
    // The pair's account status, as the tab reads it for the single-job pairs (v2.6086).
    const accountStatus = new Map(rows.map((r) => [r.id, r.account_not_needed ? 'not_needed' : null]))
    const movable = movableCandidates(unpaid, TODAY).filter((r) => allocationCount.get(r.id) === 1 && accountStatus.get(r.id) !== 'not_needed')
    const asked = new Set(rows.filter((r) => r.open_ask).map((r) => r.id))
    const s = moveStripSummary(movable, asked)
    expect(s.count).toBe(expected.count)
    expect(s.dollars).toBeCloseTo(expected.dollars, 2)
    expect(s.askedCount).toBe(expected.asked)
    expect(s.soonestDueYmd).toBe(ymdPlus(expected.soonest_in_days))
    // The per-row test the modal's rows use agrees with the set the strip summed.
    const byRow = unpaid.filter((r) => isMovableAgingInvoice(r, allocationCount.get(r.id) ?? null, TODAY, accountStatus.get(r.id))).map((r) => r.id)
    expect(byRow).toEqual(movable.map((r) => r.id))
  })
})
