import { describe, expect, it } from 'vitest'

import { submittalNudgeIsEmpty, summarizeSubmittalNudge, type SubmittalNudgeInput } from './submittalNeedsYou'

const now = new Date('2026-09-20T15:00:00Z')
const base = (): SubmittalNudgeInput => ({
  bids: [
    { bidId: 'b1', bidLabel: 'B398 ZZ Test', outcome: 'won', outcomeAt: '2026-09-10T00:00:00Z', jobId: 'j1' },
    { bidId: 'b2', bidLabel: 'B403 LIVSTE', outcome: 'won', outcomeAt: '2026-09-18T00:00:00Z', jobId: null },
    { bidId: 'b3', bidLabel: 'B375 SpaceX', outcome: 'won', outcomeAt: '2026-08-25T00:00:00Z', jobId: 'j3' },
    { bidId: 'b4', bidLabel: 'B410 Lost', outcome: 'lost', outcomeAt: '2026-09-01T00:00:00Z', jobId: null },
    { bidId: 'b5', bidLabel: 'B411 DRF', outcome: 'won', outcomeAt: '2026-09-13T00:00:00Z', jobId: 'j5' },
    { bidId: 'b6', bidLabel: 'B412 Started', outcome: 'started_or_complete', outcomeAt: '2026-09-14T00:00:00Z', jobId: 'j6' },
    { bidId: 'b7', bidLabel: 'B300 Old', outcome: 'won', outcomeAt: '2026-06-01T00:00:00Z', jobId: 'j7' },
  ],
  revisions: [
    { id: 'r3a', bidId: 'b3', revNumber: 1, sharedAt: '2026-09-10T00:00:00Z', status: 'superseded' },
    { id: 'r3b', bidId: 'b3', revNumber: 2, sharedAt: '2026-09-16T00:00:00Z', status: 'shared' },
    { id: 'r1', bidId: 'b1', revNumber: 1, sharedAt: '2026-09-12T00:00:00Z', status: 'shared' },
  ],
  rooms: [
    { bidId: 'b3', sharedAt: '2026-09-16T00:00:00Z', status: 'open' },
    { bidId: 'b1', sharedAt: '2026-09-12T00:00:00Z', status: 'open' },
  ],
  views: [{ bidId: 'b3', occurredAt: '2026-09-17T00:00:00Z' }, { bidId: 'b1', occurredAt: '2026-09-11T00:00:00Z' }],
  people: [
    { bidId: 'b1', name: 'Marco Ellis', openCount: 0, mayDecide: true, closed: false },
    { bidId: 'b1', name: 'Old Link', openCount: 0, mayDecide: true, closed: true },
  ],
  items: [
    { submittalId: 'r3b', tag: 'WC-1', reviewDecision: 'revise', leadTimeDays: 28 },
    { submittalId: 'r3b', tag: 'RD-2', reviewDecision: 'rejected', leadTimeDays: null },
    { submittalId: 'r3b', tag: 'DWH-1', reviewDecision: 'approved', leadTimeDays: 7 },
    { submittalId: 'r1', tag: 'KS-1', reviewDecision: null, leadTimeDays: 14 },
  ],
  windows: [
    { jobId: 'j3', windowEndYmd: '2026-10-02', label: 'Top-out' },
    { jobId: 'j3', windowEndYmd: '2026-11-15', label: 'Trim' },
    { jobId: 'j1', windowEndYmd: '2026-12-01', label: 'Rough-in' },
  ],
})

describe('summarizeSubmittalNudge', () => {
  it('won (or started) five days with no submittal counts; two days waits; 45+ days, a bid with a revision or a lost bid never counts', () => {
    const n = summarizeSubmittalNudge(base(), now)
    expect(n.notStarted).toEqual({ count: 2, first: { bidId: 'b5', bidLabel: 'B411 DRF', days: 7 } })
    expect(summarizeSubmittalNudge(base(), now, { wonDays: 1 }).notStarted.count).toBe(3)
  })

  it('a room shared three days with no open since the share counts, naming the people who never opened their link', () => {
    const n = summarizeSubmittalNudge(base(), now)
    expect(n.unopened).toEqual({ count: 1, first: { bidId: 'b1', bidLabel: 'B398 ZZ Test', days: 8, names: ['Marco Ellis'] } })
    const opened = base()
    opened.views.push({ bidId: 'b1', occurredAt: '2026-09-13T00:00:00Z' })
    expect(summarizeSubmittalNudge(opened, now).unopened.count).toBe(0)
  })

  it('rows sent back on the newest shared revision count until a newer revision exists', () => {
    const n = summarizeSubmittalNudge(base(), now)
    expect(n.sentBack).toEqual({ count: 1, first: { bidId: 'b3', bidLabel: 'B375 SpaceX', revNumber: 2, rows: 2 } })
    const answered = base()
    answered.revisions.push({ id: 'r3c', bidId: 'b3', revNumber: 3, sharedAt: null, status: 'draft' })
    expect(summarizeSubmittalNudge(answered, now).sentBack.count).toBe(0)
  })

  it('a lead time that lands after the job\'s earliest stage window end counts, worst overrun first', () => {
    const n = summarizeSubmittalNudge(base(), now, { todayYmd: '2026-09-20' })
    expect(n.leadTime).toEqual({ count: 1, first: { bidId: 'b3', bidLabel: 'B375 SpaceX', tag: 'WC-1', leadDays: 28, landsYmd: '2026-10-18', windowEndYmd: '2026-10-02', overrunDays: 16 } })
    expect(submittalNudgeIsEmpty(n)).toBe(false)
    expect(submittalNudgeIsEmpty(null)).toBe(true)
    expect(submittalNudgeIsEmpty(summarizeSubmittalNudge({ bids: [], revisions: [], rooms: [], views: [], people: [], items: [], windows: [] }, now))).toBe(true)
  })
})
