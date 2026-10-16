import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { PhoneLine } from '../quickReplies/phone'
import {
  acts,
  clockHm,
  driveMinutes,
  guessDrive,
  hereNote,
  holdWords,
  legOf,
  legWords,
  minutesOf,
  pastWindowWords,
  pressLine,
  stepMinutes,
  textHold,
  travelNote,
  type TextHold,
} from './onMyWay'

const line = (id: string, extra: Partial<PhoneLine> = {}): PhoneLine =>
  ({ id, text: `${id} {minutes}`, for: 'customer', stepId: null, scope: 'team', addedBy: 'rosa', addedAt: 1, removed: false, uses: {}, lastUsed: null, textEs: null, phoneOrder: 1, phoneName: null, phonePress: null, ...extra }) as PhoneLine

// 12:45 PM in Chicago on a Friday in October (CDT, UTC−5).
const NOON_45 = Date.parse('2026-10-16T17:45:00Z')

describe('the leg from the two stamps', () => {
  it('reads unmarked, on the way and on site', () => {
    expect(legOf(null)).toBe('unmarked')
    expect(legOf({ travelStartedAt: null, arrivedAt: null })).toBe('unmarked')
    expect(legOf({ travelStartedAt: '2026-10-16T15:12:00Z', arrivedAt: null })).toBe('on-the-way')
    expect(legOf({ travelStartedAt: '2026-10-16T15:12:00Z', arrivedAt: '2026-10-16T15:31:00Z' })).toBe('on-site')
    expect(legOf({ travelStartedAt: null, arrivedAt: '2026-10-16T15:31:00Z' })).toBe('on-site')
  })

  it('counts the drive to the arrival, or to now while on the way', () => {
    const facts = { travelStartedAt: '2026-10-16T15:12:00Z', arrivedAt: '2026-10-16T15:31:00Z' }
    expect(driveMinutes(facts, NOON_45)).toBe(19)
    expect(driveMinutes({ travelStartedAt: '2026-10-16T17:31:00Z', arrivedAt: null }, NOON_45)).toBe(14)
    expect(driveMinutes({ travelStartedAt: null, arrivedAt: '2026-10-16T15:31:00Z' }, NOON_45)).toBeNull()
  })

  it('words the header in the phone’s clock', () => {
    expect(clockHm('2026-10-16T15:12:00Z')).toBe('10:12 AM')
    expect(legWords({ travelStartedAt: '2026-10-16T17:31:00Z', arrivedAt: null }, NOON_45)).toBe('On the way · left 12:31 PM · 14 min')
    expect(legWords({ travelStartedAt: '2026-10-16T15:12:00Z', arrivedAt: '2026-10-16T15:31:00Z' }, NOON_45)).toBe('On site since 10:31 AM · 19 min drive')
    expect(legWords({ travelStartedAt: null, arrivedAt: '2026-10-16T15:31:00Z' }, NOON_45)).toBe('On site since 10:31 AM')
    expect(legWords(null, NOON_45)).toBeNull()
  })
})

describe('the lines and the holds', () => {
  it('finds the live team line on the phone that holds the press, and nothing else', () => {
    const lines = [
      line('mine', { phonePress: 'on_my_way', scope: 'mine' }),
      line('off', { phonePress: 'on_my_way', phoneOrder: null }),
      line('gone', { phonePress: 'on_my_way', removed: true }),
      line('here', { phonePress: 'im_here' }),
      line('way', { phonePress: 'on_my_way' }),
    ]
    expect(pressLine(lines, 'on_my_way')?.id).toBe('way')
    expect(pressLine(lines, 'im_here')?.id).toBe('here')
    expect(pressLine([line('plain')], 'on_my_way')).toBeNull()
  })

  it('holds in order: the role, the customer, the switch, the line', () => {
    const l = line('way', { phonePress: 'on_my_way' })
    expect(textHold({ offered: false, hasCustomer: true, textsOn: true, line: l })).toBe('not-offered')
    expect(textHold({ offered: true, hasCustomer: false, textsOn: true, line: l })).toBe('no-customer')
    expect(textHold({ offered: true, hasCustomer: true, textsOn: false, line: l })).toBe('texts-off')
    expect(textHold({ offered: true, hasCustomer: true, textsOn: true, line: null })).toBe('no-line')
    expect(textHold({ offered: true, hasCustomer: true, textsOn: true, line: l })).toBeNull()
  })

  it('says each hold in plain words, naming the press’s line', () => {
    expect(holdWords('no-line', 'on_my_way')).toBe('No text: the office has no On my way line on the phone.')
    expect(holdWords('no-line', 'im_here')).toBe('No text: the office has no I’m here line on the phone.')
    for (const hold of ['not-offered', 'no-customer', 'texts-off', 'no-line'] as TextHold[]) {
      expect(plainWordsFailures(holdWords(hold, 'on_my_way').replace(/^No text: /, '')), hold).toEqual([])
    }
  })
})

describe('the guess', () => {
  const office: { lat: number; lng: number } = { lat: 29.653, lng: -97.797 }

  it('rounds the straight-line minutes up to the next five, never under five', () => {
    // About 9.4 road miles east: 16 minutes at 35 mph reads as 20.
    const far = guessDrive(office, { lat: 29.653, lng: -97.68 })
    expect(far).not.toBeNull()
    expect(far!.minutes).toBe(20)
    expect(far!.sameSite).toBe(false)
    expect(far!.minutes % 5).toBe(0)
    // Across the street: five, and the same site.
    const near = guessDrive(office, { lat: 29.6531, lng: -97.7971 })
    expect(near!.minutes).toBe(5)
    expect(near!.sameSite).toBe(true)
  })

  it('is nothing without both points', () => {
    expect(guessDrive(null, office)).toBeNull()
    expect(guessDrive(office, null)).toBeNull()
  })

  it('reads typed minutes and steps by five', () => {
    expect(minutesOf(' 20 ')).toBe(20)
    expect(minutesOf('0')).toBeNull()
    expect(minutesOf('twenty')).toBeNull()
    expect(minutesOf('2.5')).toBeNull()
    expect(stepMinutes(20, 1)).toBe(25)
    expect(stepMinutes(20, -1)).toBe(15)
    expect(stepMinutes(22, 1)).toBe(25)
    expect(stepMinutes(22, -1)).toBe(20)
    expect(stepMinutes(3, -1)).toBe(1)
    expect(stepMinutes(null, 1)).toBe(10)
  })
})

describe('the window', () => {
  it('warns when the guessed arrival passes the block’s end, in the window’s own words', () => {
    expect(pastWindowWords(NOON_45, 35, { timeEnd: '13:00:00' })).toBe('That lands about 1:20 PM, past the 1:00 PM window. Running late is under Message the customer and moves the board.')
    expect(pastWindowWords(NOON_45, 10, { timeEnd: '13:00:00' })).toBeNull()
    expect(pastWindowWords(NOON_45, 35, { timeEnd: '14:00:00' })).toBeNull()
    expect(pastWindowWords(NOON_45, null, { timeEnd: '13:00:00' })).toBeNull()
    expect(pastWindowWords(NOON_45, 35, null)).toBeNull()
  })
})

describe('the note and the rows', () => {
  it('writes the session’s note', () => {
    expect(travelNote('PLUM 512 · Whitfield water heater', 20)).toBe('On my way to PLUM 512 · Whitfield water heater, about 20 min')
    expect(travelNote('PLUM 512 · Whitfield water heater', null)).toBe('On my way to PLUM 512 · Whitfield water heater')
    expect(hereNote('PLUM 512 · Whitfield water heater')).toBe('On site at PLUM 512 · Whitfield water heater')
  })

  it('On my way: the clock row, the text row, and a button that says both', () => {
    const a = acts({ press: 'on_my_way', jobLabel: 'PLUM 512', first: 'Dana', leaving: null, hold: null, sameSite: false })
    expect(a.rows.map((r) => r.words)).toEqual(['Clocks you in on PLUM 512 as on the way.', 'Texts Dana from the company number. Their answer comes back to you.'])
    expect(a.primary).toBe('On my way, text Dana')
    expect(a.secondary).toBe('Clock in, no text')
    const b = acts({ press: 'on_my_way', jobLabel: 'GAS 77', first: 'Priya', leaving: 'PLUM 512', hold: null, sameSite: false })
    expect(b.rows[0]!.words).toBe('Clocks you out of PLUM 512 and in on GAS 77 as on the way.')
  })

  it('On my way with a hold: the clock row, the hold row, and a button that promises only the clock', () => {
    const a = acts({ press: 'on_my_way', jobLabel: 'PLUM 509', first: null, leaving: null, hold: 'no-customer', sameSite: false })
    expect(a.rows[1]).toEqual({ icon: '⚠', words: 'No text: this job has no customer yet.', hold: true })
    expect(a.primary).toBe('On my way')
    expect(a.secondary).toBeNull()
  })

  it('already there: the press becomes I’m here, with the text as a choice', () => {
    const a = acts({ press: 'on_my_way', jobLabel: 'PLUM 512', first: 'Dana', leaving: null, hold: null, sameSite: true })
    expect(a.rows[0]!.words).toBe('Clocks you in on PLUM 512, on site now.')
    expect(a.rows[1]!.words).toBe('Texts Dana that you are at the door. Skip it when Dana is already there.')
    expect(a.primary).toBe('I’m here, text Dana')
    expect(a.secondary).toBe('I’m here, no text')
  })

  it('I’m here on an open session: the mark with the road, and the text as a choice', () => {
    const a = acts({ press: 'im_here', jobLabel: 'PLUM 512', first: 'Dana', leaving: null, hold: null, sameSite: false, driveMinutes: 19 })
    expect(a.rows[0]!.words).toBe('Marks you on site at PLUM 512. 19 minutes on the road.')
    expect(a.primary).toBe('I’m here, text Dana')
    const held = acts({ press: 'im_here', jobLabel: 'PLUM 512', first: 'Dana', leaving: null, hold: 'texts-off', sameSite: false, driveMinutes: 0 })
    expect(held.rows[0]!.words).toBe('Marks you on site at PLUM 512.')
    expect(held.primary).toBe('I’m here')
    expect(held.secondary).toBeNull()
  })

  it('every row reads in plain words', () => {
    for (const a of [
      acts({ press: 'on_my_way', jobLabel: 'PLUM 512', first: 'Dana', leaving: 'GAS 77', hold: null, sameSite: false }),
      acts({ press: 'on_my_way', jobLabel: 'PLUM 512', first: null, leaving: null, hold: null, sameSite: true }),
      acts({ press: 'im_here', jobLabel: 'PLUM 512', first: 'Dana', leaving: null, hold: null, sameSite: false, driveMinutes: 19 }),
    ]) {
      for (const r of a.rows) expect(plainWordsFailures(r.words), r.words).toEqual([])
    }
  })
})
