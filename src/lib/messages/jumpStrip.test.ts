import { describe, expect, it } from 'vitest'
import { JUMP_LANE_ANCHOR, JUMP_LANE_COLOR, jumpStripActive, jumpStripItems, QUEUE_LANES, type JumpCounts } from './jumpStrip'

const counts: JumpCounts = { new: 3, needsYou: 0, needsReply: 0, weOwe: 1, waiting: 3, wentOut: 9 }

describe('jumpStripItems', () => {
  it('draws the five lanes in page order with their headings’ counts, an empty lane greyed in place, Needs you hidden at zero', () => {
    const items = jumpStripItems(counts)
    expect(items.map((i) => i.key)).toEqual(['new', 'needsReply', 'weOwe', 'waiting', 'wentOut'])
    expect(items.map((i) => `${i.label} ${i.count}`)).toEqual(['New 3', 'Needs a reply 0', 'We owe them 1', 'Waiting on them 3', 'Went out 9'])
    expect(items.map((i) => i.empty)).toEqual([false, true, false, false, false])
    expect(items[0]).toEqual({ key: 'new', label: 'New', count: '3', noun: 'people', anchor: 'new-lane', color: '#3b82f6', empty: false })
  })

  it('shows Needs you in its place once it has rows, and says one person or row in the singular', () => {
    const items = jumpStripItems({ ...counts, needsYou: 2, weOwe: 1, waiting: 1 })
    expect(items.map((i) => i.key)).toEqual(['new', 'needsYou', 'needsReply', 'weOwe', 'waiting', 'wentOut'])
    expect(items[1]!.noun).toBe('rows')
    expect(items.find((i) => i.key === 'weOwe')!.noun).toBe('row')
    expect(items.find((i) => i.key === 'waiting')!.noun).toBe('person')
    expect(items.find((i) => i.key === 'wentOut')!.noun).toBe('sends')
  })

  it('prints "…" for a lane that has not read yet, neither empty nor counted', () => {
    const items = jumpStripItems({ ...counts, waiting: null, wentOut: null, needsYou: null })
    expect(items.map((i) => i.key)).toEqual(['new', 'needsReply', 'weOwe', 'waiting', 'wentOut'])
    const waiting = items.find((i) => i.key === 'waiting')!
    expect(waiting.count).toBe('…')
    expect(waiting.empty).toBe(false)
    expect(waiting.noun).toBe('people')
  })

  it('lands each lane on its section and keeps the queue lanes apart from the two sections below', () => {
    expect(JUMP_LANE_ANCHOR.waiting).toBe('waiting-on-them')
    expect(JUMP_LANE_ANCHOR.wentOut).toBe('went-out')
    expect([...QUEUE_LANES]).toEqual(['new', 'needsYou', 'needsReply', 'weOwe'])
    expect(JUMP_LANE_COLOR.needsReply).toBe('#ea580c')
  })
})

describe('jumpStripActive', () => {
  const tops = (n: number | null, r: number | null, w: number | null) => [
    { key: 'new' as const, top: n },
    { key: 'needsReply' as const, top: r },
    { key: 'wentOut' as const, top: w },
  ]

  it('is null at the top of the page, before any heading reaches the line', () => {
    expect(jumpStripActive(tops(300, 700, 1800), 64)).toBeNull()
  })

  it('is the last heading that has reached the line', () => {
    expect(jumpStripActive(tops(-200, 40, 1500), 64)).toBe('needsReply')
    expect(jumpStripActive(tops(-900, -500, 64), 64)).toBe('wentOut')
    expect(jumpStripActive(tops(-900, -500, 65), 64)).toBe('needsReply')
  })

  it('skips a heading that is not drawn', () => {
    expect(jumpStripActive(tops(-200, null, 1500), 64)).toBe('new')
    expect(jumpStripActive([], 64)).toBeNull()
  })
})
