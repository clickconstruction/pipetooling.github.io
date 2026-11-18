/**
 * The phone's trip, the rules alone (punch list #379, PR 7b): the reply read back, what the job's card
 * shows, the words, and Just clock in remembered on the device. Every site, person and date is made up.
 */
import { describe, expect, it } from 'vitest'
import {
  joinTripWords,
  milesFromShopWords,
  ownDaysWords,
  parseTripPhoneState,
  readTripHeadedHome,
  readTripJustClockIn,
  sinceWords,
  tripBannerTitle,
  tripDayNumber,
  tripKindOfSession,
  tripNameWords,
  tripPhoneNeedsMiles,
  tripPhoneView,
  tripQuietPaint,
  tripToSiteWords,
  TRIP_HEADED_HOME_KEY,
  TRIP_JUST_CLOCK_IN_KEY,
  weekdayOf,
  withTodayPainted,
  writeTripHeadedHome,
  writeTripJustClockIn,
  type TripPhoneState,
  type TripPhoneStorage,
} from './tripPhone'

const TODAY = '2026-10-28'

const reply = (over: Record<string, unknown> = {}) => ({ ok: true, development_id: 'd-heron', development_name: 'Heron Point', has_trips: false, mine: null, open: [], today: TODAY, ...over })
const state = (over: Record<string, unknown> = {}): TripPhoneState => {
  const s = parseTripPhoneState(reply(over), TODAY)
  if (!s) throw new Error('the reply did not read')
  return s
}
const MINE = { trip_id: 't1', trip_number: 5, first_day: '2026-10-26', last_day: '2026-10-28', purpose: 'Lift stations', days: { '2026-10-26': 'road', '2026-10-27': 'site', '2026-10-28': 'site' }, with: ['Priya'] }
const LUIS = { trip_id: 't2', trip_number: 4, first_day: '2026-10-26', people: ['Luis'] }

function memory(): TripPhoneStorage & { kept: Map<string, string> } {
  const kept = new Map<string, string>()
  return { kept, getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => void kept.set(k, v) }
}

describe('parseTripPhoneState', () => {
  it('reads nothing from a caller who is not working the job, or from junk', () => {
    expect(parseTripPhoneState({ ok: false }, TODAY)).toBeNull()
    expect(parseTripPhoneState(null, TODAY)).toBeNull()
    expect(parseTripPhoneState([], TODAY)).toBeNull()
    expect(parseTripPhoneState('ok', TODAY)).toBeNull()
  })

  it('reads a job on no site as a state with no development', () => {
    const s = parseTripPhoneState({ ok: true, development_id: null, has_trips: false, mine: null, open: [], today: TODAY }, '2026-01-01')
    expect(s).toEqual({ developmentId: null, developmentName: '', hasTrips: false, mine: null, open: [], today: TODAY })
  })

  it('reads the person’s own trip, dropping a day that is not a day', () => {
    const s = state({ has_trips: true, mine: { ...MINE, days: { ...MINE.days, soon: 'site', '2026-10-29': 'lunch' } } })
    expect(s.mine).toEqual({ tripId: 't1', tripNumber: 5, firstDay: '2026-10-26', lastDay: '2026-10-28', purpose: 'Lift stations', days: MINE.days, with: ['Priya'] })
  })

  it('reads the open trips newest first and drops one with no id or no day', () => {
    const s = state({ open: [{ trip_id: 't-old', first_day: '2026-10-20', people: ['Omar'] }, LUIS, { trip_id: '', first_day: '2026-10-27', people: [] }, { trip_id: 't-bad', first_day: 'Monday' }] })
    expect(s.open.map((o) => o.tripId)).toEqual(['t2', 't-old'])
  })

  it('reads a trip’s number as a positive whole number, and an older reply without one as null', () => {
    expect(state({ mine: MINE, open: [LUIS] })).toMatchObject({ mine: { tripNumber: 5 }, open: [{ tripId: 't2', tripNumber: 4 }] })
    // A reply from before numbers: the field is not there at all.
    const oldMine = { trip_id: 't1', first_day: MINE.first_day, last_day: MINE.last_day, purpose: MINE.purpose, days: MINE.days, with: MINE.with }
    const oldOpen = { trip_id: 't2', first_day: LUIS.first_day, people: LUIS.people }
    expect(state({ mine: oldMine, open: [oldOpen] })).toMatchObject({ mine: { tripId: 't1', tripNumber: null }, open: [{ tripId: 't2', tripNumber: null }] })
    for (const junk of [null, 0, -3, 2.5, '5', {}]) {
      expect(state({ mine: { ...MINE, trip_number: junk }, open: [{ ...LUIS, trip_number: junk }] })).toMatchObject({ mine: { tripNumber: null }, open: [{ tripNumber: null }] })
    }
  })

  it('takes the device’s day only when the reply names none', () => {
    expect(parseTripPhoneState(reply({ today: undefined }), '2026-10-30')?.today).toBe('2026-10-30')
    expect(parseTripPhoneState(reply(), '2026-10-30')?.today).toBe(TODAY)
  })
})

describe('the words', () => {
  it('names a weekday without a device zone', () => {
    expect(weekdayOf('2026-10-26')).toBe('Mon')
    expect(weekdayOf('2026-11-01')).toBe('Sun')
  })

  it('says when a trip started: today, the weekday inside six days, the date before that', () => {
    expect(sinceWords(TODAY, TODAY)).toBe('today')
    expect(sinceWords('2026-10-26', TODAY)).toBe('Mon')
    expect(sinceWords('2026-10-22', TODAY)).toBe('Thu')
    expect(sinceWords('2026-10-21', TODAY)).toBe('Oct 21')
  })

  it('names a trip by its number when it has one, on the banner and on the End the trip sheet', () => {
    expect(tripNameWords(5)).toBe('Trip 5')
    expect(tripNameWords(null)).toBe('Trip')
    expect(tripBannerTitle({ tripNumber: 5, day: 3, site: 'Heron Point' })).toBe('Trip 5 · day 3 at Heron Point')
    expect(tripBannerTitle({ tripNumber: null, day: 3, site: 'Heron Point' })).toBe('Trip · day 3 at Heron Point')
    expect(tripBannerTitle({ tripNumber: 5, day: 1, site: '' })).toBe('Trip 5 · day 1')
    expect(tripToSiteWords(5, 'Heron Point')).toBe('Trip 5 to Heron Point')
    expect(tripToSiteWords(null, 'Heron Point')).toBe('Trip to Heron Point')
    expect(tripToSiteWords(5, '')).toBe('Trip 5')
  })

  it('offers a crewmate’s trip by first names', () => {
    expect(joinTripWords({ people: ['Luis'], firstDay: '2026-10-26' }, TODAY)).toBe('Join Luis’s trip, out since Mon')
    expect(joinTripWords({ people: ['Luis', 'Priya'], firstDay: '2026-10-27' }, TODAY)).toBe('Join Luis and Priya’s trip, out since Tue')
    expect(joinTripWords({ people: [], firstDay: TODAY }, TODAY)).toBe('Join a crewmate’s trip, out since today')
  })

  it('says the miles whole, and nothing while unknown', () => {
    expect(milesFromShopWords(1180.4)).toBe('1,180 miles from the shop')
    expect(milesFromShopWords(1)).toBe('1 mile from the shop')
    expect(milesFromShopWords(null)).toBeNull()
  })

  it('says a person’s own days by kind, leaving out a kind with none', () => {
    expect(ownDaysWords({ '2026-10-26': 'road', '2026-10-27': 'site', '2026-10-28': 'site', '2026-10-29': 'road' })).toBe('2 days at the site · 2 on the road')
    expect(ownDaysWords({ '2026-10-25': 'ready', '2026-10-27': 'site' })).toBe('1 day at the site · 1 getting ready')
    expect(ownDaysWords({ '2026-10-26': 'road' })).toBe('1 day on the road')
    expect(ownDaysWords({})).toBe('')
  })
})

describe('tripPhoneView', () => {
  it('shows nothing with no reply, on a job on no site, or on a near site with no trip', () => {
    expect(tripPhoneView({ state: null, miles: 1180, justClockIn: false, clockedIn: true })).toEqual({ kind: 'none' })
    expect(tripPhoneView({ state: state({ development_id: null }), miles: 1180, justClockIn: false, clockedIn: true })).toEqual({ kind: 'none' })
    expect(tripPhoneView({ state: state(), miles: 12, justClockIn: false, clockedIn: true })).toEqual({ kind: 'none' })
    // An unknown distance is not far.
    expect(tripPhoneView({ state: state(), miles: null, justClockIn: false, clockedIn: true })).toEqual({ kind: 'none' })
  })

  it('asks on a site far from the shop, with the miles', () => {
    expect(tripPhoneView({ state: state(), miles: 1180, justClockIn: false, clockedIn: true })).toEqual({ kind: 'ask', siteLine: 'Heron Point · 1,180 miles from the shop', joins: [] })
    expect(tripPhoneView({ state: state(), miles: 150, justClockIn: false, clockedIn: true }).kind).toBe('ask')
    expect(tripPhoneView({ state: state(), miles: 149.9, justClockIn: false, clockedIn: true }).kind).toBe('none')
  })

  it('asks on a site that has had a trip, with the miles left out while unknown', () => {
    expect(tripPhoneView({ state: state({ has_trips: true }), miles: null, justClockIn: false, clockedIn: true })).toEqual({ kind: 'ask', siteLine: 'Heron Point', joins: [] })
  })

  it('asks where a crewmate is out, offering at most two trips, newest first', () => {
    const open = [LUIS, { trip_id: 't3', first_day: '2026-10-27', people: ['Omar', 'Walt'] }, { trip_id: 't4', first_day: '2026-10-12', people: ['Ray'] }]
    const v = tripPhoneView({ state: state({ has_trips: true, open }), miles: null, justClockIn: false, clockedIn: true })
    expect(v).toEqual({
      kind: 'ask',
      siteLine: 'Heron Point',
      joins: [
        { tripId: 't3', label: 'Join Omar and Walt’s trip, out since Tue' },
        { tripId: 't2', label: 'Join Luis’s trip, out since Mon' },
      ],
    })
  })

  it('asks nothing after Just clock in was said for the job today', () => {
    expect(tripPhoneView({ state: state({ has_trips: true, open: [LUIS] }), miles: 1180, justClockIn: true, clockedIn: true })).toEqual({ kind: 'none' })
  })

  it('shows the banner while the person’s own trip is open, whatever was said before', () => {
    const v = tripPhoneView({ state: state({ has_trips: true, mine: MINE }), miles: null, justClockIn: true, clockedIn: true })
    expect(v).toEqual({ kind: 'banner', tripId: 't1', title: 'Trip 5 · day 3 at Heron Point', sub: 'with Priya · started Mon Oct 26', heading: 'Trip 5 to Heron Point', when: 'Oct 26 to 28', daysLine: '2 days at the site · 1 on the road', todayKind: 'site' })
  })

  it('keeps the plain title on a trip made before numbers, and the Join press never says a number', () => {
    const v = tripPhoneView({ state: state({ has_trips: true, mine: { ...MINE, trip_number: null } }), miles: null, justClockIn: false, clockedIn: true })
    expect(v).toMatchObject({ kind: 'banner', title: 'Trip · day 3 at Heron Point', heading: 'Trip to Heron Point' })
    const ask = tripPhoneView({ state: state({ has_trips: true, open: [LUIS] }), miles: null, justClockIn: false, clockedIn: true })
    expect(ask).toMatchObject({ kind: 'ask', joins: [{ tripId: 't2', label: 'Join Luis’s trip, out since Mon' }] })
  })

  it('leaves out who it is with when alone, and counts today before it is painted', () => {
    const v = tripPhoneView({ state: state({ has_trips: true, mine: { ...MINE, with: [], days: { '2026-10-26': 'road', '2026-10-27': 'site' }, last_day: '2026-10-27' } }), miles: null, justClockIn: false, clockedIn: true })
    expect(v).toMatchObject({ kind: 'banner', title: 'Trip 5 · day 3 at Heron Point', sub: 'started Mon Oct 26', daysLine: '1 day at the site · 1 on the road', todayKind: null })
  })

  it('before the clock in asks nothing, however far the site, and still shows the banner', () => {
    expect(tripPhoneView({ state: state({ has_trips: true, open: [LUIS] }), miles: 1180, justClockIn: false, clockedIn: false })).toEqual({ kind: 'none' })
    expect(tripPhoneView({ state: state({ has_trips: true, mine: MINE }), miles: null, justClockIn: false, clockedIn: false }).kind).toBe('banner')
  })

  it('numbers today among the person’s own days, painted or not', () => {
    expect(tripDayNumber({ days: {} }, TODAY)).toBe(1)
    expect(tripDayNumber({ days: { [TODAY]: 'site' } }, TODAY)).toBe(1)
    expect(tripDayNumber({ days: { '2026-10-26': 'road', '2026-10-27': 'site' } }, TODAY)).toBe(3)
    expect(tripDayNumber({ days: { '2026-10-26': 'road', '2026-10-27': 'site', [TODAY]: 'road' } }, TODAY)).toBe(3)
  })
})

describe('the reads, and the kind a trip act paints', () => {
  it('reads the distance only when it alone would decide the question', () => {
    expect(tripPhoneNeedsMiles(state(), false, true)).toBe(true)
    expect(tripPhoneNeedsMiles(null, false, true)).toBe(false)
    expect(tripPhoneNeedsMiles(state({ development_id: null }), false, true)).toBe(false)
    expect(tripPhoneNeedsMiles(state({ has_trips: true }), false, true)).toBe(false)
    expect(tripPhoneNeedsMiles(state({ open: [LUIS] }), false, true)).toBe(false)
    expect(tripPhoneNeedsMiles(state({ mine: MINE }), false, true)).toBe(false)
    expect(tripPhoneNeedsMiles(state(), true, true)).toBe(false)
    // Somebody who has not clocked in is not asked, so the distance is not read.
    expect(tripPhoneNeedsMiles(state(), false, false)).toBe(false)
  })

  it('reads the kind a trip act paints from the open session: a drive that has not arrived is On the road', () => {
    expect(tripKindOfSession({ travelStartedAt: '2026-10-28T12:05:00Z', arrivedAt: null })).toBe('road')
    expect(tripKindOfSession({ travelStartedAt: '2026-10-28T12:05:00Z', arrivedAt: '2026-10-28T14:40:00Z' })).toBe('site')
    // Start here and the manual clock in stamp no drive: the person is at work.
    expect(tripKindOfSession({ travelStartedAt: null, arrivedAt: '2026-10-28T12:05:00Z' })).toBe('site')
    expect(tripKindOfSession({ travelStartedAt: null, arrivedAt: null })).toBe('site')
    expect(tripKindOfSession(null)).toBe('site')
    expect(tripKindOfSession(undefined)).toBe('site')
  })
})

describe('tripQuietPaint', () => {
  const days = { '2026-10-26': 'road', '2026-10-27': 'site' }
  const on = (today?: string) => state({ mine: { ...MINE, last_day: today ? TODAY : '2026-10-27', days: today ? { ...days, [TODAY]: today } : days } })
  const paint = (today: string | undefined, kind: 'road' | 'site' | null, over: { clockedIn?: boolean; headedHome?: boolean } = {}) =>
    tripQuietPaint({ state: on(today), clockedIn: over.clockedIn ?? true, kind, headedHome: over.headedHome ?? false })

  it('paints nothing with no reply, no trip of the person’s own, before the clock in, or while the kind is not known', () => {
    expect(tripQuietPaint({ state: null, clockedIn: true, kind: 'site', headedHome: false })).toBeNull()
    expect(tripQuietPaint({ state: state(), clockedIn: true, kind: 'site', headedHome: false })).toBeNull()
    expect(paint(undefined, 'site', { clockedIn: false })).toBeNull()
    expect(paint(undefined, null)).toBeNull()
  })

  it('paints an unpainted today the kind the session says', () => {
    expect(paint(undefined, 'site')).toBe('site')
    // On my way and still driving: the day starts On the road.
    expect(paint(undefined, 'road')).toBe('road')
  })

  it('skips a day that is that kind already', () => {
    expect(paint('site', 'site')).toBeNull()
    expect(paint('road', 'road')).toBeNull()
  })

  it('never turns At the site into On the road: a drive to the motel after work is still a site day', () => {
    expect(paint('site', 'road')).toBeNull()
  })

  it('turns On the road into At the site: a morning drive, then I’m here', () => {
    expect(paint('road', 'site')).toBe('site')
  })

  it('leaves a Getting ready day alone: loading the trailer at home is not a day at the site or on the road', () => {
    expect(paint('ready', 'site')).toBeNull()
    expect(paint('ready', 'road')).toBeNull()
  })

  it('paints nothing after Heading home in the same session', () => {
    expect(paint('road', 'site', { headedHome: true })).toBeNull()
    expect(paint(undefined, 'site', { headedHome: true })).toBeNull()
  })

  it('counts a painted day in place', () => {
    const painted = withTodayPainted(on(), 'road')
    expect(painted.mine?.days[TODAY]).toBe('road')
    expect(painted.mine?.lastDay).toBe(TODAY)
    expect(withTodayPainted(painted, 'site').mine?.days[TODAY]).toBe('site')
  })
})

describe('Just clock in, remembered on the device', () => {
  it('remembers the job and the day, and forgets it the next day', () => {
    const s = memory()
    expect(readTripJustClockIn('j1', TODAY, s)).toBe(false)
    writeTripJustClockIn('j1', TODAY, s)
    expect(readTripJustClockIn('j1', TODAY, s)).toBe(true)
    expect(readTripJustClockIn('j2', TODAY, s)).toBe(false)
    expect(readTripJustClockIn('j1', '2026-10-29', s)).toBe(false)
  })

  it('drops yesterday’s answers on the next write', () => {
    const s = memory()
    writeTripJustClockIn('j1', '2026-10-27', s)
    writeTripJustClockIn('j2', TODAY, s)
    expect(JSON.parse(s.kept.get(TRIP_JUST_CLOCK_IN_KEY) ?? '')).toEqual({ j2: TODAY })
  })

  it('passes over a store that holds junk, throws, or is not there', () => {
    const junk = memory()
    junk.kept.set(TRIP_JUST_CLOCK_IN_KEY, 'not json')
    expect(readTripJustClockIn('j1', TODAY, junk)).toBe(false)
    writeTripJustClockIn('j1', TODAY, junk)
    expect(readTripJustClockIn('j1', TODAY, junk)).toBe(true)
    const broken: TripPhoneStorage = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readTripJustClockIn('j1', TODAY, broken)).toBe(false)
    expect(() => writeTripJustClockIn('j1', TODAY, broken)).not.toThrow()
    expect(readTripJustClockIn('j1', TODAY, null)).toBe(false)
    expect(() => writeTripJustClockIn('j1', TODAY, null)).not.toThrow()
  })

  it('remembers Heading home by clock session and day, apart from Just clock in', () => {
    const s = memory()
    expect(readTripHeadedHome('s1', TODAY, s)).toBe(false)
    writeTripHeadedHome('s1', TODAY, s)
    expect(readTripHeadedHome('s1', TODAY, s)).toBe(true)
    // A new clock session the same day is free to paint again.
    expect(readTripHeadedHome('s2', TODAY, s)).toBe(false)
    expect(readTripHeadedHome('s1', '2026-10-29', s)).toBe(false)
    expect(readTripJustClockIn('s1', TODAY, s)).toBe(false)
    expect(JSON.parse(s.kept.get(TRIP_HEADED_HOME_KEY) ?? '')).toEqual({ s1: TODAY })
    expect(readTripHeadedHome('s1', TODAY, null)).toBe(false)
    expect(() => writeTripHeadedHome('s1', TODAY, null)).not.toThrow()
  })
})
