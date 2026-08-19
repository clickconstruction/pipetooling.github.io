import { describe, expect, it } from 'vitest'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { mergeScopedRows, primaryScopeForStatus } from './boardScopes'

const j = (id: string, status: string | null) => ({ id, status }) as unknown as JobWithDetails

describe('primaryScopeForStatus', () => {
  it('maps every status; null and unknowns are working', () => {
    expect(primaryScopeForStatus('waiting')).toBe('waiting')
    expect(primaryScopeForStatus('working')).toBe('working')
    expect(primaryScopeForStatus(null)).toBe('working')
    expect(primaryScopeForStatus('mystery')).toBe('working')
    expect(primaryScopeForStatus('ready_to_bill')).toBe('ready_to_bill')
    expect(primaryScopeForStatus('billed')).toBe('billed_all')
    expect(primaryScopeForStatus('paid')).toBe('paid')
  })
})

describe('mergeScopedRows', () => {
  it('replaces the scope-owned rows, keeps everyone else', () => {
    const prev = [j('w1', 'working'), j('r1', 'ready_to_bill'), j('b1', 'billed')]
    const merged = mergeScopedRows(prev, [j('r2', 'ready_to_bill')], 'ready_to_bill')
    expect(merged.map((x) => x.id).sort()).toEqual(['b1', 'r2', 'w1'])
  })

  it('a stale scope row absent from the fresh fetch disappears', () => {
    const prev = [j('r1', 'ready_to_bill'), j('w1', 'working')]
    const merged = mergeScopedRows(prev, [], 'ready_to_bill')
    expect(merged.map((x) => x.id)).toEqual(['w1'])
  })

  it('RTB fetch returning working companions upgrades them without purging other working rows', () => {
    const prev = [j('w1', 'working'), j('w2', 'working'), j('r1', 'ready_to_bill')]
    // Fresh RTB fetch: r1 gone (billed now), w2 came back as a working companion with fresher data.
    const merged = mergeScopedRows(prev, [j('w2', 'working'), j('r3', 'ready_to_bill')], 'ready_to_bill')
    expect(merged.map((x) => x.id).sort()).toEqual(['r3', 'w1', 'w2'])
  })

  it('a job that moved status is not duplicated when its new scope refreshes', () => {
    const prev = [j('x1', 'ready_to_bill')]
    // x1 moved to billed; billed_all refresh returns it.
    const merged = mergeScopedRows(prev, [j('x1', 'billed')], 'billed_all')
    expect(merged).toHaveLength(1)
    expect(merged[0]!.status).toBe('billed')
  })
})
