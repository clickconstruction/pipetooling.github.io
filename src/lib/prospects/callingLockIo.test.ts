import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Lazy the way the real client is: a query is sent only when it is awaited (`then`). */
const sent = vi.hoisted(() => ({ deletes: [] as Array<{ table: string; filters: Record<string, unknown> }>, fail: false }))

vi.mock('../supabase', () => {
  function builder(table: string) {
    const filters: Record<string, unknown> = {}
    let deleting = false
    const b: Record<string, unknown> = {}
    b.delete = () => {
      deleting = true
      return b
    }
    b.eq = (col: string, value: unknown) => {
      filters[col] = value
      return b
    }
    b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      if (deleting) sent.deletes.push({ table, filters })
      return (sent.fail ? Promise.reject(new Error('offline')) : Promise.resolve({ data: null, error: null })).then(onFulfilled, onRejected)
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

import { releaseCallingLock } from './callingLockIo'

beforeEach(() => {
  sent.deletes = []
  sent.fail = false
})

describe('releaseCallingLock', () => {
  it('sends the delete of the caller’s own row on that prospect', () => {
    releaseCallingLock('prospect-1', 'user-1')
    expect(sent.deletes).toEqual([{ table: 'prospect_calling_locks', filters: { prospect_id: 'prospect-1', user_id: 'user-1' } }])
  })

  it('never throws and leaves no unhandled rejection when the signal is lost', async () => {
    sent.fail = true
    expect(() => releaseCallingLock('prospect-1', 'user-1')).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()
    expect(sent.deletes).toHaveLength(1)
  })
})
