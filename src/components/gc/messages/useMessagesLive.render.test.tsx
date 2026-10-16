// @vitest-environment jsdom
/**
 * v2.5572: two readers on one page share one realtime channel; a change on `messages` or `contacts` reads both after the
 * settle; a tab coming back to focus reads too; the channel closes when the last reader leaves.
 */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => {
  const listeners: Array<{ table: string; fn: () => void }> = []
  const removed: unknown[] = []
  let made = 0
  const channel = (name: string) => {
    made += 1
    const ch: Record<string, unknown> = { name }
    ch.on = (_kind: string, spec: { table: string }, fn: () => void) => {
      listeners.push({ table: spec.table, fn })
      return ch
    }
    ch.subscribe = () => ch
    return ch
  }
  return { listeners, removed, channel, count: () => made }
})
vi.mock('../../../lib/supabase', () => ({
  supabase: { channel: fake.channel, removeChannel: (ch: unknown) => fake.removed.push(ch) },
}))

import { useMessagesLive } from './useMessagesLive'

function Reader({ on }: { on: () => void }) {
  useMessagesLive(true, on)
  return null
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useMessagesLive', () => {
  it('holds one channel for two readers, reads both on a change and on focus, and closes after the last leaves', () => {
    const a = vi.fn()
    const b = vi.fn()
    const first = render(<Reader on={a} />)
    const second = render(<Reader on={b} />)
    expect(fake.count()).toBe(1)
    expect(fake.listeners.map((l) => l.table)).toEqual(['messages', 'contacts'])

    act(() => fake.listeners[0]!.fn())
    act(() => fake.listeners[1]!.fn())
    expect(a).not.toHaveBeenCalled()
    act(() => void vi.advanceTimersByTime(400))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)

    act(() => void window.dispatchEvent(new Event('focus')))
    act(() => void vi.advanceTimersByTime(400))
    expect(a).toHaveBeenCalledTimes(2)

    first.unmount()
    expect(fake.removed).toHaveLength(0)
    second.unmount()
    expect(fake.removed).toHaveLength(1)
    act(() => fake.listeners[0]!.fn())
    act(() => void vi.advanceTimersByTime(400))
    expect(b).toHaveBeenCalledTimes(2)
  })
})
