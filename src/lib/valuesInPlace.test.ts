/**
 * Values in place, the pure half (punch list #382, PR 1): a value marked inside a sentence, what Keep means for a
 * draft, and the words the pieces say. Every name and day here is made up.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from './plainWords'
import { KEEP_WHY, SET_OWN_LABEL, VALUES_LEGEND, VALUE_FIELD_WORDS, changeableValueName, keepVerdict, plainSentence, sentenceParts, val, type KeepInput } from './valuesInPlace'

const base: KeepInput = { type: 'text', draft: '', value: '', thisYear: 2026 }
const verdict = (over: Partial<KeepInput>) => keepVerdict({ ...base, ...over })

describe('a value inside a sentence', () => {
  it('marks a value so a screen can draw it apart, and reads it back in order', () => {
    const sentence = `Waiting on ${val('contact', 'Ray')} for ${val('count', '2 things')}. We decide by ${val('decide', 'Sat Nov 21')}.`
    expect(sentenceParts(sentence)).toEqual([
      'Waiting on ',
      { kind: 'contact', text: 'Ray' },
      ' for ',
      { kind: 'count', text: '2 things' },
      '. We decide by ',
      { kind: 'decide', text: 'Sat Nov 21' },
      '.',
    ])
  })

  it('reads a sentence with no mark as one piece of words, and an empty one as nothing', () => {
    expect(sentenceParts('This stage is finished.')).toEqual(['This stage is finished.'])
    expect(sentenceParts('')).toEqual([])
  })

  it('reads a sentence that is one value alone, and two values with nothing between them', () => {
    expect(sentenceParts(val('day', 'Dec 8'))).toEqual([{ kind: 'day', text: 'Dec 8' }])
    expect(sentenceParts(val('who', 'Dana') + val('day', 'Nov 12'))).toEqual([
      { kind: 'who', text: 'Dana' },
      { kind: 'day', text: 'Nov 12' },
    ])
  })

  it('gives the plain words to a place that cannot draw a value apart', () => {
    expect(plainSentence(`${val('who', 'Dana')} pressed Go ${val('day', 'Nov 12')}.`)).toBe('Dana pressed Go Nov 12.')
    expect(plainSentence('Nothing is open.')).toBe('Nothing is open.')
  })

  it('keeps a value whose words hold a bar, and drops a stray bracket from a value instead of breaking the sentence', () => {
    expect(sentenceParts(val('name', 'North | South'))).toEqual([{ kind: 'name', text: 'North | South' }])
    expect(plainSentence(`Ask ${val('contact', 'Ray⟫ the super')} today.`)).toBe('Ask Ray the super today.')
  })

  it('uses its own brackets, so a paper gap marked the lien desk’s way is left as words', () => {
    expect(sentenceParts('The owner is ⟦GAP:1⟧.')).toEqual(['The owner is ⟦GAP:1⟧.'])
  })
})

describe('what Keep means for a draft', () => {
  it('saves nothing when the draft is the value it opened on', () => {
    expect(verdict({ type: 'text', draft: ' Ray ', value: 'Ray' })).toEqual({ kind: 'same' })
    expect(verdict({ type: 'date', draft: '2026-12-08', value: '2026-12-08' })).toEqual({ kind: 'same' })
    expect(verdict({ type: 'number', draft: '10.0', value: '10' })).toEqual({ kind: 'same' })
    expect(verdict({ type: 'choice', draft: 'word', value: 'word' })).toEqual({ kind: 'same' })
    expect(verdict({ type: 'date', draft: '', value: '' })).toEqual({ kind: 'same' })
  })

  it('keeps a finished value, trimmed, and a number as a number', () => {
    expect(verdict({ type: 'text', draft: '  Dana  ', value: 'Ray' })).toEqual({ kind: 'keep', value: 'Dana' })
    expect(verdict({ type: 'date', draft: '2026-12-11', value: '2026-12-08' })).toEqual({ kind: 'keep', value: '2026-12-11' })
    expect(verdict({ type: 'number', draft: '07', value: '10' })).toEqual({ kind: 'keep', value: '7' })
    expect(verdict({ type: 'choice', draft: 'photo', value: 'word' })).toEqual({ kind: 'keep', value: 'photo' })
    expect(verdict({ type: 'date', draft: '2026-12-11', value: '' })).toEqual({ kind: 'keep', value: '2026-12-11' })
  })

  it('holds an emptied field with what to do, unless the value may be cleared', () => {
    expect(verdict({ type: 'date', draft: '', value: '2026-12-08' })).toEqual({ kind: 'hold', why: 'Pick a day first.' })
    expect(verdict({ type: 'number', draft: ' ', value: '10' })).toEqual({ kind: 'hold', why: 'Type a number first.' })
    expect(verdict({ type: 'text', draft: '', value: 'Ray' })).toEqual({ kind: 'hold', why: 'Type something first.' })
    expect(verdict({ type: 'choice', draft: '', value: 'word' })).toEqual({ kind: 'hold', why: 'Pick one first.' })
    expect(verdict({ type: 'date', draft: '', value: '2026-12-08', canClear: true })).toEqual({ kind: 'keep', value: '' })
  })

  it('holds a date until its year is typed in full, and a day that is not on the calendar', () => {
    const why = KEEP_WHY.unfinishedDate(2026)
    expect(why).toBe('Finish the date first. Type the year in full, like 2026.')
    expect(verdict({ type: 'date', draft: '0002-12-08', value: '2026-12-01' })).toEqual({ kind: 'hold', why })
    expect(verdict({ type: 'date', draft: '2026-02-30', value: '2026-12-01' })).toEqual({ kind: 'hold', why })
    // The browser reports a date with a part missing as an empty box and says the entry is bad.
    expect(verdict({ type: 'date', draft: '', value: '2026-12-01', unfinished: true })).toEqual({ kind: 'hold', why })
  })

  it('holds a day outside its first and last day, naming the day across a month end', () => {
    expect(verdict({ type: 'date', draft: '2026-11-30', value: '2026-12-08', min: '2026-12-01' })).toEqual({ kind: 'hold', why: 'Pick Dec 1 or later.' })
    expect(verdict({ type: 'date', draft: '2027-01-01', value: '2026-12-08', max: '2026-12-31' })).toEqual({ kind: 'hold', why: 'Pick Dec 31 or earlier.' })
    expect(verdict({ type: 'date', draft: '2026-12-01', value: '2026-12-08', min: '2026-12-01' })).toEqual({ kind: 'keep', value: '2026-12-01' })
  })

  it('holds what is not a number, a fraction where a count is asked for, and a number outside its range', () => {
    expect(verdict({ type: 'number', draft: 'ten', value: '10' })).toEqual({ kind: 'hold', why: 'That is not a number.' })
    expect(verdict({ type: 'number', draft: '2.5', value: '10', whole: true })).toEqual({ kind: 'hold', why: 'Type a whole number.' })
    expect(verdict({ type: 'number', draft: '2.5', value: '10' })).toEqual({ kind: 'keep', value: '2.5' })
    expect(verdict({ type: 'number', draft: '-1', value: '10', min: '0' })).toEqual({ kind: 'hold', why: 'Type 0 or more.' })
    expect(verdict({ type: 'number', draft: '61', value: '10', max: '60' })).toEqual({ kind: 'hold', why: 'Type 60 or less.' })
    expect(verdict({ type: 'number', draft: '60', value: '10', min: '0', max: '60', whole: true })).toEqual({ kind: 'keep', value: '60' })
  })

  it('runs the screen’s own check last, on a draft that passed the rest', () => {
    const seen: string[] = []
    const check = (d: string) => {
      seen.push(d)
      return d === '2026-12-25' ? 'The yard is closed that day.' : null
    }
    expect(verdict({ type: 'date', draft: '2026-12-25', value: '2026-12-08', check })).toEqual({ kind: 'hold', why: 'The yard is closed that day.' })
    expect(verdict({ type: 'date', draft: '2026-12-26', value: '2026-12-08', check })).toEqual({ kind: 'keep', value: '2026-12-26' })
    expect(verdict({ type: 'date', draft: '0002-12-25', value: '2026-12-08', check }).kind).toBe('hold')
    expect(verdict({ type: 'date', draft: '2026-12-08', value: '2026-12-08', check })).toEqual({ kind: 'same' })
    expect(seen).toEqual(['2026-12-25', '2026-12-26'])
  })

  it('waits for a reason when one is required, and never asks for one when nothing changed', () => {
    const required = { text: '', required: true }
    expect(verdict({ type: 'date', draft: '2026-12-11', value: '2026-12-08', reason: required })).toEqual({ kind: 'hold', why: 'Say why first.' })
    expect(verdict({ type: 'date', draft: '2026-12-11', value: '2026-12-08', reason: { text: ' The slab is late ', required: true } })).toEqual({ kind: 'keep', value: '2026-12-11' })
    expect(verdict({ type: 'date', draft: '2026-12-11', value: '2026-12-08', reason: { text: '', required: false } })).toEqual({ kind: 'keep', value: '2026-12-11' })
    expect(verdict({ type: 'date', draft: '2026-12-08', value: '2026-12-08', reason: required })).toEqual({ kind: 'same' })
    expect(verdict({ type: 'date', draft: '', value: '2026-12-08', canClear: true, reason: required })).toEqual({ kind: 'hold', why: 'Say why first.' })
  })
})

describe('the words the pieces say', () => {
  it('names a changeable value by its value, what it is, and that a press changes it', () => {
    expect(changeableValueName('our first day', 'Tue Dec 8')).toBe('Tue Dec 8, our first day, press to change')
  })

  it('says every reason and every press in plain words', () => {
    const lines = [
      KEEP_WHY.unfinishedDate(2026),
      KEEP_WHY.notANumber,
      KEEP_WHY.notWhole,
      KEEP_WHY.reason,
      'Pick a day first.',
      'Type a number first.',
      'Type something first.',
      'Pick one first.',
      'Pick Dec 1 or later.',
      'Type 60 or less.',
      `${VALUES_LEGEND.changeable}${VALUES_LEGEND.changeableTail}${VALUES_LEGEND.workedOut}${VALUES_LEGEND.workedOutTail}`,
      SET_OWN_LABEL,
      VALUE_FIELD_WORDS.keep,
      VALUE_FIELD_WORDS.cancel,
    ]
    for (const line of lines) expect(plainWordsFailures(line)).toEqual([])
  })

  it('reads the legend as two sentences, one for each look', () => {
    expect(`${VALUES_LEGEND.changeable}${VALUES_LEGEND.changeableTail}${VALUES_LEGEND.workedOut}${VALUES_LEGEND.workedOutTail}`).toBe(
      'Underlined values change where they sit: press one. Bold values are worked out.',
    )
  })
})
