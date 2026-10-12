import { describe, expect, it } from 'vitest'
import { DEMO_FOLLOW_UP_CONTACTS, DEMO_HEARD, DEMO_JOB_NAMES, DEMO_TODAY } from '../followUp/followUpDemo'
import { plainWordsFailures } from '../plainWords'
import {
  ASKED_ARCHITECT_TOAST,
  askArchitectNote,
  heardDay,
  heardDayButton,
  JUST_TALK,
  promiseChoices,
  promiseChoiceTip,
  notAPromiseWords,
  askedLineWords,
  answeringLineWords,
  writtenLineWords,
  promiseOfferWords,
  promiseWord,
  promiseWrittenWords,
  rowOffers,
  runningPromise,
  writtenWhat,
  type HeardLine,
} from './promises'

const person = (id: string) => DEMO_FOLLOW_UP_CONTACTS.find((c) => c.id === id)!

describe('promiseChoices: what a heard day could be a promise of, by who they are (v1.7)', () => {
  it('offers a trade partner their quote first, then a start or delivery, then their papers', () => {
    const choices = promiseChoices(person('greg'), DEMO_JOB_NAMES.boerne!)
    expect(choices.map((c) => [c.label, c.tag, c.target])).toEqual([
      ['Their quote', 'Board', 'boardAsk'],
      ['A start or delivery', 'Schedule', 'tradePromise'],
      ['Insurance or W-9', 'Papers', 'tradePromise'],
    ])
    expect(choices.map((c) => c.what)).toEqual([
      'Hillside Excavation’s Sitework quote for Boerne Retail Shell',
      'Hillside Excavation’s start or delivery on Boerne Retail Shell',
      'Hillside Excavation’s insurance or W-9',
    ])
  })

  it('writes the first of a double kind, and says which (the lead, 2026-10-12)', () => {
    const [, start, papers] = promiseChoices(person('greg'), DEMO_JOB_NAMES.boerne!)
    expect(start!.writes).toEqual({ kind: 'start', other: 'delivery', what: 'Hillside Excavation’s start on Boerne Retail Shell' })
    expect(papers!.writes).toEqual({ kind: 'insurance', other: 'w9', what: 'Hillside Excavation’s insurance' })
    expect(writtenWhat(start!)).toBe('Hillside Excavation’s start on Boerne Retail Shell')
    expect([promiseWord(start!), promiseWord(papers!)]).toEqual(['start', 'insurance'])
  })

  it('offers a customer a payment first, then their answer on our bid, then a day on site', () => {
    const choices = promiseChoices(person('elena'), DEMO_JOB_NAMES.fairoaks!)
    expect(choices.map((c) => [c.label, c.tag, c.what])).toEqual([
      ['A payment', 'Pipeline', 'a payment on Fair Oaks Shops, Building D'],
      ['Their answer on our bid', 'Bid', 'their answer on our bid for Fair Oaks Shops, Building D'],
      ['A day we can be on site', 'Schedule', 'a day we can be on site at Fair Oaks Shops, Building D'],
    ])
    expect(choices.every((c) => !c.writes)).toBe(true)
  })

  it('offers an architect their answer or the certificate', () => {
    const choices = promiseChoices(person('jonah'), DEMO_JOB_NAMES.boerne!)
    expect(choices.map((c) => [c.label, c.tag, c.target])).toEqual([
      ['Their answer', 'Plan question', 'planQuestion'],
      ['The certificate', 'Pay app', 'payAppCertificate'],
    ])
  })

  it('names a trade partner with no company by their first name, and a number nobody named as their', () => {
    expect(promiseChoices({ kind: 'trade', name: 'Dee Alvarez', company: '' }, null)[0]!.what).toBe('Dee’s quote for a job')
    expect(promiseChoices(person('unk1'), DEMO_JOB_NAMES.padb!)[0]!.what).toBe('their quote for Boerne Retail Pad B')
  })
})

describe('the offer line and the written line', () => {
  it('reads the day, then its choices, then just talk', () => {
    expect(promiseOfferWords('Wed Oct 7')).toBe('Wed Oct 7 is a promise of')
    expect(JUST_TALK).toBe('just talk')
    expect(promiseChoiceTip(promiseChoices(person('greg'), 'Boerne Retail Shell')[0]!, 'Wed Oct 7')).toBe(
      'Writes down Hillside Excavation’s Sitework quote for Boerne Retail Shell by Wed Oct 7. Their move runs until that day.',
    )
  })

  it('repeats exactly what once written, the one kind of a double, and claims no place it is not written (the lead, 2026-10-12)', () => {
    const [quote, start] = promiseChoices(person('greg'), DEMO_JOB_NAMES.boerne!)
    expect(promiseWrittenWords(quote!, 'Wed Oct 7')).toBe('Written down. Hillside Excavation’s Sitework quote for Boerne Retail Shell by Wed Oct 7.')
    expect(promiseWrittenWords(start!, 'Wed Oct 7')).toBe('Written down. Hillside Excavation’s start on Boerne Retail Shell by Wed Oct 7.')
    const access = promiseChoices(person('elena'), DEMO_JOB_NAMES.fairoaks!)[2]!
    expect(promiseWrittenWords(access, 'Fri Oct 9')).toBe('Written down. A day we can be on site at Fair Oaks Shops, Building D by Fri Oct 9.')
    for (const words of [promiseWrittenWords(quote!, 'Wed Oct 7'), promiseChoiceTip(start!, 'Wed Oct 7')]) expect(words).not.toMatch(/Board|schedule|Pipeline/)
  })

  it('says under the line who wrote it down, who called it talk, and who asked or answers the question', () => {
    const written = { messageId: '3', contactId: 'greg', at: '2026-10-01T14:00:00.000Z', by: 'Rosa', kind: 'papers' as const, state: 'written' as const, dayYmd: '2026-10-07', writes: 'w9' as const }
    expect(writtenLineWords(written)).toBe('✓ Written down by Rosa: the W-9 by Wed Oct 7.')
    expect(writtenLineWords({ ...written, kind: 'decision', writes: null, dayYmd: null, dayWords: 'after the Board meets' })).toBe('✓ Written down by Rosa: the answer on our bid, after the Board meets.')
    expect(notAPromiseWords('Rosa')).toBe('Not a promise, said Rosa.')
    expect(askedLineWords('Robert')).toBe('✓ Sent to the architect as a plan question by Robert.')
    expect(answeringLineWords('Robert')).toBe('✓ Robert is answering it, not the architect.')
  })
})

describe('runningPromise: the written day the move line waits on', () => {
  it('runs until its day, then no longer holds the move', () => {
    expect(runningPromise(DEMO_HEARD, 'greg', '2026-09-29')).toEqual({
      messageId: '1',
      dayYmd: '2026-09-30',
      pill: 'promised Wed Sep 30 · quote',
      until: 'until Wed Sep 30 · quote',
    })
    expect(runningPromise(DEMO_HEARD, 'greg', '2026-09-30')?.dayYmd).toBe('2026-09-30')
    expect(runningPromise(DEMO_HEARD, 'greg', DEMO_TODAY)).toBeNull()
  })

  it('takes the newest written line, names the one kind written, and skips offered days', () => {
    const heard: HeardLine[] = [
      ...DEMO_HEARD,
      { messageId: '21', contactId: 'greg', at: '2026-10-02T17:00:00.000Z', kind: 'start', state: 'written', dayYmd: '2026-10-12', writes: 'start' },
      { messageId: '22', contactId: 'greg', at: '2026-10-02T16:00:00.000Z', kind: 'quote', state: 'written', dayYmd: '2026-10-07' },
    ]
    expect(runningPromise(heard, 'greg', DEMO_TODAY)).toMatchObject({ messageId: '21', until: 'until Mon Oct 12 · start' })
    expect(runningPromise(DEMO_HEARD, 'elena', DEMO_TODAY)).toBeNull()
  })
})

describe('rowOffers: the presses a Follow up row carries for lines still offered', () => {
  it('gives Greg his heard day and his plans question, oldest first', () => {
    expect(rowOffers(DEMO_HEARD, 'greg')).toEqual([
      { messageId: '3', kind: 'day', label: 'A day was heard: Wed Oct 7 · say what it is' },
      { messageId: '4', kind: 'question', label: 'Ask the architect' },
    ])
    expect(rowOffers(DEMO_HEARD, 'elena').map((o) => o.label)).toEqual(['A day was heard: Fri Oct 9 · say what it is'])
    expect(rowOffers(DEMO_HEARD, 'priya')).toEqual([])
  })

  it('drops a line once someone has said what it is', () => {
    const said: HeardLine[] = DEMO_HEARD.map((l) => (l.messageId === '3' ? { ...l, kind: 'quote', state: 'written' } : l.messageId === '4' ? { ...l, state: 'asked' } : l)) as HeardLine[]
    expect(rowOffers(said, 'greg')).toEqual([])
  })

  it('reads a day heard as words when it did not read as a date', () => {
    const words: HeardLine = { messageId: '30', contactId: 'tom', at: DEMO_TODAY, kind: null, state: 'offered', dayYmd: null, dayWords: 'after the inspection' }
    expect(heardDay(words)).toBe('after the inspection')
    expect(heardDayButton(heardDay(words))).toBe('A day was heard: after the inspection · say what it is')
  })
})

describe('the plans question', () => {
  it('leaves a team note naming the question, and the office reads one sentence', () => {
    expect(askArchitectNote('Also is the detention pond in sitework or concrete?')).toBe(
      'Sent to the architect as a plan question: “Also is the detention pond in sitework or concrete?”',
    )
    expect(plainWordsFailures(ASKED_ARCHITECT_TOAST)).toEqual([])
  })
})

describe('plain words', () => {
  it('holds every written line to the rules', () => {
    const lines = [
      ...promiseChoices(person('greg'), DEMO_JOB_NAMES.boerne!).map((c) => promiseWrittenWords(c, 'Wed Oct 7')),
      ...promiseChoices(person('elena'), DEMO_JOB_NAMES.fairoaks!).map((c) => promiseWrittenWords(c, 'Fri Oct 9')),
      ...promiseChoices(person('jonah'), DEMO_JOB_NAMES.boerne!).map((c) => promiseWrittenWords(c, 'Mon Oct 5')),
    ]
    expect(lines.flatMap(plainWordsFailures)).toEqual([])
  })
})
