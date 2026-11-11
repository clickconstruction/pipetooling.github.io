import { describe, expect, it } from 'vitest'
import type { LienDeskItemRow } from './lienDesk'
import { affidavitGateMissingWord, affidavitGates, buildLienAffidavitQueue, contractorAddressGate, withContractorAddress, type LienAffidavitRow } from './lienDeskAffidavits'

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
    expect(sub.map((g) => [g.key, g.ok])).toEqual([['owner', true], ['legal', true], ['contractor', true], ['notice', false], ['homestead', true]])
    expect(sub.find((g) => g.key === 'notice')?.label).toContain('a late one counts while this window is open')
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

describe("the general contractor's address (punch list #305)", () => {
  it('a job under a GC holds while the GC has no address on file; a job contracted with the owner names no GC', () => {
    expect(contractorAddressGate({ isSub: true, hasAddress: false })).toEqual({ key: 'contractor', ok: false, label: 'The general contractor has no address on its customer record. The affidavit gives its last known address (§ 53.054)' })
    expect(contractorAddressGate({ isSub: true, hasAddress: true })).toEqual({ key: 'contractor', ok: true, label: "The general contractor's last known address" })
    expect(contractorAddressGate({ isSub: false, hasAddress: false })).toEqual({ key: 'contractor', ok: true, label: 'No general contractor to name (contracted with the owner)' })
  })

  it('a row nobody read the GC for is not judged: the firm’s portal and an older caller hold nothing', () => {
    expect(contractorAddressGate({ isSub: true, hasAddress: undefined }).ok).toBe(true)
    expect(contractorAddressGate({ isSub: true, hasAddress: null }).ok).toBe(true)
    expect(affidavitGates(row({ job_id: 'a' })).find((g) => g.key === 'contractor')?.ok).toBe(true)
  })

  it('the desk fills the fact from the GC rows it read: a blank or a missing row is no address, a job with no GC is left alone', () => {
    const rows = withContractorAddress(
      [row({ job_id: 'has', gc_customer_id: 'g1' }), row({ job_id: 'blank', gc_customer_id: 'g2' }), row({ job_id: 'gone', gc_customer_id: 'g3' }), row({ job_id: 'direct', is_sub: false, gc_customer_id: null })],
      { g1: { address: ' 9 Yard St, Devine TX ' }, g2: { address: '   ' } },
    )
    expect(rows.map((r) => [r.job_id, r.has_contractor_address])).toEqual([['has', true], ['blank', false], ['gone', false], ['direct', undefined]])
  })

  it('the hold changes the pile of a paper not yet sent for approval, and leaves an approved one where its item put it', () => {
    const rows = withContractorAddress([row({ job_id: 'new', gc_customer_id: 'g2' }), row({ job_id: 'drafted', gc_customer_id: 'g2' }), row({ job_id: 'approved', gc_customer_id: 'g2' }), row({ job_id: 'fine', gc_customer_id: 'g1' })], { g1: { address: '9 Yard St' }, g2: { address: '' } })
    const q = buildLienAffidavitQueue(rows, [item({ job_id: 'drafted', status: 'drafted' }), item({ job_id: 'approved', status: 'approved', approval_mode: 'leader' })], TODAY)
    const of = (id: string) => q.entries.find((e) => e.jobId === id)!
    expect([of('new').pile, of('new').ready]).toEqual(['needs_property', false])
    expect(of('drafted').pile).toBe('needs_property')
    expect([of('approved').pile, of('approved').ready]).toEqual(['ready', false])
    expect([of('fine').pile, of('fine').ready]).toEqual(['to_draft', true])
    expect(of('new').gates.filter((g) => !g.ok).map((g) => g.key)).toEqual(['contractor'])
  })

  it('the list row’s missing words name the address, and keep the other gates’ keys', () => {
    expect(affidavitGateMissingWord('contractor')).toBe("the GC's address")
    expect(affidavitGateMissingWord('owner')).toBe('owner')
  })
})

describe('buildLienAffidavitQueue · a job with no clock hours is dated from its creation month (v2.3747)', () => {
  it('carries the flag on the entry; an ordinary row reads as the last month worked', () => {
    const q = buildLienAffidavitQueue([row({ job_id: 'j858', last_month: '2026-08', deadline: '2026-10-15', month_source: 'job_created' }), row({ job_id: 'j273', last_month: '2026-08', deadline: '2026-10-15' })], [], TODAY)
    expect(q.entries.map((e) => [e.jobId, e.lastMonthFromCreation])).toEqual([['j858', true], ['j273', false]])
  })
})

describe('an affidavit filed in the evening keeps its day (v2.4468)', () => {
  it('stays listed for 30 days from the Central day', () => {
    // 00:30 UTC on Dec 2 is 6:30 pm CST on Dec 1.
    const rows = [row({ job_id: 'f1', filed: true })]
    const evening = [item({ job_id: 'f1', status: 'sent', sent_at: '2026-12-02T00:30:00Z' })]
    expect(buildLienAffidavitQueue(rows, evening, '2026-12-31').entries.map((e) => [e.jobId, e.pile])).toEqual([['f1', 'filed']])
    expect(buildLienAffidavitQueue(rows, evening, '2027-01-01').entries).toEqual([])
    const noon = [item({ job_id: 'f1', status: 'sent', sent_at: '2026-12-02T12:00:00Z' })]
    expect(buildLienAffidavitQueue(rows, noon, '2027-01-01').entries.map((e) => e.jobId)).toEqual(['f1'])
  })
})
