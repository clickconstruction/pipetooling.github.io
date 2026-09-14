import { describe, expect, it } from 'vitest'
import { crewPositionsFromRpc, crewShortName, firstName, newestPercent, percentIsStale, splitSheetNames, type JobCrewPositionRpcRow } from './jobCrewPosition'

const today = '2026-09-14'
const row = (over: Partial<JobCrewPositionRpcRow> & { job_ledger_id: string }): JobCrewPositionRpcRow => ({
  last_work_date: null,
  last_day_people: null,
  sessions_60d: 0,
  people_60d: 0,
  sheet_stage: null,
  sheet_names: null,
  sheet_date: null,
  sheet_progress_pct: null,
  sheet_stage_changed_at: null,
  report_pct: null,
  report_at: null,
  pct_manual_at: null,
  ...over,
})

describe('crewPositionsFromRpc', () => {
  // J931 Heron, 2026-09-14: Behar's crew clocked in Sep 12; the sheet dated Sep 10 still says working; 40% is the Aug 7 seed (no manual event).
  const heron = row({
    job_ledger_id: 'heron',
    last_work_date: '2026-09-12',
    last_day_people: ['Behar Kraja', 'Malachi Jones'],
    sessions_60d: 14,
    people_60d: 6,
    sheet_stage: 'working',
    sheet_names: 'Behar | Malachi | Abraham | Bryan | Behar Kraja',
    sheet_date: '2026-09-10',
  })

  it('parses a row and knows whether the last clock-in was today', () => {
    const m = crewPositionsFromRpc([heron, row({ job_ledger_id: 'palmer', last_work_date: today, last_day_people: ['Behar Kraja', 'Abraham Ruiz', 'Bryan Diaz'], sessions_60d: 3, people_60d: 3 })], today)
    expect(m.get('heron')).toMatchObject({ lastWorkYmd: '2026-09-12', onSiteToday: false, sessions60d: 14, people60d: 6, lastDayPeople: ['Behar Kraja', 'Malachi Jones'] })
    expect(m.get('heron')!.sheet).toMatchObject({ stage: 'working', names: ['Behar', 'Malachi', 'Abraham', 'Bryan', 'Behar Kraja'], ymd: '2026-09-10' })
    expect(m.get('palmer')).toMatchObject({ onSiteToday: true, lastDayPeople: ['Behar Kraja', 'Abraham Ruiz', 'Bryan Diaz'] })
    expect(crewPositionsFromRpc(null, today).size).toBe(0)
  })

  it('drops an unknown sheet stage and clamps the report percent', () => {
    const m = crewPositionsFromRpc([row({ job_ledger_id: 'x', sheet_stage: 'weird', report_pct: 140, report_at: '2026-09-11T14:00:00Z' })], today)
    expect(m.get('x')!.sheet).toBeNull()
    expect(m.get('x')!.report).toEqual({ pct: 100, at: '2026-09-11T14:00:00Z' })
  })
})

describe('names', () => {
  it('splits a pipe-delimited sheet and takes first names', () => {
    expect(splitSheetNames('Behar | Malachi | Abraham | Bryan | Behar Kraja')).toEqual(['Behar', 'Malachi', 'Abraham', 'Bryan', 'Behar Kraja'])
    expect(splitSheetNames(null)).toEqual([])
    expect(firstName('Behar Kraja')).toBe('Behar')
    expect(firstName('  ')).toBe('')
  })

  it('crewShortName: one name, two names, a crew, or the sheet lead', () => {
    const base = crewPositionsFromRpc([row({ job_ledger_id: 'a', last_work_date: today, last_day_people: ['Miguel Rodriguez'] })], today).get('a')!
    expect(crewShortName(base)).toBe('Miguel')
    expect(crewShortName({ ...base, lastDayPeople: ['Behar Kraja', 'Malachi Jones'] })).toBe('Behar & Malachi')
    expect(crewShortName({ ...base, lastDayPeople: ['Behar Kraja', 'Malachi Jones', 'Abraham Ruiz'] })).toBe('Behar +2')
    const sheetOnly = crewPositionsFromRpc([row({ job_ledger_id: 'b', sheet_stage: 'working', sheet_names: 'Behar | Malachi | Abraham' })], today).get('b')!
    expect(crewShortName(sheetOnly)).toBe("Behar's crew")
    expect(crewShortName(crewPositionsFromRpc([row({ job_ledger_id: 'c', sheet_stage: 'working', sheet_names: 'Texas Rooter' })], today).get('c'))).toBe('Texas Rooter')
    expect(crewShortName(null)).toBe('')
    expect(crewShortName(crewPositionsFromRpc([row({ job_ledger_id: 'd' })], today).get('d'))).toBe('')
  })
})

describe('newestPercent / percentIsStale — the v2.3372 rule on the row', () => {
  const p = (over: Partial<JobCrewPositionRpcRow>) => crewPositionsFromRpc([row({ job_ledger_id: 'j', ...over })], today).get('j')!

  it('the typed number is the number: dated by the hand-set, else by the report that carries it; a report stands alone only with no typed %', () => {
    expect(newestPercent(p({ report_pct: 77, report_at: '2026-05-15T12:00:00Z', pct_manual_at: '2026-09-03T12:00:00Z' }), 90)).toEqual({ pct: 90, source: 'typed', at: '2026-09-03T12:00:00Z' })
    // Take 5 Seguin, live 2026-09-14: the box says 60, the only report (Jul 29) said 0 — the row must not read "0% reported".
    expect(newestPercent(p({ report_pct: 0, report_at: '2026-07-29T12:00:00Z' }), 60)).toEqual({ pct: 60, source: 'typed', at: null })
    // SpaceX: the box's 12 came from the Sep 11 report — that report dates it.
    expect(newestPercent(p({ report_pct: 12, report_at: '2026-09-11T12:00:00Z' }), 12)).toEqual({ pct: 12, source: 'report', at: '2026-09-11T12:00:00Z' })
    expect(newestPercent(p({}), 40)).toEqual({ pct: 40, source: 'typed', at: null })
    expect(newestPercent(p({ report_pct: 12, report_at: '2026-09-11T12:00:00Z' }), null)).toEqual({ pct: 12, source: 'report', at: '2026-09-11T12:00:00Z' })
    expect(newestPercent(p({}), null)).toBeNull()
  })

  it('pct_set_at dates the typed number by the event that set it, worded by its source; the old RPC shape (no pct_set_at) keeps the manual/report reading', () => {
    // Heron: 40% is the Aug 7 back-fill (source seed) — dated, and read as "set".
    expect(newestPercent(p({ pct_set_at: '2026-08-07T05:10:00Z', pct_source: 'seed' }), 40)).toEqual({ pct: 40, source: 'seed', at: '2026-08-07T05:10:00Z' })
    // SpaceX: the 12 came through the Sep 11 report's propagation (source service) — "reported Sep 11" even with an older hand-set on the job.
    expect(newestPercent(p({ pct_manual_at: '2026-08-20T12:00:00Z', report_pct: 12, report_at: '2026-09-11T12:00:00Z', pct_set_at: '2026-09-11T12:00:05Z', pct_source: 'service' }), 12)).toEqual({ pct: 12, source: 'report', at: '2026-09-11T12:00:05Z' })
    // Mission Hills: typed Sep 3 (source manual).
    expect(newestPercent(p({ pct_manual_at: '2026-09-03T12:00:00Z', pct_set_at: '2026-09-03T12:00:00Z', pct_source: 'manual' }), 90)).toEqual({ pct: 90, source: 'typed', at: '2026-09-03T12:00:00Z' })
    // An unknown source word falls back to "typed"; a null pct_set_at (no event, or the pre-column RPC) → today's rule.
    expect(newestPercent(p({ pct_set_at: '2026-09-03T12:00:00Z', pct_source: 'weird' }), 90)).toEqual({ pct: 90, source: 'typed', at: '2026-09-03T12:00:00Z' })
    expect(newestPercent(p({ pct_set_at: null, pct_source: null }), 40)).toEqual({ pct: 40, source: 'typed', at: null })
    // A report stands alone only with no typed %: the event date does not apply to a report-only row.
    expect(newestPercent(p({ report_pct: 12, report_at: '2026-09-11T12:00:00Z', pct_set_at: '2026-08-07T05:10:00Z', pct_source: 'seed' }), null)).toEqual({ pct: 12, source: 'report', at: '2026-09-11T12:00:00Z' })
    expect(crewPositionsFromRpc([row({ job_ledger_id: 'q', pct_set_at: '2026-08-07T05:10:00Z', pct_source: 'seed' })], today).get('q')).toMatchObject({ pctSetAt: '2026-08-07T05:10:00Z', pctSource: 'seed' })
    expect(crewPositionsFromRpc([row({ job_ledger_id: 'q' })], today).get('q')).toMatchObject({ pctSetAt: null, pctSource: null })
  })

  it('stale = the percent on record predates the last clock-in', () => {
    // Heron: 40% seeded Aug 7 with no manual event; the crew was on site Sep 12 → stale.
    expect(percentIsStale(p({ last_work_date: '2026-09-12' }), 40)).toBe(true)
    // Mission Hills: 90% typed Sep 3, last on site Sep 11 → stale (eight days of work since).
    expect(percentIsStale(p({ last_work_date: '2026-09-11', pct_manual_at: '2026-09-03T12:00:00Z' }), 90)).toBe(true)
    // SpaceX: 12% reported Sep 11, crew on site Sep 14 → stale; reported today → fresh.
    expect(percentIsStale(p({ last_work_date: today, report_pct: 12, report_at: '2026-09-11T12:00:00Z' }), 12)).toBe(true)
    expect(percentIsStale(p({ last_work_date: today, report_pct: 12, report_at: `${today}T12:00:00Z` }), 12)).toBe(false)
    // Nobody clocked in: nothing to be stale against. No percent: nothing to be stale.
    expect(percentIsStale(p({}), 40)).toBe(false)
    expect(percentIsStale(p({ last_work_date: today }), null)).toBe(false)
  })

  it('with pct_set_at the stale rule is by date for every source: Heron\'s Aug 7 seed is stale against a Sep 12 clock-in; a report that landed after the last clock-in is fresh', () => {
    expect(percentIsStale(p({ last_work_date: '2026-09-12', pct_set_at: '2026-08-07T05:10:00Z', pct_source: 'seed' }), 40)).toBe(true)
    expect(percentIsStale(p({ last_work_date: '2026-09-12', report_pct: 12, report_at: '2026-09-13T12:00:00Z', pct_set_at: '2026-09-13T12:00:05Z', pct_source: 'service' }), 12)).toBe(false)
    expect(percentIsStale(p({ last_work_date: '2026-09-11', pct_manual_at: '2026-09-03T12:00:00Z', pct_set_at: '2026-09-03T12:00:00Z', pct_source: 'manual' }), 90)).toBe(true)
    // Set the same day the crew was last on site: not stale (the day is not before the clock-in day).
    expect(percentIsStale(p({ last_work_date: '2026-09-12', pct_set_at: '2026-09-12T20:00:00Z', pct_source: 'manual' }), 55)).toBe(false)
  })
})
