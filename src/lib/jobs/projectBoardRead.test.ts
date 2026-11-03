import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { laborEventsOf, parseProjectBoardRead, teamHoursOf, valueEventsOf } from './projectBoardRead'
import { JOB_BURN_DEFAULT_TARGET_MARGIN_PCT } from './jobBurn'

const raw = {
  reads_wages: true,
  jobs: [
    {
      id: 'a',
      hcp_number: '1044',
      click_number: null,
      job_name: 'The Lodge',
      job_address: '1 Hill Rd',
      status: 'working',
      pct_complete: 50,
      revenue: '27000',
      budget_kind: 'bid',
      budget_hours: '180.5',
      fixtures: [{ id: 'f', name: 'Rough In', stage_kind: 'order', line_kind: 'fixture', line_unit_price: 9000, count: 1, progress_pct: null, sequence_order: 1 }],
      labor: [
        { ymd: '2026-10-20', who: 'Ana', hours: 8 },
        { ymd: '2026-10-20', who: 'Luis', hours: '4.5' },
        { ymd: '2026-10-21', who: 'Ana', hours: 0 },
        { ymd: null, who: 'Lost', hours: 8 },
      ],
      values: [
        { ymd: '2026-10-20', pct: 40, kind: 'report' },
        { ymd: '2026-10-21', pct: '45', kind: 'manual' },
        { ymd: '2026-10-22', pct: null, kind: 'report' },
      ],
      spent_pct: 41,
    },
    { id: null, job_name: 'No id' },
  ],
}

describe('parseProjectBoardRead', () => {
  const read = parseProjectBoardRead(raw)
  it('reads the viewer\'s wage flag strictly, and drops a job with no id', () => {
    expect(read.readsWages).toBe(true)
    expect(read.jobs.map((j) => j.id)).toEqual(['a'])
    expect(parseProjectBoardRead({ reads_wages: 'yes', jobs: [] }).readsWages).toBe(false)
  })
  it('reads numbers that arrive as strings and keeps a null spend as no reading', () => {
    expect(read.jobs[0]).toMatchObject({ revenue: 27000, budgetKind: 'bid', budgetHours: 180.5, spentPct: 41 })
    expect(parseProjectBoardRead({ jobs: [{ id: 'b', spent_pct: null }] }).jobs[0]).toMatchObject({ spentPct: null, budgetKind: null, budgetHours: null, labor: [], values: [], fixtures: [] })
  })
  it('keeps only labor rows with a day and hours, and only percents with a value', () => {
    expect(read.jobs[0]!.labor).toEqual([
      { ymd: '2026-10-20', who: 'Ana', hours: 8 },
      { ymd: '2026-10-20', who: 'Luis', hours: 4.5 },
    ])
    expect(read.jobs[0]!.values).toEqual([
      { ymd: '2026-10-20', pct: 40, kind: 'report' },
      { ymd: '2026-10-21', pct: 45, kind: 'manual' },
    ])
  })
  it('survives a read that is not the shape it expects', () => {
    expect(parseProjectBoardRead(null)).toEqual({ readsWages: false, jobs: [] })
    expect(parseProjectBoardRead({ reads_wages: true, jobs: 'nope' })).toEqual({ readsWages: true, jobs: [] })
  })
  it('carries what the job\'s kind reads, and tells a blank kind from a read that never carried it', () => {
    const facts = { id: 'a', kind: 'project', bid_id: 'b1', project_id: 'p1', first_work_date: '2026-10-20', billing_only: true }
    expect(parseProjectBoardRead({ jobs: [facts] }).jobs[0]).toMatchObject(facts)
    const blank = parseProjectBoardRead({ jobs: [{ id: 'a', kind: null, bid_id: null, project_id: null, first_work_date: null, billing_only: false }] }).jobs[0]!
    expect(blank).toMatchObject({ kind: null, bid_id: null, project_id: null, first_work_date: null, billing_only: false })
    expect(parseProjectBoardRead({ jobs: [{ id: 'a' }] }).jobs[0]!.kind).toBeUndefined()
  })
})

describe('the read as the strip and the day card draw it', () => {
  const job = parseProjectBoardRead(raw).jobs[0]!
  it('totals the hours', () => {
    expect(teamHoursOf(job)).toBe(12.5)
  })
  it('makes each labor row a team labor event with hours and no dollar', () => {
    expect(laborEventsOf(job)).toEqual([
      { source: 'team_labor', dateKey: '2026-10-20', amount: 0, label: 'Ana', who: 'Ana', hours: 8 },
      { source: 'team_labor', dateKey: '2026-10-20', amount: 0, label: 'Luis', who: 'Luis', hours: 4.5 },
    ])
  })
  it('makes each percent a value event of its kind', () => {
    expect(valueEventsOf(job)).toEqual([
      { dateKey: '2026-10-20', percent: 40, label: '', kind: 'report' },
      { dateKey: '2026-10-21', percent: 45, label: '', kind: 'manual' },
    ])
  })
})

describe('the function the read comes from', () => {
  // The read prod answers with is the newest migration that replaces the function, so a later copy stays under these pins.
  const dir = resolve(process.cwd(), 'supabase/migrations')
  const read = (file: string) => readFileSync(resolve(dir, file), 'utf8')
  const replaces = readdirSync(dir)
    .filter((f) => f.includes('_project_board_'))
    .filter((f) => read(f).includes('CREATE OR REPLACE FUNCTION public.list_project_board('))
    .sort()
  const sql = read(replaces[replaces.length - 1]!)
  it('carries every fact the job\'s kind reads, for every role on the board', () => {
    const returned = sql.slice(sql.indexOf("'reads_wages', public.has_payroll_access()"), sql.indexOf('INTO v_out'))
    for (const fact of ['kind', 'hcp_number', 'click_number', 'bid_id', 'project_id', 'revenue', 'first_work_date', 'status', 'billing_only', 'fixtures']) {
      expect(returned).toContain(`'${fact}', `)
    }
  })
  it('assumes the same margin as the Burn default, so the board and the Costs tab start from one figure', () => {
    expect(sql).toContain(`(1 - ${JOB_BURN_DEFAULT_TARGET_MARGIN_PCT} / 100.0)`)
  })
  it('stands a baseline for the whole job only with a labor and a materials figure, as the Costs tab\'s Burn does', () => {
    expect(sql).toContain("b.kind IN ('bid', 'typed') AND COALESCE(b.labor_usd, 0) > 0 AND COALESCE(b.materials_usd, 0) > 0")
  })
  it('lets no labor dollar out: the only money in what it returns is the blended percent', () => {
    const start = sql.indexOf("'reads_wages', public.has_payroll_access()")
    const end = sql.indexOf('INTO v_out')
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    // The flag's own name and the comments aside, what comes back is hours, percents and the job's own facts.
    const returned = sql.slice(start, end).replace(/--.*$/gm, '').replace("'reads_wages'", '')
    const percent = 'CASE WHEN sp.budget_usd > 0 THEN round(100 * sp.usd / sp.budget_usd)::int END'
    expect(returned).toContain(percent)
    expect(returned.replace(percent, '')).not.toMatch(/usd|wage|rate\b|amount|cost/i)
    const labor = sql.slice(sql.indexOf('labor_rows AS ('), sql.indexOf('value_rows AS ('))
    expect(labor).toContain("'hours', round(hours, 2)")
    expect(labor.replace(/--.*$/gm, '')).not.toMatch(/usd|wage|rate\b/i)
  })
  it('holds the read to the board\'s roles, the same set the client gates on', () => {
    expect(read('20261102163008_project_board_read.sql')).toContain("u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'superintendent')")
    expect(sql).toContain('IF NOT public.can_read_project_board() THEN')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.list_project_board(uuid[]) FROM PUBLIC, anon;')
  })
})
