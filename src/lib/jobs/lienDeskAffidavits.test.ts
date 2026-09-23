import { describe, expect, it } from 'vitest'
import type { LienDeskItemRow } from './lienDesk'
import { affidavitGates, buildLienAffidavitQueue, type LienAffidavitRow } from './lienDeskAffidavits'

const TODAY = '2026-09-14'

function row(partial: Partial<LienAffidavitRow> & { job_id: string }): LienAffidavitRow {
  return {
    last_month: '2026-05',
    deadline: '2026-09-15',
    is_sub: true,
    noticed: true,
    filed: false,
    open_balance: 12_000,
    customer_id: 'c',
    gc_customer_id: 'gc',
    property_kind: '',
    has_owner: true,
    has_legal: true,
    homestead: false,
    desk_item_id: null,
    desk_status: null,
    ...partial,
  }
}

function item(partial: Partial<LienDeskItemRow> & { job_id: string; status: LienDeskItemRow['status'] }): LienDeskItemRow {
  return { id: 'a-' + partial.job_id, kind: 'affidavit', months: [], fields: {}, cover_note: false, drafted_by: null, drafted_at: '2026-09-14T10:00:00Z', submitted_at: null, approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-14T10:00:00Z', updated_at: '2026-09-14T10:00:00Z', voided_at: null, ...partial } as LienDeskItemRow
}

describe('affidavit gates and piles', () => {
  it('a sub job needs owner, legal description, a recorded notice, and no homestead; a direct job skips the notice', () => {
    const sub = affidavitGates(row({ job_id: 'a', noticed: false }))
    expect(sub.map((g) => [g.key, g.ok])).toEqual([['owner', true], ['legal', true], ['notice', false], ['homestead', true]])
    const direct = affidavitGates(row({ job_id: 'b', is_sub: false, noticed: false, gc_customer_id: null }))
    expect(direct.find((g) => g.key === 'notice')?.ok).toBe(true)
    expect(affidavitGates(row({ job_id: 'c', homestead: true })).find((g) => g.key === 'homestead')?.ok).toBe(false)
  })

  it('piles: property facts first, then to draft; items decide the rest; filed and missed are the record', () => {
    const rows = [
      row({ job_id: 'ok' }),
      row({ job_id: 'noOwner', has_owner: false }),
      row({ job_id: 'filed', filed: true }),
      row({ job_id: 'late', deadline: '2026-09-01' }),
      row({ job_id: 'approved' }),
      row({ job_id: 'held' }),
    ]
    const items = [item({ job_id: 'approved', status: 'approved', approval_mode: 'leader' }), item({ job_id: 'held', status: 'held', hold_reason: 'call_first', hold_until: '2026-09-12' })]
    const q = buildLienAffidavitQueue(rows, items, TODAY)
    const pileOf = (id: string) => q.entries.find((e) => e.jobId === id)?.pile
    expect(pileOf('ok')).toBe('to_draft')
    expect(pileOf('noOwner')).toBe('needs_property')
    expect(pileOf('filed')).toBeUndefined() // filed with no desk record — nothing to show
    expect(pileOf('late')).toBe('missed')
    expect(pileOf('approved')).toBe('ready')
    expect(pileOf('held')).toBe('held')
    expect(q.entries[0]!.jobId).toBe('late')
    expect(q.entries.find((e) => e.jobId === 'ok')).toMatchObject({ daysLeft: 1, severity: 'red', ready: true })
  })

  it('a filed item stays listed for 30 days, then drops', () => {
    const fresh = item({ job_id: 'f1', status: 'sent', sent_at: '2026-09-01T10:00:00Z' })
    const old = item({ job_id: 'f2', status: 'sent', sent_at: '2026-07-01T10:00:00Z' })
    const q = buildLienAffidavitQueue([row({ job_id: 'f1', filed: true }), row({ job_id: 'f2', filed: true })], [fresh, old], TODAY)
    expect(q.entries.map((e) => [e.jobId, e.pile])).toEqual([['f1', 'filed']])
  })
})

describe('buildLienAffidavitQueue · a job with no clock hours is dated from its creation month (v2.3747)', () => {
  it('carries the flag on the entry; an ordinary row reads as the last month worked', () => {
    const q = buildLienAffidavitQueue([row({ job_id: 'j858', last_month: '2026-08', deadline: '2026-10-15', month_source: 'job_created' }), row({ job_id: 'j273', last_month: '2026-08', deadline: '2026-10-15' })], [], TODAY)
    expect(q.entries.map((e) => [e.jobId, e.lastMonthFromCreation])).toEqual([['j858', true], ['j273', false]])
  })
})
