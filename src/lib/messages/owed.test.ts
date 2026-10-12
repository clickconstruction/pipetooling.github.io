import { describe, expect, it } from 'vitest'
import { DEMO_FOLLOW_UP_CONTACTS, DEMO_NOW, DEMO_OUR_STEPS, DEMO_OWED, DEMO_TODAY } from '../followUp/followUpDemo'
import { plainWordsFailures } from '../plainWords'
import {
  afterSendDefault,
  afterSendResult,
  afterSendTips,
  afterSendWords,
  dayChips,
  dayKept,
  dayLabel,
  exactStamp,
  markedByTip,
  markedByWords,
  markItTip,
  nextMonday,
  nextWorkday,
  OWED_DONE_NEEDS_A_NOTE,
  OWED_DONE_TOAST,
  OWED_FLOW_EMPTY,
  OWED_USUAL,
  owedDay,
  owedDayChangedLine,
  owedDayToast,
  owedDoneChip,
  owedDoneHeader,
  owedFlowHead,
  owedForMove,
  owedMarkedLine,
  owedMarkedToast,
  owedPill,
  owedSentDoneLine,
  owedSentence,
  owedWhatChangedLine,
  owedWhatOptions,
  owedWhatToast,
  readDay,
  readDayEcho,
  sendOwedLabel,
  type Owed,
} from './owed'

const person = (id: string) => DEMO_FOLLOW_UP_CONTACTS.find((c) => c.id === id)!
const priyaOwes: Owed = DEMO_OWED[0]!
const greg = person('greg')
const plans: Owed = { what: 'the plans or an addendum', byYmd: '2026-10-05', byWords: null, markedBy: 'Robert', markedAt: DEMO_NOW }
const inWords: Owed = { ...plans, byYmd: null, byWords: 'after the Board meets' }
const noDay: Owed = { ...plans, byYmd: null }

/** The day `text` reads as from the prototype's Friday, as its date. */
const read = (text: string, today = DEMO_TODAY) => readDay(text, today)?.ymd

describe('day words', () => {
  it('writes a day as the app writes it', () => {
    expect(dayLabel('2026-10-02')).toBe('Fri Oct 2')
    expect(dayLabel('2027-01-05')).toBe('Tue Jan 5')
    expect(exactStamp('2026-09-26T19:30:00.000Z')).toBe('Sat Sep 26, 2:30 PM')
  })

  it('offers the next six days by name, then a week and two weeks out (v1.64)', () => {
    const chips = dayChips(DEMO_TODAY)
    expect(chips.map((c) => c.top)).toEqual(['Tomorrow', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'A week', 'Two weeks'])
    expect(chips.map((c) => c.label)).toEqual(['Sat Oct 3', 'Sun Oct 4', 'Mon Oct 5', 'Tue Oct 6', 'Wed Oct 7', 'Thu Oct 8', 'Fri Oct 9', 'Fri Oct 16'])
    expect(chips[0]).toEqual({ top: 'Tomorrow', sub: 'Oct 3', label: 'Sat Oct 3', ymd: '2026-10-03' })
  })

  it('reads a weekday as the coming one, never today', () => {
    expect(read('today')).toBe('2026-10-02')
    expect(read('Tomorrow')).toBe('2026-10-03')
    expect(read('Monday')).toBe('2026-10-05')
    expect(read('mon')).toBe('2026-10-05')
    expect(read('Friday')).toBe('2026-10-09')
    expect(read('this Thursday')).toBe('2026-10-08')
  })

  it('reads next Monday as the coming Monday, and the Monday after next a week on (the lead, 2026-10-12)', () => {
    expect(read('next Monday')).toBe('2026-10-05')
    expect(read('next Friday')).toBe('2026-10-09')
    expect(read('the Monday after next')).toBe('2026-10-12')
    expect(read('Monday after next')).toBe('2026-10-12')
  })

  it('reads a span of days or weeks', () => {
    expect(read('in two weeks')).toBe('2026-10-16')
    expect(read('in 3 days')).toBe('2026-10-05')
    expect(read('a week')).toBe('2026-10-09')
    expect(read('next week')).toBe('2026-10-09')
  })

  it('reads a month and a day as this year, or next year once it has passed', () => {
    expect(read('Oct 16')).toBe('2026-10-16')
    expect(read('Fri Oct 16')).toBe('2026-10-16')
    expect(read('October 16th')).toBe('2026-10-16')
    expect(read('Oct. 2')).toBe('2026-10-02')
    expect(read('Sep 1')).toBe('2027-09-01')
    expect(read('Jan 5', '2026-12-30')).toBe('2027-01-05')
    expect(read('Oct 16, 2027')).toBe('2027-10-16')
  })

  it('reads a date in numbers', () => {
    expect(read('10/16')).toBe('2026-10-16')
    expect(read('1/5')).toBe('2027-01-05')
    expect(read('10/16/27')).toBe('2027-10-16')
    expect(read('2026-11-03')).toBe('2026-11-03')
  })

  it('reads a day of the month as the next one, the way a voicemail says it', () => {
    expect(read('the 7th')).toBe('2026-10-07')
    expect(read('Wednesday the 7th')).toBe('2026-10-07')
    expect(read('the 1st')).toBe('2026-11-01')
    expect(read('the 31st', '2026-11-15')).toBe('2026-12-31')
  })

  it('keeps anything else as typed, with no date, and never refuses it', () => {
    expect(readDay('after the Board meets', DEMO_TODAY)).toEqual({ label: 'after the Board meets', ymd: null, known: false })
    expect(readDay('Feb 30', DEMO_TODAY)).toEqual({ label: 'Feb 30', ymd: null, known: false })
    expect(read('monster')).toBeNull()
    expect(read('octopus 5')).toBeNull()
    expect(readDay('   ', DEMO_TODAY)).toBeNull()
  })

  it('reads the typed day back as it is typed', () => {
    expect(readDayEcho('Oct 20', DEMO_TODAY)).toBe('Reads as Tue Oct 20. Press Enter.')
    expect(readDayEcho('when Plumbing is awarded', DEMO_TODAY)).toBe('Cannot read that as a day. Enter keeps it as typed.')
    expect(readDayEcho('', DEMO_TODAY)).toBe('')
  })

  it('keeps a day as a date, or as the words when it is not one', () => {
    expect(dayKept(readDay('Monday', DEMO_TODAY))).toEqual({ ymd: '2026-10-05', words: null })
    expect(dayKept(readDay('after the Board meets', DEMO_TODAY))).toEqual({ ymd: null, words: 'after the Board meets' })
    expect(dayKept(null)).toEqual({ ymd: null, words: null })
  })

  it('puts a row off to the coming Monday, and a note to the next working day', () => {
    expect(nextMonday('2026-10-02')).toBe('2026-10-05')
    expect(nextMonday('2026-10-04')).toBe('2026-10-05')
    expect(nextMonday('2026-10-05')).toBe('2026-10-12')
    expect(nextWorkday('2026-10-02')).toBe('2026-10-05')
    expect(nextWorkday('2026-10-03')).toBe('2026-10-05')
    expect(nextWorkday('2026-10-04')).toBe('2026-10-05')
    expect(nextWorkday('2026-10-06')).toBe('2026-10-07')
  })
})

describe('what we owe, in words', () => {
  it('says it as the strip above the reply box', () => {
    expect(owedSentence(person('priya'), priyaOwes)).toBe('We owe Dr. Raman the start date by Mon Oct 5')
    expect(owedSentence(greg, inWords)).toBe('We owe Greg the plans or an addendum, after the Board meets')
    expect(owedSentence(greg, noDay)).toBe('We owe Greg the plans or an addendum')
    expect(owedSentence(person('unk1'), { what: 'a call back', byYmd: null, byWords: null })).toBe('We owe them a call back')
  })

  it('reads on a row as a pill, and a day in words says it has no day', () => {
    expect(owedPill(priyaOwes)).toBe('we owe the start date · by Mon Oct 5')
    expect(owedPill(inWords)).toBe('we owe the plans or an addendum · after the Board meets · no day')
    expect(owedPill(noDay)).toBe('we owe the plans or an addendum')
    expect(owedDay(inWords)).toEqual({ label: 'after the Board meets', dated: false })
    expect(owedDay(noDay)).toBeNull()
  })

  it('hands the move line the what, and the day when it is a date', () => {
    expect(owedForMove(priyaOwes)).toEqual({ what: 'the start date', by: 'Mon Oct 5' })
    expect(owedForMove(inWords)).toEqual({ what: 'the plans or an addendum', by: null })
  })

  it('says who marked it and when, small, with the exact stamp on its hover', () => {
    expect(markedByWords(priyaOwes, DEMO_NOW)).toBe('Rosa, last Saturday')
    expect(markedByWords({ markedBy: 'Robert', markedAt: '2026-10-02T14:14:00.000Z' }, DEMO_NOW)).toBe('Robert, today, 9:14 AM')
    expect(markedByTip(priyaOwes, DEMO_NOW)).toEqual({
      title: 'Marked by Rosa',
      does: 'Sat Sep 26, 2:30 PM · 6 days ago',
      changes: 'What we owe and its day can be changed with Change what we owe, or the day.',
    })
  })

  it('names the strip’s send press after the person and what we owe', () => {
    expect(sendOwedLabel(person('priya'), priyaOwes)).toBe('Send Dr. Raman the start date')
  })

  it('says on Mark it what is missing', () => {
    expect(markItTip(greg, { what: '', day: { ymd: null, words: null } })).toEqual({
      title: 'Mark it',
      does: 'Writes what we owe Greg.',
      changes: 'Say what first. The day is optional. It stays our move until it is done. Follow up lists it under We owe them.',
    })
    expect(markItTip(greg, { what: 'the plans', day: { ymd: '2026-10-05', words: null } }).does).toBe('Writes what we owe Greg and by when.')
  })
})

describe('owedWhatOptions: the what blank’s list (owed-blanks-mockups.html)', () => {
  it('lists the flow’s our-move steps first, then the usual asks', () => {
    expect(owedWhatOptions('customer', DEMO_OUR_STEPS.customer)).toEqual({
      flow: ['our bid', 'the start date', 'the day we are on site', 'the closeout papers', 'the warranty papers'],
      usual: ['a pay application', 'a change order’s price', 'an answer to their question', 'a call back'],
    })
    expect(owedWhatOptions('trade', DEMO_OUR_STEPS.trade).flow).toEqual(['the invitation', 'our decision on their quote'])
  })

  it('says an architect’s flow holds nothing of ours, and an unknown number is owed a call back only', () => {
    expect(owedWhatOptions('arch', DEMO_OUR_STEPS.arch)).toEqual({ flow: [], usual: [...OWED_USUAL.arch] })
    expect(owedWhatOptions('unknown', DEMO_OUR_STEPS.unknown)).toEqual({ flow: [], usual: ['a call back'] })
    expect([owedFlowHead('arch'), OWED_FLOW_EMPTY]).toEqual(['From the architect flow', 'nothing of ours in their flow'])
  })

  it('names a step with no words of its own after the step, and never lists a usual ask twice', () => {
    expect(owedWhatOptions('customer', [{ name: 'Punch walk' }, { name: 'Call', owedWords: 'a call back' }])).toEqual({
      flow: ['the punch walk', 'a call back'],
      usual: ['a pay application', 'a change order’s price', 'an answer to their question'],
    })
  })
})

describe('the thread’s event lines and what the office reads', () => {
  it('writes a gray line for every change', () => {
    expect(owedMarkedLine('Robert', 'Greg Paulk', plans)).toBe('Robert marked that we owe Greg Paulk the plans or an addendum by Mon Oct 5.')
    expect(owedMarkedLine('Robert', 'Greg Paulk', inWords)).toBe('Robert marked that we owe Greg Paulk the plans or an addendum, after the Board meets.')
    expect(owedWhatChangedLine('Rosa', 'Dr. Priya Raman', priyaOwes, 'a call back')).toBe('Rosa changed what we owe Dr. Priya Raman: the start date, not a call back, by Mon Oct 5.')
    expect(owedDayChangedLine('Robert', 'Dr. Priya Raman', { ...priyaOwes, byYmd: '2026-10-12' })).toBe('Robert set the day we owe Dr. Priya Raman the start date to Mon Oct 12.')
    expect(owedDayChangedLine('Robert', 'Dr. Priya Raman', { ...priyaOwes, byYmd: null })).toBe('Robert set the day we owe Dr. Priya Raman the start date to no day.')
    expect(owedSentDoneLine('Robert', priyaOwes)).toBe('Robert sent the start date. It is done.')
  })

  it('heads the note that marks it done, and chips it', () => {
    expect(owedDoneHeader(priyaOwes)).toBe('Marking it done: we owed the start date · by Mon Oct 5')
    expect(owedDoneHeader(inWords)).toBe('Marking it done: we owed the plans or an addendum · after the Board meets')
    expect(owedDoneChip(priyaOwes)).toBe('✓ done: the start date')
  })

  it('says what changed in one short sentence', () => {
    expect(owedMarkedToast('Greg Paulk', plans)).toBe('Marked: we owe Greg Paulk the plans or an addendum.')
    expect(owedWhatToast('Greg Paulk', plans)).toBe('We owe Greg Paulk the plans or an addendum now.')
    expect([owedDayToast(plans), owedDayToast(inWords), owedDayToast(noDay)]).toEqual(['By Mon Oct 5.', 'No day. Kept as typed: after the Board meets.', 'No day set.'])
  })
})

describe('After this sends (v1.83)', () => {
  it('lights our move while something is owed, theirs when nothing is', () => {
    expect(afterSendDefault(priyaOwes)).toBe('ours')
    expect(afterSendDefault(null)).toBe('theirs')
  })

  it('says what each choice means, and leaves the two blanks when nothing is owed', () => {
    expect(afterSendWords(priyaOwes, 'theirs')).toBe('This message gets the start date done.')
    expect(afterSendWords(priyaOwes, 'ours')).toBe('We still owe the start date by Mon Oct 5.')
    expect(afterSendWords(null, 'theirs')).toBe('Nothing is on us.')
    expect(afterSendWords(null, 'ours')).toBeNull()
  })

  it('marks it done, keeps it, or marks a new one from the blanks', () => {
    expect(afterSendResult(priyaOwes, 'theirs')).toBe('done')
    expect(afterSendResult(priyaOwes, 'ours')).toBe('keep')
    expect(afterSendResult(null, 'ours', { what: 'the plans' })).toBe('mark')
    expect(afterSendResult(null, 'ours', { what: '  ' })).toBe('none')
    expect(afterSendResult(null, 'theirs')).toBe('none')
  })
})

describe('plain words', () => {
  it('holds every sentence to the rules', () => {
    const tips = [afterSendTips(priyaOwes), afterSendTips(null)].flatMap((t) => [t.theirs, t.ours]).flatMap((t) => [t.does, t.changes])
    const sentences = [
      ...tips,
      ...[priyaOwes, plans, inWords, noDay].flatMap((o) => [
        owedMarkedLine('Robert', 'Dr. Priya Raman', o),
        owedWhatChangedLine('Robert', 'Dr. Priya Raman', o, 'a call back'),
        owedDayChangedLine('Robert', 'Dr. Priya Raman', o),
        owedDayToast(o),
        afterSendWords(o, 'theirs')!,
        afterSendWords(o, 'ours')!,
      ]),
      owedSentDoneLine('Robert', priyaOwes),
      markItTip(greg, { what: '', day: { ymd: null, words: null } }).changes,
      markedByTip(priyaOwes, DEMO_NOW).changes,
      readDayEcho('Oct 20', DEMO_TODAY),
      readDayEcho('when Plumbing is awarded', DEMO_TODAY),
      OWED_DONE_NEEDS_A_NOTE,
      OWED_DONE_TOAST,
    ]
    expect(sentences.flatMap(plainWordsFailures)).toEqual([])
  })
})
