import { describe, expect, it } from 'vitest'

import { auditFilterCounts, auditKind, filterAuditList } from './auditListFilter'

const items = [
  { id: 'a', projectName: 'ZZ Twin BONILLA LAW FIRM (backtest R2)', openQuestions: 12 },
  { id: 'b', projectName: 'ZZ Shadow PALMER WINERY', openQuestions: 0 },
  { id: 'c', projectName: 'zz shadow galloway park', openQuestions: 2 },
  { id: 'd', projectName: null, openQuestions: 0 },
  { id: 'e', projectName: 'ZZ Shadow SEALED ONE', openQuestions: 3, sealed: true },
]

describe('auditKind', () => {
  it('reads the ZZ convention — Shadow is a live-bid shadow, anything else a backtest', () => {
    expect(auditKind('ZZ Shadow PALMER WINERY')).toBe('shadow')
    expect(auditKind('  zz shadow x')).toBe('shadow')
    expect(auditKind('ZZ Twin LIVSTE')).toBe('backtest')
    expect(auditKind('ZZ Shadowy Name')).toBe('backtest')
    expect(auditKind(null)).toBe('backtest')
  })
})

describe('filterAuditList', () => {
  it('all keeps everything in the order given', () => {
    expect(filterAuditList(items, 'all').map((i) => i.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('backtests / shadows split on kind', () => {
    expect(filterAuditList(items, 'backtests').map((i) => i.id)).toEqual(['a', 'd'])
    expect(filterAuditList(items, 'shadows').map((i) => i.id)).toEqual(['b', 'c', 'e'])
  })
  it('questions keeps only openable audits with an open question — a sealed shadow waits for the send', () => {
    expect(filterAuditList(items, 'questions').map((i) => i.id)).toEqual(['a', 'c'])
  })
})

describe('auditFilterCounts', () => {
  it('counts each pill over the same list', () => {
    expect(auditFilterCounts(items)).toEqual({ all: 5, backtests: 2, shadows: 3, questions: 2 })
  })
})
