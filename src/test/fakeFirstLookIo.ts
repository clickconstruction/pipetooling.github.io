/**
 * A stand-in for the First look's reads and writes (`src/lib/firstLook/threadIo.ts`), for render smokes: every door
 * answers nothing, as a thread with no look does, and a test hands over the ones it scripts. One place, so a new door
 * on the io is added here and no smoke breaks.
 */
import { vi } from 'vitest'
import type { FirstLookThreadIo } from '../lib/firstLook/threadIo'

export function fakeFirstLookThreadIo(over: Partial<FirstLookThreadIo> = {}): FirstLookThreadIo {
  return {
    looks: vi.fn(async () => ({ looks: [], files: [] })),
    lookById: vi.fn(async () => null),
    looksOfJob: vi.fn(async () => ({ looks: [], files: [] })),
    lookOfEstimate: vi.fn(async () => null),
    signLookFiles: vi.fn(async (paths: readonly string[]) => Object.fromEntries(paths.map((p) => [p, `https://files.test/${p}`]))),
    signTexted: vi.fn(async (ids: readonly string[]) => Object.fromEntries(ids.map((id) => [id, `https://texted.test/${id}`]))),
    mint: vi.fn(async () => ({ id: 'L9', link: 'https://clicktooling.com/show/k7m2p9xq4d' })),
    stamp: vi.fn(async () => undefined),
    setJob: vi.fn(async () => undefined),
    ...over,
  }
}
