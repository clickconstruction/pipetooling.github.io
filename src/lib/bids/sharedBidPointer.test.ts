import { describe, expect, it } from 'vitest'
import { SHARED_BID_POINTER_KEY, readSharedBidId, rememberSharedBidId } from './sharedBidPointer'

function memoryStorage() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  }
}

describe('shared bid pointer (J11-F2/N2)', () => {
  it('remembers and reads back a bid id', () => {
    const s = memoryStorage()
    rememberSharedBidId('bid-1', s)
    expect(s.m.get(SHARED_BID_POINTER_KEY)).toBe('bid-1')
    expect(readSharedBidId(s)).toBe('bid-1')
  })
  it('forgets on null (closing the bid clears the pointer)', () => {
    const s = memoryStorage()
    rememberSharedBidId('bid-1', s)
    rememberSharedBidId(null, s)
    expect(readSharedBidId(s)).toBeNull()
  })
  it('is null with no storage or a blank value', () => {
    expect(readSharedBidId(null)).toBeNull()
    const s = memoryStorage()
    s.setItem(SHARED_BID_POINTER_KEY, '  ')
    expect(readSharedBidId(s)).toBeNull()
  })
  it('never throws when storage refuses', () => {
    const angry = { getItem: () => { throw new Error('no') }, setItem: () => { throw new Error('no') }, removeItem: () => { throw new Error('no') } }
    expect(() => rememberSharedBidId('x', angry)).not.toThrow()
    expect(readSharedBidId(angry)).toBeNull()
  })
})
