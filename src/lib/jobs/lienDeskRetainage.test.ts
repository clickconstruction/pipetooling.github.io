import { describe, expect, it } from 'vitest'
import type { LienDeskItemRow } from './lienDesk'
import { buildLienRetainageQueue, contractEndedWords, lienRetainageListView, paymentBondWords, retainageDeadlineWords, retainageGates, type LienRetainageEntry, type LienRetainagePile, type LienRetainageRow } from './lienDeskRetainage'
import { retainageDeadlineFor } from './lienDeadlines'
import { formatYmdMonthDay } from './billedExpectedPay'

const TODAY = '2026-09-24'

function row(partial: Partial<LienRetainageRow> & { job_id: string }): LienRetainageRow {
  return {
    retainage_held: 1_760,
    contract_ended_on: '2026-09-03',
    contract_ended_how: 'complete',
    deadline: '2026-10-05',
    noticed: false,
    in_claim: false,
    open_balance: 9_800,
    customer_id: 'c',
    gc_customer_id: 'gc',
    property_kind: 'residential',
    has_owner: true,
    payment_bond: 'unknown',
    desk_item_id: null,
    desk_status: null,
    ...partial,
  }
}

function item(partial: Partial<LienDeskItemRow> & { job_id: string; status: LienDeskItemRow['status'] }): LienDeskItemRow {
  return { id: 'r-' + partial.job_id, kind: 'retainage_53_057', months: [], fields: {}, cover_note: true, drafted_by: null, drafted_at: '2026-09-24T10:00:00Z', submitted_at: null, approved_by: null, approved_at: null, approval_mode: null, word_note: '', word_channel: '', held_by: null, held_at: null, hold_reason: '', hold_until: null, sent_filing_id: null, sent_at: null, pulled_back_by: null, pulled_back_at: null, created_at: '2026-09-24T10:00:00Z', updated_at: '2026-09-24T10:00:00Z', voided_at: null, ...partial } as LienDeskItemRow
}

describe('the § 53.057 clock', () => {
  it('is 30 days after the day our contract ended, rolled off a weekend (§ 53.003)', () => {
    expect(retainageDeadlineFor('2026-09-03')).toBe('2026-10-05') // Oct 3 is a Saturday → Monday
    expect(retainageDeadlineFor('2026-09-01')).toBe('2026-10-01')
    expect(retainageDeadlineFor(null)).toBe('')
    expect(retainageDeadlineFor('not a day')).toBe('')
  })
})

describe('retainage gates and piles', () => {
  it('needs the owner, the GC, an ended contract and a recorded figure', () => {
    expect(retainageGates(row({ job_id: 'a' })).map((g) => [g.key, g.ok])).toEqual([['owner', true], ['gc', true], ['contract_ended', true], ['retainage', true]])
    expect(retainageGates(row({ job_id: 'b', contract_ended_on: null, has_owner: false })).filter((g) => !g.ok).map((g) => g.key)).toEqual(['owner', 'contract_ended'])
  })

  it('a job with retainage and no end date sits in Clock not started; the rest follow the deadline and the item', () => {
    const rows = [
      row({ job_id: 'open', contract_ended_on: null, contract_ended_how: null, deadline: null }),
      row({ job_id: 'draft' }),
      row({ job_id: 'noOwner', has_owner: false }),
      row({ job_id: 'late', contract_ended_on: '2026-08-01', deadline: '2026-08-31' }),
      row({ job_id: 'awaiting' }),
      row({ job_id: 'ready' }),
      row({ job_id: 'sentNow', noticed: true }),
      row({ job_id: 'sentLongAgo', noticed: true }),
    ]
    const items = [
      item({ job_id: 'awaiting', status: 'awaiting_approval' }),
      item({ job_id: 'ready', status: 'approved', approval_mode: 'leader' }),
      item({ job_id: 'sentNow', status: 'sent', sent_at: '2026-09-20T10:00:00Z' }),
      item({ job_id: 'gone', status: 'sent', sent_at: '2026-09-10T10:00:00Z' }),
    ]
    const q = buildLienRetainageQueue(rows, items, TODAY)
    const pileOf = (id: string) => q.entries.find((e) => e.jobId === id)?.pile
    expect(pileOf('open')).toBe('clock_not_started')
    expect(pileOf('draft')).toBe('to_draft')
    expect(pileOf('noOwner')).toBe('needs_owner')
    expect(pileOf('late')).toBe('missed')
    expect(pileOf('awaiting')).toBe('awaiting')
    expect(pileOf('ready')).toBe('ready')
    expect(pileOf('sentNow')).toBe('sent')
    expect(pileOf('sentLongAgo')).toBeUndefined() // recorded long ago, nothing to show
    // A sent item whose row is gone (retainage cleared since) stays for the record.
    expect(pileOf('gone')).toBe('sent')
    expect(q.counts.ready).toBe(1)
    expect(q.counts.clock_not_started).toBe(1)
    // Deadline order, clock-not-started last.
    expect(q.entries.map((e) => e.jobId).indexOf('late')).toBe(0)
    expect(q.entries.filter((e) => e.deadline).every((e, i, arr) => i === 0 || (arr[i - 1]!.deadline ?? '') <= (e.deadline ?? ''))).toBe(true)
  })

  it('reads the deadline, the contract end and the bond in one wording', () => {
    expect(retainageDeadlineWords({ deadline: null, daysLeft: null }, formatYmdMonthDay)).toBe('clock not started')
    expect(retainageDeadlineWords({ deadline: '2026-10-05', daysLeft: 11 }, formatYmdMonthDay)).toBe('mail in 11d')
    expect(retainageDeadlineWords({ deadline: '2026-11-05', daysLeft: 42 }, formatYmdMonthDay)).toMatch(/^mail by Nov 5/)
    expect(retainageDeadlineWords({ deadline: '2026-09-01', daysLeft: -3 }, formatYmdMonthDay)).toBe('window closed')
    expect(contractEndedWords('terminated', '2026-09-03', formatYmdMonthDay)).toMatch(/^terminated Sep 3/)
    expect(contractEndedWords(null, null, formatYmdMonthDay)).toBe('our contract still open')
    expect(paymentBondWords('yes')).toBe('payment bond on the project')
  })
})

describe('a retainage notice sent in the evening keeps its day (v2.4468)', () => {
  it('stays in Sent for 30 days from the Central day', () => {
    // 00:30 UTC on Oct 3 is 7:30 pm CDT on Oct 2.
    const evening = [item({ job_id: 'gone', status: 'sent', sent_at: '2026-10-03T00:30:00+00:00' })]
    expect(buildLienRetainageQueue([], evening, '2026-11-01').entries.map((e) => e.jobId)).toEqual(['gone'])
    expect(buildLienRetainageQueue([], evening, '2026-11-02').entries).toEqual([])
    const noon = [item({ job_id: 'gone', status: 'sent', sent_at: '2026-10-03T12:00:00Z' })]
    expect(buildLienRetainageQueue([], noon, '2026-11-02').entries.map((e) => e.jobId)).toEqual(['gone'])
  })
})

describe('lienRetainageListView (out of LienDesk.tsx, v2.7583)', () => {
  const entry = (jobId: string, pile: LienRetainagePile): LienRetainageEntry => ({ jobId, pile }) as LienRetainageEntry
  const entries = [entry('held-1', 'held'), entry('draft-1', 'to_draft'), entry('ready-1', 'ready'), entry('draft-2', 'to_draft')]
  const view = (over: Partial<Parameters<typeof lienRetainageListView>[0]> = {}) => lienRetainageListView({ entries, pile: null, finding: false, matches: () => true, selectedJobId: null, oneColumn: false, ...over })

  it('lists the entries in the piles’ order, each pile keeping its own order', () => {
    expect(view().visible.map((e) => e.jobId)).toEqual(['draft-1', 'draft-2', 'ready-1', 'held-1'])
    expect(view().pilesShown.map((x) => [x.p, x.rows.length, x.total])).toEqual([['to_draft', 2, 2], ['ready', 1, 1], ['held', 1, 1]])
  })
  it('a pressed pile narrows the list to that pile', () => {
    const v = view({ pile: 'to_draft' })
    expect(v.visibleAll.map((e) => e.jobId)).toEqual(['draft-1', 'draft-2'])
    expect(v.pilesShown.map((x) => x.p)).toEqual(['to_draft'])
  })
  it('the find box narrows the rows, and is asked with the pile’s label', () => {
    const asked: string[] = []
    const v = view({ finding: true, matches: (e, label) => (asked.push(label), e.jobId === 'draft-2') })
    expect(v.visible.map((e) => e.jobId)).toEqual(['draft-2'])
    expect(v.visibleAll).toHaveLength(4)
    expect(asked).toContain('To send for Master approval')
  })
  it('while finding, a pile that had rows stays drawn with none; otherwise an empty pile is not drawn', () => {
    const v = view({ finding: true, matches: (e) => e.jobId === 'draft-2' })
    expect(v.pilesShown.map((x) => [x.p, x.rows.length, x.total])).toEqual([['to_draft', 1, 2], ['ready', 0, 1], ['held', 0, 1]])
    expect(view().pilesShown.some((x) => x.p === 'sent')).toBe(false)
  })
  it('never asks the find box when nothing is typed', () => {
    let asks = 0
    view({ matches: () => (asks++, false) })
    expect(asks).toBe(0)
  })
  it('opens the picked job while the list shows it', () => {
    expect(view({ selectedJobId: 'held-1' }).selected?.jobId).toBe('held-1')
  })
  it('side by side, the first row opens when nothing is picked or the pick is not shown', () => {
    expect(view().selected?.jobId).toBe('draft-1')
    expect(view({ selectedJobId: 'held-1', pile: 'ready' }).selected?.jobId).toBe('ready-1')
  })
  it('in one column nothing opens by itself', () => {
    expect(view({ oneColumn: true }).selected).toBeNull()
    expect(view({ oneColumn: true, selectedJobId: 'ready-1' }).selected?.jobId).toBe('ready-1')
  })
  it('opens no row while the address names a job the list does not hold, and still lists every row (v2.7744)', () => {
    const v = view({ openNone: true, selectedJobId: 'gone' })
    expect(v.selected).toBeNull()
    expect(v.visible).toHaveLength(4)
    // Not even a row the list does hold: the note stands until the reader picks one.
    expect(view({ openNone: true, selectedJobId: 'held-1' }).selected).toBeNull()
  })
  it('an empty list opens nothing and draws no pile', () => {
    const v = view({ entries: [] })
    expect(v.selected).toBeNull()
    expect(v.pilesShown).toEqual([])
  })
})
