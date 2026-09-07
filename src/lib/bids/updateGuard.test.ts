import { beforeEach, describe, expect, it, vi } from 'vitest'

const recordNavClick = vi.fn()
vi.mock('../navClickTelemetry', () => ({ recordNavClick: (...a: unknown[]) => recordNavClick(...a) }))

import { setRefusedWriteIdentity } from '../refusedWrite'
import { BID_UPDATE_NOT_APPLIED_MESSAGE, bidUpdateRefused, updateApplied } from './updateGuard'

beforeEach(() => {
  recordNavClick.mockClear()
  setRefusedWriteIdentity('u1', 'estimator')
})

describe('updateApplied', () => {
  it('true when the update returned rows', () => {
    expect(updateApplied([{ id: 'a' }])).toBe(true)
    expect(updateApplied([{ id: 'a' }, { id: 'b' }])).toBe(true)
  })
  it('false on the RLS silent no-op shape: success with zero rows', () => {
    expect(updateApplied([])).toBe(false)
  })
  it('false on null/undefined data', () => {
    expect(updateApplied(null)).toBe(false)
    expect(updateApplied(undefined)).toBe(false)
  })
})

describe('bidUpdateRefused', () => {
  it('reports the refusal against the bids table and keeps the v2.2454 message', () => {
    expect(bidUpdateRefused([{ id: 'a' }])).toBe(false)
    expect(recordNavClick).not.toHaveBeenCalled()
    expect(bidUpdateRefused([])).toBe(true)
    expect(recordNavClick).toHaveBeenCalledWith('u1', 'estimator', 'rls_refused', '/bids?op=update')
    expect(BID_UPDATE_NOT_APPLIED_MESSAGE).toMatch(/^Save didn’t apply — you don’t have permission to edit this bid/)
  })
})
