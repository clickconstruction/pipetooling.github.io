import { describe, expect, it } from 'vitest'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import {
  EXTEND_GOOD_THROUGH_HASH,
  GOOD_THROUGH_PASSED_CHIP_COLORS,
  GOOD_THROUGH_PASSED_CHIP_WORDS,
  extendGoodThroughHref,
  goodThroughPassedChip,
} from './estimateGoodThroughChip'

const TODAY = '2026-10-28'
const SENT_AT = '2026-09-24T18:31:00Z'
const sent = (over: Partial<Parameters<typeof goodThroughPassedChip>[0]> = {}) => ({ status: 'sent', sent_at: SENT_AT, valid_until: '2026-10-27', bid_room_id: null, estimate_number: 176, ...over })

describe('goodThroughPassedChip', () => {
  it('a sent estimate whose day passed yesterday wears the red chip that lands on the Extend door', () => {
    expect(goodThroughPassedChip(sent(), TODAY)).toEqual({
      label: 'good through passed · extend?',
      title: 'Pricing passed its good-through date on Oct 27, 2026. Extend it and the link they have works again.',
      href: '/estimates/176#extend-good-through',
      ymd: '2026-10-27',
    })
    expect(GOOD_THROUGH_PASSED_CHIP_WORDS).toBe('good through passed · extend?')
    expect(extendGoodThroughHref(52)).toBe(`/estimates/52#${EXTEND_GOOD_THROUGH_HASH}`)
  })

  it('the day boundary: the good-through day itself is still live, the day after is passed', () => {
    expect(goodThroughPassedChip(sent({ valid_until: TODAY }), TODAY)).toBeNull()
    expect(goodThroughPassedChip(sent({ valid_until: '2026-10-29' }), TODAY)).toBeNull()
    expect(goodThroughPassedChip(sent({ valid_until: '2026-10-27' }), TODAY)?.ymd).toBe('2026-10-27')
    expect(goodThroughPassedChip(sent({ valid_until: '2026-10-27T00:00:00' }), TODAY)?.ymd).toBe('2026-10-27')
  })

  it("today is the company's calendar day, not the UTC one: 10:30 PM Central is still the 27th", () => {
    // 2026-10-28T03:30Z is Oct 27, 10:30 PM in America/Chicago (CDT): a date good through the 27th is live.
    const lateEvening = todayYmdInAppTz(new Date('2026-10-28T03:30:00Z'))
    expect(lateEvening).toBe('2026-10-27')
    expect(goodThroughPassedChip(sent(), lateEvening)).toBeNull()
    // 2026-10-28T05:30Z is Oct 28, 12:30 AM Central: now it has passed.
    const afterMidnight = todayYmdInAppTz(new Date('2026-10-28T05:30:00Z'))
    expect(afterMidnight).toBe('2026-10-28')
    expect(goodThroughPassedChip(sent(), afterMidnight)?.label).toBe(GOOD_THROUGH_PASSED_CHIP_WORDS)
  })

  it('keeps today’s chip where the Extend door is not offered: a draft, an accepted, a declined, a superseded, a never-sent or a bid-room row', () => {
    expect(goodThroughPassedChip(sent({ status: 'draft', sent_at: null }), TODAY)).toBeNull()
    expect(goodThroughPassedChip(sent({ status: 'customer_accepted' }), TODAY)).toBeNull()
    expect(goodThroughPassedChip(sent({ status: 'declined' }), TODAY)).toBeNull()
    expect(goodThroughPassedChip(sent({ status: 'superseded' }), TODAY)).toBeNull()
    expect(goodThroughPassedChip(sent({ sent_at: null }), TODAY)).toBeNull()
    expect(goodThroughPassedChip(sent({ bid_room_id: 'room-1' }), TODAY)).toBeNull()
  })

  it('keeps today’s chip with no good-through date on the row', () => {
    expect(goodThroughPassedChip(sent({ valid_until: null }), TODAY)).toBeNull()
    expect(goodThroughPassedChip(sent({ valid_until: 'soon' }), TODAY)).toBeNull()
  })

  it('names its tone as theme tokens', () => {
    expect(GOOD_THROUGH_PASSED_CHIP_COLORS).toEqual({ fg: 'var(--text-red-700)', bg: 'var(--bg-red-tint)', border: 'var(--border-red)' })
  })
})
