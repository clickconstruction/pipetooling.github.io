import { describe, expect, it } from 'vitest'
import { draftCarryFor, draftFromBid, draftProblem, draftSentLabel, jobDraftFromPayload, jobDraftWords, parseJobDraft, type JobDraft } from './jobDraft'
import type { BidImportGcOption } from './jobImportFromBid'
import type { GcPacket } from './gcPackets'

const bid = { project_name: ' Tune 5 Oil Change Seguin ', address: '410 TX-123, Seguin, TX 78155', service_type_id: 'st-plumb', agreed_value: null }
const opt = (key: string, name: string, value: number | null): BidImportGcOption => ({ key, customerId: key ? `c-${key}` : null, name, sentOn: '2026-04-20', value, outcome: null, sharedLetter: false })
const packet = (key: string, name: string, value: number | null, outcome: string | null = null) =>
  ({ key, gcId: key ? `c-${key}` : null, name, sentOn: '2026-04-20', sentValue: value, outcome, versions: [{ id: `v-${key}` }], sharedLetter: false }) as unknown as GcPacket

const draft = (over: Partial<JobDraft> = {}): JobDraft => ({ v: 1, jobName: 'Tune 5', address: '410 TX-123', gcKey: '', gcName: 'Southern Pine', carry: 38625, serviceTypeId: 'st-plumb', wantedBy: '2026-10-30', note: 'Slab pour is the 3rd', ...over })

describe('draftFromBid: what Send to Dispatch opens with', () => {
  it('one GC: that GC and what it was sent, the bid name and address trimmed', () => {
    const d = draftFromBid({ bid, packets: [packet('', 'Southern Pine', 38625)], options: [opt('', 'Southern Pine', 38625)] })
    expect(d).toMatchObject({ jobName: 'Tune 5 Oil Change Seguin', address: '410 TX-123, Seguin, TX 78155', gcKey: '', gcName: 'Southern Pine', carry: 38625, serviceTypeId: 'st-plumb', wantedBy: null, note: null })
  })
  it("the bid's agreed value wins over what was sent", () => {
    const d = draftFromBid({ bid: { ...bid, agreed_value: '40000' }, packets: [packet('', 'Southern Pine', 38625)], options: [opt('', 'Southern Pine', 38625)] })
    expect(d.carry).toBe(40000)
  })
  it('several GCs and no winner: none picked yet, no figure', () => {
    const d = draftFromBid({ bid, packets: [packet('', 'Southern Pine', 38625), packet('x', 'Achilles', 41000)], options: [opt('', 'Southern Pine', 38625), opt('x', 'Achilles', 41000)] })
    expect(d.gcKey).toBeNull()
    expect(d.carry).toBeNull()
  })
  it('several GCs and one recorded winner: the winner', () => {
    const d = draftFromBid({ bid, packets: [packet('', 'Southern Pine', 38625), packet('x', 'Achilles', 41000, 'won')], options: [opt('', 'Southern Pine', 38625), opt('x', 'Achilles', 41000)] })
    expect(d).toMatchObject({ gcKey: 'x', gcName: 'Achilles', carry: 41000 })
  })
})

describe('the draft sheet rules', () => {
  it('a GC choice brings its figure', () => {
    expect(draftCarryFor(bid, opt('x', 'Achilles', 41000))).toBe(41000)
    expect(draftCarryFor({ agreed_value: 5000 }, opt('x', 'Achilles', 41000))).toBe(5000)
    expect(draftCarryFor(bid, null)).toBeNull()
  })
  it('waits on a name, an address and, with several GCs, the GC', () => {
    const two = [opt('', 'Southern Pine', 1), opt('x', 'Achilles', 2)]
    expect(draftProblem(draft({ jobName: ' ' }), two)).toBe('Give the job a name.')
    expect(draftProblem(draft({ address: '' }), two)).toBe('Give the job an address.')
    expect(draftProblem(draft({ gcKey: null }), two)).toBe('Pick the GC that won it.')
    expect(draftProblem(draft({ gcKey: null }), [two[0]!])).toBeNull()
    expect(draftProblem(draft(), two)).toBeNull()
  })
})

describe('the draft on the request', () => {
  it('reads back what was written, and nothing that is not a version 1 draft', () => {
    expect(jobDraftFromPayload({ job_draft: draft() })).toEqual(draft())
    expect(jobDraftFromPayload({ supply_houses: [] })).toBeNull()
    expect(jobDraftFromPayload(null)).toBeNull()
    expect(parseJobDraft({ ...draft(), v: 2 })).toBeNull()
    expect(parseJobDraft({ ...draft(), carry: -5, wantedBy: 'Friday', note: '  ' })).toMatchObject({ carry: null, wantedBy: null, note: null })
  })
  it('the inbox and New Job say it in one line', () => {
    expect(jobDraftWords(draft(), 'Wendi')).toBe("Wendi's draft: GC Southern Pine · starts at $38,625.00 · wanted by Oct 30 · note: Slab pour is the 3rd")
    expect(jobDraftWords(draft({ gcName: null, carry: null, wantedBy: null, note: null }), null)).toBe('The draft: starts at $0')
  })
  it('carries the GC’s pay terms when the estimator added them, and no key when not (punch list #323)', () => {
    const payTerms = { scope: 'job' as const, calendar: { cutoffDay: 25, payDay: 10, monthsAfter: 1, payWhenPaid: false, clause: '§ 5.2', words: '' } }
    expect(jobDraftFromPayload({ job_draft: draft({ payTerms }) })?.payTerms).toEqual(payTerms)
    expect(parseJobDraft({ ...draft(), payTerms: { scope: 'job', calendar: { payDay: 99 } } })).not.toHaveProperty('payTerms')
    expect(parseJobDraft({ ...draft(), payTerms: null })).not.toHaveProperty('payTerms')
    expect(jobDraftWords(draft({ payTerms }), 'Wendi')).toBe("Wendi's draft: GC Southern Pine · starts at $38,625.00 · wanted by Oct 30 · note: Slab pour is the 3rd · pay terms: in by the 25th, paid the 10th, only this job")
  })
  it('the Job block while Dispatch has it', () => {
    expect(draftSentLabel('2026-10-20T15:30:00Z')).toBe('Sent to Dispatch Oct 20 · waiting')
    expect(draftSentLabel(null)).toBe('Sent to Dispatch · waiting')
  })
})
