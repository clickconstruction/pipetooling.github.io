import { describe, expect, it } from 'vitest'

import { auditKind, buildAuditQueue, deltaWord, finishLabel, jobNameFromShell, jobTypeWords, sealedLine, slateLabel, whyLine, type AuditQueueItem } from './auditQueue'

const item = (over: Partial<AuditQueueItem> & { id: string }): AuditQueueItem => ({
  status: 'pending',
  requestedAt: '2026-09-05T13:00:00Z',
  shellName: `ZZ Twin ${over.id.toUpperCase()} (backtest R2)`,
  shellNumber: '476',
  refNumber: '376',
  refDueDate: null,
  refSentDate: '2026-05-01',
  sealed: false,
  unpriced: false,
  openQuestions: 0,
  notes: 0,
  deltaPct: null,
  axis: null,
  gate: null,
  needsFix: false,
  ...over,
})

describe('jobNameFromShell — the row is named for the job, not the robot’s copy', () => {
  it('drops the ZZ prefix and the backtest / shadow suffix', () => {
    expect(jobNameFromShell('ZZ Twin MPH CASA LINDA (backtest R2)')).toBe('MPH CASA LINDA')
    expect(jobNameFromShell('ZZ Twin BONILLA LAW FIRM (backtest)')).toBe('BONILLA LAW FIRM')
    expect(jobNameFromShell('ZZ Shadow Galloway Park')).toBe('Galloway Park')
    expect(jobNameFromShell('Plain name')).toBe('Plain name')
    expect(jobNameFromShell(null)).toBe('Unknown project')
  })
})

describe('slateLabel / auditKind', () => {
  it('a round-two backtest is a re-bid, a first round a slate, a shadow says when we sent', () => {
    expect(auditKind({ shellName: 'ZZ Twin X (backtest R2)' })).toBe('backtest')
    expect(auditKind({ shellName: 'ZZ Shadow X' })).toBe('shadow')
    expect(slateLabel({ shellName: 'ZZ Twin X (backtest R2)', requestedAt: '2026-09-05T13:00:00Z', refSentDate: null })).toBe('re-bid Sep 5')
    expect(slateLabel({ shellName: 'ZZ Twin X (backtest)', requestedAt: '2026-08-31T13:00:00Z', refSentDate: null })).toBe('slate Aug 31')
    expect(slateLabel({ shellName: 'ZZ Shadow X', requestedAt: '2026-09-20T13:00:00Z', refSentDate: '2026-09-22' })).toBe('shadow · sent 09/22')
    expect(slateLabel({ shellName: 'ZZ Shadow X', requestedAt: '2026-09-20T13:00:00Z', refSentDate: null })).toBe('shadow')
  })
})

describe('whyLine', () => {
  it('questions · notes · the kind of job and its gate · needs a fix · the slate', () => {
    expect(whyLine(item({ id: 'a', openQuestions: 12, notes: 4, axis: 'vet-clinic', gate: { streak: 1, met: false }, needsFix: true }))).toBe('12 questions · 4 notes · Vet clinic, 1 of 5 in a row · needs a fix first · re-bid Sep 5')
    expect(whyLine(item({ id: 'b', shellName: 'ZZ Twin B (backtest)', requestedAt: '2026-08-31T13:00:00Z' }))).toBe('no questions · slate Aug 31')
    expect(whyLine(item({ id: 'c', unpriced: true, openQuestions: 3 }))).toBe('robot still working · no counts yet · re-bid Sep 5')
    expect(jobTypeWords('fitness-club', { streak: 5, met: true })).toBe('Fitness club · earned first drafts')
    expect(jobTypeWords('fitness-club', { streak: 0, met: false })).toBe('Fitness club')
    expect(jobTypeWords(null, null)).toBeNull()
  })
})

describe('sealedLine / deltaWord', () => {
  it('say when a sealed audit opens, and the delta as a whole percent', () => {
    expect(sealedLine({ refNumber: '494', refDueDate: '2026-10-01' })).toBe('opens when b494 goes out · due 10/01')
    expect(sealedLine({ refNumber: null, refDueDate: null })).toBe('opens when our bid goes out')
    expect(deltaWord(-7.9)).toBe('−8%')
    expect(deltaWord(127.04)).toBe('+127%')
    expect(deltaWord(null)).toBeNull()
  })
})

describe('buildAuditQueue', () => {
  const items = [
    item({ id: 'p1', openQuestions: 12 }),
    item({ id: 'p2', openQuestions: 10 }),
    item({ id: 's1', sealed: true, refNumber: '494', refDueDate: '2026-10-01' }),
    item({ id: 'p3', openQuestions: 0 }),
    item({ id: 'd1', status: 'done' }),
    item({ id: 'g1', status: 'digested' }),
  ]
  it('sections the stake-ordered list around the open card', () => {
    const q = buildAuditQueue(items, 'p2')
    expect(q.now?.id).toBe('p2')
    expect(q.nowPosition).toBe(2)
    expect(q.workableCount).toBe(3)
    expect(q.upNext.map((i) => i.id)).toEqual(['p1', 'p3'])
    expect(q.sealed.map((i) => i.id)).toEqual(['s1'])
    expect(q.digesting.map((i) => i.id)).toEqual(['d1'])
    expect(q.digested.map((i) => i.id)).toEqual(['g1'])
    expect(finishLabel(q)).toBe('Finish audit → next: P1')
  })
  it('with nothing open, Up next is the whole workable list', () => {
    const q = buildAuditQueue(items, null)
    expect(q.now).toBeNull()
    expect(q.nowPosition).toBeNull()
    expect(q.upNext.map((i) => i.id)).toEqual(['p1', 'p2', 'p3'])
    expect(finishLabel({ ...q, upNext: [] })).toBe('Finish audit')
  })
  it('an open done card is Now, out of Digesting, with no position', () => {
    const q = buildAuditQueue(items, 'd1')
    expect(q.now?.id).toBe('d1')
    expect(q.nowPosition).toBeNull()
    expect(q.digesting).toEqual([])
  })
})
