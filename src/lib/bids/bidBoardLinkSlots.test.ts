import { describe, expect, it } from 'vitest'
import { BOARD_LINK_ORDER, boardLinkSlotCount, boardLinkSlots, type BoardLinkKind } from './bidBoardLinkSlots'

const link = (kind: BoardLinkKind, href: string) => ({ kind, href })

describe('boardLinkSlots', () => {
  it('keeps one order: folder, plans, count, submission', () => {
    expect(BOARD_LINK_ORDER).toEqual(['folder', 'plans', 'count', 'submission'])
    expect(boardLinkSlotCount(true)).toBe(5)
    expect(boardLinkSlotCount(false)).toBe(4)
  })

  it('puts each link in its own slot whatever order it came in', () => {
    const out = boardLinkSlots([link('submission', 's'), link('folder', 'f'), link('count', 'c'), link('plans', 'p')])
    expect(out.slots.map((l) => l?.href ?? null)).toEqual(['f', 'p', 'c', 's'])
    expect(out.extra).toEqual([])
  })

  it('leaves a slot empty for a link the bid does not have, so the others keep their place', () => {
    expect(boardLinkSlots([link('plans', 'p')]).slots.map((l) => l?.href ?? null)).toEqual([null, 'p', null, null])
    expect(boardLinkSlots([link('folder', 'f'), link('count', 'c')]).slots.map((l) => l?.href ?? null)).toEqual(['f', null, 'c', null])
    expect(boardLinkSlots([]).slots).toEqual([null, null, null, null])
  })

  it('puts a second CountTooling project after the slots', () => {
    const out = boardLinkSlots([link('folder', 'f'), link('count', 'c1'), link('count', 'c2'), link('count', 'c3')])
    expect(out.slots.map((l) => l?.href ?? null)).toEqual(['f', null, 'c1', null])
    expect(out.extra.map((l) => l.href)).toEqual(['c2', 'c3'])
  })
})
