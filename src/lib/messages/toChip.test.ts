import { describe, expect, it } from 'vitest'
import type { Contact } from '../contacts/kernel'
import { plainWordsFailures } from '../plainWords'
import type { ThreadMessage } from './thread'
import { chipHasMenu, chipLabel, MAKE_USUAL_LABEL, numberChoices, numbersOfRecord, usualAsk, usualToSet } from './toChip'

const NOW = '2026-10-23T15:00:00.000Z'
const ch = (id: string, value: string, more: Partial<Contact['channels'][number]> = {}) => ({ id, kind: 'phone' as const, value, optedOutAt: null, ...more })
const line = (channelId: string, at: string, direction: 'in' | 'out' = 'in'): Pick<ThreadMessage, 'channelId' | 'at' | 'direction'> => ({ channelId, at, direction })

const DANA = {
  channels: [
    ch('land', '(830) 555-0121'),
    ch('cell', '(830) 555-0190'),
    ch('old', '(830) 555-0144', { optedOutAt: '2026-09-01T12:00:00.000Z' }),
    { id: 'mail', kind: 'email' as const, value: 'dana@whitfield.example', optedOutAt: null },
  ],
}

describe('numberChoices: the menu in the order a text would go', () => {
  it('lists the last-carried number first when none is starred, with when it last carried a line, and the STOP last', () => {
    const choices = numberChoices(DANA, [line('land', '2026-07-20T15:00:00.000Z', 'out'), line('cell', '2026-10-17T15:00:00.000Z')], NOW)
    expect(choices.map((c) => c.id)).toEqual(['cell', 'land', 'old'])
    expect(choices[0]).toMatchObject({ value: '(830) 555-0190', usual: false, optedOut: false, words: 'last line last Saturday' })
    expect(choices[1]!.words).toBe('last line on Jul 20')
    expect(choices[2]).toMatchObject({ optedOut: true, words: 'sent STOP', usual: false })
  })

  it('puts the usual first whatever the thread last carried, and says no line yet', () => {
    const starred = { channels: DANA.channels.map((c) => (c.id === 'land' ? { ...c, usualAt: '2026-10-01T12:00:00.000Z' } : c)) }
    const choices = numberChoices(starred, [line('cell', '2026-10-17T15:00:00.000Z')], NOW)
    expect(choices.map((c) => c.id)).toEqual(['land', 'cell', 'old'])
    expect(choices[0]).toMatchObject({ usual: true, words: 'no line yet' })
  })

  it('a stopped usual is not usual any more', () => {
    const stoppedStar = { channels: DANA.channels.map((c) => (c.id === 'old' ? { ...c, usualAt: '2026-08-01T12:00:00.000Z' } : c)) }
    expect(numberChoices(stoppedStar, [], NOW).find((c) => c.id === 'old')).toMatchObject({ usual: false, optedOut: true })
  })

  it('is a label with one number and a menu with two', () => {
    expect(chipHasMenu(numberChoices({ channels: [ch('one', '(830) 555-0101')] }, [], NOW))).toBe(false)
    expect(chipHasMenu(numberChoices(DANA, [], NOW))).toBe(true)
    expect(chipLabel(numberChoices(DANA, [], NOW)[0]!)).toBe('To (830) 555-0121')
    expect(chipLabel(null)).toBe('To no number on file')
  })

  it('every word a first-timer reads keeps the plain-words rules', () => {
    for (const c of numberChoices(DANA, [line('cell', '2026-10-17T15:00:00.000Z')], NOW)) expect(plainWordsFailures(c.words)).toEqual([])
    expect(plainWordsFailures(MAKE_USUAL_LABEL)).toEqual([])
  })
})

describe('usualToSet: the tick remembers a deliberate pick', () => {
  const choices = numberChoices(DANA, [line('cell', '2026-10-17T15:00:00.000Z')], NOW)
  it('names the picked number when it is ticked and not the usual already, never a STOP or the rule’s own pick', () => {
    expect(usualToSet(choices, 'land', true)).toBe('land')
    expect(usualToSet(choices, 'land', false)).toBeNull()
    expect(usualToSet(choices, null, true)).toBeNull()
    expect(usualToSet(choices, 'old', true)).toBeNull()
    const starred = numberChoices({ channels: DANA.channels.map((c) => (c.id === 'land' ? { ...c, usualAt: '2026-10-01T12:00:00.000Z' } : c)) }, [], NOW)
    expect(usualToSet(starred, 'land', true)).toBeNull()
  })
})

describe('Who is this? asks Make this their usual', () => {
  const record = { table: 'customers' as const, id: 'cust-dana' }
  const view = {
    contacts: [{ id: 'c-dana', record, channels: [ch('land', '(830) 555-0121')] }],
    messages: [{ id: 'm1', contactId: 'c-dana', channelId: 'land', at: '2026-07-20T15:00:00.000Z', direction: 'out' } as unknown as ThreadMessage],
  }

  it('reads the record’s numbers and when each last carried a line', () => {
    expect(numbersOfRecord(view, record)).toEqual([{ value: '(830) 555-0121', lastAt: '2026-07-20T15:00:00.000Z', usual: false }])
    expect(numbersOfRecord(view, { table: 'customers', id: 'somebody-else' })).toEqual([])
  })

  it('ticks by default when the old number has been quiet a month, and not when it carried a line', () => {
    expect(usualAsk(numbersOfRecord(view, record), NOW)).toEqual({ label: MAKE_USUAL_LABEL, was: '(830) 555-0121 was', tickedByDefault: true })
    const busy = { ...view, messages: [{ ...view.messages[0]!, at: '2026-10-20T15:00:00.000Z' }] }
    expect(usualAsk(numbersOfRecord(busy, record), NOW)?.tickedByDefault).toBe(false)
    expect(usualAsk([], NOW)).toBeNull()
  })
})
