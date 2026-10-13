/**
 * The Dashboard's Follow up line reads cut 2's badge (`follow_up_count`, v2.5289), the number Follow up's pill says
 * (call E1), and says it in plain words.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { plainWordsFailures } from '../plainWords'

const io = vi.hoisted(() => ({ count: vi.fn() }))
vi.mock('../followUp/followUpIo', () => ({ supabaseFollowUpIo: () => io }))

import { followUpNeedsWords, loadGcFollowUpNeeds } from './followUpNeedsIo'

beforeEach(() => io.count.mockReset())

describe('the Dashboard’s Follow up line', () => {
  it('reads the badge’s count, once a person', async () => {
    io.count.mockResolvedValue(3)
    expect(await loadGcFollowUpNeeds()).toEqual({ count: 3, late: false, title: '3 people are waiting on us', detail: 'Answer them, or say what we owe them.' })
    expect(io.count).toHaveBeenCalledTimes(1)
  })

  it('says one person as one, and nothing when nobody waits', async () => {
    expect(followUpNeedsWords(1)?.title).toBe('1 person is waiting on us')
    io.count.mockResolvedValue(0)
    expect(await loadGcFollowUpNeeds()).toBeNull()
  })

  it('is in plain words', () => {
    const w = followUpNeedsWords(3)!
    expect([w.title, w.detail].flatMap(plainWordsFailures)).toEqual([])
  })
})
