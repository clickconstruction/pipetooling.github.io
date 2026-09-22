/**
 * The email's one-liner (a Deno-safe port over raw rows) must say what the Dashboard's
 * says (the client kernel's lines): one fixture through both, same sentence.
 */
import { describe, expect, it } from 'vitest'
import { buildDayBookView, type DayBookEventRow, type DayBookPayload } from './dayBook'
import { dayBookOneLiner } from './dayBookOneLiner'
import { dayBookOneLinersByUser } from '../../../supabase/functions/_shared/dayBookOneLiner'

const T = 'u-taunya'
const NOW = Date.parse('2026-09-16T21:00:00Z')
const ev = (kind: string, ref_id: string, detail: Record<string, unknown> | null = null, extra: Partial<DayBookEventRow> = {}): DayBookEventRow => ({
  actor_user_id: T,
  at: '2026-09-16T15:00:00Z',
  day: '2026-09-16',
  kind,
  ref_type: 'job',
  ref_id,
  amount_usd: null,
  detail,
  ...extra,
})

describe('the email one-liner matches the Dashboard one-liner', () => {
  it('office kinds, a status move, a schedule line, a muted deletion, and estimator lines', () => {
    const events = [
      ev('billed', 'job-1', { invoice_id: 'a' }),
      ev('billed', 'job-1', { invoice_id: 'a' }), // marked billed and sent: one
      ev('billed', 'job-2', { invoice_id: 'b' }),
      ev('deposit', 'job-1'),
      ev('deposit', 'job-3'),
      ev('status', 'job-4', { to: 'paid' }),
      ev('contract_sent', 'job-5'),
      ev('approval', 'p-1', { hours: 8 }, { ref_type: 'person' }),
      ev('schedule', 'job-6', { change: 'moved', block_id: 'b1', assignee_user_id: 'p-2', work_date: '2026-09-17' }),
      ev('deleted', 'clock_sessions', { n: 3 }, { ref_type: 'table' }),
      ev('bid_sent', 'bid-1', { gcs: 2 }, { ref_type: 'bid' }),
      ev('followed_up', 'bid-1', { gc_customer_id: 'g1', contact_method: 'Phone' }, { ref_type: 'bid' }),
    ]
    const payload: DayBookPayload = {
      from: '2026-09-16',
      to: '2026-09-16',
      viewer: { can_see_money: true, can_pick_person: true, user_id: T },
      users: [{ id: T, name: 'Taunya', role: 'controller' }],
      jobs: [],
      ref_people: [],
      sessions: [],
      events,
      system_counts: [],
    }
    const view = buildDayBookView(payload, { nowMs: NOW })
    const fromClient = dayBookOneLiner(view.days[0]!.people[0]!, 20)
    const fromShared = dayBookOneLinersByUser(events, '2026-09-16', 20)[T]
    expect(fromShared).toBe(fromClient)
    expect(fromShared).toBe('billed 2 · 2 deposits · moved 1 job to Paid · 1 contract sent · approved 1 session · updated the schedule · sent 1 bid · followed up 1 GC')
  })
  it('caps at five with +N, and a person with only muted lines gets no entry', () => {
    const many = ['billed', 'deposit', 'payment', 'contract_filed', 'hours_reviewed', 'dispatch_answered', 'approval'].map((k, i) => ev(k, `r${i}`, k === 'billed' ? { invoice_id: `i${i}` } : null))
    expect(dayBookOneLinersByUser(many, '2026-09-16')[T]).toBe('billed 1 · 1 deposit · 1 payment · 1 signed contract filed · approved 1 session · +2')
    expect(dayBookOneLinersByUser([ev('deleted', 't', { n: 2 }, { ref_type: 'table' })], '2026-09-16')).toEqual({})
    expect(dayBookOneLinersByUser(many, '2026-09-15')).toEqual({})
  })
})
