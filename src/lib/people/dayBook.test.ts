import { describe, expect, it } from 'vitest'
import {
  buildDayBookView,
  dayBookDayLabel,
  dayBookLineSentence,
  dayBookRangeLabel,
  dayBookShiftYmd,
  dayBookWeekOf,
  type DayBookEventRow,
  type DayBookPayload,
  type DayBookSessionRow,
} from './dayBook'

const T = 'u-taunya'
const J = 'u-jordan'
const NOW = Date.parse('2026-09-16T21:00:00Z')

function session(user_id: string, work_date: string, inIso: string, outIso: string | null, note = ''): DayBookSessionRow {
  return { user_id, work_date, clocked_in_at: inIso, clocked_out_at: outIso, on_bid: false, note }
}
function ev(actor: string, day: string, kind: string, extra: Partial<DayBookEventRow> = {}): DayBookEventRow {
  return {
    actor_user_id: actor,
    at: `${day}T15:00:00Z`,
    day,
    kind,
    ref_type: 'job',
    ref_id: 'job-102',
    amount_usd: null,
    detail: null,
    ...extra,
  }
}

function payload(over: Partial<DayBookPayload> = {}): DayBookPayload {
  return {
    from: '2026-09-14',
    to: '2026-09-16',
    viewer: { can_see_money: true, can_pick_person: true, user_id: 'u-robert' },
    users: [
      { id: T, name: 'Taunya', role: 'assistant' },
      { id: J, name: 'Jordan', role: 'assistant' },
    ],
    jobs: [
      { id: 'job-102', hcp_number: '102', click_number: null, job_name: 'Halvorsen' },
      { id: 'job-258', hcp_number: '258', click_number: null, job_name: 'Dudley Mason' },
      { id: 'job-273', hcp_number: null, click_number: '273', job_name: 'Dudley Lennox' },
    ],
    ref_people: [],
    sessions: [],
    events: [],
    system_counts: [],
    ...over,
  }
}

describe('buildDayBookView — lines', () => {
  it('Billed counts an invoice once even when it was marked billed and sent, and sums the amount it has', () => {
    const view = buildDayBookView(
      payload({
        sessions: [session(T, '2026-09-16', '2026-09-16T12:52:00Z', '2026-09-16T21:31:00Z')],
        events: [
          ev(T, '2026-09-16', 'billed', { ref_id: 'job-102', amount_usd: 5355, detail: { invoice_id: 'inv-1', via: 'billed' } }),
          ev(T, '2026-09-16', 'billed', { ref_id: 'job-102', amount_usd: null, detail: { invoice_id: 'inv-1', via: 'sent' } }),
          ev(T, '2026-09-16', 'billed', { ref_id: 'job-258', amount_usd: '8000', detail: { invoice_id: 'inv-2', via: 'billed' } }),
          ev(T, '2026-09-16', 'billed', { ref_id: 'job-273', amount_usd: 845, detail: { invoice_id: 'inv-3', via: 'billed' } }),
        ],
      }),
      { nowMs: NOW },
    )
    const line = view.days[0]!.people[0]!.lines[0]!
    expect(dayBookLineSentence(line)).toBe('Billed 3 · J102 J258 J273 · $14,200')
    expect(line.refs[0]).toEqual({ label: 'J102', href: '/jobs?job=102' })
    expect(view.summary.billed).toEqual({ n: 3, usd: 14200 })
  })

  it('deposits and other payments are separate lines; deposits name the job count when more than one', () => {
    const view = buildDayBookView(
      payload({
        events: [
          ev(T, '2026-09-15', 'deposit', { ref_id: 'job-102', amount_usd: 1000 }),
          ev(T, '2026-09-15', 'deposit', { ref_id: 'job-258', amount_usd: 2000 }),
          ev(T, '2026-09-15', 'deposit', { ref_id: 'job-258', amount_usd: 500 }),
          ev(T, '2026-09-15', 'payment', { ref_id: 'job-273', amount_usd: 50 }),
        ],
      }),
      { nowMs: NOW },
    )
    const lines = view.days[0]!.people[0]!.lines.map(dayBookLineSentence)
    expect(lines).toEqual(['Applied 3 deposits · J102 J258 · 2 jobs · $3,500', 'Recorded 1 payment · J273 · $50'])
    expect(view.summary.deposits).toEqual({ n: 3, usd: 3500 })
    expect(view.summary.payments).toBe(1)
  })

  it('status moves group by destination, contracts split sent from filed, approvals count people and hours', () => {
    const view = buildDayBookView(
      payload({
        events: [
          ev(J, '2026-09-15', 'status', { ref_id: 'job-102', detail: { from: 'working', to: 'billed' } }),
          ev(J, '2026-09-15', 'status', { ref_id: 'job-258', detail: { from: 'working', to: 'billed' } }),
          ev(J, '2026-09-15', 'status', { ref_id: 'job-273', detail: { from: 'billed', to: 'paid' } }),
          ev(J, '2026-09-15', 'contract_sent', { ref_id: 'job-102' }),
          ev(J, '2026-09-15', 'contract_filed', { ref_id: 'job-258' }),
          ev(J, '2026-09-15', 'approval', { ref_type: 'person', ref_id: 'p-1', detail: { hours: 8 } }),
          ev(J, '2026-09-15', 'approval', { ref_type: 'person', ref_id: 'p-1', detail: { hours: 7.5 } }),
          ev(J, '2026-09-15', 'approval', { ref_type: 'person', ref_id: 'p-2', detail: { hours: 4 } }),
          ev(J, '2026-09-15', 'dispatch_answered', { ref_type: 'dispatch_request', ref_id: 'd-1' }),
          ev(J, '2026-09-15', 'deleted', { ref_type: 'table', ref_id: 'jobs_ledger_fixtures', detail: { n: 4, restored_n: 1 } }),
        ],
      }),
      { nowMs: NOW },
    )
    const lines = view.days[0]!.people[0]!.lines
    expect(lines.map(dayBookLineSentence)).toEqual([
      'Moved 2 jobs to Billed · J102 J258',
      'Moved 1 job to Paid · J273',
      'Sent 1 contract · J102',
      'Filed 1 signed contract · J258',
      'Approved 3 clock sessions · 2 people · 19.5h',
      'Answered 1 dispatch request',
      'Deleted 4 records · 1 restored · recoverable',
    ])
    expect(lines[lines.length - 1]!.quiet).toBe(true)
    expect(view.summary).toMatchObject({ statusMoves: 3, contracts: { sent: 1, filed: 1 }, approvals: 3 })
  })
})

describe('buildDayBookView — days, people, money', () => {
  it('a day with clock time and no lines is quiet, carries the note, and counts in no total', () => {
    const view = buildDayBookView(
      payload({
        sessions: [session(J, '2026-09-15', '2026-09-15T13:01:00Z', '2026-09-15T20:55:00Z', 'Called all 9 GCs on the statement round')],
      }),
      { nowMs: NOW },
    )
    const row = view.days[0]!.people[0]!
    expect(row.quiet).toBe(true)
    expect(row.lines).toEqual([])
    expect(row.notes).toEqual(['Called all 9 GCs on the statement round'])
    expect(row.hoursMs).toBe((7 * 60 + 54) * 60 * 1000)
    expect(view.summary.billed.n).toBe(0)
    expect(Object.keys(view.summary)).not.toContain('quietDays')
  })

  it('an open session runs to now and marks the row open', () => {
    const view = buildDayBookView(
      payload({ sessions: [session(T, '2026-09-16', '2026-09-16T20:00:00Z', null)] }),
      { nowMs: NOW },
    )
    const row = view.days[0]!.people[0]!
    expect(row.open).toBe(true)
    expect(row.hoursMs).toBe(60 * 60 * 1000)
  })

  it('money arrives stripped for a viewer without payroll access and is never invented', () => {
    const view = buildDayBookView(
      payload({
        viewer: { can_see_money: false, can_pick_person: false, user_id: T },
        events: [ev(T, '2026-09-16', 'billed', { amount_usd: null, detail: { invoice_id: 'inv-1' } })],
      }),
      { nowMs: NOW },
    )
    expect(view.canSeeMoney).toBe(false)
    expect(view.canPickPerson).toBe(false)
    expect(dayBookLineSentence(view.days[0]!.people[0]!.lines[0]!)).toBe('Billed 1 · J102')
    expect(view.summary.billed).toEqual({ n: 1, usd: null })
  })

  it('rows with an actor outside the population are dropped; system rows count on the day header', () => {
    const view = buildDayBookView(
      payload({
        events: [ev('u-field-tech', '2026-09-16', 'status'), ev(T, '2026-09-16', 'billed', { detail: { invoice_id: 'inv-1' } })],
        system_counts: [
          { day: '2026-09-16', kind: 'billed', n: 3 },
          { day: '2026-09-16', kind: 'payment', n: 1 },
        ],
      }),
      { nowMs: NOW },
    )
    expect(view.days).toHaveLength(1)
    expect(view.days[0]!.people.map((p) => p.userId)).toEqual([T])
    expect(view.days[0]!.systemCount).toBe(4)
  })

  it('the person filter keeps one person; a chip keeps matching lines and quiet rows, drops the rest', () => {
    const base = payload({
      sessions: [
        session(T, '2026-09-16', '2026-09-16T12:52:00Z', '2026-09-16T21:31:00Z'),
        session(J, '2026-09-16', '2026-09-16T13:04:00Z', '2026-09-16T21:00:00Z'),
      ],
      events: [
        ev(T, '2026-09-16', 'billed', { detail: { invoice_id: 'inv-1' } }),
        ev(T, '2026-09-16', 'contract_sent'),
        ev(J, '2026-09-16', 'contract_sent'),
      ],
    })
    const one = buildDayBookView(base, { nowMs: NOW, person: J })
    expect(one.days[0]!.people.map((p) => p.name)).toEqual(['Jordan'])
    expect(one.people.map((p) => p.name)).toEqual(['Jordan', 'Taunya'])

    const billing = buildDayBookView(base, { nowMs: NOW, chip: 'billing' })
    expect(billing.days[0]!.people.map((p) => p.name)).toEqual(['Taunya'])
    expect(billing.days[0]!.people[0]!.lines.map((l) => l.kind)).toEqual(['billed'])

    const quietUnderChip = buildDayBookView(
      payload({ sessions: [session(J, '2026-09-16', '2026-09-16T13:04:00Z', '2026-09-16T21:00:00Z')] }),
      { nowMs: NOW, chip: 'deposits' },
    )
    expect(quietUnderChip.days[0]!.people[0]!.quiet).toBe(true)
  })

  it('days come newest first, people with more lines first, and empty days are left out', () => {
    const view = buildDayBookView(
      payload({
        sessions: [session(T, '2026-09-14', '2026-09-14T13:00:00Z', '2026-09-14T21:00:00Z')],
        events: [
          ev(J, '2026-09-16', 'contract_sent'),
          ev(T, '2026-09-16', 'billed', { detail: { invoice_id: 'a' } }),
          ev(T, '2026-09-16', 'deposit'),
        ],
      }),
      { nowMs: NOW },
    )
    expect(view.days.map((d) => d.day)).toEqual(['2026-09-16', '2026-09-14'])
    expect(view.days[0]!.people.map((p) => p.name)).toEqual(['Taunya', 'Jordan'])
    expect(view.days[0]!.label).toBe('Wed, Sep 16')
    expect(view.summary.people).toBe(2)
  })
})

describe('date helpers', () => {
  it('labels, weeks and shifts are computed on the calendar, not the host clock', () => {
    expect(dayBookDayLabel('2026-09-16')).toBe('Wed, Sep 16')
    expect(dayBookWeekOf('2026-09-16')).toEqual({ from: '2026-09-14', to: '2026-09-20' })
    expect(dayBookWeekOf('2026-09-14')).toEqual({ from: '2026-09-14', to: '2026-09-20' })
    expect(dayBookWeekOf('2026-09-20')).toEqual({ from: '2026-09-14', to: '2026-09-20' })
    expect(dayBookShiftYmd('2026-09-14', -7)).toBe('2026-09-07')
    expect(dayBookShiftYmd('2026-08-31', 1)).toBe('2026-09-01')
    expect(dayBookRangeLabel('2026-09-14', '2026-09-20')).toBe('Week of Sep 14 – 20')
    expect(dayBookRangeLabel('2026-09-28', '2026-10-04')).toBe('Week of Sep 28 – Oct 4')
    expect(dayBookRangeLabel('2026-09-01', '2026-09-30')).toBe('Sep 1 – 30')
  })
})
