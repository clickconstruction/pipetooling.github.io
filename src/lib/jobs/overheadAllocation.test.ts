import { describe, expect, it } from 'vitest'
import { allocateJobOverheadDayShare, buildJobDayLedger, deserializeJobDayLedger, serializeJobDayLedger, unallocatedJobDayOverhead, type JobDayLedger } from './jobDayLedger'
import {
  OVERHEAD_ALLOCATION_LEGACY,
  OVERHEAD_ALLOCATION_RECOMMENDED,
  buildOverheadAllocation,
  isLegacyOverheadAllocation,
  jobOverheadAllocation,
  normalizeOverheadAllocationSettings,
  overheadAllocationLabel,
  overheadAllocationReconciles,
  type OverheadAllocationSettings,
} from './overheadAllocation'
import type { OtherJobsLaborDetailLine } from '../overheadDailyLabor'
import { ymdAddDays } from '../../utils/dateUtils'

const line = (ymd: string, job: string, user: string, hours: number, wage = 30): OtherJobsLaborDetailLine => ({
  sessionId: `${ymd}-${job}-${user}`,
  workDate: ymd,
  userName: user,
  hours,
  laborUsd: hours * wage,
  missingWage: false,
  jobLedgerId: job,
  notes: null,
})

/** A three-week window with a two-week lead: lumpy pool, a one-hour Saturday, quiet days, three jobs with different shapes. */
function fixture(opts: { lead?: boolean; spans?: boolean } = {}): JobDayLedger {
  const field = new Map<string, OtherJobsLaborDetailLine[]>()
  const pool = new Map<string, number>()
  const put = (ymd: string, lines: OtherJobsLaborDetailLine[]) => field.set(ymd, lines)
  // Lead (Aug 17 → Aug 30): jA worked, a fat pool on Aug 28 that should spread into the window.
  if (opts.lead !== false) {
    put('2026-08-24', [line('2026-08-24', 'jA', 'Terry', 8)])
    put('2026-08-26', [line('2026-08-26', 'jA', 'Terry', 8), line('2026-08-26', 'jB', 'Paige', 8)])
    pool.set('2026-08-24', 300)
    pool.set('2026-08-28', 900)
  }
  // Window (Aug 31 → Sep 20).
  put('2026-08-31', [line('2026-08-31', 'jA', 'Terry', 8), line('2026-08-31', 'jB', 'Paige', 24)])
  put('2026-09-01', [line('2026-09-01', 'jA', 'Terry', 8), line('2026-09-01', 'jC', 'Micah', 8)])
  put('2026-09-02', [line('2026-09-02', 'jA', 'Terry', 8)])
  put('2026-09-05', [line('2026-09-05', 'jC', 'Micah', 1)]) // Saturday, one hour
  put('2026-09-08', [line('2026-09-08', 'jA', 'Terry', 8), line('2026-09-08', 'jB', 'Paige', 8)])
  put('2026-09-15', [line('2026-09-15', 'jA', 'Terry', 8)])
  put('2026-09-18', [line('2026-09-18', 'jA', 'Terry', 8)])
  pool.set('2026-08-31', 400)
  pool.set('2026-09-01', 1200) // the lumpy day
  pool.set('2026-09-02', 350)
  pool.set('2026-09-05', 500) // office parts on the Saturday
  pool.set('2026-09-06', 120) // Sunday, nobody in the field
  pool.set('2026-09-08', 380)
  pool.set('2026-09-09', 200) // office only, the day before jB is billed
  pool.set('2026-09-15', 390)
  pool.set('2026-09-18', 410)
  pool.set('2026-09-20', 100) // office only, the window's last day
  return buildJobDayLedger({
    startYmd: '2026-08-31',
    endYmd: '2026-09-20',
    leadStartYmd: opts.lead !== false ? '2026-08-17' : undefined,
    officeJobLedgerId: 'office',
    fieldDetailByDay: field,
    poolUsdByDay: pool,
    jobLabels: new Map([
      ['jA', { number: '101', name: 'Long job', status: 'working' }],
      ['jB', { number: '102', name: 'Billed job', status: 'billed' }],
      ['jC', { number: '103', name: 'Short job', status: 'working' }],
    ]),
    statusSpansByJob:
      opts.spans === false
        ? new Map()
        : new Map([
            ['jA', { startYmd: '2026-08-20', endYmd: null, billedYmd: null, paidYmd: null }],
            ['jB', { startYmd: '2026-08-26', endYmd: '2026-09-10', billedYmd: '2026-09-10', paidYmd: null }],
            ['jC', { startYmd: '2026-09-01', endYmd: null, billedYmd: null, paidYmd: null }],
          ]),
    invoicedRevenueUsd: 50_000,
    addDays: ymdAddDays,
  })
}

const REC = OVERHEAD_ALLOCATION_RECOMMENDED
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0)

describe('buildJobDayLedger with a lead', () => {
  it('keeps the window in `days` and the lead in `leadDays`, and rolls jobs up from the window only', () => {
    const l = fixture()
    expect(l.days[0]!.ymd).toBe('2026-08-31')
    expect(l.days[l.days.length - 1]!.ymd).toBe('2026-09-20')
    expect(l.leadDays!.map((d) => d.ymd)[0]).toBe('2026-08-17')
    expect(l.leadDays!.length).toBe(14)
    expect(l.leadDays!.find((d) => d.ymd === '2026-08-26')!.byJob.get('jB')!.hours).toBe(8)
    // jB's window hours exclude its lead day.
    expect(l.jobs.get('jB')!.hours).toBe(32)
    expect(l.totals.poolUsd).toBe(400 + 1200 + 350 + 500 + 120 + 380 + 200 + 390 + 410 + 100)
  })
  it('survives serialization with its lead', () => {
    const l = fixture()
    const back = deserializeJobDayLedger(serializeJobDayLedger(l))
    expect(back.leadDays!.length).toBe(14)
    expect(back.leadDays!.find((d) => d.ymd === '2026-08-28')!.poolUsd).toBe(900)
    expect(buildOverheadAllocation(back, REC).totals.chargedUsd).toBeCloseTo(buildOverheadAllocation(l, REC).totals.chargedUsd, 6)
  })
})

describe('legacy identity', () => {
  it('1 day · 0% · no cap reproduces the original day-share to the cent, job by job', () => {
    const l = fixture()
    for (const id of ['jA', 'jB', 'jC']) {
      const legacy = allocateJobOverheadDayShare(l, id)
      const viaAllocation = jobOverheadAllocation(l, id, OVERHEAD_ALLOCATION_LEGACY)
      expect(viaAllocation.overheadUsd).toBeCloseTo(legacy.overheadUsd, 9)
      expect(viaAllocation.hoursInWindow).toBeCloseTo(legacy.hoursInWindow, 9)
      expect(viaAllocation.daysInWindow).toBe(legacy.daysInWindow)
      expect(viaAllocation.lines.map((x) => [x.ymd, x.shareUsd])).toEqual(legacy.lines.map((x) => [x.ymd, expect.closeTo(x.shareUsd, 9)]))
      expect(viaAllocation.carryUsd).toBe(0)
    }
    const un = unallocatedJobDayOverhead(l)
    const t = buildOverheadAllocation(l, OVERHEAD_ALLOCATION_LEGACY).totals
    expect(t.unallocatedUsd).toBeCloseTo(un.usd, 9)
    expect(t.unallocatedDays).toBe(un.days)
    expect(un.usd).toBe(120 + 200 + 100) // the Sunday, Sep 9 and Sep 20: office cost, nobody in the field
    expect(isLegacyOverheadAllocation(OVERHEAD_ALLOCATION_LEGACY)).toBe(true)
    expect(isLegacyOverheadAllocation(REC)).toBe(false)
  })
  it('allocateJobOverheadDayShare takes the allocation path only for non-legacy settings', () => {
    const l = fixture()
    expect(allocateJobOverheadDayShare(l, 'jA', OVERHEAD_ALLOCATION_LEGACY).lines[0]!.carryUsd).toBeUndefined()
    expect(allocateJobOverheadDayShare(l, 'jA', REC).lines[0]!.carryUsd).toBeDefined()
  })
})

describe('reconciliation', () => {
  const settingsGrid: OverheadAllocationSettings[] = [
    OVERHEAD_ALLOCATION_LEGACY,
    REC,
    { smoothDays: 7, carryShare: 0, idleCapDays: null, openDef: 'status' },
    { smoothDays: 14, carryShare: 0.5, idleCapDays: 7, openDef: 'worked' },
    { smoothDays: 60, carryShare: 1, idleCapDays: null, openDef: 'status' },
    { smoothDays: 3, carryShare: 0.2, idleCapDays: 30, openDef: 'status' },
  ]
  for (const s of settingsGrid) {
    it(`ties to the cent: ${overheadAllocationLabel(s)} (${s.openDef})`, () => {
      for (const l of [fixture(), fixture({ lead: false }), fixture({ spans: false })]) {
        const a = buildOverheadAllocation(l, s)
        const t = a.totals
        expect(overheadAllocationReconciles(t, 1e-6)).toBe(true)
        // Per-job sum equals the charged total.
        expect(sum([...a.perJob.values()].map((j) => j.overheadUsd))).toBeCloseTo(t.chargedUsd, 6)
        expect(sum([...a.perJob.values()].map((j) => j.carryUsd))).toBeCloseTo(t.carryUsd, 6)
        expect(sum([...a.perJob.values()].map((j) => j.activityUsd))).toBeCloseTo(t.activityUsd, 6)
        // Day rows tie too.
        expect(sum(a.days.map((d) => d.landedUsd))).toBeCloseTo(t.chargedUsd + t.unallocatedUsd - (t.unallocatedUsd - sum(a.days.map((d) => d.unallocatedUsd))), 6)
        for (const d of a.days) {
          expect(d.activityUsd).toBeGreaterThanOrEqual(-1e-9)
          expect(d.carryUsd).toBeGreaterThanOrEqual(-1e-9)
        }
      }
    })
  }
  it('the window pool is the raw pool; carried in comes only from lead days', () => {
    const withLead = buildOverheadAllocation(fixture(), REC).totals
    const noLead = buildOverheadAllocation(fixture({ lead: false }), REC).totals
    expect(withLead.poolUsd).toBe(noLead.poolUsd)
    expect(noLead.carriedInUsd).toBe(0)
    expect(withLead.carriedInUsd).toBeGreaterThan(0)
    // Aug 28's $900 spreads over Aug 28 → Sep 26; the lead has no hours after Aug 26, so all of it lands in the window.
    // Aug 24's $300 spreads over Aug 24 → Sep 22, and the lead holds 24 of those hours, so only part of it carries in.
    expect(withLead.carriedInUsd).toBeGreaterThan(900)
    expect(withLead.carriedInUsd).toBeLessThan(1200)
  })
})

describe('the spread', () => {
  it('lands on hours, not on days: the one-hour Saturday receives 1/H of the pool, not a whole day', () => {
    const l = fixture()
    const a = buildOverheadAllocation(l, { smoothDays: 7, carryShare: 0, idleCapDays: null, openDef: 'status' })
    const sat = a.dayByYmd.get('2026-09-05')!
    const tue = a.dayByYmd.get('2026-09-08')!
    // Same activity rate per hour on both days, since the same source windows feed them.
    expect(sat.activityPerHourUsd).toBeGreaterThan(0)
    expect(sat.landedUsd).toBeLessThan(tue.landedUsd)
    expect(sat.landedUsd / sat.fieldHours).toBeCloseTo(sat.activityPerHourUsd, 9)
  })
  it('smooths the lumpy day: the $1,200 Tuesday no longer lands on the two jobs worked that day alone', () => {
    const l = fixture()
    const legacy = allocateJobOverheadDayShare(l, 'jC')
    const smooth = jobOverheadAllocation(l, 'jC', { smoothDays: 14, carryShare: 0, idleCapDays: null, openDef: 'status' })
    // jC worked 8 h on the $1,200 day and 1 h on the Saturday. Legacy: half of $1,200 plus the whole Saturday pool.
    expect(legacy.overheadUsd).toBeCloseTo(600 + 500, 6)
    expect(smooth.overheadUsd).toBeLessThan(legacy.overheadUsd / 2)
  })
  it('quiet-day pool spreads onto later hours instead of going unallocated', () => {
    const l = fixture()
    expect(buildOverheadAllocation(l, OVERHEAD_ALLOCATION_LEGACY).totals.unallocatedUsd).toBe(420)
    // Sep 20's $100 has no hours in its 7-day window inside the data: it is in flight, not unallocated.
    const t7 = buildOverheadAllocation(l, { smoothDays: 7, carryShare: 0, idleCapDays: null, openDef: 'status' }).totals
    expect(t7.unallocatedUsd).toBeCloseTo(100 / 7, 6)
    expect(t7.inFlightUsd).toBeGreaterThan(0)
  })
  it('pool from the window that spreads past the end is in flight, and it shrinks with a shorter window', () => {
    const l = fixture()
    const t30 = buildOverheadAllocation(l, REC).totals
    const t7 = buildOverheadAllocation(l, { ...REC, smoothDays: 7 }).totals
    expect(t30.inFlightUsd).toBeGreaterThan(t7.inFlightUsd)
    expect(t7.inFlightUsd).toBeGreaterThan(0) // Sep 18's pool still has days past Sep 20
    expect(buildOverheadAllocation(l, OVERHEAD_ALLOCATION_LEGACY).totals.inFlightUsd).toBe(0)
  })
})

describe('carry', () => {
  it('splits the carry slice equally among the jobs open that day and charges the rest by hours', () => {
    const l = fixture()
    const a = buildOverheadAllocation(l, { smoothDays: 1, carryShare: 0.5, idleCapDays: null, openDef: 'status' })
    const d = a.dayByYmd.get('2026-09-02')! // jA worked; jA, jB, jC all open under status
    expect(d.openJobs).toBe(3)
    expect(d.carryUsd).toBeCloseTo(175, 6)
    expect(d.activityUsd).toBeCloseTo(175, 6)
    expect(d.byJob.get('jA')!.carryUsd).toBeCloseTo(175 / 3, 6)
    expect(d.byJob.get('jB')!.carryUsd).toBeCloseTo(175 / 3, 6)
    expect(d.byJob.get('jB')!.activityUsd).toBe(0)
    expect(d.byJob.get('jA')!.activityUsd).toBeCloseTo(175, 6)
  })
  it('an open job with no field time that day is charged carry only, and shows on its lines', () => {
    const l = fixture()
    const jB = jobOverheadAllocation(l, 'jB', { smoothDays: 1, carryShare: 0.5, idleCapDays: null, openDef: 'status' })
    const idle = jB.lines.find((x) => x.ymd === '2026-09-02')!
    expect(idle.jobHours).toBe(0)
    expect(idle.activityUsd).toBe(0)
    expect(idle.carryUsd).toBeGreaterThan(0)
    expect(jB.openDays).toBeGreaterThan(jB.daysInWindow)
    expect(jB.daysInWindow).toBe(2) // field days stay field days
  })
  it('the status definition ends carry at the Billed move; the worked definition ends it at the last field day', () => {
    const l = fixture()
    const status = jobOverheadAllocation(l, 'jB', { smoothDays: 1, carryShare: 1, idleCapDays: null, openDef: 'status' })
    const worked = jobOverheadAllocation(l, 'jB', { smoothDays: 1, carryShare: 1, idleCapDays: null, openDef: 'worked' })
    expect(status.lines.some((x) => x.ymd === '2026-09-09')).toBe(true) // still open the day before its Billed move
    expect(status.lines.some((x) => x.ymd === '2026-09-15')).toBe(false)
    expect(worked.lines.some((x) => x.ymd === '2026-09-09')).toBe(false) // last field day Sep 8
  })
  it('a still-open job runs to the window end; a job with no status history falls back to its field days', () => {
    const l = fixture({ spans: false })
    const jA = jobOverheadAllocation(l, 'jA', { smoothDays: 1, carryShare: 1, idleCapDays: null, openDef: 'status' })
    expect(jA.lines.some((x) => x.ymd === '2026-09-20')).toBe(true) // working, no span → to the end
    const jB = jobOverheadAllocation(l, 'jB', { smoothDays: 1, carryShare: 1, idleCapDays: null, openDef: 'status' })
    expect(jB.lines.some((x) => x.ymd === '2026-09-09')).toBe(false) // billed, no span → last field day
  })
  it('the idle cap stops carry after N days without field time, with the same grace from the start', () => {
    const l = fixture()
    const capped = jobOverheadAllocation(l, 'jC', { smoothDays: 1, carryShare: 1, idleCapDays: 3, openDef: 'status' })
    // jC: span from Sep 1, worked Sep 1 and Sep 5. Carries Sep 1–4 (work Sep 1), Sep 5–8 (work Sep 5), then stops.
    const days = capped.lines.map((x) => x.ymd)
    expect(days).toContain('2026-09-08')
    expect(days).not.toContain('2026-09-09')
    const uncapped = jobOverheadAllocation(l, 'jC', { smoothDays: 1, carryShare: 1, idleCapDays: null, openDef: 'status' })
    expect(uncapped.lines.map((x) => x.ymd)).toContain('2026-09-20')
  })
  it('carry with nobody open goes to hours; activity with nobody working goes to open jobs only when carry is on', () => {
    // A ledger where a day has pool and hours but no open job (no spans, billed status, work only that day).
    const field = new Map([['2026-09-01', [line('2026-09-01', 'jX', 'Terry', 8)]]])
    const l = buildJobDayLedger({
      startYmd: '2026-09-01',
      endYmd: '2026-09-02',
      officeJobLedgerId: 'office',
      fieldDetailByDay: field,
      poolUsdByDay: new Map([
        ['2026-09-01', 100],
        ['2026-09-02', 50],
      ]),
      jobLabels: new Map([['jX', { number: '1', name: 'x', status: 'billed' }]]),
      addDays: ymdAddDays,
    })
    const half = buildOverheadAllocation(l, { smoothDays: 1, carryShare: 0.5, idleCapDays: null, openDef: 'status' })
    // Sep 1: jX open (worked) and working → carry 50 to jX, activity 50 to jX.
    expect(half.perJob.get('jX')!.overheadUsd).toBeCloseTo(100, 6)
    // Sep 2: pool 50, nobody worked, nobody open (billed, last day Sep 1) → unallocated.
    expect(half.totals.unallocatedUsd).toBeCloseTo(50, 6)
    const none = buildOverheadAllocation(l, { smoothDays: 2, carryShare: 0, idleCapDays: null, openDef: 'status' })
    // With carry off an open job is never charged. Sep 2's $50 spreads over Sep 2–3: half is past the data (in flight),
    // the half that stays has no hours to land on → unallocated.
    expect(none.totals.unallocatedUsd).toBeCloseTo(25, 6)
    expect(none.totals.inFlightUsd).toBeCloseTo(25, 6)
    expect(overheadAllocationReconciles(none.totals, 1e-6)).toBe(true)
  })
})

describe('settings', () => {
  it('normalizes stored JSON and clamps every field', () => {
    expect(normalizeOverheadAllocationSettings(null)).toEqual(OVERHEAD_ALLOCATION_LEGACY)
    expect(normalizeOverheadAllocationSettings('not json')).toEqual(OVERHEAD_ALLOCATION_LEGACY)
    expect(normalizeOverheadAllocationSettings(JSON.stringify(REC))).toEqual(REC)
    expect(normalizeOverheadAllocationSettings({ smoothDays: 999, carryShare: 7, idleCapDays: 0, openDef: 'nope' })).toEqual({ smoothDays: 60, carryShare: 1, idleCapDays: 1, openDef: 'status' })
    expect(normalizeOverheadAllocationSettings({ smoothDays: '30', carryShare: '0.2', idleCapDays: '', openDef: 'worked' })).toEqual({ smoothDays: 30, carryShare: 0.2, idleCapDays: null, openDef: 'worked' })
    expect(normalizeOverheadAllocationSettings({ carryShare: 0.333 }).carryShare).toBe(0.33)
  })
  it('labels read the way the toolbar shows them', () => {
    expect(overheadAllocationLabel(OVERHEAD_ALLOCATION_LEGACY)).toBe('1 day · no carry')
    expect(overheadAllocationLabel(REC)).toBe('30 days · 20% carry · 14-day idle cap')
    expect(overheadAllocationLabel({ smoothDays: 14, carryShare: 0.5, idleCapDays: null, openDef: 'status' })).toBe('14 days · 50% carry')
  })
  it('memoizes per ledger and settings', () => {
    const l = fixture()
    expect(buildOverheadAllocation(l, REC)).toBe(buildOverheadAllocation(l, { ...REC }))
    expect(buildOverheadAllocation(l, REC)).not.toBe(buildOverheadAllocation(l, { ...REC, smoothDays: 29 }))
  })
})
