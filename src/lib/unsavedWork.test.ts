import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetUnsavedWorkForTests,
  holdUnsavedWork,
  inFlightWriteCount,
  subscribeUnsavedWork,
  unsavedHoldCount,
  unsavedHoldLabels,
  wrapFetchCountingWrites,
} from './unsavedWork'

afterEach(() => __resetUnsavedWorkForTests())

describe('holds', () => {
  it('counts while held, releases once, and tells subscribers', () => {
    const seen: number[] = []
    subscribeUnsavedWork(() => seen.push(unsavedHoldCount()))
    const release = holdUnsavedWork('Legal firm settings')
    const release2 = holdUnsavedWork('Sub sheet')
    expect(unsavedHoldCount()).toBe(2)
    expect(unsavedHoldLabels()).toEqual(['Legal firm settings', 'Sub sheet'])
    release()
    release()
    expect(unsavedHoldCount()).toBe(1)
    release2()
    expect(seen).toEqual([1, 2, 1, 0])
  })
})

describe('wrapFetchCountingWrites', () => {
  it('counts a POST while it runs and not a GET', async () => {
    const resolvers: Array<(r: Response) => void> = []
    const inner = vi.fn(() => new Promise<Response>((r) => resolvers.push(r)))
    const f = wrapFetchCountingWrites(inner)
    const get = f('https://x/rows', { method: 'GET' })
    expect(inFlightWriteCount()).toBe(0)
    const post = f('https://x/rpc/save', { method: 'POST' })
    expect(inFlightWriteCount()).toBe(1)
    for (const r of resolvers) r(new Response('{}'))
    await Promise.all([get, post])
    expect(inFlightWriteCount()).toBe(0)
  })
  it('a rejected write still releases the count, and a Request object carries its own method', async () => {
    const f = wrapFetchCountingWrites(() => Promise.reject(new Error('offline')))
    await expect(f(new Request('https://x/rows', { method: 'PATCH' }))).rejects.toThrow('offline')
    expect(inFlightWriteCount()).toBe(0)
  })
})
