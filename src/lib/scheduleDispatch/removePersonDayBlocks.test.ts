import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ deleteJobScheduleBlock: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: {} }))
vi.mock('../jobScheduleBlocks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../jobScheduleBlocks')>()),
  ...mocks,
}))

import { removePersonDayBlocks } from './removePersonDayBlocks'

beforeEach(() => {
  mocks.deleteJobScheduleBlock.mockReset().mockResolvedValue({ error: null })
})

describe('removePersonDayBlocks', () => {
  it('deletes nothing and counts nothing for a day with no blocks', async () => {
    expect(await removePersonDayBlocks([])).toEqual({ removed: 0, failed: 0 })
    expect(mocks.deleteJobScheduleBlock).not.toHaveBeenCalled()
  })

  it('deletes every block, one call each', async () => {
    expect(await removePersonDayBlocks(['a', 'b', 'c'])).toEqual({ removed: 3, failed: 0 })
    expect(mocks.deleteJobScheduleBlock.mock.calls.map((c) => c[0])).toEqual(['a', 'b', 'c'])
  })

  it('counts a refused delete as failed and keeps going', async () => {
    mocks.deleteJobScheduleBlock.mockImplementation(async (id: string) => ({
      error: id === 'b' ? 'permission denied' : null,
    }))
    expect(await removePersonDayBlocks(['a', 'b', 'c'])).toEqual({ removed: 2, failed: 1 })
    expect(mocks.deleteJobScheduleBlock).toHaveBeenCalledTimes(3)
  })

  it('counts every block as failed when none can be deleted', async () => {
    mocks.deleteJobScheduleBlock.mockResolvedValue({ error: 'network down' })
    expect(await removePersonDayBlocks(['a', 'b'])).toEqual({ removed: 0, failed: 2 })
  })

  it('starts every delete before the first one finishes', async () => {
    const started: string[] = []
    const release: Array<() => void> = []
    mocks.deleteJobScheduleBlock.mockImplementation(
      (id: string) =>
        new Promise((resolve) => {
          started.push(id)
          release.push(() => resolve({ error: null }))
        }),
    )
    const pending = removePersonDayBlocks(['a', 'b', 'c'])
    await Promise.resolve()
    expect(started).toEqual(['a', 'b', 'c'])
    for (const r of release) r()
    expect(await pending).toEqual({ removed: 3, failed: 0 })
  })

  it('rejects when a delete throws instead of returning its error', async () => {
    mocks.deleteJobScheduleBlock.mockRejectedValueOnce(new Error('boom'))
    await expect(removePersonDayBlocks(['a', 'b'])).rejects.toThrow('boom')
  })
})
