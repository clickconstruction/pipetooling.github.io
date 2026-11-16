import { describe, expect, it } from 'vitest'
import { buildSheetPartiesLookup, sheetParties } from '../subWorkOrders/sheetParties'
import type { NeedsWorkOrderRosterPerson } from '../subWorkOrders/rosterSub'
import { sheetOwedTo, rodeAlongWords, teamSheetsLineWords } from '../subWorkOrders/teamSheetRule'
import { buildJobOwedBlock, buildSubOwedBreakdown, owedCheck, owedCsv, owedPersonById, owedPersonMatches, owedTiles, owedView, type OwedSheetInput } from './subOwedBreakdown'

// Made-up people. Harlan and Marlow are subs; Dana carries kind `sub` behind a team login; Owen is a teammate.
const ROSTER: NeedsWorkOrderRosterPerson[] = [
  { id: 'harlan', name: 'Harlan Mechanical', kind: 'sub', accountRole: 'subcontractor' },
  { id: 'marlow', name: 'Marlow Tile', kind: 'sub', accountRole: null },
  { id: 'dana', name: 'Dana Whitlock', kind: 'sub', accountRole: 'superintendent' },
  { id: 'owen', name: 'Owen Farris', kind: 'helper', accountRole: 'helpers' },
]
const lookup = buildSheetPartiesLookup(ROSTER)

type Pay = { id: string; amount: number; payment_date?: string | null; method?: string | null; method_ref?: string | null; memo?: string | null }
function sheet(id: string, names: string[], lines: Array<[string, number]>, pays: Pay[] = [], over: Partial<OwedSheetInput> & { day?: string; number?: string } = {}): OwedSheetInput {
  const s = {
    id,
    assigned_to_name: names.map((n) => ROSTER.find((p) => p.id === n)?.name ?? n).join(' | '),
    job_number: over.number ?? '2041',
    job_ledger_id: over.jobId ?? 'job-cedar',
    address: '418 Larkspur Ln',
    labor_rate: null,
    job_date: over.day ?? '2026-10-28',
    created_at: '2026-10-28T15:00:00Z',
    items: lines.map(([fixture, amount]) => ({ fixture, count: 1, hrs_per_unit: 0, direct_labor_amount: amount })),
    payments: pays.map((p) => ({ memo: null, created_at: '2026-10-31T15:00:00Z', ...p })),
  }
  const assignees = names.filter((n) => ROSTER.some((p) => p.id === n)).map((n) => ({ personId: n, personName: ROSTER.find((p) => p.id === n)!.name }))
  return { sheet: s, parties: sheetParties(s, assignees.length === names.length ? assignees : undefined, lookup), payWhen: over.payWhen ?? null, jobId: over.jobId ?? 'job-cedar', jobName: over.jobName ?? 'Cedar Hollow Clinic' }
}

const READY = { kind: 'ready' as const, label: 'Ready', detail: 'customer paid', tone: 'green' as const }

describe('sheetOwedTo — who a sheet is owed to under each rule', () => {
  it('a sub and a teammate: the sub, whole, under both rules', () => {
    const p = sheet('a', ['harlan', 'dana'], [['Rough-in', 100]]).parties
    for (const rule of ['payroll', 'owed'] as const) {
      const to = sheetOwedTo(p, rule)
      expect(to.kind).toBe('sub')
      expect(to.person?.id).toBe('harlan')
      expect(to.counts).toBe(true)
    }
  })
  it('one teammate and no sub: nobody under payroll, the teammate under owed', () => {
    const p = sheet('a', ['dana'], [['Job finished early', 500]]).parties
    expect(sheetOwedTo(p, 'payroll')).toMatchObject({ kind: 'payroll', person: null, counts: false })
    expect(sheetOwedTo(p, 'owed')).toMatchObject({ kind: 'team', key: 'id:dana', counts: true })
  })
  it('two teammates and no sub: shared under owed, never split', () => {
    const p = sheet('a', ['dana', 'owen'], [['Bonus', 500]]).parties
    expect(sheetOwedTo(p, 'owed')).toMatchObject({ kind: 'shared', person: null, counts: true })
    expect(sheetOwedTo(p, 'payroll').kind).toBe('payroll')
  })
  it('two subs: shared under both rules', () => {
    const p = sheet('a', ['harlan', 'marlow'], [['Curb', 800]]).parties
    expect(sheetOwedTo(p, 'payroll').kind).toBe('shared')
    expect(sheetOwedTo(p, 'owed').kind).toBe('shared')
  })
  it('says a teammate is not paid from a sub sheet, and does not say payroll', () => {
    const words = rodeAlongWords(['Dana Whitlock'], 'Harlan Mechanical')
    expect(words).toBe("Dana Whitlock is named on this sheet and not paid from it. The whole sheet is Harlan Mechanical's.")
    expect(words).not.toMatch(/payroll/i)
  })
  it('the line under the roster names the open money under each rule', () => {
    expect(teamSheetsLineWords(7, 2950, 'payroll')).toBe("7 sheets name a teammate and no sub. $2,950.00 is open on them and is in nobody's Balance due.")
    expect(teamSheetsLineWords(7, 2950, 'owed')).toBe('7 sheets name a teammate and no sub. $2,950.00 is open on them, owed to the teammate as sub labor.')
    expect(teamSheetsLineWords(0, 0, 'owed')).toBe('')
  })
})

describe('buildSubOwedBreakdown — a sub, by job and sheet', () => {
  const inputs = [
    sheet('s1', ['harlan', 'dana'], [['Rough-in', 2400], ['Top-out', 1800]], [{ id: 'p1', amount: 1500, payment_date: '2026-10-31', method: 'check', method_ref: '1182' }, { id: 'b1', amount: -100, memo: 'cleanup after top-out' }]),
    sheet('s2', ['harlan'], [['Trim', 1200]], [], { day: '2026-11-06', payWhen: READY }),
    sheet('s3', ['harlan'], [['Slab sleeves', 2500]], [], { day: '2026-11-03', jobId: 'job-ridge', jobName: 'Ridgeway Builders, Lot 12', number: '2057' }),
    sheet('s4', ['harlan'], [['Drain', 900]], [{ id: 'p4', amount: 900, payment_date: '2026-10-02' }], { day: '2026-09-28' }),
    sheet('s5', ['harlan'], [['Vent', 300]], [{ id: 'p5', amount: 350, payment_date: '2026-10-03' }], { day: '2026-09-29' }),
  ]
  const b = buildSubOwedBreakdown(inputs)
  const harlan = owedPersonById(b, 'harlan')!
  const open = owedView(harlan, 'open')

  it('adds up: agreed less paid less back-charged is the open figure', () => {
    expect(open).toMatchObject({ agreed: 7900, paid: 1500, backcharged: 100, open: 6300, sheetCount: 3, jobCount: 2 })
    const check = owedCheck(open, 6300)
    expect(check).toMatchObject({ stripAddsUp: true, jobsAddUp: true, matchesColumn: true, problem: '' })
    expect(check.sumWords).toBe('3 sheets · $3,800.00 + $2,500.00 = $6,300.00')
  })
  it('groups by job, most open first, sheets oldest first, with their lines and money', () => {
    expect(open.jobs.map((j) => [j.name, j.open])).toEqual([['Cedar Hollow Clinic', 3800], ['Ridgeway Builders, Lot 12', 2500]])
    const s1 = open.jobs[0]!.sheets[0]!
    expect(s1).toMatchObject({ title: 'Sheet of Oct 28', agreed: 4200, paid: 1500, backcharged: 100, open: 2600, withNames: ['Dana Whitlock'] })
    expect(s1.lines).toEqual([{ label: 'Rough-in', amount: 2400 }, { label: 'Top-out', amount: 1800 }])
    expect(s1.money.map((m) => m.kind)).toEqual(['payment', 'backcharge'])
    expect(s1.money[0]!.words).toContain('Paid Oct 31')
    expect(s1.money[1]!.words).toContain('cleanup after top-out')
  })
  it('counts what is ready by the Pay view own words', () => {
    expect(open).toMatchObject({ ready: 1200, readySheets: 1 })
  })
  it('keeps settled sheets as history, and an over-paid sheet is open by nothing', () => {
    const paid = owedView(harlan, 'paid')
    expect(paid.sheetCount).toBe(2)
    expect(paid.open).toBe(0)
    expect(paid.jobs[0]!.sheets.find((s) => s.id === 's5')).toMatchObject({ over: 50, settled: true, open: 0 })
  })
  it('does not draw the tick when the column says something else', () => {
    const check = owedCheck(open, 4150)
    expect(check.matchesColumn).toBe(false)
    expect(check.problem).toBe('These sheets sum to $6,300.00, and the column says $4,150.00.')
  })
  it('the search finds a sub by a job they have a sheet on', () => {
    expect(owedPersonMatches('Harlan Mechanical', harlan, 'ridgeway')).toBe(true)
    expect(owedPersonMatches('Harlan Mechanical', harlan, '2057')).toBe(true)
    expect(owedPersonMatches('Harlan Mechanical', harlan, 'pine')).toBe(false)
  })
  it('exports one row per open sheet, and the last column sums to the open figure', () => {
    const rows = owedCsv([harlan]).split('\n')
    expect(rows).toHaveLength(4)
    expect(rows.slice(1).reduce((n, r) => n + Number(r.split(',').pop()), 0)).toBe(6300)
  })
})

describe('every open dollar sits in exactly one place, under either rule', () => {
  const inputs = [
    sheet('s1', ['harlan', 'dana'], [['Rough-in', 2600]]),
    sheet('s2', ['harlan', 'marlow'], [['Curb', 800]], [], { jobId: 'job-pine', jobName: 'Pine Street Duplex', number: '2063' }),
    sheet('s3', ['dana'], [['Finished a week early', 500]], [], { day: '2026-11-13' }),
    sheet('s4', ['dana'], [['No call-backs in October', 200]], [], { day: '2026-11-13' }),
    sheet('s5', ['dana', 'owen'], [['Crew bonus', 400]]),
    sheet('s6', ['marlow'], [['Tile', 900]]),
  ]
  const total = 2600 + 800 + 500 + 200 + 400 + 900

  it('payroll (today): teammate sheets are in no figure, and say how much that is', () => {
    const t = owedTiles(buildSubOwedBreakdown(inputs, { rule: 'payroll' }))
    expect(t).toMatchObject({ rows: 3500, shared: 800, owed: 4300, payrollOpen: 1100, payrollSheets: 3, teamOpen: 0, addsUp: true })
    expect(t.owed + t.payrollOpen).toBe(total)
  })
  it('owed: a lone teammate sheet is theirs, a two-teammate sheet is shared, nothing is counted twice', () => {
    const b = buildSubOwedBreakdown(inputs, { rule: 'owed' })
    const t = owedTiles(b)
    expect(t).toMatchObject({ rows: 4200, shared: 1200, owed: total, payrollOpen: 0, teamOpen: 700, addsUp: true })
    const dana = owedPersonById(b, 'dana')!
    expect(dana.kind).toBe('team')
    expect(owedView(dana, 'open')).toMatchObject({ open: 700, sheetCount: 2, jobCount: 1 })
    // Dana rode along on Harlan's sheet: none of its money is hers.
    expect(owedView(owedPersonById(b, 'harlan'), 'open').open).toBe(2600)
  })
})

describe('buildJobOwedBlock — the same sheets from a job', () => {
  const onJob = [
    sheet('s1', ['harlan', 'dana'], [['Rough-in', 2400], ['Top-out', 1800]], [{ id: 'p1', amount: 1500, payment_date: '2026-10-31' }, { id: 'b1', amount: -100, memo: 'cleanup' }]),
    sheet('s2', ['harlan'], [['Trim', 1200]], [], { day: '2026-11-06' }),
    sheet('s3', ['marlow'], [['Top-out', 1800]], [{ id: 'p3', amount: 900, payment_date: '2026-10-25' }], { day: '2026-10-22' }),
    sheet('s4', ['owen'], [['Stayed late', 150]]),
  ]
  it('the old way (payroll): each sub, their sheets, a sum that adds up, and the teammate sheet set apart', () => {
    const j = buildJobOwedBlock(onJob, { rule: 'payroll' })
    expect(j.people.map((p) => [p.name, p.open])).toEqual([['Harlan Mechanical', 3800], ['Marlow Tile', 900]])
    expect(j).toMatchObject({ agreed: 7200, paid: 2400, backcharged: 100, open: 4700, addsUp: true })
    expect(j.sumWords).toBe('2 people · 3 sheets · $3,800.00 + $900.00 = $4,700.00')
    expect(j.payroll.map((p) => p.names)).toEqual(['Owen Farris'])
  })
  it('flags the same line and amount on two sheets of the job', () => {
    const j = buildJobOwedBlock(onJob)
    expect(j.sameLines).toHaveLength(1)
    expect(j.sameLines[0]).toMatchObject({ label: 'Top-out', amount: 1800, sheetIds: ['s1', 's3'] })
  })
  it("Taunya's rule, with nothing said: the teammate is a person on the job, owed like the others", () => {
    const j = buildJobOwedBlock(onJob)
    expect(j.people.map((p) => [p.name, p.kind, p.open])).toContainEqual(['Owen Farris', 'team', 150])
    expect(j.open).toBe(4850)
    expect(j.payroll).toEqual([])
    expect(j.addsUp).toBe(true)
  })
})
