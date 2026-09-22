import { describe, expect, it } from 'vitest'
import { buildDayBookView, type DayBookEventRow, type DayBookPayload, type DayBookSessionRow } from './dayBook'
import { buildRhythm, dayBookDaysBetween, dayBookInitials, dayBookMonthOf, dayBookShiftMonth, rhythmRowSentence } from './dayBookRhythm'

const T = 'u-taunya'
const R = 'u-robert'
const NOW = Date.parse('2026-09-16T21:00:00Z')

function session(user_id: string, work_date: string): DayBookSessionRow {
  return { user_id, work_date, clocked_in_at: `${work_date}T13:00:00Z`, clocked_out_at: `${work_date}T21:00:00Z`, on_bid: false, note: '' }
}
function ev(actor: string, day: string, kind: string, extra: Partial<DayBookEventRow> = {}): DayBookEventRow {
  return { actor_user_id: actor, at: `${day}T15:00:00Z`, day, kind, ref_type: 'job', ref_id: 'job-102', amount_usd: null, detail: { invoice_id: `${day}-${kind}` }, ...extra }
}
function payload(over: Partial<DayBookPayload> = {}): DayBookPayload {
  return {
    from: '2026-09-07',
    to: '2026-09-18',
    viewer: { can_see_money: true, can_pick_person: true, user_id: R },
    users: [
      { id: T, name: 'Taunya', role: 'assistant' },
      { id: R, name: 'Robert Douglas', role: 'dev' },
    ],
    jobs: [{ id: 'job-102', hcp_number: '102', click_number: null, job_name: 'Halvorsen' }],
    ref_people: [],
    sessions: [],
    events: [],
    system_counts: [],
    ...over,
  }
}
// Mon Sep 7 … Fri Sep 11, Mon Sep 14 … Wed Sep 16 (today); the 12th/13th are a weekend.
const workdays = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16']
const sessions = workdays.flatMap((d) => [session(T, d), session(R, d)])
const TODAY = '2026-09-16'

describe('buildRhythm', () => {
  it('a cell carries the initials of who did that kind of work; closed days are the days nobody clocked in', () => {
    const view = buildDayBookView(payload({ sessions, events: [ev(T, '2026-09-08', 'billed'), ev(R, '2026-09-08', 'billed'), ev(T, '2026-09-09', 'deposit')] }), { nowMs: NOW })
    const grid = buildRhythm(view, { today: TODAY, queueHeldWork: () => null })
    const billing = grid.rows.find((r) => r.chip === 'billing')!
    const sep8 = billing.cells.find((c) => c.day === '2026-09-08')!
    expect(sep8.state).toBe('done')
    expect(sep8.who.map((w) => w.initials)).toEqual(['RD', 'T']) // the day's people order: lines, hours, then name
    expect(billing.cells.find((c) => c.day === '2026-09-12')!.state).toBe('closed')
    expect(billing.cells.find((c) => c.day === '2026-09-16')!.state).toBe('today')
    expect(billing.cells.find((c) => c.day === '2026-09-18')!.state).toBe('future')
    expect(grid.workingDays).toBe(8)
    expect(grid.legend).toEqual([{ initials: 'RD', name: 'Robert Douglas' }, { initials: 'T', name: 'Taunya' }])
  })

  it('never turns amber while the queue is unknown', () => {
    const view = buildDayBookView(payload({ sessions, events: [ev(T, '2026-09-07', 'deposit')] }), { nowMs: NOW })
    const grid = buildRhythm(view, { today: TODAY, queueHeldWork: () => null })
    const deposits = grid.rows.find((r) => r.chip === 'deposits')!
    expect(deposits.cells.filter((c) => c.state === 'gap')).toHaveLength(0)
    expect(deposits.cells.filter((c) => c.state === 'none')).toHaveLength(6) // Sep 8–11, 14, 15
    expect(deposits.longestGap).toBe(0)
  })

  it('three working days of nothing while the queue held work turn amber, and a weekend neither breaks nor extends the run', () => {
    const view = buildDayBookView(payload({ sessions, events: [ev(T, '2026-09-08', 'deposit')] }), { nowMs: NOW })
    const grid = buildRhythm(view, { today: TODAY, queueHeldWork: (chip) => (chip === 'deposits' ? true : null) })
    const deposits = grid.rows.find((r) => r.chip === 'deposits')!
    const gapDays = deposits.cells.filter((c) => c.state === 'gap').map((c) => c.day)
    // Sep 9, 10, 11, then over the weekend to 14 and 15 — one run of five working days.
    expect(gapDays).toEqual(['2026-09-09', '2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15'])
    expect(deposits.cells.find((c) => c.day === '2026-09-12')!.state).toBe('closed')
    expect(deposits.longestGap).toBe(5)
    // Today does not count toward a run.
    expect(deposits.cells.find((c) => c.day === TODAY)!.state).toBe('today')
    // A row whose queue is unknown stays plain.
    expect(grid.rows.find((r) => r.chip === 'billing')!.cells.filter((c) => c.state === 'gap')).toHaveLength(0)
  })

  it('a run shorter than the threshold stays plain, and "no work waiting" breaks a run', () => {
    const view = buildDayBookView(payload({ sessions, events: [] }), { nowMs: NOW })
    const grid = buildRhythm(view, {
      today: TODAY,
      queueHeldWork: (chip, day) => (chip === 'approvals' ? day !== '2026-09-09' : null),
    })
    const approvals = grid.rows.find((r) => r.chip === 'approvals')!
    // Sep 7–8 (two days, then the queue was empty on the 9th), then Sep 10, 11, 14, 15 (four).
    expect(approvals.cells.filter((c) => c.state === 'gap').map((c) => c.day)).toEqual(['2026-09-10', '2026-09-11', '2026-09-14', '2026-09-15'])
    expect(approvals.cells.find((c) => c.day === '2026-09-07')!.state).toBe('none')
    expect(approvals.longestGap).toBe(4)
  })

  it('a person filter leaves other initials out', () => {
    const view = buildDayBookView(payload({ sessions, events: [ev(T, '2026-09-08', 'billed'), ev(R, '2026-09-08', 'billed')] }), { nowMs: NOW, person: T })
    const grid = buildRhythm(view, { today: TODAY, queueHeldWork: () => null })
    expect(grid.rows.find((r) => r.chip === 'billing')!.cells.find((c) => c.day === '2026-09-08')!.who.map((w) => w.initials)).toEqual(['T'])
    expect(grid.legend.map((l) => l.name)).toEqual(['Taunya'])
  })

  it('two people with the same initials get told apart', () => {
    const view = buildDayBookView(
      payload({
        users: [
          { id: T, name: 'Tom Adams', role: 'assistant' },
          { id: R, name: 'Tim Alder', role: 'dev' },
        ],
        sessions,
        events: [ev(T, '2026-09-08', 'billed'), ev(R, '2026-09-08', 'billed', { detail: { invoice_id: 'other' } })],
      }),
      { nowMs: NOW },
    )
    const grid = buildRhythm(view, { today: TODAY, queueHeldWork: () => null })
    expect(grid.legend.map((l) => l.initials).sort()).toEqual(['TA', 'ToA'])
  })

  it('reads a row as coverage, not volume; work on a closed day shows in its cell but is not coverage', () => {
    const view = buildDayBookView(
      payload({ sessions, events: [ev(T, '2026-09-08', 'deposit'), ev(T, '2026-09-08', 'deposit', { detail: { invoice_id: 'x' } }), ev(T, '2026-09-10', 'deposit'), ev(R, '2026-09-12', 'deposit')] }),
      { nowMs: NOW },
    )
    const grid = buildRhythm(view, { today: TODAY, queueHeldWork: () => null })
    const deposits = grid.rows.find((r) => r.chip === 'deposits')!
    expect(rhythmRowSentence(deposits, grid.workingDays)).toBe('applied on 2 of 8 working days')
    expect(deposits.cells.find((c) => c.day === '2026-09-08')!.who[0]!.count).toBe(2)
    const saturday = deposits.cells.find((c) => c.day === '2026-09-12')!
    expect(saturday.state).toBe('done')
    expect(saturday.who.map((w) => w.initials)).toEqual(['RD'])
  })
})

describe('the month helpers', () => {
  it('initials', () => {
    expect(dayBookInitials('Taunya')).toBe('T')
    expect(dayBookInitials('Robert Douglas')).toBe('RD')
    expect(dayBookInitials('  mary ann lee ')).toBe('ML')
    expect(dayBookInitials('')).toBe('?')
  })
  it('days between, month of, shift month', () => {
    expect(dayBookDaysBetween('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'])
    expect(dayBookMonthOf('2026-09-16')).toEqual({ from: '2026-09-01', to: '2026-09-30' })
    expect(dayBookMonthOf('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(dayBookShiftMonth('2026-01-31', 1)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(dayBookShiftMonth('2026-01-15', -1)).toEqual({ from: '2025-12-01', to: '2025-12-31' })
  })
})
