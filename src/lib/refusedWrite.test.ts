import { beforeEach, describe, expect, it, vi } from 'vitest'

const recordNavClick = vi.fn()
vi.mock('./navClickTelemetry', () => ({ recordNavClick: (...a: unknown[]) => recordNavClick(...a) }))

import { RLS_REFUSED_CONTROL, refusedUpdateMessage, refusedWriteTarget, reportRefusedWrite, setRefusedWriteIdentity, updateApplied, updateRefused } from './refusedWrite'

beforeEach(() => {
  recordNavClick.mockClear()
  setRefusedWriteIdentity(null, null)
})

describe('updateApplied', () => {
  it('true only when the update returned rows', () => {
    expect(updateApplied([{ id: 'a' }])).toBe(true)
    expect(updateApplied([])).toBe(false)
    expect(updateApplied(null)).toBe(false)
    expect(updateApplied(undefined)).toBe(false)
  })
})

describe('updateRefused', () => {
  it('is false and silent when rows came back', () => {
    setRefusedWriteIdentity('u1', 'estimator')
    expect(updateRefused([{ id: 'a' }], 'bids')).toBe(false)
    expect(recordNavClick).not.toHaveBeenCalled()
  })
  it('is true and writes one rls_refused row — the table and op in the target, the role on the row — when the signed-in user was refused', () => {
    setRefusedWriteIdentity('u1', 'estimator')
    expect(updateRefused([], 'bids')).toBe(true)
    expect(recordNavClick).toHaveBeenCalledWith('u1', 'estimator', RLS_REFUSED_CONTROL, '/bids?op=update')
    expect(updateRefused(null, 'bids_takeoff_rough_part_lines', 'delete')).toBe(true)
    expect(recordNavClick).toHaveBeenLastCalledWith('u1', 'estimator', 'rls_refused', '/bids_takeoff_rough_part_lines?op=delete')
  })
  it('still reports the refusal to the caller when nobody is signed in, without a row', () => {
    expect(updateRefused([], 'bids')).toBe(true)
    expect(recordNavClick).not.toHaveBeenCalled()
  })
  it('a throwing sink never reaches the caller', () => {
    setRefusedWriteIdentity('u1', 'dev')
    recordNavClick.mockImplementationOnce(() => {
      throw new Error('offline')
    })
    expect(() => reportRefusedWrite('bids')).not.toThrow()
  })
})

describe('copy and target', () => {
  it('names the thing that was not saved; the target is root-relative', () => {
    expect(refusedUpdateMessage('bid')).toBe('Save didn’t apply — you don’t have permission to edit this bid, or it no longer exists. Your changes were not saved.')
    expect(refusedWriteTarget('bids', 'update')).toBe('/bids?op=update')
  })
})
