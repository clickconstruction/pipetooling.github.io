import { describe, expect, it } from 'vitest'
import { BOARD_TAB_REFETCH_TTL_MS, boardIsFreshForTab } from './boardRefetchTtl'

const base = () => ({
  key: 'u1:all',
  completedKeys: new Set(['u1:all']),
  currentKey: 'u1:all',
  lastCompletedAt: 100_000,
  now: 110_000,
  mergedScopes: new Set(['waiting', 'working', 'ready_to_bill', 'billed_all'] as const),
  wantedScopes: ['ready_to_bill', 'working'] as const,
})

describe('boardIsFreshForTab', () => {
  it('skips the reload inside the window when the same key holds every wanted scope', () => {
    expect(boardIsFreshForTab(base())).toBe(true)
    expect(BOARD_TAB_REFETCH_TTL_MS).toBe(30_000)
  })
  it('reloads once the window has passed, on the edge included', () => {
    expect(boardIsFreshForTab({ ...base(), now: 100_000 + BOARD_TAB_REFETCH_TTL_MS })).toBe(false)
    expect(boardIsFreshForTab({ ...base(), now: 100_000 + BOARD_TAB_REFETCH_TTL_MS - 1 })).toBe(true)
    expect(boardIsFreshForTab({ ...base(), ttlMs: 5_000 })).toBe(false)
  })
  it('reloads for another key, before any load, or when the rows belong to a different key', () => {
    expect(boardIsFreshForTab({ ...base(), key: 'u1:cust-9' })).toBe(false)
    expect(boardIsFreshForTab({ ...base(), completedKeys: new Set(), lastCompletedAt: 0 })).toBe(false)
    expect(boardIsFreshForTab({ ...base(), currentKey: null })).toBe(false)
  })
  it('reloads when the tab wants a scope the rows do not hold', () => {
    expect(boardIsFreshForTab({ ...base(), mergedScopes: new Set(['ready_to_bill'] as const) })).toBe(false)
    expect(boardIsFreshForTab({ ...base(), wantedScopes: [] })).toBe(true)
  })
})
