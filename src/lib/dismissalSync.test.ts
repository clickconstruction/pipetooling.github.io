import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A stand-in that is lazy the way the real client is: a query is sent only when it is awaited (`then`).
 * A write that is built and dropped records nothing here, as it sends nothing there.
 */
const sent = vi.hoisted(() => ({ writes: [] as Array<{ table: string; method: string; payload: unknown; options: unknown }>, rows: [] as Array<{ key: string; state: unknown }>, refuse: false }))

vi.mock('./supabase', () => {
  function builder(table: string) {
    let write: { method: string; payload: unknown; options: unknown } | null = null
    const b: Record<string, unknown> = {}
    b.upsert = (payload: unknown, options: unknown) => {
      write = { method: 'upsert', payload, options }
      return b
    }
    b.select = () => b
    b.eq = () => b
    b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
      if (write) sent.writes.push({ table, ...write })
      if (sent.refuse && write) return Promise.reject(new Error('offline')).then(onFulfilled, onRejected)
      return Promise.resolve(write ? { data: null, error: null } : { data: sent.rows, error: null }).then(onFulfilled, onRejected)
    }
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

import { pushDismissal } from './dismissalStore'
import { startDismissalSync, stopDismissalSync } from './dismissalSync'

const store = new Map<string, string>()

beforeEach(() => {
  sent.writes = []
  sent.rows = []
  sent.refuse = false
  store.clear()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
})
afterEach(() => {
  stopDismissalSync()
  vi.unstubAllGlobals()
})

describe('startDismissalSync', () => {
  it('a dismissal saved after sign-in is sent to the server, on the person’s own row', async () => {
    await startDismissalSync('user-1')
    pushDismissal('alert_prefix_', 'user-1', { dismissedAt: '2026-11-17' })
    await Promise.resolve()
    expect(sent.writes).toHaveLength(1)
    expect(sent.writes[0]).toMatchObject({ table: 'user_dismissals', method: 'upsert', options: { onConflict: 'user_id,key' } })
    expect(sent.writes[0]?.payload).toMatchObject({ user_id: 'user-1', key: 'alert_prefix_', state: { dismissedAt: '2026-11-17' } })
  })

  it('a refused or offline save is let go, and the dismissal itself does not throw', async () => {
    await startDismissalSync('user-1')
    sent.refuse = true
    expect(() => pushDismissal('alert_prefix_', 'user-1', { dismissedAt: '2026-11-17' })).not.toThrow()
    await Promise.resolve()
    await Promise.resolve()
    expect(sent.writes).toHaveLength(1)
  })

  it('seeds this device from the server at sign-in, where the device has nothing', async () => {
    sent.rows = [{ key: 'alert_prefix_', state: { dismissedAt: '2026-11-01' } }]
    store.set('other_prefix_user-1', '"kept"')
    await startDismissalSync('user-1')
    expect(store.get('alert_prefix_user-1')).toBe(JSON.stringify({ dismissedAt: '2026-11-01' }))
    expect(store.get('other_prefix_user-1')).toBe('"kept"')
    expect(sent.writes).toHaveLength(0)
  })

  it('after sign-out nothing is sent', async () => {
    await startDismissalSync('user-1')
    stopDismissalSync()
    pushDismissal('alert_prefix_', 'user-1', { dismissedAt: '2026-11-17' })
    await Promise.resolve()
    expect(sent.writes).toHaveLength(0)
  })
})
