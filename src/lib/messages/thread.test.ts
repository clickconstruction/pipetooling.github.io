import { describe, expect, it } from 'vitest'
import { DEMO_MESSAGES, DEMO_NOW } from './messagesDemo'
import {
  agoWords,
  callLength,
  channelWord,
  clockTime,
  courtOf,
  dayLabel,
  fullWhen,
  isLong,
  lastIn,
  lastMessage,
  lastOut,
  lineWhen,
  snippetOf,
  threadOf,
  threadRows,
  whenWords,
  type ThreadMessage,
} from './thread'

const msg = (id: string): ThreadMessage => DEMO_MESSAGES.find((m) => m.id === id)!
/** A Chicago wall time in October 2026 or September 2026 (CDT, five hours behind UTC). */
const cdt = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00-05:00`).toISOString()

describe('the when, in Chicago', () => {
  it('reads a line’s time and day as the office’s clock does', () => {
    expect(DEMO_NOW).toBe('2026-10-02T16:45:00.000Z')
    expect(clockTime(msg('4').at)).toBe('8:44 AM')
    expect(clockTime(msg('1').at)).toBe('12:00 AM')
    expect(lineWhen(msg('4').at, DEMO_NOW)).toBe('today · 8:44 AM')
    expect(lineWhen(msg('5').at, DEMO_NOW)).toBe('Thu, Oct 1 · 3:10 PM')
    expect(fullWhen(msg('4').at)).toBe('Friday, October 2, 2026 at 8:44 AM')
  })

  it('names the day dividers, with the year only when it is not this one', () => {
    expect(dayLabel(DEMO_NOW, DEMO_NOW)).toBe('Today, Fri Oct 2')
    expect(dayLabel(msg('2').at, DEMO_NOW)).toBe('Wednesday, Sep 30')
    expect(dayLabel(cdt('2025-12-31', '09:00'), DEMO_NOW)).toBe('Wednesday, Dec 31, 2025')
  })

  it('says the when in words, weeks starting on Sunday', () => {
    const words = (ymd: string, hm = '09:00') => whenWords(cdt(ymd, hm), DEMO_NOW)
    expect(words('2026-10-02', '08:44')).toBe('today at 8:44 AM')
    expect(words('2026-10-01')).toBe('yesterday')
    expect(words('2026-09-30')).toBe('on Wednesday')
    expect(words('2026-09-27')).toBe('on Sunday')
    expect(words('2026-09-26')).toBe('last Saturday')
    expect(words('2026-09-25')).toBe('last week')
    expect(words('2026-09-19')).toBe('two weeks ago')
    expect(words('2026-09-12')).toBe('three weeks ago')
    expect(words('2026-09-05')).toBe('on Sep 5')
    expect(words('2025-09-05')).toBe('on Sep 5, 2025')
  })

  it('a Sunday belongs to its own week: the prototype read last week’s Sunday as two weeks ago', () => {
    expect(whenWords(cdt('2026-09-20', '10:00'), DEMO_NOW)).toBe('last week')
    expect(whenWords(cdt('2026-09-13', '10:00'), DEMO_NOW)).toBe('two weeks ago')
    expect(whenWords(cdt('2026-09-06', '10:00'), DEMO_NOW)).toBe('three weeks ago')
  })

  it('a late evening in Chicago is still that day, though it is the next day in UTC', () => {
    const lateLastNight = cdt('2026-10-01', '23:30')
    expect(lateLastNight.startsWith('2026-10-02')).toBe(true)
    expect(whenWords(lateLastNight, DEMO_NOW)).toBe('yesterday')
    expect(dayLabel(lateLastNight, DEMO_NOW)).toBe('Thursday, Oct 1')
  })

  it('says how long ago, short', () => {
    expect(agoWords(msg('16').at, DEMO_NOW)).toBe('15 min')
    expect(agoWords(msg('11').at, DEMO_NOW)).toBe('4 h')
    expect(agoWords(msg('8').at, DEMO_NOW)).toBe('6 d')
    expect(agoWords(DEMO_NOW, DEMO_NOW)).toBe('1 min')
  })
})

describe('a line’s words', () => {
  it('shows an email’s subject, else its first line, and a missed call as no voicemail', () => {
    expect(snippetOf(msg('16'))).toBe('Hillside sitework, Boerne, rev 1')
    expect(snippetOf(msg('7'))).toBe('Pay application 3 for Fair Oaks Shops, Building D, $4,536. Opened at 3:12 PM.')
    expect(snippetOf(msg('6'))).toBe('no voicemail')
    expect(snippetOf(msg('4'))).toBe(msg('4').body)
    expect(channelWord(msg('6'))).toBe('Missed call')
    expect(channelWord(msg('15'))).toBe('Voicemail')
  })

  it('writes a call’s length from its seconds', () => {
    expect(callLength(msg('1').durationSeconds!)).toBe('4:12')
    expect(callLength(msg('3').durationSeconds!)).toBe('0:38')
    expect(callLength(3725)).toBe('1:02:05')
    expect(callLength(-3)).toBe('0:00')
  })

  it('folds a long email to four lines and leaves a text whole', () => {
    expect(isLong(msg('13'))).toBe(true)
    expect(isLong(msg('16'))).toBe(true)
    expect(isLong(msg('4'))).toBe(false)
  })
})

describe('the last word each way', () => {
  it('reads their newest and ours, a team note neither', () => {
    expect(lastIn(DEMO_MESSAGES, 'greg')?.id).toBe('16')
    expect(lastOut(DEMO_MESSAGES, 'greg')?.id).toBe('2')
    expect(lastIn(DEMO_MESSAGES, 'priya')?.id).toBe('8')
    expect(lastOut(DEMO_MESSAGES, 'priya')?.id).toBe('17')
    expect(lastOut(DEMO_MESSAGES, 'jonah')).toBeUndefined()
    // The newest line either way: Priya's team note counts, Marcus's event does not.
    expect(lastMessage(DEMO_MESSAGES, 'priya')?.id).toBe('9')
    expect(lastMessage(DEMO_MESSAGES, 'marcus')?.id).toBe('19')
  })
})

describe('whose move it is (the prototype’s courtOf)', () => {
  it('reads the demo people as the prototype’s strip does', () => {
    const court = (id: string) => courtOf(DEMO_MESSAGES, id, DEMO_NOW).word
    expect(court('greg')).toBe('Our move · 15 min')
    expect(court('elena')).toBe('Our move · 2 h')
    expect(court('priya')).toBe('Our move · 6 d')
    expect(court('bill')).toBe('Their move · 4 h')
    expect(court('tom')).toBe('Their move · 2 d')
    expect(court('jonah')).toBe('Our move · 57 min')
    expect(court('marcus')).toBe('Our move · 3 d')
    expect(court('unk1')).toBe('Our move · 3 h')
    expect(courtOf(DEMO_MESSAGES, 'nobody', DEMO_NOW)).toEqual({ side: 'none', word: 'no messages yet' })
  })

  it('counts from the word that set it', () => {
    expect(courtOf(DEMO_MESSAGES, 'greg', DEMO_NOW)).toEqual({ side: 'ours', word: 'Our move · 15 min', sinceIso: msg('16').at })
    expect(courtOf(DEMO_MESSAGES, 'bill', DEMO_NOW)).toEqual({ side: 'theirs', word: 'Their move · 4 h', sinceIso: msg('11').at })
  })

  it('a team note moves nothing', () => {
    const noteLater: ThreadMessage = { ...msg('9'), id: 'n', at: DEMO_NOW }
    expect(courtOf([...DEMO_MESSAGES, noteLater], 'priya', DEMO_NOW).word).toBe('Our move · 6 d')
  })

  it('what we owe keeps it ours, a promised day runs their move, and a closed door is no move', () => {
    expect(courtOf(DEMO_MESSAGES, 'priya', DEMO_NOW, { owed: { what: 'the start date', by: 'Mon Oct 5' } })).toEqual({
      side: 'ours',
      word: 'Our move · we owe the start date · by Mon Oct 5',
      owed: true,
    })
    expect(courtOf(DEMO_MESSAGES, 'priya', DEMO_NOW, { owed: { what: 'the start date' } }).word).toBe('Our move · we owe the start date')
    expect(courtOf(DEMO_MESSAGES, 'bill', DEMO_NOW, { promisedUntil: 'until Wed Oct 7 · quote' }).word).toBe('Their move · until Wed Oct 7 · quote')
    // A promise only runs their move: when the last word is theirs, it is ours whatever they promised.
    expect(courtOf(DEMO_MESSAGES, 'greg', DEMO_NOW, { promisedUntil: 'until Wed Oct 7 · quote' }).word).toBe('Our move · 15 min')
    expect(courtOf(DEMO_MESSAGES, 'greg', DEMO_NOW, { optedOut: true })).toEqual({ side: 'none', word: 'opted out' })
  })
})

describe('the thread’s rows (the loop in renderMessages)', () => {
  const rows = (lines: ThreadMessage[]) =>
    threadRows(lines, DEMO_NOW).map((r) => (r.kind === 'day' ? `— ${r.label}` : r.kind === 'event' ? `event ${r.message.id} ${r.time}` : `${r.message.id} ${r.job}`))

  it('puts a divider at each new day and a repeated job within a day as its number alone', () => {
    expect(rows(threadOf(DEMO_MESSAGES, 'greg'))).toEqual([
      '— Saturday, Sep 26',
      '1 full',
      '— Wednesday, Sep 30',
      '2 full',
      '— Today, Fri Oct 2',
      '3 full',
      '4 number',
      '16 number',
    ])
  })

  it('names the job again when it changes, and on the first line of each day', () => {
    expect(rows(threadOf(DEMO_MESSAGES, 'elena'))).toEqual(['— Thursday, Oct 1', '5 full', '7 full', '— Today, Fri Oct 2', '15 full', '6 full'])
  })

  it('draws an event as its gray line with its time, and an event never breaks a run of one job', () => {
    const later: ThreadMessage = { ...msg('19'), id: '19b', at: cdt('2026-09-29', '17:30') }
    expect(rows([...threadOf(DEMO_MESSAGES, 'marcus'), later])).toEqual([
      '— Monday, Sep 21',
      '18 full',
      '— Tuesday, Sep 29',
      '19 full',
      'event 20 5:05 PM',
      '19b number',
    ])
  })

  it('a line on the person, no job, breaks the run', () => {
    const untied: ThreadMessage = { ...msg('4'), id: '4b', jobId: null, at: cdt('2026-10-02', '09:00') }
    expect(rows([...threadOf(DEMO_MESSAGES, 'greg'), untied]).slice(4)).toEqual(['— Today, Fri Oct 2', '3 full', '4 number', '4b none', '16 full'])
  })

  it('a job’s filter keeps only the lines tied to it', () => {
    expect(threadOf(DEMO_MESSAGES, 'elena', 'fairoaks').map((m) => m.id)).toEqual(['7', '15'])
    expect(threadOf(DEMO_MESSAGES, 'elena').map((m) => m.id)).toEqual(['5', '7', '15', '6'])
  })
})
