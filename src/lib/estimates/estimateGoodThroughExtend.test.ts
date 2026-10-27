import { describe, expect, it } from 'vitest'
import {
  EXTEND_PRESETS,
  EXTEND_WORDS,
  canExtendEstimateGoodThrough,
  extendButtonLabel,
  extendDateProblem,
  extendDateProblemWords,
  extendLeadWords,
  extendPresetMatching,
  extendPresetYmd,
  goodThroughExtendedLine,
  goodThroughState,
  goodThroughYmd,
  parseGoodThroughExtendedMetadata,
} from './estimateGoodThroughExtend'

const TODAY = '2026-10-27'
const SENT_AT = '2026-09-24T18:31:00Z'

describe('canExtendEstimateGoodThrough', () => {
  it('allows a sent estimate with a send on record, past date or not', () => {
    expect(canExtendEstimateGoodThrough('sent', SENT_AT)).toEqual({ ok: true })
  })
  it('refuses a draft, an accepted, a declined, a superseded or an unknown row', () => {
    expect(canExtendEstimateGoodThrough('draft', null)).toEqual({ ok: false, reason: 'draft' })
    expect(canExtendEstimateGoodThrough('customer_accepted', SENT_AT)).toEqual({ ok: false, reason: 'accepted' })
    expect(canExtendEstimateGoodThrough('declined', SENT_AT)).toEqual({ ok: false, reason: 'declined' })
    expect(canExtendEstimateGoodThrough('superseded', SENT_AT)).toEqual({ ok: false, reason: 'superseded' })
    expect(canExtendEstimateGoodThrough('whatever', SENT_AT)).toEqual({ ok: false, reason: 'unknown_status' })
  })
  it('refuses a sent row with no send on record and a change order in a bid room', () => {
    expect(canExtendEstimateGoodThrough('sent', null)).toEqual({ ok: false, reason: 'never_sent' })
    expect(canExtendEstimateGoodThrough('sent', 'nope')).toEqual({ ok: false, reason: 'never_sent' })
    expect(canExtendEstimateGoodThrough('sent', SENT_AT, { inBidRoom: true })).toEqual({ ok: false, reason: 'bid_room' })
  })
})

describe('goodThroughState', () => {
  it('reads the day, live or passed, and nothing for no date', () => {
    expect(goodThroughState('2026-11-26', TODAY)).toEqual({ kind: 'live', ymd: '2026-11-26', words: 'Good through Thu Nov 26, 2026' })
    expect(goodThroughState(TODAY, TODAY).kind).toBe('live')
    expect(goodThroughState('2026-10-24', TODAY)).toEqual({ kind: 'passed', ymd: '2026-10-24', words: 'Good through Sat Oct 24, 2026 · passed' })
    expect(goodThroughState(null, TODAY)).toEqual({ kind: 'none' })
    expect(goodThroughState('soon', TODAY)).toEqual({ kind: 'none' })
  })
  it('takes a timestamp down to its day', () => {
    expect(goodThroughYmd('2026-11-26T00:00:00')).toBe('2026-11-26')
  })
})

describe('the presets', () => {
  const base = new Date(2026, 9, 27, 12)
  it('count from today and read back', () => {
    expect(EXTEND_PRESETS.map((p) => p.label)).toEqual(['+2 weeks', '+30 days', '+60 days'])
    expect(extendPresetYmd(14, base)).toBe('2026-11-10')
    expect(extendPresetYmd(30, base)).toBe('2026-11-26')
    expect(extendPresetYmd(60, base)).toBe('2026-12-26')
    expect(extendPresetMatching('2026-11-26', base)).toBe(30)
    expect(extendPresetMatching('2026-11-27', base)).toBeNull()
  })
})

describe('extendDateProblem', () => {
  it('needs a day today or later that is not already the date', () => {
    expect(extendDateProblem('2026-11-26', TODAY, '2026-10-24')).toBeNull()
    expect(extendDateProblem(TODAY, TODAY, '2026-10-24')).toBeNull()
    expect(extendDateProblem('', TODAY, '2026-10-24')).toBe('not_a_date')
    expect(extendDateProblem('2026-10-26', TODAY, '2026-10-24')).toBe('before_today')
    expect(extendDateProblem('2026-11-26', TODAY, '2026-11-26')).toBe('same_day')
    expect(extendDateProblemWords('before_today')).toBe('The day must be today or later.')
  })
})

describe('the words', () => {
  it('lead: passed, live, none', () => {
    expect(extendLeadWords('2026-10-24', TODAY)).toBe('Pricing passed its good-through date on Oct 24, 2026. Extend it and the link they have works again.')
    expect(extendLeadWords('2026-11-26', TODAY)).toBe('Good through Nov 26, 2026. Extend it to give them more room.')
    expect(extendLeadWords(null, TODAY)).toBe('This estimate has no good-through date. Set one here.')
  })
  it('the button names the day', () => {
    expect(extendButtonLabel('2026-11-26')).toBe('Extend good-through to Nov 26, 2026')
    expect(extendButtonLabel('')).toBe('Extend good-through')
  })
  it('the toast says the link works again only when the date had passed', () => {
    expect(EXTEND_WORDS.done('2026-11-26', true)).toBe('Good through Thu Nov 26, 2026. The link they have works again.')
    expect(EXTEND_WORDS.done('2026-11-26', false)).toBe('Good through Thu Nov 26, 2026.')
  })
  it('the activity line reads the event', () => {
    const meta = parseGoodThroughExtendedMetadata({ from: '2026-10-24', to: '2026-11-26', user_id: 'u1', user_name: 'Taunya' })
    expect(goodThroughExtendedLine(meta)).toBe('Good-through date extended to Nov 26, 2026 by Taunya (was Oct 24, 2026)')
    expect(goodThroughExtendedLine(parseGoodThroughExtendedMetadata({ to: '2026-11-26' }))).toBe('Good-through date extended to Nov 26, 2026')
    expect(goodThroughExtendedLine(parseGoodThroughExtendedMetadata(null))).toBe('Good-through date extended')
    expect(goodThroughExtendedLine(parseGoodThroughExtendedMetadata('junk'))).toBe('Good-through date extended')
  })
})
