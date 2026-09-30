import { describe, expect, it } from 'vitest'
import {
  addedEntry,
  dayChangeWords,
  describeHeld,
  holdWords,
  isTypedByHand,
  needsSecondLook,
  parseTypedStampRow,
  secondLookWords,
  splitForApproveAll,
  trimmedEntry,
  typedByWords,
  typedHoursShort,
  typedLateDays,
  typedWhenWords,
  type TypedEntry,
  type TypedStamp,
} from './typedHours'

// Wed Sep 30 2026, 9:40 AM Central.
const TYPED_AT = '2026-09-30T14:40:00.000Z'
const NOW = new Date('2026-09-30T18:00:00.000Z').getTime()

function entry(over: Partial<TypedEntry> = {}): TypedEntry {
  return {
    id: 'e1',
    kind: 'added',
    typedBy: 'taunya',
    typedByName: 'Taunya',
    typedAt: TYPED_AT,
    seconds: 39600,
    daySecondsBefore: 0,
    daySecondsAfter: 39600,
    self: false,
    confirmedByName: null,
    confirmedAt: null,
    ...over,
  }
}
const stamp = (entries: TypedEntry[], hold: TypedStamp['hold'] = null): TypedStamp => ({ hold, entries })

describe('parseTypedStampRow', () => {
  it('reads a row of clock_typed_stamps', () => {
    const parsed = parseTypedStampRow({
      session_id: 's1',
      hold: 'typed',
      entries: [
        {
          id: 'e1', kind: 'added', typed_by: 'u1', typed_by_name: 'Taunya', typed_at: TYPED_AT,
          seconds: 39600, day_seconds_before: 0, day_seconds_after: 39600, self: false,
          confirmed_by_name: null, confirmed_at: null,
        },
      ],
    })
    expect(parsed?.sessionId).toBe('s1')
    expect(parsed?.stamp.hold).toBe('typed')
    expect(parsed?.stamp.entries[0]).toEqual(entry({ typedBy: 'u1' }))
  })

  it('drops what is not a row, an entry, or a known hold', () => {
    expect(parseTypedStampRow(null)).toBeNull()
    expect(parseTypedStampRow({ hold: 'own' })).toBeNull()
    const parsed = parseTypedStampRow({ session_id: 's1', hold: 'nope', entries: [{ id: 'x' }, 'junk', { id: 'e', kind: 'moved', typed_at: TYPED_AT }] })
    expect(parsed?.stamp).toEqual({ hold: null, entries: [] })
    expect(parseTypedStampRow({ session_id: 's1', entries: null })?.stamp.entries).toEqual([])
  })

  it('names a typist with no name', () => {
    const parsed = parseTypedStampRow({ session_id: 's1', entries: [{ id: 'e1', kind: 'trimmed', typed_at: TYPED_AT }] })
    expect(parsed?.stamp.entries[0]?.typedByName).toBe('Someone')
  })
})

describe('which entry the stamp speaks for', () => {
  it('prefers added hours still waiting on a look, newest first', () => {
    const looked = entry({ id: 'old', typedAt: '2026-09-30T20:00:00.000Z', confirmedAt: '2026-09-30T21:00:00.000Z', confirmedByName: 'Cora' })
    const waiting = entry({ id: 'wait', typedAt: '2026-09-29T20:00:00.000Z' })
    expect(addedEntry(stamp([looked, waiting]))?.id).toBe('wait')
    expect(addedEntry(stamp([looked]))?.id).toBe('old')
    expect(addedEntry(stamp([entry({ kind: 'trimmed' })]))).toBeNull()
    expect(addedEntry(undefined)).toBeNull()
  })

  it('finds the newest trim', () => {
    const a = entry({ id: 'a', kind: 'trimmed', typedAt: '2026-09-29T20:00:00.000Z' })
    const b = entry({ id: 'b', kind: 'trimmed', typedAt: '2026-09-30T20:00:00.000Z' })
    expect(trimmedEntry(stamp([a, b]))?.id).toBe('b')
    expect(trimmedEntry(stamp([entry()]))).toBeNull()
  })

  it('knows typed from punched, and looked-at from waiting', () => {
    expect(isTypedByHand(stamp([]))).toBe(false)
    expect(isTypedByHand(stamp([entry({ kind: 'trimmed' })]))).toBe(false)
    expect(isTypedByHand(stamp([entry()]))).toBe(true)
    expect(needsSecondLook(stamp([entry()]))).toBe(true)
    expect(needsSecondLook(stamp([entry({ confirmedAt: TYPED_AT })]))).toBe(false)
    expect(needsSecondLook(stamp([entry({ kind: 'trimmed' })]))).toBe(false)
    expect(needsSecondLook(null)).toBe(false)
  })
})

describe('the words on the stamp', () => {
  it('says hours to one decimal', () => {
    expect(typedHoursShort(39600)).toBe('11.0h')
    expect(typedHoursShort(9000)).toBe('2.5h')
    expect(typedHoursShort(-5)).toBe('0.0h')
    expect(typedHoursShort(82)).toBe('1 min')
    expect(typedHoursShort(359)).toBe('6 min')
    expect(typedHoursShort(360)).toBe('0.1h')
  })

  it('says when in the company time zone, with the date once a weekday is ambiguous', () => {
    expect(typedWhenWords(TYPED_AT, NOW)).toBe('Wed 9:40 AM')
    expect(typedWhenWords(TYPED_AT, NOW + 7 * 24 * 60 * 60 * 1000)).toBe('Sep 30, 9:40 AM')
    expect(typedWhenWords('not a date', NOW)).toBe('')
  })

  it('counts how late an entry was typed', () => {
    expect(typedLateDays('2026-09-25', TYPED_AT)).toBe(5)
    expect(typedLateDays('2026-09-30', TYPED_AT)).toBe(0)
    expect(typedLateDays('2026-10-02', TYPED_AT)).toBe(0)
    expect(typedLateDays(null, TYPED_AT)).toBe(0)
  })

  it('names the typist, the person themself, and a trim', () => {
    expect(typedByWords(entry(), '2026-09-25', NOW)).toBe('typed by Taunya · Wed 9:40 AM')
    expect(typedByWords(entry({ self: true, typedByName: 'Michael A' }), '2026-09-25', NOW)).toBe('typed by Michael A · own entry · 5 days late')
    expect(typedByWords(entry({ self: true, typedByName: 'Michael A' }), '2026-09-30', NOW)).toBe('typed by Michael A · own entry · Wed 9:40 AM')
    expect(typedByWords(entry({ kind: 'trimmed' }), '2026-09-25', NOW)).toBe('trimmed by Taunya · Wed 9:40 AM')
  })

  it('says what the day read before and after', () => {
    expect(dayChangeWords(entry())).toEqual({ was: 'Nothing recorded', now: '11.0h' })
    expect(dayChangeWords(entry({ daySecondsBefore: 23400, daySecondsAfter: 32400 }))).toEqual({ was: '6.5h', now: '9.0h' })
  })

  it('says who gave the second look', () => {
    expect(secondLookWords(entry())).toBeNull()
    expect(secondLookWords(entry({ confirmedAt: TYPED_AT, confirmedByName: 'Cora' }))).toBe('looked at by Cora')
    expect(secondLookWords(entry({ confirmedAt: TYPED_AT }))).toBe('looked at by someone else')
  })

  it('says why there is no Approve', () => {
    expect(holdWords('own')).toBe('Your own hours — someone else approves them')
    expect(holdWords('typed')).toBe('You typed these — waiting on a second person')
  })
})

describe('splitForApproveAll', () => {
  it('never sweeps a typed row in with the punches', () => {
    const stamps = new Map<string, TypedStamp>([
      ['typed-by-other', stamp([entry()])],
      ['typed-by-me', stamp([entry()], 'typed')],
      ['my-own', stamp([], 'own')],
      ['looked-at', stamp([entry({ confirmedAt: TYPED_AT })])],
      ['trimmed', stamp([entry({ kind: 'trimmed' })])],
    ])
    expect(splitForApproveAll(['punch', 'typed-by-other', 'typed-by-me', 'my-own', 'looked-at', 'trimmed'], stamps)).toEqual({
      punchIds: ['punch', 'looked-at', 'trimmed'],
      typedIds: ['typed-by-other'],
      heldIds: ['typed-by-me', 'my-own'],
    })
  })

  it('takes everything when nothing is stamped', () => {
    expect(splitForApproveAll(['a', 'b'], new Map())).toEqual({ punchIds: ['a', 'b'], typedIds: [], heldIds: [] })
  })
})

describe('describeHeld', () => {
  it('says nothing when nothing was left', () => {
    expect(describeHeld(0, 0)).toBeNull()
  })
  it('says what an approve left for someone else', () => {
    expect(describeHeld(0, 1)).toBe('1 left for someone else: you typed it.')
    expect(describeHeld(0, 2)).toBe('2 left for someone else: you typed them.')
    expect(describeHeld(1, 0)).toBe('1 left for someone else: your own hours.')
    expect(describeHeld(2, 1)).toBe('3 left for someone else: you typed 1, 2 are your own hours.')
    expect(describeHeld(1, 1)).toBe('2 left for someone else: you typed 1, 1 is your own hours.')
  })
})
