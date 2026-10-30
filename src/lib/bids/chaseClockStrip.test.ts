/**
 * The chase clock as a strip of days (punch list #217, bids-7): a promised day draws solid,
 * the rule's day dashed, today passing the diamond makes the bid *to chase*, and the
 * tab-gettable day sits twenty-one days after the send.
 */
import { describe, expect, it } from 'vitest'
import { resolveBidFollowup } from './bidNextFollowup'
import { CHASE_CLOCK_MAX_DAYS, chaseClockLabels, chaseClockStrip } from './chaseClockStrip'

const TODAY = '2026-10-30'
const NOW = '2026-10-30T17:00:00.000Z'

function followupOf(sentIso: string, lastContactIso: string | null, bidNextYmd: string | null = null) {
  return resolveBidFollowup({ sentIso, lastContactIso, bidNextYmd }, TODAY, NOW)
}

function marksOn(strip: NonNullable<ReturnType<typeof chaseClockStrip>>, ymd: string) {
  return strip.days.find((d) => d.ymd === ymd)?.marks ?? []
}

describe('chaseClockStrip', () => {
  it('a promised day: a solid diamond on that day, the bid parked until then', () => {
    // Sent Oct 25, one call Oct 27, the GC said call again Nov 10.
    const strip = chaseClockStrip({ sentIso: '2026-10-25', contactIsos: ['2026-10-27T15:00:00.000Z'], followup: followupOf('2026-10-25', '2026-10-27T15:00:00.000Z', '2026-11-10'), hasTab: false, todayYmd: TODAY })!
    expect(strip.callAgain).toEqual({ ymd: '2026-11-10', source: 'bid', words: 'call again · Nov 10 · promised' })
    expect(marksOn(strip, '2026-11-10')).toEqual(['promised'])
    expect(marksOn(strip, '2026-10-25')).toEqual(['sent'])
    expect(marksOn(strip, '2026-10-27')).toEqual(['contact'])
    expect(strip.toChase).toBe(false)
    expect(strip.labels.map((l) => l.text)).toEqual(['sent Oct 25', 'today', 'call again · promised', 'tab gettable Nov 15'])
    expect(strip.words).toBe('Sent Oct 25. 1 contact, the last Oct 27. Call again · Nov 10 · promised, is ahead. Tab gettable from Nov 15. Today Oct 30: 3 days quiet.')
  })

  it('a default day: a dashed diamond seven days after the last contact, and the words say the rule made it', () => {
    const strip = chaseClockStrip({ sentIso: '2026-10-25', contactIsos: ['2026-10-27T15:00:00.000Z'], followup: followupOf('2026-10-25', '2026-10-27T15:00:00.000Z'), hasTab: false, todayYmd: TODAY })!
    expect(strip.callAgain).toEqual({ ymd: '2026-11-03', source: 'default', words: "call again · Nov 3 · the rule's 7 days after the last contact" })
    expect(marksOn(strip, '2026-11-03')).toEqual(['default'])
    expect(strip.toChase).toBe(false)
    expect(strip.quietDays).toBe(3)
    // The window: the send to a day past the gettable day, today marked once.
    expect(strip.startYmd).toBe('2026-10-25')
    expect(strip.endYmd).toBe('2026-11-16')
    expect(strip.days.filter((d) => d.today).map((d) => d.ymd)).toEqual([TODAY])
    expect(strip.days.find((d) => d.ymd === '2026-10-31')?.weekend).toBe(true)
  })

  it('past the diamond: today has gone by the rule’s day, so the bid is to chase and the words say so', () => {
    // Sent Oct 10, last call Oct 15: the rule's day was Oct 22, eight days gone.
    const strip = chaseClockStrip({ sentIso: '2026-10-10', contactIsos: ['2026-10-15T15:00:00.000Z'], followup: followupOf('2026-10-10', '2026-10-15T15:00:00.000Z'), hasTab: false, todayYmd: TODAY })!
    expect(strip.callAgain?.ymd).toBe('2026-10-22')
    expect(strip.callAgain!.ymd < TODAY).toBe(true)
    expect(strip.toChase).toBe(true)
    expect(strip.quietDays).toBe(15)
    expect(strip.words).toContain('Call again · Oct 22 · the rule\'s 7 days after the last contact, passed.')
    expect(strip.words).toContain('15 days quiet, to chase.')
  })

  it('past gettable: the green tick sits behind today and the label reads since', () => {
    // Sent Sep 20: gettable Oct 11, nineteen days ago.
    const strip = chaseClockStrip({ sentIso: '2026-09-20', contactIsos: ['2026-10-28T15:00:00.000Z'], followup: followupOf('2026-09-20', '2026-10-28T15:00:00.000Z'), hasTab: false, todayYmd: TODAY })!
    expect(strip.gettable).toEqual({ ymd: '2026-10-11', past: true })
    expect(marksOn(strip, '2026-10-11')).toEqual(['gettable'])
    expect(strip.labels.find((l) => l.tone === 'green')?.text).toBe('tab gettable since Oct 11')
    expect(strip.words).toContain('Tab gettable since Oct 11.')
    // A tab on record draws no gettable day at all.
    const withTab = chaseClockStrip({ sentIso: '2026-09-20', contactIsos: [], followup: followupOf('2026-09-20', null), hasTab: true, todayYmd: TODAY })!
    expect(withTab.gettable).toBeNull()
    expect(withTab.days.some((d) => d.marks.includes('gettable'))).toBe(false)
  })

  it('never contacted: the rule’s diamond sits on the send day, and a contact before the send does not count', () => {
    const strip = chaseClockStrip({ sentIso: '2026-10-25', contactIsos: ['2026-10-20T15:00:00.000Z'], followup: followupOf('2026-10-25', null), hasTab: false, todayYmd: TODAY })!
    expect(strip.contactYmds).toEqual([])
    expect(strip.callAgain).toEqual({ ymd: '2026-10-25', source: 'default', words: 'call again · Oct 25 · the day it went out, nobody has called since' })
    expect(marksOn(strip, '2026-10-25')).toEqual(['default', 'sent'])
    expect(strip.toChase).toBe(true)
    expect(strip.words).toContain('No contact since it went out.')
    // With the send label and the diamond on one day, the diamond's label wins and the send's gives way.
    expect(strip.labels.map((l) => l.text)).toEqual(['call again · default', 'today', 'tab gettable Nov 15'])
  })

  it('a bid sent long ago: the strip holds at most 42 days, keeps today in view and says the send fell off the left', () => {
    const strip = chaseClockStrip({ sentIso: '2026-07-01', contactIsos: ['2026-10-01T15:00:00.000Z'], followup: followupOf('2026-07-01', '2026-10-01T15:00:00.000Z'), hasTab: false, todayYmd: TODAY })!
    expect(strip.days.length).toBe(CHASE_CLOCK_MAX_DAYS)
    expect(strip.sentOnStrip).toBe(false)
    expect(strip.days.some((d) => d.today)).toBe(true)
    expect(strip.words.startsWith('Sent Jul 1, before the strip starts.')).toBe(true)
    // The send and the gettable day (Jul 22) are off the strip: both pin to the first column, marked as before the strip.
    const first = strip.days[0]!
    expect(first.pinned).toBe(true)
    expect(first.marks).toEqual(['gettable', 'sent'])
    expect(first.title).toBe('Sep 23 · before the strip starts · sent Jul 1 · tab gettable since Jul 22')
    expect(strip.days.slice(1).some((d) => d.pinned || d.marks.includes('gettable') || d.marks.includes('sent'))).toBe(false)
    // The first column's label is the send's, with ‹ for the days it stands for; the gettable day's gave way to it. The rule's diamond (Oct 8) is on the strip.
    expect(strip.labels.map((l) => l.text)).toEqual(['‹ sent Jul 1', 'call again · default', 'today'])
    expect(strip.words).toContain('Tab gettable since Jul 22.')
  })

  it('a bid sent last year with nobody called since: the diamond on its send day pins to the first column, and the dates carry the year', () => {
    const strip = chaseClockStrip({ sentIso: '2025-10-03', contactIsos: [], followup: followupOf('2025-10-03', null), hasTab: false, todayYmd: TODAY })!
    expect(strip.callAgain).toEqual({ ymd: '2025-10-03', source: 'default', words: 'call again · Oct 3, 2025 · the day it went out, nobody has called since' })
    expect(strip.days[0]!.marks).toEqual(['default', 'gettable', 'sent'])
    expect(strip.days[0]!.pinned).toBe(true)
    expect(strip.toChase).toBe(true)
    expect(strip.labels.map((l) => l.text)).toEqual(['‹ call again · default', 'today'])
    expect(strip.words).toBe('Sent Oct 3, 2025, before the strip starts. No contact since it went out. Call again · Oct 3, 2025 · the day it went out, nobody has called since, passed. Tab gettable since Oct 24, 2025. Today Oct 30: 392 days quiet, to chase.')
  })

  it('a bid with no send day draws nothing', () => {
    expect(chaseClockStrip({ sentIso: null, contactIsos: [], followup: followupOf('', null), hasTab: false, todayYmd: TODAY })).toBeNull()
  })

  it('the builder’s day draws as promised and names the builder', () => {
    const f = resolveBidFollowup({ sentIso: '2026-10-25', lastContactIso: null, builderNextYmd: '2026-11-05' }, TODAY, NOW)
    const strip = chaseClockStrip({ sentIso: '2026-10-25', contactIsos: [], followup: f, hasTab: false, todayYmd: TODAY })!
    expect(strip.callAgain).toEqual({ ymd: '2026-11-05', source: 'builder', words: "call again · Nov 5 · the builder's day" })
    expect(marksOn(strip, '2026-11-05')).toEqual(['promised'])
  })
})

describe('chaseClockLabels', () => {
  it('two labels within four days: the lesser gives way, and the ends lean inward', () => {
    const labels = chaseClockLabels(
      [
        { ymd: '2026-10-25', text: 'sent Oct 25', tone: 'muted' },
        { ymd: '2026-10-29', text: 'today', tone: 'blue' },
        { ymd: '2026-10-31', text: 'call again · default', tone: 'amber' },
        { ymd: '2026-11-15', text: 'tab gettable Nov 15', tone: 'green' },
      ],
      '2026-10-25',
      '2026-11-16',
    )
    // Today is two days from the diamond and gives way; the send is six days off and stays.
    expect(labels.map((l) => l.text)).toEqual(['sent Oct 25', 'call again · default', 'tab gettable Nov 15'])
    expect(labels.map((l) => l.align)).toEqual(['left', 'center', 'right'])
  })

  it('a label off the window is dropped', () => {
    expect(chaseClockLabels([{ ymd: '2026-07-22', text: 'tab gettable since Jul 22', tone: 'green' }], '2026-09-19', '2026-10-30')).toEqual([])
  })
})
