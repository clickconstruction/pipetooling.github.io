import { describe, expect, it } from 'vitest'
import { releaseMutationLock, tryAcquireMutationLock } from './mutationLockSet'

describe('tryAcquireMutationLock', () => {
  it('acquires a free id and records it as in flight', () => {
    const locks = new Set<string>()
    expect(tryAcquireMutationLock(locks, 'inv-1')).toBe(true)
    expect(locks.has('inv-1')).toBe(true)
  })

  it('blocks a second acquire on the same id (double-click guard preserved)', () => {
    const locks = new Set<string>()
    expect(tryAcquireMutationLock(locks, 'inv-1')).toBe(true)
    expect(tryAcquireMutationLock(locks, 'inv-1')).toBe(false)
    expect(locks.size).toBe(1)
  })

  it('allows a different id while the first is in flight, holding both', () => {
    const locks = new Set<string>()
    expect(tryAcquireMutationLock(locks, 'inv-1')).toBe(true)
    expect(tryAcquireMutationLock(locks, 'inv-2')).toBe(true)
    expect(locks.has('inv-1')).toBe(true)
    expect(locks.has('inv-2')).toBe(true)
  })

  it('re-acquires an id after it was released', () => {
    const locks = new Set<string>()
    tryAcquireMutationLock(locks, 'inv-1')
    releaseMutationLock(locks, 'inv-1')
    expect(tryAcquireMutationLock(locks, 'inv-1')).toBe(true)
  })
})

describe('releaseMutationLock', () => {
  it('releases only its own id, leaving other in-flight ids locked', () => {
    const locks = new Set<string>()
    tryAcquireMutationLock(locks, 'inv-1')
    tryAcquireMutationLock(locks, 'inv-2')
    releaseMutationLock(locks, 'inv-1')
    expect(locks.has('inv-1')).toBe(false)
    expect(locks.has('inv-2')).toBe(true)
    expect(tryAcquireMutationLock(locks, 'inv-2')).toBe(false)
  })

  it('is a no-op for an id that is not held', () => {
    const locks = new Set<string>()
    tryAcquireMutationLock(locks, 'inv-1')
    releaseMutationLock(locks, 'inv-2')
    expect(locks.has('inv-1')).toBe(true)
    expect(locks.size).toBe(1)
  })

  it('old single-slot failure mode: A then B in flight, A finishing never unlocks B', () => {
    // With the old string|null slot, B's acquire overwrote A's id; A's guarded
    // cleanup then skipped clearing, and B's cleanup cleared while A was still
    // in flight. With per-id locks the interleaving is safe end to end.
    const locks = new Set<string>()
    expect(tryAcquireMutationLock(locks, 'A')).toBe(true)
    expect(tryAcquireMutationLock(locks, 'B')).toBe(true)
    releaseMutationLock(locks, 'A')
    expect(tryAcquireMutationLock(locks, 'B')).toBe(false)
    releaseMutationLock(locks, 'B')
    expect(locks.size).toBe(0)
  })
})
