import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence } from '../valuesInPlace'
import {
  ANOTHER_DAY_TIP,
  defaultWrites,
  heardChoiceOnLine,
  heardChoiceWords,
  heardChoices,
  heardLineState,
  heardMarkWords,
  heardWrittenToast,
  JUST_TALK_PRESS,
  JUST_TALK_TIP,
  JUST_TALK_TOAST,
  lineTakesChoice,
  paymentChoiceTip,
} from './heardChoice'
import { runningPromise, type HeardLine } from './promises'

const trade = { kind: 'trade' as const, name: 'Dee Ramos', company: 'ZZ Test Tile Co', trade: 'Tile' }
const customer = { kind: 'customer' as const, name: 'Dana Whitfield' }
const arch = { kind: 'arch' as const, name: 'Ivy Stone', company: 'ZZ Test Studio' }

/** A text in at noon in the app's zone (18:00Z is noon in Chicago through the winter). */
const text = (ymd: string, body: string, channel = 'text') => ({ direction: 'in', channel, at: `${ymd}T18:00:00Z`, body })

describe('lineTakesChoice', () => {
  it('their own text or voicemail, from a customer, a trade partner or an architect', () => {
    for (const kind of ['customer', 'trade', 'arch']) {
      expect(lineTakesChoice({ direction: 'in', channel: 'text' }, { kind })).toBe(true)
      expect(lineTakesChoice({ direction: 'in', channel: 'voicemail' }, { kind })).toBe(true)
    }
  })
  it('never ours, a call, an email, or another kind of person', () => {
    expect(lineTakesChoice({ direction: 'out', channel: 'text' }, { kind: 'trade' })).toBe(false)
    expect(lineTakesChoice({ direction: 'in', channel: 'call' }, { kind: 'trade' })).toBe(false)
    expect(lineTakesChoice({ direction: 'in', channel: 'email' }, { kind: 'customer' })).toBe(false)
    for (const kind of ['lead', 'supply_house', 'candidate', 'sub', 'team', 'unknown']) expect(lineTakesChoice({ direction: 'in', channel: 'text' }, { kind })).toBe(false)
  })
})

describe('heardChoices', () => {
  it('a customer: a payment opens the sheet, the other two write the line', () => {
    const got = heardChoices(customer, 'Whitfield repipe', 'Fri Nov 27')
    expect(got.map((c) => [c.label, c.opens])).toEqual([
      ['A payment', 'sheet'],
      ['Their answer on our bid', 'write'],
      ['A day we can be on site', 'write'],
    ])
    expect(got[0]!.tip).toBe(paymentChoiceTip('Fri Nov 27'))
    expect(got[1]!.tip).toBe('Goes on the bid’s follow-up')
  })
  it('a trade partner: their quote, a start or delivery, insurance or a W-9', () => {
    expect(heardChoices(trade, 'Elm Street', 'Wed Nov 25').map((c) => [c.label, c.opens])).toEqual([
      ['Their quote', 'write'],
      ['A start or delivery', 'write'],
      ['Insurance or W-9', 'write'],
    ])
  })
  it('an architect: their answer and the certificate', () => {
    expect(heardChoices(arch, null, 'Wed Nov 25').map((c) => c.label)).toEqual(['Their answer', 'The certificate'])
  })
})

describe('heardChoiceOnLine', () => {
  const now = new Date('2026-11-23T18:00:00Z')

  it('reads the day from the line’s own day: Wednesday in Monday’s text', () => {
    const got = heardChoiceOnLine(text('2026-11-23', 'We can get you the quote by Wednesday.'), trade, 'Elm Street', now)
    expect(got).toMatchObject({ ymd: '2026-11-25', label: 'Wed Nov 25', said: 'Wednesday', from: 'text', anotherDay: false })
    expect(got!.choices.map((c) => c.kind)).toEqual(['quote', 'start', 'papers'])
  })

  it('across a week’s end: Monday in Saturday’s text is two days on', () => {
    const got = heardChoiceOnLine(text('2026-11-28', 'Crew can start Monday.'), trade, null, new Date('2026-11-28T18:00:00Z'))
    expect(got).toMatchObject({ ymd: '2026-11-30', label: 'Mon Nov 30' })
  })

  it('across a year’s end: Tuesday in New Year’s Eve’s text is in January', () => {
    const got = heardChoiceOnLine(text('2026-12-31', 'Insurance papers by Tuesday.'), trade, null, new Date('2026-12-31T18:00:00Z'))
    expect(got).toMatchObject({ ymd: '2027-01-05', label: 'Tue Jan 5' })
  })

  it('in the app’s zone: tomorrow in a text sent late Monday evening is Tuesday, though it is Tuesday in UTC', () => {
    const late = { direction: 'in', channel: 'text', at: '2026-11-24T04:30:00Z', body: 'I will have it tomorrow.' }
    expect(heardChoiceOnLine(late, trade, null, now)).toMatchObject({ ymd: '2026-11-24', label: 'Tue Nov 24' })
  })

  it('a voicemail offers Another day, and a day the office picked stands in for the day read', () => {
    const vm = text('2026-11-23', 'Hi, this is Ivy. You will have our answer Friday.', 'voicemail')
    const read = heardChoiceOnLine(vm, arch, null, now)
    expect(read).toMatchObject({ ymd: '2026-11-27', from: 'voicemail', anotherDay: true })
    expect(heardChoiceOnLine(vm, arch, null, now, '2026-12-01')).toMatchObject({ ymd: '2026-12-01', label: 'Tue Dec 1', said: 'Friday' })
  })

  it('a customer’s payment tip names the day picked', () => {
    const got = heardChoiceOnLine(text('2026-11-23', 'I will pay Friday.'), customer, null, now, '2026-11-30')
    expect(got!.choices[0]!.tip).toBe(paymentChoiceTip('Mon Nov 30'))
  })

  it('none for a day gone by, no day said, an email, or a lead', () => {
    expect(heardChoiceOnLine(text('2026-11-16', 'Quote by Wednesday.'), trade, null, now)).toBeNull()
    expect(heardChoiceOnLine(text('2026-11-23', 'Thanks, got it.'), trade, null, now)).toBeNull()
    expect(heardChoiceOnLine(text('2026-11-23', 'Quote by Wednesday.', 'email'), trade, null, now)).toBeNull()
    expect(heardChoiceOnLine(text('2026-11-23', 'I will decide Friday.'), { kind: 'lead', name: 'Pat' }, null, now)).toBeNull()
  })
})

describe('the words', () => {
  it('the line before the presses marks the day as a value', () => {
    expect(heardChoiceWords('Wed Nov 25')).toBe('⟪day|Wed Nov 25⟫ is a promise of')
    expect(plainSentence(heardChoiceWords('Wed Nov 25'))).toBe('Wed Nov 25 is a promise of')
  })

  it('the toast after a press says what and by when', () => {
    expect(heardWrittenToast('quote', null, '2026-11-25')).toBe('Written down. Their quote by Wed Nov 25.')
    expect(heardWrittenToast('start', 'start', '2026-11-25')).toBe('Written down. Their start by Wed Nov 25.')
    expect(heardWrittenToast('papers', 'insurance', '2026-11-25')).toBe('Written down. Their insurance by Wed Nov 25.')
    expect(heardWrittenToast('decision', null, '2026-11-25')).toBe('Written down. Their answer on our bid by Wed Nov 25.')
    expect(heardWrittenToast('access', null, '2026-11-25')).toBe('Written down. We can be on site Wed Nov 25.')
    expect(heardWrittenToast('cert', null, '2026-11-25')).toBe('Written down. The certificate by Wed Nov 25.')
  })

  it('a double kind writes its first by default', () => {
    expect(defaultWrites('start')).toBe('start')
    expect(defaultWrites('papers')).toBe('insurance')
    expect(defaultWrites('quote')).toBeNull()
  })

  it('under a written line, what it was written as and its day', () => {
    expect(plainSentence(heardMarkWords({ kind: 'quote', state: 'written', day: '2026-11-25' })!)).toBe('Written down as their quote by Wed Nov 25.')
    expect(plainSentence(heardMarkWords({ kind: 'papers', state: 'written', day: '2026-11-25', writes: 'w9' })!)).toBe('Written down as their W-9 by Wed Nov 25.')
    expect(plainSentence(heardMarkWords({ kind: 'access', state: 'written', day: '2026-11-25' })!)).toBe('Written down. We can be on site Wed Nov 25.')
    expect(heardMarkWords({ kind: null, state: 'no', day: '2026-11-25' })).toBeNull()
    expect(heardMarkWords({ kind: null, state: 'offered', day: '2026-11-25' })).toBeNull()
  })

  it('what a line shows by its mark', () => {
    expect(heardLineState(null)).toBe('choice')
    expect(heardLineState({ kind: null, state: 'offered', day: '2026-11-25' })).toBe('choice')
    expect(heardLineState({ kind: null, state: 'no', day: '2026-11-25' })).toBe('talk')
    expect(heardLineState({ kind: 'payment', state: 'written', day: '2026-11-25' })).toBe('payment')
    expect(heardLineState({ kind: 'quote', state: 'written', day: '2026-11-25' })).toBe('written')
  })

  it('every sentence a first-timer reads passes the plain words rules', () => {
    const sentences = [
      JUST_TALK_TIP,
      JUST_TALK_TOAST,
      ANOTHER_DAY_TIP,
      paymentChoiceTip('Fri Nov 27'),
      heardWrittenToast('quote', null, '2026-11-25'),
      heardWrittenToast('access', null, '2026-11-25'),
      plainSentence(heardMarkWords({ kind: 'decision', state: 'written', day: '2026-11-25' })!),
    ]
    for (const s of sentences) expect(plainWordsFailures(s), s).toEqual([])
    expect(JUST_TALK_PRESS).toBe('just talk')
  })
})

describe('the move line after a choice', () => {
  const line = (kind: HeardLine extends infer L ? (L extends { kind: infer K } ? K : never) : never, writes: string | null = null): HeardLine =>
    ({ messageId: 'm1', contactId: 'c1', at: '2026-11-23T18:00:00Z', kind, state: 'written', dayYmd: '2026-11-25', writes }) as HeardLine

  it('reads like Their move · until Wed Nov 25 · quote, each kind in words', () => {
    expect(runningPromise([line('quote')], 'c1', '2026-11-23')?.until).toBe('until Wed Nov 25 · quote')
    expect(runningPromise([line('papers', 'w9')], 'c1', '2026-11-23')?.until).toBe('until Wed Nov 25 · W-9')
    expect(runningPromise([line('decision')], 'c1', '2026-11-23')?.until).toBe('until Wed Nov 25 · their answer')
    expect(runningPromise([line('access')], 'c1', '2026-11-23')?.until).toBe('until Wed Nov 25 · on site')
    expect(runningPromise([line('cert')], 'c1', '2026-11-23')?.until).toBe('until Wed Nov 25 · certificate')
  })
})
