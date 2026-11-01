// @vitest-environment jsdom
/**
 * The photo counts of a list (punch list #229, PR 3): one read for the ids, kept even when the list re-keys while
 * the read is out (the live walk of 2026-11-01: the Reports tab re-ordered its rows under the first read and every
 * badge was lost), a changed order reading nothing new, a grown list reading only its new ids.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const reads: string[][] = []
let answer: (found: Map<string, number>) => void = () => {}

vi.mock('../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoCounts: (ids: string[]) => {
    reads.push([...ids])
    return new Promise<Map<string, number>>((resolve) => {
      answer = resolve
    })
  },
}))

import { useReportPhotoCounts } from './useReportPhotoCounts'

describe('useReportPhotoCounts', () => {
  it('keeps the read’s answer when the list re-orders under it, and reads nothing new for the same ids', async () => {
    reads.length = 0
    const { result, rerender } = renderHook(({ ids }) => useReportPhotoCounts(ids), { initialProps: { ids: ['a', 'b', 'c'] } })
    expect(reads).toEqual([['a', 'b', 'c']])
    // The list re-keys while the read is out: the same ids in another order.
    rerender({ ids: ['c', 'a', 'b'] })
    expect(reads).toHaveLength(1)
    await act(async () => {
      answer(new Map([['b', 2]]))
    })
    await waitFor(() => expect(result.current.get('b')).toBe(2))
    expect(result.current.has('a')).toBe(false)
  })

  it('a grown list reads only its new ids', async () => {
    reads.length = 0
    const { result, rerender } = renderHook(({ ids }) => useReportPhotoCounts(ids), { initialProps: { ids: ['a'] } })
    await act(async () => {
      answer(new Map([['a', 1]]))
    })
    await waitFor(() => expect(result.current.get('a')).toBe(1))
    rerender({ ids: ['a', 'd'] })
    expect(reads).toEqual([['a'], ['d']])
  })
})
