import { describe, expect, it } from 'vitest'
import {
  AWAY_NOTE_DEFAULT,
  AWAY_NOTE_WORDS_MAX,
  AWAY_WORDS,
  awayAlertWords,
  awayBackOnWords,
  awayBarPercent,
  awayCallHref,
  awayCityFromAddress,
  awayCountdown,
  awayCountdownLine,
  awayDriveWords,
  awayFromLine,
  awayHello,
  awayMiles,
  awayNoteHelp,
  awayNoteIsEmpty,
  awayNoteProblem,
  awayUpdatedWords,
  awayWhereWords,
  buildAwayScreen,
  roundAwayMiles,
} from './awayNote'

const NOW = new Date(2026, 11, 2, 9, 28) // Dec 2, 2026 at 9:28 on the phone's clock
const office = { address: '12925 FM 20, Kingsbury, TX 78638', latLng: { lat: 29.65, lng: -97.81 }, phone: '(512) 555-0142' }
const draft = { words: 'Corinne, your spot on the crew is waiting. Come home to us.', countdownYmd: '2029-11-05', showWhere: true, showCall: true, alertOnDay: false }

describe('the countdown', () => {
  it('counts whole days, hours and minutes to the start of the day back, no seconds, and the bar from the day they left', () => {
    const c = awayCountdown({ backYmd: '2029-11-05', leftYmd: '2026-11-03', now: NOW })!
    // Dec 2, 2026 09:28 → Nov 5, 2029 00:00 is 1,068 days, 14 hours and 32 minutes.
    expect([c.days, c.hours, c.minutes, c.done]).toEqual([1068, 14, 32, false])
    expect(awayCountdownLine(c)).toBe("1,068 days, 14 hours and 32 minutes until you're back")
    expect(c.backOn).toBe('Back on Monday, Nov 5, 2029')
    // 29 days and change of 1,098: under three percent, and the bar never reads under one.
    expect(c.pct).toBeCloseTo(29.4 / 1098, 2)
    expect(awayBarPercent(c)).toBe(2.7)
    expect(awayBarPercent({ ...c, pct: 0 })).toBe(1)
  })
  it('is done once the day back has begun, and stays done after it', () => {
    const onTheDay = awayCountdown({ backYmd: '2026-12-02', leftYmd: '2026-11-03', now: NOW })!
    expect(onTheDay.done).toBe(true)
    expect([onTheDay.days, onTheDay.hours, onTheDay.minutes]).toEqual([0, 0, 0])
    expect(onTheDay.pct).toBe(1)
    expect(awayCountdownLine(onTheDay)).toBe("Today's the day.")
    expect(awayCountdown({ backYmd: '2026-11-20', leftYmd: '2026-11-03', now: NOW })!.done).toBe(true)
  })
  it('the bar is full with no day left or a day back that is not after it, and the one-minute case reads one', () => {
    expect(awayCountdown({ backYmd: '2029-11-05', leftYmd: null, now: NOW })!.pct).toBe(1)
    expect(awayCountdown({ backYmd: '2026-12-03', leftYmd: '2026-12-03', now: NOW })!.pct).toBe(1)
    const soon = awayCountdown({ backYmd: '2026-12-03', leftYmd: '2026-11-03', now: new Date(2026, 11, 2, 23, 59) })!
    expect([soon.days, soon.hours, soon.minutes]).toEqual([0, 0, 1])
    expect(awayCountdownLine(soon)).toBe("0 days, 0 hours and 1 minute until you're back")
  })
  it('a day back that is not a date is no countdown', () => {
    expect(awayCountdown({ backYmd: 'soon', leftYmd: null, now: NOW })).toBeNull()
    expect(awayBackOnWords('2026-12-25')).toBe('Back on Friday, Dec 25, 2026')
  })
})

describe('the miles and the drive', () => {
  it('rounds the crow’s miles to the mile, to five, then to ten, and says the drive in hours or days', () => {
    expect(roundAwayMiles(3.6)).toBe(4)
    expect(roundAwayMiles(47)).toBe(45)
    expect(roundAwayMiles(1183)).toBe(1180)
    expect(awayDriveWords(0.4)).toBe("You're nearly there.")
    expect(awayDriveWords(30)).toBe("Under an hour's drive.")
    expect(awayDriveWords(180)).toBe('About 3 hours of driving.')
    expect(awayDriveWords(1180)).toBe('Roughly a two-day drive.')
    expect(awayDriveWords(700)).toBe('Roughly a one-day drive.')
    expect(awayDriveWords(9000)).toBe('Roughly a 15-day drive.')
  })
  it('works the miles out from two points, the office pin and where they stand, and words them', () => {
    // Kingsbury, TX to Nashville, TN: about 780 miles as the crow flies.
    const m = awayMiles({ lat: 36.16, lng: -86.78 }, office.latLng)
    expect(m.miles).toBe(780)
    expect(m.line).toBe('About 780 miles')
    expect(m.tail).toBe('from you, as the crow flies. Roughly a one-day drive.')
    const near = awayMiles({ lat: 29.651, lng: -97.811 }, office.latLng)
    expect(near.line).toBe('Under a mile')
    expect(near.tail).toBe("from you, as the crow flies. You're nearly there.")
  })
})

describe('the city, the call and the lines', () => {
  it('reads the city and state out of the office address, and a short address whole', () => {
    expect(awayCityFromAddress(office.address)).toBe('Kingsbury, TX')
    expect(awayCityFromAddress('500 Congress Ave, Austin, Texas 78701')).toBe('Austin, Texas')
    expect(awayCityFromAddress('Austin, Texas')).toBe('Texas')
    expect(awayCityFromAddress('Austin')).toBe('Austin')
    expect(awayCityFromAddress('')).toBeNull()
    expect(awayWhereWords('Kingsbury, TX')).toBe("We're in Kingsbury, TX")
  })
  it('makes the call and text links from the office line’s digits, and none without a number', () => {
    expect(awayCallHref('(512) 555-0142')).toBe('tel:+15125550142')
    expect(awayCallHref('(512) 555-0142', 'text')).toBe('sms:+15125550142')
    expect(awayCallHref('+44 20 7946 0958')).toBe('tel:+442079460958')
    expect(awayCallHref('555')).toBeNull()
    expect(awayCallHref(null)).toBeNull()
  })
  it('the hello, the help, the signature and the day’s alert', () => {
    expect(awayHello('Corinne')).toBe('See you soon, Corinne.')
    expect(awayHello(null)).toBe('See you soon.')
    expect(awayNoteHelp('Corinne')).toBe('Only Corinne sees this. Change it any time.')
    expect(awayNoteHelp('')).toBe('Only they see this. Change it any time.')
    expect(awayUpdatedWords('2026-12-02', '2026-12-02')).toBe('updated today')
    expect(awayUpdatedWords('2026-11-03', '2026-12-02')).toBe('updated Nov 3, 2026')
    expect(awayUpdatedWords(null, '2026-12-02')).toBe('updated today')
    expect(awayFromLine('2026-11-03', '2026-12-02')).toBe('The team · updated Nov 3, 2026')
    expect(awayAlertWords('Corinne Vela', '2026-11-03')).toEqual({ title: "Corinne Vela's countdown ended today.", sub: 'They left Nov 3, 2026.' })
    expect(awayAlertWords('  ', null)).toEqual({ title: "A teammate's countdown ended today.", sub: null })
  })
})

describe('the draft', () => {
  it('refuses a note that is too long, a day back that is not a date or not after today, and an alert with no day', () => {
    expect(awayNoteProblem(draft, '2026-12-02')).toBeNull()
    expect(awayNoteProblem({ ...draft, words: 'x'.repeat(AWAY_NOTE_WORDS_MAX + 1) }, '2026-12-02')).toMatch(/over 600 characters/)
    expect(awayNoteProblem({ ...draft, countdownYmd: 'soon' }, '2026-12-02')).toBe('The day back is not a date.')
    expect(awayNoteProblem({ ...draft, countdownYmd: '2026-12-02' }, '2026-12-02')).toBe('The day back has to be after today.')
    expect(awayNoteProblem({ ...draft, countdownYmd: null, alertOnDay: true }, '2026-12-02')).toMatch(/needs a day back/)
    expect(awayNoteProblem({ ...draft, countdownYmd: null }, '2026-12-02')).toBeNull()
  })
  it('is empty with no words, no countdown and both switches off; the default has the city and the call on and the alert off', () => {
    expect(awayNoteIsEmpty(AWAY_NOTE_DEFAULT)).toBe(false)
    expect(awayNoteIsEmpty({ words: '  ', countdownYmd: null, showWhere: false, showCall: false, alertOnDay: false })).toBe(true)
    expect(AWAY_NOTE_DEFAULT.alertOnDay).toBe(false)
  })
})

describe('the screen', () => {
  const base = { draft, firstName: 'Corinne', now: NOW, leftYmd: '2026-11-03', updatedYmd: '2026-11-03', todayYmd: '2026-12-02', office }
  it('draws the hello, the note signed by the team, the countdown with its bar, the city with the location press, and the call', () => {
    const s = buildAwayScreen(base)
    expect(s.hello).toBe('See you soon, Corinne.')
    expect(s.done).toBeNull()
    expect(s.letter).toEqual({ words: draft.words, from: 'The team · updated Nov 3, 2026' })
    expect(s.countdown).toMatchObject({ days: 1068, hours: 14, minutes: 32, head: "Until you're back", barPercent: 2.7, backOn: 'Back on Monday, Nov 5, 2029' })
    expect(s.where).toEqual({ city: 'Kingsbury, TX', words: "We're in Kingsbury, TX", ask: AWAY_WORDS.whereAsk, locate: 'Use my location', privacy: AWAY_WORDS.privacy, office: office.latLng })
    expect(s.call).toEqual({ label: 'Call the office', href: 'tel:+15125550142', textLabel: 'Text the office', textHref: 'sms:+15125550142' })
    expect(s.empty).toBeNull()
  })
  it('on the day, or with the preview’s switch, only the day-of words and the call remain', () => {
    const day = buildAwayScreen({ ...base, now: new Date(2029, 10, 5, 7, 0) })
    expect(day.done).toEqual({ title: "Today's the day.", sub: "Call the office and we'll open the app back up for you." })
    expect([day.hello, day.letter, day.countdown, day.where, day.empty]).toEqual([null, null, null, null, null])
    expect(day.call?.label).toBe('Call the office')
    const switched = buildAwayScreen({ ...base, onTheDay: true, draft: { ...draft, showCall: false } })
    expect(switched.done?.sub).toBe("We'll open the app back up for you.")
    expect(switched.call).toBeNull()
  })
  it('leaves out what is off or missing: no words, no countdown, no office address or line', () => {
    const s = buildAwayScreen({ ...base, draft: { ...draft, words: '', countdownYmd: null, showWhere: true, showCall: true }, office: { address: null, latLng: null, phone: null } })
    expect(s.letter).toBeNull()
    expect(s.countdown).toBeNull()
    expect(s.where).toBeNull()
    expect(s.call).toEqual({ label: 'Call the office', href: null, textLabel: 'Text the office', textHref: null })
    expect(s.empty).toBeNull()
  })
  it('with nothing on it rests on the one line, for the preview and the person alike', () => {
    const s = buildAwayScreen({ ...base, draft: { words: '', countdownYmd: null, showWhere: false, showCall: false, alertOnDay: false } })
    expect(s.hello).toBe('See you soon, Corinne.')
    expect(s.empty).toBe(AWAY_WORDS.empty)
    expect([s.letter, s.countdown, s.where, s.call]).toEqual([null, null, null, null])
  })
})
