import { describe, expect, it, vi } from 'vitest'
import { lienSentPacketFacts, type LienSentPacketInput } from './lienSentPacket'

const item = (id: string, over: Record<string, unknown> = {}) => ({ id, job_id: 'job-1', fields: null, months: ['2026-09'], sent_at: '2026-10-05T15:00:00Z', sent_filing_id: null, ...over })
const row = (openAmount: number, payable = true) => ({ invoiceId: `inv-${openAmount}`, openAmount, payable })

const facts = (over: Partial<Record<keyof LienSentPacketInput, unknown>> = {}) =>
  lienSentPacketFacts({
    data: { letterTwoByJob: {}, items: [], ownerCallByJob: {}, filingsByJob: {} },
    jobId: 'job-1',
    sentItem: null,
    entrySentFilingId: null,
    courtesyByJob: {},
    payRows: [],
    job: undefined,
    address: null,
    gc: undefined,
    todayYmd: '2026-11-17',
    phone: () => '',
    openBalance: 0,
    ...over,
  } as unknown as LienSentPacketInput)

describe('lienSentPacketFacts (out of LienDesk.tsx, v2.7591)', () => {
  it('with no data reads nothing and owes nothing', () => {
    const f = facts({ data: null })
    expect(f).toMatchObject({ lt: undefined, first: null, call: null, courtesy: null, courtesyDraft: null, courtesyFacts: null, sentFiling: null, trackingOwed: [], stillOwed: 0, courtesyClaim: 0, jobBalance: 0 })
  })

  it('the first packet is letter two’s first item, else the entry’s sent notice', () => {
    const sent = item('sent-item')
    const firstOfTwo = item('first-of-two')
    expect(facts({ sentItem: sent }).first).toBe(sent)
    expect(facts({ sentItem: sent, data: { letterTwoByJob: { 'job-1': { firstItemId: 'first-of-two' } }, items: [firstOfTwo], ownerCallByJob: {}, filingsByJob: {} } }).first).toBe(firstOfTwo)
    // Letter two names an item the desk no longer holds: the entry's own sent notice stands in.
    expect(facts({ sentItem: sent, data: { letterTwoByJob: { 'job-1': { firstItemId: 'gone' } }, items: [], ownerCallByJob: {}, filingsByJob: {} } }).first).toBe(sent)
  })

  it('reads this job’s call and courtesy notice, not another job’s', () => {
    const call = { at: '2026-10-20' }
    const courtesy = { state: 'due', lienDay: null }
    const f = facts({ data: { letterTwoByJob: {}, items: [], ownerCallByJob: { 'job-1': call, 'job-2': { at: 'other' } }, filingsByJob: {} }, courtesyByJob: { 'job-1': courtesy, 'job-2': { state: 'sent' } } })
    expect(f.call).toBe(call)
    expect(f.courtesy).toBe(courtesy)
  })

  it('the balance is what the sent bills still owe, never below zero', () => {
    expect(facts({ openBalance: 1_250.5 }).jobBalance).toBe(1_250.5)
    expect(facts({ openBalance: -40 }).jobBalance).toBe(0)
  })

  it('the courtesy notice names what the enclosed bills still owe', () => {
    const f = facts({ sentItem: item('sent-item'), payRows: [row(300), row(200), row(0)] })
    expect(f.stillOwed).toBe(500)
    expect(f.courtesyClaim).toBe(500)
  })

  it('with no bill still owing, the courtesy claim falls back to the notice’s own, and to zero with none', () => {
    expect(facts({ sentItem: item('sent-item'), payRows: [row(0)] }).courtesyClaim).toBe(0)
    expect(facts({ payRows: [] }).courtesyClaim).toBe(0)
  })

  it('has no courtesy facts, and asks for no phone, until the courtesy notice has a lien day', () => {
    const phone = vi.fn(() => '555-0100')
    const f = facts({ sentItem: item('sent-item'), courtesyByJob: { 'job-1': { state: 'waiting', lienDay: null } }, phone })
    expect(f.courtesyFacts).toBeNull()
    expect(phone).not.toHaveBeenCalled()
  })

  it('finds the recorded packet by the first item’s filing, else the entry’s own', () => {
    const filings = [{ id: 'filing-a', sends: [] }, { id: 'filing-b', sends: [] }]
    const data = { letterTwoByJob: {}, items: [], ownerCallByJob: {}, filingsByJob: { 'job-1': filings } }
    expect(facts({ data, sentItem: item('sent-item', { sent_filing_id: 'filing-b' }), entrySentFilingId: 'filing-a' }).sentFiling).toBe(filings[1])
    expect(facts({ data, sentItem: item('sent-item'), entrySentFilingId: 'filing-a' }).sentFiling).toBe(filings[0])
    expect(facts({ data, sentItem: item('sent-item') }).sentFiling).toBeNull()
    expect(facts({ data, sentItem: item('sent-item'), entrySentFilingId: 'filing-a' }).trackingOwed).toEqual([])
  })
})
