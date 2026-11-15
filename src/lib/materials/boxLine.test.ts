import { describe, expect, it } from 'vitest'
import {
  BOX_LINE_MAX,
  addedLineVerdict,
  boxChipWords,
  boxLine,
  boxLineFromParts,
  boxLineOf,
  boxLinePressLabel,
  boxLineSavedWords,
  boxLineShort,
  boxLineVerdict,
  boxNameWithLine,
  cleanBoxLine,
  lineFieldValue,
  nameWordsNote,
  sayItBetterPress,
  sayItBetterSub,
  sayItBetterTitle,
} from './boxLine'
import type { ContainerLine } from './onSite'

const part = (partName: string, onHand: number) => ({ partName, onHand })
const line = (containerId: string, partName: string, onHand: number, extra: Partial<ContainerLine> = {}): ContainerLine => ({ containerId, partKey: `text:${partName.toLowerCase()}`, partId: null, partName, manufacturer: null, onHand, lastTouchedAt: null, lastTouchedBy: null, lastCountAt: null, lastCountBy: null, lastCountDiff: null, cannotFindSinceCount: 0, ...extra })

describe('the app’s line, from the parts', () => {
  it('reads nothing for an empty box', () => {
    expect(boxLineFromParts([])).toBe('')
    expect(boxLineFromParts([part('2 inch 90', 0)])).toBe('')
  })

  it('reads one kind of part as its name and count', () => {
    expect(boxLineFromParts([part('Kohler toilets', 24)])).toBe('Kohler toilets · 24')
    expect(boxLineFromParts([part('1/2 PEX stub', 1200)])).toBe('1/2 PEX stub · 1,200')
  })

  it('names both of two parts, the one there is most of first', () => {
    expect(boxLineFromParts([part('1-1/2 coupling', 3), part('2 inch 90', 94)])).toBe('2 parts: 2 inch 90 and 1-1/2 coupling')
  })

  it('names the two a mixed box holds most of and counts the rest', () => {
    const parts = [part('tee', 1), part('2 inch 90', 94), part('1-1/2 coupling', 40), part('cap', 2), part('bushing', 2), part('wye', 1), part('trap', 1)]
    expect(boxLineFromParts(parts)).toBe('7 parts: 2 inch 90, 1-1/2 coupling and 5 more')
  })

  it('breaks a tie in name order, so the line does not flicker', () => {
    expect(boxLineFromParts([part('wye', 5), part('cap', 5), part('tee', 5)])).toBe('3 parts: cap, tee and 1 more')
  })

  it('leaves out a line with nothing on hand', () => {
    expect(boxLineFromParts([part('Kohler toilets', 24), part('wax ring', 0)])).toBe('Kohler toilets · 24')
  })

  it('never runs past 80 characters: one part is named, then its name is cut before its count is', () => {
    const long = 'Kohler K-3999 Highline Comfort Height two-piece elongated toilet 1.28 gpf white'
    const one = boxLineFromParts([part(long, 12)])
    expect(one.length).toBeLessThanOrEqual(BOX_LINE_MAX)
    expect(one.endsWith('… · 12')).toBe(true)
    const three = boxLineFromParts([part(long, 12), part('Wax ring with horn, extra thick, reinforced', 12), part('Closet bolts', 24)])
    expect(three.length).toBeLessThanOrEqual(BOX_LINE_MAX)
    expect(three).toBe('3 parts: Closet bolts and 2 more')
    const two = boxLineFromParts([part(long, 12), part(`${long} with seat`, 3)])
    expect(two.length).toBeLessThanOrEqual(BOX_LINE_MAX)
    expect(two.startsWith('2 parts: Kohler K-3999')).toBe(true)
    expect(two.endsWith('… and 1 more')).toBe(true)
  })
})

describe('a person’s words over the app’s line', () => {
  it('shows the app’s line until a person says it better', () => {
    expect(boxLine(null, [part('Kohler toilets', 24)])).toEqual({ text: 'Kohler toilets · 24', by: 'app' })
    expect(boxLine('', [part('Kohler toilets', 24)])).toEqual({ text: 'Kohler toilets · 24', by: 'app' })
  })

  it('shows a person’s words from the moment they are typed', () => {
    expect(boxLine('  PVC fittings,   mixed ', [part('tee', 1), part('cap', 2)])).toEqual({ text: 'PVC fittings, mixed', by: 'person' })
  })

  it('shows a person’s words on an empty box, and nothing when nobody said', () => {
    expect(boxLine('Waiting on the vanities', [])).toEqual({ text: 'Waiting on the vanities', by: 'person' })
    expect(boxLine(undefined, [])).toEqual({ text: '', by: 'none' })
  })

  it('reads one box out of a job’s lines', () => {
    const lines = [line('a', 'Kohler toilets', 24), line('b', 'tee', 4), line('a', 'wax ring', 0)]
    expect(boxLineOf({ id: 'a' }, lines)).toEqual({ text: 'Kohler toilets · 24', by: 'app' })
    expect(boxLineOf({ id: 'b', said: 'Tees' }, lines)).toEqual({ text: 'Tees', by: 'person' })
    expect(boxLineOf({ id: 'c' }, lines)).toEqual({ text: '', by: 'none' })
  })
})

describe('the line on a Print labels chip', () => {
  it('drops the count of a one-part box and says how many parts a mixed one holds', () => {
    expect(boxLineShort(null, [part('2 inch 90', 94)])).toBe('2 inch 90')
    expect(boxLineShort(null, [part('tee', 1), part('cap', 2), part('wye', 1)])).toBe('3 parts')
    expect(boxLineShort('PVC fittings, mixed', [part('tee', 1), part('cap', 2)])).toBe('PVC fittings, mixed')
    expect(boxLineShort(null, [])).toBe('')
  })

  it('reads the name, then the line', () => {
    expect(boxNameWithLine('R76', 'Kohler toilets')).toBe('R76 · Kohler toilets')
    expect(boxNameWithLine('R12', '')).toBe('R12')
    expect(boxChipWords({ id: 'a', label: 'R76' }, [line('a', 'Kohler toilets', 24)])).toBe('R76 · Kohler toilets')
    expect(boxChipWords({ id: 'z', label: 'R9' }, [])).toBe('R9')
  })
})

describe('Say it better', () => {
  it('names the press by what stands there', () => {
    expect(sayItBetterPress({ text: 'Kohler toilets · 24', by: 'app' })).toBe('Say it better')
    expect(sayItBetterPress({ text: 'Toilets', by: 'person' })).toBe('Say it better')
    expect(sayItBetterPress({ text: '', by: 'none' })).toBe('Say what is in it')
    expect(sayItBetterTitle({ label: 'R83' })).toBe('What is in R83')
  })

  it('says under the title whose line stands', () => {
    expect(sayItBetterSub({ text: '7 parts: tee, cap and 5 more', by: 'app' })).toContain('“7 parts: tee, cap and 5 more”')
    expect(sayItBetterSub({ text: 'Tees', by: 'person' })).toContain('clear them')
    expect(sayItBetterSub({ text: '', by: 'none' })).toContain('Nothing is in it yet')
  })

  it('saves a person’s words cleaned', () => {
    expect(boxLineVerdict({ said: '' }, '  PVC  fittings, mixed ')).toEqual({ ok: true, said: 'PVC fittings, mixed' })
    expect(boxLineVerdict({}, 'Toilets')).toEqual({ ok: true, said: 'Toilets' })
  })

  it('hands the line back to the app when the words are cleared', () => {
    expect(boxLineVerdict({ said: 'PVC fittings, mixed' }, '   ')).toEqual({ ok: true, said: null })
    expect(boxLinePressLabel({ said: 'PVC fittings, mixed' }, '')).toBe('Use the app’s line')
    expect(boxLineSavedWords({ label: 'R83' }, null)).toBe('R83’s line is from its parts again.')
  })

  it('is a quiet no while nothing changed', () => {
    expect(boxLineVerdict({ said: 'Toilets' }, ' Toilets ')).toEqual({ ok: false, reason: 'same', words: '' })
    expect(boxLineVerdict({}, '')).toEqual({ ok: false, reason: 'same', words: '' })
    expect(boxLinePressLabel({}, '')).toBe('Save the line')
  })

  it('refuses a line past 80 characters with the count', () => {
    const typed = 'x'.repeat(81)
    expect(boxLineVerdict({}, typed)).toEqual({ ok: false, reason: 'long', words: 'The line holds 80 characters. This one is 81.' })
    expect(boxLineVerdict({}, 'x'.repeat(80)).ok).toBe(true)
  })

  it('says what the box reads after the press', () => {
    expect(boxLineSavedWords({ label: 'R83' }, 'PVC fittings, mixed')).toBe('R83 reads “PVC fittings, mixed” now.')
  })
})

describe('words typed into a name land on the line', () => {
  it('stands the name’s words in the untouched line field and saves them', () => {
    expect(lineFieldValue(null, 'Toilets')).toBe('Toilets')
    expect(addedLineVerdict(null, 'Toilets')).toEqual({ ok: true, said: 'Toilets' })
    expect(nameWordsNote('Toilets', null)).toBe('“Toilets” moved to What is in it.')
  })

  it('saves nothing when neither the name nor the field carried words', () => {
    expect(lineFieldValue(null, '')).toBe('')
    expect(addedLineVerdict(null, '')).toEqual({ ok: true, said: null })
    expect(nameWordsNote('', null)).toBeNull()
  })

  it('keeps the field once a person types in it, and says so', () => {
    expect(lineFieldValue('Kohler toilets', 'Toilets')).toBe('Kohler toilets')
    expect(addedLineVerdict('Kohler toilets', 'Toilets')).toEqual({ ok: true, said: 'Kohler toilets' })
    expect(nameWordsNote('Toilets', 'Kohler toilets')).toBe('“Toilets” is not part of the name. What is in it holds what you typed there.')
    expect(nameWordsNote('Toilets', ' toilets ')).toBe('“Toilets” moved to What is in it.')
  })

  it('lets the field be cleared on purpose', () => {
    expect(addedLineVerdict('', 'Toilets')).toEqual({ ok: true, said: null })
  })

  it('makes the press dead past 80 characters', () => {
    expect(addedLineVerdict('y'.repeat(90), '')).toEqual({ ok: false, words: 'The line holds 80 characters. This one is 90.' })
  })

  it('cleans what is not text to nothing', () => {
    expect(cleanBoxLine(null)).toBe('')
    expect(cleanBoxLine(42)).toBe('')
    expect(cleanBoxLine('  a   b ')).toBe('a b')
  })
})
