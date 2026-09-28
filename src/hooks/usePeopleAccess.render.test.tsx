// @vitest-environment jsdom
/**
 * usePeopleAccess (v2.3933): the App Activity gate rides on the role the hook already reads —
 * a dev without asking the viewers table, anyone else by their row in it — and only for the
 * caller that asks for it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { usePeopleAccess } from './usePeopleAccess'

const db = vi.hoisted(() => ({
  role: 'assistant' as string | null,
  viewerRow: null as { viewer_user_id: string } | null,
  viewerError: null as { message: string; code?: string } | null,
  tablesRead: [] as string[],
}))

vi.mock('../lib/supabase', () => {
  function makeBuilder(table: string): Record<string, unknown> {
    const builder: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit']) builder[m] = () => builder
    builder.single = () => Promise.resolve({ data: table === 'users' && db.role ? { role: db.role } : null, error: null })
    builder.maybeSingle = () => Promise.resolve({ data: db.viewerRow, error: db.viewerError })
    builder.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected)
    return builder
  }
  return {
    supabase: {
      from: (table: string) => {
        db.tablesRead.push(table)
        return makeBuilder(table)
      },
    },
  }
})

const WITH_ACTIVITY = { activityViewer: true }

beforeEach(() => {
  db.role = 'assistant'
  db.viewerRow = null
  db.viewerError = null
  db.tablesRead.length = 0
})
afterEach(cleanup)

describe('usePeopleAccess — the App Activity gate', () => {
  it('lets a dev in without reading the viewers table', async () => {
    db.role = 'dev'
    const { result } = renderHook(() => usePeopleAccess('u1', WITH_ACTIVITY))
    await waitFor(() => expect(result.current.activityAccessResolved).toBe(true))
    expect(result.current.canSeeActivityTab).toBe(true)
    expect(result.current.isDev).toBe(true)
    expect(db.tablesRead).not.toContain('user_app_activity_viewers')
  })

  it('lets a listed viewer in', async () => {
    db.viewerRow = { viewer_user_id: 'u1' }
    const { result } = renderHook(() => usePeopleAccess('u1', WITH_ACTIVITY))
    await waitFor(() => expect(result.current.activityAccessResolved).toBe(true))
    expect(result.current.canSeeActivityTab).toBe(true)
    expect(result.current.isDev).toBe(false)
  })

  it('keeps everyone else out, resolved', async () => {
    const { result } = renderHook(() => usePeopleAccess('u1', WITH_ACTIVITY))
    expect(result.current.activityAccessResolved).toBe(false) // first paint
    await waitFor(() => expect(result.current.activityAccessResolved).toBe(true))
    expect(result.current.canSeeActivityTab).toBe(false)
    expect(db.tablesRead).toContain('user_app_activity_viewers')
  })

  it('reads the role once', async () => {
    const { result } = renderHook(() => usePeopleAccess('u1', WITH_ACTIVITY))
    await waitFor(() => expect(result.current.activityAccessResolved).toBe(true))
    expect(db.tablesRead.filter((t) => t === 'users')).toHaveLength(1)
  })

  it('never reads the viewers table for a caller that did not ask', async () => {
    const { result } = renderHook(() => usePeopleAccess('u1'))
    await waitFor(() => expect(result.current.accessResolved).toBe(true))
    expect(db.tablesRead).not.toContain('user_app_activity_viewers')
    expect(result.current.activityAccessResolved).toBe(false)
    expect(result.current.canSeeActivityTab).toBe(false)
  })

  it('resolves nothing without a signed-in user', async () => {
    const { result } = renderHook(() => usePeopleAccess(undefined, WITH_ACTIVITY))
    await Promise.resolve()
    expect(result.current.activityAccessResolved).toBe(false)
    expect(db.tablesRead).toEqual([])
  })
})
