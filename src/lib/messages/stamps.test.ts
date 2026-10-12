import { describe, expect, it } from 'vitest'
import { contactById } from '../contacts/kernel'
import { plainWordsFailures } from '../plainWords'
import { DEMO_CONTACTS, DEMO_MESSAGES, DEMO_NOW } from './messagesDemo'
import { agoMark, stampCalendar, stampFull, stampPair, stampSentence, stampShort, verbOf } from './stamps'
import type { ThreadMessage } from './thread'

const msg = (id: string): ThreadMessage => DEMO_MESSAGES.find((m) => m.id === id)!
const sentence = (id: string, goesBy: string | null = null) => stampSentence({ ...contactById(DEMO_CONTACTS, id)!, goesBy }, DEMO_MESSAGES, id, DEMO_NOW)

describe('Them · Us, the header’s stamps', () => {
  it('keeps today’s time, gives an older one its date and the (+N) mark', () => {
    expect(stampShort(msg('4').at, DEMO_NOW)).toBe('today · 8:44 AM')
    expect(stampShort(msg('2').at, DEMO_NOW)).toBe('Sep 30')
    expect(stampShort('2025-09-05T15:00:00.000Z', DEMO_NOW)).toBe('Sep 5, 2025')
    expect(agoMark(msg('2').at, DEMO_NOW)).toBe('(+2)')
    expect(agoMark(msg('4').at, DEMO_NOW)).toBe('')
  })

  it('reads Greg’s block: his email this morning, our text on Wednesday', () => {
    const { them, us } = stampPair(DEMO_MESSAGES, 'greg', DEMO_NOW)
    expect(them).toMatchObject({ message: { id: '16' }, words: 'email · today · 11:30 AM', mark: '' })
    expect(us).toMatchObject({ message: { id: '2' }, words: 'text · Sep 30', mark: '(+2)' })
    expect(stampPair(DEMO_MESSAGES, 'jonah', DEMO_NOW).us).toBeNull()
  })

  it('writes the hover card’s line in full, with how many days ago', () => {
    expect(stampFull(msg('1'), DEMO_NOW)).toBe('call · Sat, Sep 26 · 12:00 AM · 6 days ago')
    expect(stampFull(msg('5'), DEMO_NOW)).toBe('call · Thu, Oct 1 · 3:10 PM · yesterday')
    expect(stampFull(msg('4'), DEMO_NOW)).toBe('text · today · 8:44 AM')
  })
})

describe('the stamps as sentences (the folded header)', () => {
  it('puts the newer side first, the channel as the verb and the when in words', () => {
    expect(sentence('priya').text).toBe('Dr. Raman texted last Saturday. We emailed two weeks ago.')
    expect(sentence('priya', 'Priya').text).toBe('Priya texted last Saturday. We emailed two weeks ago.')
    expect(sentence('greg').text).toBe('Greg emailed today at 11:30 AM. We texted on Wednesday.')
    expect(sentence('bill').text).toBe('We texted today at 8:02 AM. Bill texted today at 7:58 AM.')
    expect(sentence('marcus').text).toBe('Marcus texted on Tuesday. We emailed last week.')
  })

  it('says a missed call left no voicemail, and who has not written yet', () => {
    expect(sentence('elena').text).toBe('Elena called today at 10:05 AM, no voicemail. We emailed yesterday.')
    expect(sentence('tom').text).toBe('We texted on Wednesday. Tom has not written yet.')
    expect(sentence('jonah').text).toBe('Jonah emailed today at 10:48 AM. We have not written yet.')
  })

  it('a number nobody has named reads they, never a guessed name', () => {
    expect(sentence('unk1').text).toBe('They texted today at 9:12 AM. We have not written yet.')
  })

  it('marks the when strong for the bold, and every sentence passes the plain-words rule', () => {
    expect(sentence('priya').sentences[0]).toEqual([{ text: 'Dr. Raman texted ' }, { text: 'last Saturday', strong: true }, { text: '.' }])
    for (const c of DEMO_CONTACTS) expect(plainWordsFailures(sentence(c.id).text)).toEqual([])
  })

  it('a portal line or anything else from them reads wrote', () => {
    expect(verbOf({ channel: 'portal' })).toBe('wrote')
    expect(verbOf({ channel: 'voicemail' })).toBe('left a voicemail')
  })
})

describe('the calendar on the stamps’ hover card', () => {
  const days = (id: string) =>
    (stampCalendar(DEMO_MESSAGES, id, DEMO_NOW) ?? []).flatMap((w) => w.days).filter((d) => d.tone || d.note || d.today)

  it('draws Sunday-to-Saturday weeks from the first line to the end of this week', () => {
    const weeks = stampCalendar(DEMO_MESSAGES, 'greg', DEMO_NOW)!
    expect(weeks.map((w) => w.label)).toEqual(['Sep 20 – 26', 'Sep 27 – Oct 3 · this week'])
    expect(weeks.map((w) => w.thisWeek)).toEqual([false, true])
    expect(weeks.every((w) => w.days.length === 7)).toBe(true)
    expect(weeks[1]!.days.map((d) => d.future)).toEqual([false, false, false, false, false, false, true])
  })

  it('colors a day by who wrote and counts the lines', () => {
    expect(days('greg')).toEqual([
      { ymd: '2026-09-26', tone: 'them', note: false, today: false, future: false, count: 1 },
      { ymd: '2026-09-30', tone: 'us', note: false, today: false, future: false, count: 1 },
      { ymd: '2026-10-02', tone: 'them', note: false, today: true, future: false, count: 3 },
    ])
    expect(days('bill')).toEqual([{ ymd: '2026-10-02', tone: 'both', note: false, today: true, future: false, count: 2 }])
  })

  it('marks a team note’s day and leaves an event out', () => {
    expect(days('priya').filter((d) => d.ymd === '2026-09-26')).toEqual([{ ymd: '2026-09-26', tone: 'them', note: true, today: false, future: false, count: 1 }])
    expect(stampCalendar(DEMO_MESSAGES, 'priya', DEMO_NOW)!.map((w) => w.label)).toEqual(['Sep 13 – 19', 'Sep 20 – 26', 'Sep 27 – Oct 3 · this week'])
    expect(days('marcus').filter((d) => d.ymd === '2026-09-29')).toEqual([{ ymd: '2026-09-29', tone: 'them', note: false, today: false, future: false, count: 1 }])
  })

  it('reaches back six weeks at most, and draws nothing for nobody', () => {
    const june: ThreadMessage = { ...msg('4'), id: 'june', at: '2026-06-01T15:00:00.000Z' }
    const weeks = stampCalendar([...DEMO_MESSAGES, june], 'greg', DEMO_NOW)!
    expect(weeks).toHaveLength(7)
    expect(weeks[0]!.label).toBe('Aug 16 – 22')
    expect(stampCalendar(DEMO_MESSAGES, 'nobody', DEMO_NOW)).toBeNull()
  })
})
