// @vitest-environment jsdom
/**
 * The billed jobs' lien clocks (v2.4051) — what the hook answers while a read is in flight (v2.4321).
 * The Lien desk's Calendar reads null as "Reading the board…" and `{}` as nothing billed on a clock.
 * On the phone board the billed jobs arrive after the first answer, for an empty list, so that list
 * must read null until its clocks land. A list that changes after a real answer keeps the old record
 * up instead, so the Pipeline's runways never blink during a refresh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { billedLienClocksFor, useBilledLienClocks, type BilledLienClock, type BilledLienClockJob } from './useBilledLienClocks'

const db = vi.hoisted(() => ({
  rows: {} as Record<string, unknown[]>,
  failing: false,
  gate: null as Promise<void> | null,
  release: () => {},
}))

vi.mock('../lib/supabase', () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'in', 'is', 'not', 'order', 'range']) b[m] = () => b
    b.then = (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      (async () => {
        if (db.gate) await db.gate
        // 42501 is a permanent answer: `withSupabaseRetry` throws at once instead of backing off.
        if (db.failing) return { data: null, error: { message: 'permission denied', code: '42501' } }
        return { data: db.rows[table] ?? [], error: null }
      })().then(onFulfilled, onRejected)
    return b
  }
  return { supabase: { from: (table: string) => builder(table) } }
})

const A: BilledLienClockJob = { id: 'a', customer_address_id: null, gc_customer_id: 'gc-1' }
const B: BilledLienClockJob = { id: 'b', customer_address_id: 'addr-b', gc_customer_id: null }
const CLOCK_A: BilledLienClock = { propertyKind: '', filedYmd: null, releasedYmd: null, noticedMonths: [], noticeOnFile: false, workMonths: [] }

/** Reads wait until `release()`. */
function hold() {
  db.gate = new Promise<void>((resolve) => {
    db.release = () => {
      db.gate = null
      resolve()
    }
  })
}

function mount(jobs: BilledLienClockJob[], refreshKey = 0) {
  return renderHook(({ list, refresh }: { list: BilledLienClockJob[]; refresh: number }) => useBilledLienClocks(list, refresh), {
    initialProps: { list: jobs, refresh: refreshKey },
  })
}

beforeEach(() => {
  db.rows = { customer_addresses: [{ id: 'addr-b', property_kind: 'residential' }] }
  db.failing = false
  db.gate = null
})
afterEach(cleanup)

describe('billedLienClocksFor — the answer while a read is in flight', () => {
  const record = { a: CLOCK_A }
  it('nothing read yet: null', () => {
    expect(billedLienClocksFor(null, 'a::gc-1')).toBeNull()
  })
  it('the record read for this list: that record, even when empty', () => {
    expect(billedLienClocksFor({ key: 'a::gc-1', byJob: record }, 'a::gc-1')).toBe(record)
    expect(billedLienClocksFor({ key: '', byJob: {} }, '')).toEqual({})
  })
  it('a real record read for an earlier list stays up while the new list reads', () => {
    expect(billedLienClocksFor({ key: 'a::gc-1', byJob: record }, 'a::gc-1|b:addr-b:')).toBe(record)
  })
  it('an empty record read for another list is not an answer: null', () => {
    expect(billedLienClocksFor({ key: '', byJob: {} }, 'a::gc-1')).toBeNull()
  })
})

describe('useBilledLienClocks', () => {
  it('billed jobs that arrive after an empty board read null until their clocks land — never the empty record', async () => {
    const hook = mount([])
    await waitFor(() => expect(hook.result.current).toEqual({}))
    hold()
    hook.rerender({ list: [A, B], refresh: 0 })
    // The same render the jobs arrive in: still reading, not "no clocks".
    expect(hook.result.current).toBeNull()
    await act(async () => {})
    expect(hook.result.current).toBeNull()
    act(() => db.release())
    await waitFor(() => expect(hook.result.current).not.toBeNull())
    expect(hook.result.current).toEqual({ a: CLOCK_A, b: { ...CLOCK_A, propertyKind: 'residential' } })
  })

  it('a list that changes after a real answer keeps the old record up while the new one reads', async () => {
    const hook = mount([A])
    await waitFor(() => expect(hook.result.current).toEqual({ a: CLOCK_A }))
    const first = hook.result.current
    hold()
    hook.rerender({ list: [A, B], refresh: 0 })
    expect(hook.result.current).toBe(first)
    act(() => db.release())
    await waitFor(() => expect(Object.keys(hook.result.current ?? {}).sort()).toEqual(['a', 'b']))
  })

  it('a refresh of the same list keeps the record up until the re-read lands (the Calendar’s pen)', async () => {
    const hook = mount([A])
    await waitFor(() => expect(hook.result.current).toEqual({ a: CLOCK_A }))
    const first = hook.result.current
    hold()
    hook.rerender({ list: [A], refresh: 1 })
    expect(hook.result.current).toBe(first)
    act(() => db.release())
    await waitFor(() => expect(hook.result.current).not.toBe(first))
    expect(hook.result.current).toEqual({ a: CLOCK_A })
  })

  it('a failed read answers {} for its list; the next list reads null rather than that empty record', async () => {
    db.failing = true
    const hook = mount([A])
    await waitFor(() => expect(hook.result.current).toEqual({}))
    db.failing = false
    hold()
    hook.rerender({ list: [A, B], refresh: 0 })
    expect(hook.result.current).toBeNull()
    act(() => db.release())
    await waitFor(() => expect(Object.keys(hook.result.current ?? {}).sort()).toEqual(['a', 'b']))
  })
})
