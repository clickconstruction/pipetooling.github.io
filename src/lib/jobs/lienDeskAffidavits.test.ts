import { describe, expect, it } from 'vitest'
import type { LienDeskItemRow } from './lienDesk'
import { affidavitGateMissingWord, affidavitGates, buildLienAffidavitQueue, contractorAddressGate, homesteadGate, withContractorAddress, withHomesteadAnswer, type LienAffidavitRow } from './lienDeskAffidavits'

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

describe('the homestead question (punch list #305)', () => {
  const QUESTION = "Nobody has answered whether this home is the owner's homestead. Answer yes or no on the property record"

  it('one line, three answers: marked homestead, nobody answered, not a homestead', () => {
    expect(homesteadGate({ homestead: true, propertyKind: 'residential', answered: true })).toMatchObject({ key: 'homestead', ok: false })
    expect(homesteadGate({ homestead: false, propertyKind: 'residential', answered: false })).toEqual({ key: 'homestead_answer', ok: false, label: QUESTION })
    expect(homesteadGate({ homestead: false, propertyKind: 'residential', answered: true })).toEqual({ key: 'homestead', ok: true, label: 'Not a homestead' })
    // Marked homestead with no answer on record (the roll's suggestion): the attorney's hold, the stricter one.
    expect(homesteadGate({ homestead: true, propertyKind: 'residential', answered: false }).key).toBe('homestead')
  })

  it('only a residential property is asked, and a row nobody read the answer for is not judged', () => {
    expect(homesteadGate({ homestead: false, propertyKind: 'non_residential', answered: false }).ok).toBe(true)
    expect(homesteadGate({ homestead: false, propertyKind: '', answered: false }).ok).toBe(true)
    expect(homesteadGate({ homestead: false, propertyKind: 'residential', answered: undefined }).ok).toBe(true)
    expect(homesteadGate({ homestead: false, propertyKind: 'residential', answered: null }).ok).toBe(true)
    // The RPC's row as it comes, before the desk fills the answer: the four older gates and the contractor's, nothing held for the question.
    expect(affidavitGates(row({ job_id: 'a', property_kind: 'residential' })).every((g) => g.ok)).toBe(true)
  })

  it('the desk fills the answer from the job’s linked property record; rows without the column, and jobs with no record, are left alone', () => {
    const rows = [row({ job_id: 'unasked' }), row({ job_id: 'no' }), row({ job_id: 'old' }), row({ job_id: 'unlinked' }), row({ job_id: 'unread' })]
    const filled = withHomesteadAnswer(
      rows,
      { unasked: 'p1', no: 'p2', old: 'p3', unlinked: null, unread: 'p9' },
      { p1: { id: 'p1', homestead: false, homestead_answered_at: null }, p2: { id: 'p2', homestead: false, homestead_answered_at: '2026-11-17T15:00:00Z' }, p3: { id: 'p3', homestead: false } },
    )
    expect(filled.map((r) => [r.job_id, r.homestead_answered])).toEqual([['unasked', false], ['no', true], ['old', undefined], ['unlinked', undefined], ['unread', undefined]])
  })

  it('the hold changes the pile of a paper not yet sent, leaves an approved one where its item put it, and an answer clears it', () => {
    const rows = [
      row({ job_id: 'new', property_kind: 'residential', homestead_answered: false }),
      row({ job_id: 'approved', property_kind: 'residential', homestead_answered: false }),
      row({ job_id: 'answered', property_kind: 'residential', homestead_answered: true }),
      row({ job_id: 'shop', property_kind: 'non_residential', homestead_answered: false }),
    ]
    const q = buildLienAffidavitQueue(rows, [item({ job_id: 'approved', status: 'approved', approval_mode: 'rule' })], TODAY)
    const of = (id: string) => q.entries.find((e) => e.jobId === id)!
    expect([of('new').pile, of('new').ready]).toEqual(['needs_property', false])
    expect(of('new').gates.filter((g) => !g.ok).map((g) => g.key)).toEqual(['homestead_answer'])
    expect([of('approved').pile, of('approved').ready]).toEqual(['ready', false])
    expect([of('answered').pile, of('answered').ready]).toEqual(['to_draft', true])
    expect([of('shop').pile, of('shop').ready]).toEqual(['to_draft', true])
    expect(affidavitGateMissingWord('homestead_answer')).toBe('the homestead answer')
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
