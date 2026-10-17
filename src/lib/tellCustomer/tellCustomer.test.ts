import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import type { QuickReply } from '../quickReplies/kernel'
import {
  blanksLeftIn,
  clockHm,
  DEFAULT_LINES,
  DEFAULT_SCRIPTS,
  holdWords,
  lineFor,
  receiptScript,
  sentLine,
  tellActs,
  tellFills,
  tellHold,
  tellWords,
  TELL_WORDS,
  type TellBlock,
  type TellHold,
} from './tellCustomer'

const BLOCK: TellBlock = { workDate: '2026-10-23', timeStart: '10:00:00', timeEnd: '12:00:00', techName: 'Luis Ortega' }
const line = (id: string, text: string, extra: Partial<QuickReply> = {}): QuickReply =>
  ({ id, text, for: 'customer', stepId: 'booked', scope: 'team', addedBy: 'rosa', addedAt: 1, removed: false, uses: {}, lastUsed: null, textEs: null, ...extra }) as QuickReply

describe('tellFills', () => {
  it('fills their name, ours, the job, the day, the window and the tech from the block', () => {
    const f = tellFills({ customerName: 'Dana Whitfield', me: 'Rosa Perez', jobName: 'Whitfield water heater', jobAddress: '1208 Mesquite Ln', block: BLOCK })
    expect(f).toEqual({ first: 'Dana', me: 'Rosa', job: 'Whitfield water heater', address: '1208 Mesquite Ln', day: 'Friday, October 23, 2026', window: '10:00 AM to 12:00 PM', tech: 'Luis' })
  })
  it('leaves out what it does not know', () => {
    const f = tellFills({ customerName: null, me: null, jobName: null, jobAddress: null, block: { ...BLOCK, techName: null } })
    expect(Object.keys(f).sort()).toEqual(['day', 'window'])
  })
})

describe('lineFor and tellWords', () => {
  const fills = tellFills({ customerName: 'Dana Whitfield', me: 'Rosa Perez', jobName: 'Whitfield water heater', jobAddress: '1208 Mesquite Ln', block: BLOCK })
  it('takes the office’s Booked line when it has one, in the customer’s language', () => {
    const office = line('q1', '{first}, {me} here from Click Plumbing. See you {day}, {window}.', { textEs: '{first}, le habla {me} de Click Plumbing. Nos vemos el {day}, {window}.' })
    const l = lineFor('booked', [office, line('q2', 'Not this one', { stepId: 'estimate' })], 'rosa')
    expect(l).toMatchObject({ office: true, id: 'q1' })
    expect(tellWords(l, fills, 'en').text).toBe('Dana, Rosa here from Click Plumbing. See you Friday, October 23, 2026, 10:00 AM to 12:00 PM.')
    expect(tellWords(l, fills, 'es').text).toBe('Dana, le habla Rosa de Click Plumbing. Nos vemos el Friday, October 23, 2026, 10:00 AM to 12:00 PM.')
  })
  it('falls back to the app’s own words, and a moved visit always takes its own', () => {
    expect(lineFor('booked', [], 'rosa')).toMatchObject({ office: false, id: null, text: DEFAULT_LINES.booked.text })
    expect(tellWords(lineFor('booked', [], 'rosa'), fills, 'en').text).toBe('Dana, this is Rosa with Click Plumbing. We have you booked for Friday, October 23, 2026, 10:00 AM to 12:00 PM. Luis will text you when on the way.')
    expect(lineFor('rescheduled', [line('q1', 'A Booked line')], 'rosa')).toMatchObject({ office: false, text: DEFAULT_LINES.rescheduled.text })
  })
  it('says which blanks nobody filled', () => {
    expect(tellWords(lineFor('booked', [], 'rosa'), { first: 'Dana' }, 'en').left).toEqual(['me', 'day', 'window', 'tech'])
    expect(blanksLeftIn('Hi {first}, see you {day}. {first} again.')).toEqual(['first', 'day'])
    expect(blanksLeftIn('No blanks here.')).toEqual([])
  })
})

describe('the holds and the acts', () => {
  it('holds in order: the office, the customer, the switch, the number, STOP', () => {
    const base = { office: true, hasCustomer: true, number: '(830) 555-0121', stopped: false, textsOn: true }
    expect(tellHold(base)).toBeNull()
    expect(tellHold({ ...base, office: false })).toBe('not-office')
    expect(tellHold({ ...base, hasCustomer: false })).toBe('no-customer')
    expect(tellHold({ ...base, textsOn: false })).toBe('texts-off')
    expect(tellHold({ ...base, number: null })).toBe('no-number')
    expect(tellHold({ ...base, stopped: true })).toBe('stop')
  })
  it('the rows say what the press does, and a hold says why not', () => {
    const a = tellActs('booked', 'Dana', null)
    expect(a.rows.map((r) => r.words)).toEqual(['Texts Dana the day and the window from the company number. Dana’s answer comes to the office.', 'Then shows you what went, and offers the call.'])
    expect(a.primary).toBe('Send text to Dana')
    expect(tellActs('rescheduled', null, null).rows[0]?.words).toBe('Texts the customer the new day and window from the company number. Their answer comes to the office.')
    const held = tellActs('booked', 'Dana', 'no-number')
    expect(held.rows).toEqual([{ icon: '⚠', words: 'No text: Dana has no phone number on file. Add one on the customer.', hold: true }])
    expect(held.primary).toBe('Close')
  })
})

describe('the receipt', () => {
  const fills = tellFills({ customerName: 'Dana Whitfield', me: 'Rosa Perez', jobName: null, jobAddress: null, block: BLOCK })
  it('says what went and when, and the script filled for them', () => {
    // 2:41 PM in Chicago on a Friday in October (CDT).
    const at = Date.parse('2026-10-16T19:41:00Z')
    expect(clockHm(at)).toBe('2:41 PM')
    expect(sentLine('Dana', at)).toBe('Text · from the company number · 2:41 PM · in Dana’s thread')
    expect(sentLine(null, at)).toBe('Text · from the company number · 2:41 PM · in their thread')
    expect(receiptScript('booked', fills)).toBe('Hi Dana, this is Rosa with Click Plumbing. You should have a text from us with the window for Friday, October 23, 2026, 10:00 AM to 12:00 PM. Does that still work for you? Luis will text you when on the way.')
    expect(receiptScript('rescheduled', fills, 'es')).toContain('Hola Dana')
  })
  it('the words a first-timer reads are plain', () => {
    const read = [
      ...(['not-office', 'no-customer', 'texts-off', 'no-number', 'stop'] as TellHold[]).map((h) => holdWords(h, 'Dana')),
      ...tellActs('booked', 'Dana', null).rows.map((r) => r.words),
      TELL_WORDS.editHint(true, 'booked'),
      TELL_WORDS.editHint(false, 'booked'),
      TELL_WORDS.editHint(false, 'rescheduled'),
      TELL_WORDS.noEmail,
      TELL_WORDS.callAsk('Dana'),
      TELL_WORDS.callLands('Dana'),
      TELL_WORDS.sentToast('Dana'),
      receiptScript('booked', fills),
      DEFAULT_SCRIPTS.rescheduled.text.replace(/\{[a-z ]+\}/g, 'x'),
    ]
    for (const words of read) expect(plainWordsFailures(words), words).toEqual([])
  })
})
