import { describe, expect, it } from 'vitest'
import { laborEmptyState, loadAfterResolve, shouldLoadCostEstimate, shouldMintCostEstimateOnLoad } from './laborTabLoadGate'

describe('shouldLoadCostEstimate', () => {
  it('waits while the version ref is unset (first pick of the session)', () => {
    expect(shouldLoadCostEstimate({ bidId: 'b1', resolvedFor: null, versionId: null })).toBe(false)
  })

  it('waits while the version ref still belongs to the previous bid (the F1 frame)', () => {
    expect(shouldLoadCostEstimate({ bidId: 'b2', resolvedFor: { bidId: 'b1', versionId: 'v1' }, versionId: 'v1' })).toBe(false)
  })

  it('loads once the ref belongs to this bid and agrees with the committed state', () => {
    expect(shouldLoadCostEstimate({ bidId: 'b2', resolvedFor: { bidId: 'b2', versionId: 'v9' }, versionId: 'v9' })).toBe(true)
  })

  it('loads an unsplit (Base) bid once its ref is set, even though the version is null', () => {
    expect(shouldLoadCostEstimate({ bidId: 'b3', resolvedFor: { bidId: 'b3', versionId: null }, versionId: null })).toBe(true)
  })

  it('waits when the ref is ahead of the committed state (a re-run is already scheduled)', () => {
    expect(shouldLoadCostEstimate({ bidId: 'b2', resolvedFor: { bidId: 'b2', versionId: 'v9' }, versionId: 'v1' })).toBe(false)
  })

  it('never loads without a bid', () => {
    expect(shouldLoadCostEstimate({ bidId: null, resolvedFor: { bidId: 'b1', versionId: null }, versionId: null })).toBe(false)
  })
})

describe('loadAfterResolve', () => {
  it('defers to the re-run when the resolve changed the committed version', () => {
    expect(loadAfterResolve({ picked: 'v2', versionId: 'v1' })).toBe(false)
    expect(loadAfterResolve({ picked: 'v2', versionId: null })).toBe(false)
  })

  it('loads directly when the resolve landed on the value React already holds (Base → Base)', () => {
    expect(loadAfterResolve({ picked: null, versionId: null })).toBe(true)
    expect(loadAfterResolve({ picked: 'v1', versionId: 'v1' })).toBe(true)
  })
})

describe('laborEmptyState', () => {
  it('shows the skeleton while unresolved, whatever the row count says', () => {
    expect(laborEmptyState({ resolved: false, rowCount: 0 })).toBe('skeleton')
    expect(laborEmptyState({ resolved: false, rowCount: 6 })).toBe('skeleton')
  })

  it('shows the empty sentence only for a resolved bid with zero rows', () => {
    expect(laborEmptyState({ resolved: true, rowCount: 0 })).toBe('empty')
  })

  it('shows the table for a resolved bid with rows', () => {
    expect(laborEmptyState({ resolved: true, rowCount: 6 })).toBe('table')
  })
})

describe('shouldMintCostEstimateOnLoad', () => {
  it('mints only when the resolved version has fixtures to hold labor rows for', () => {
    expect(shouldMintCostEstimateOnLoad({ rowCount: 0 })).toBe(false)
    expect(shouldMintCostEstimateOnLoad({ rowCount: 1 })).toBe(true)
  })
})
