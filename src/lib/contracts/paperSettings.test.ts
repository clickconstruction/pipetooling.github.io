/** The rules of a paper built from settings (punch list #389, step 1). Every word here is a made-up placeholder. */
import { describe, expect, it } from 'vitest'
import {
  SETTINGS_PAPER_BARE,
  blankMissing,
  bookGaps,
  choiceRank,
  clausePlaces,
  fillBlanks,
  newSlotKey,
  parseSettingsDef,
  picksProblem,
  placeProblem,
  resolvedFields,
  settingsDefJson,
  settingsDefProblems,
  startPicks,
  whenFromRow,
  whenKept,
  whenProblem,
  whenWords,
  type PlacedClause,
  type SettingsDef,
} from './paperSettings'

const RAW = {
  settings: [
    { key: 'photos', label: 'Photos and video', choices: [
      { key: 'off', label: 'Off', says: 'Nothing is asked.', out: true },
      { key: 'standard', label: 'Standard', says: 'A placeholder line.' },
      { key: 'strict', label: 'Strict', says: 'A placeholder line.' },
    ] },
    { key: 'term', label: 'How long secrecy lasts', choices: [
      { key: 'short', label: 'Short', says: 'A placeholder line.', fills: { term_words: 'one year' }, fillsEs: { term_words: 'un año' } },
      { key: 'long', label: 'Long', says: 'A placeholder line.', fills: { term_words: 'three years' } },
    ] },
  ],
  fields: [{ key: 'term_words', label: 'How long' }, { key: 'other', label: 'Other rules' }],
  levels: [{ key: 'standard', label: 'Standard', alignedWith: 'Aligned with regular businesses', picks: { photos: 'standard', term: 'long' } }],
}
const def = parseSettingsDef(RAW) as SettingsDef
const clause = (id: string, order: number, slot: string | null, when: Record<string, string> | null): PlacedClause => ({ id, order, slot, when })

describe('parseSettingsDef and settingsDefProblems', () => {
  it('reads a list whole, with nothing wrong, and writes it back short', () => {
    expect(def.settings.map((s) => s.key)).toEqual(['photos', 'term'])
    expect(def.settings[0]?.choices[0]).toMatchObject({ key: 'off', out: true, labelEs: '', fills: {} })
    expect(settingsDefProblems(def)).toEqual([])
    expect(parseSettingsDef(settingsDefJson(def))).toEqual(def)
    expect(JSON.stringify(settingsDefJson(def))).not.toContain('labelEs')
  })

  it('answers null for what is not a list at all', () => {
    for (const raw of [null, 'x', [], {}, { settings: 'x' }, { settings: [1] }, { settings: [], fields: [1] }]) expect(parseSettingsDef(raw)).toBeNull()
  })

  it('names each gap in words', () => {
    const bad = parseSettingsDef({
      settings: [
        { key: 'Photos', label: '', choices: [{ key: 'a', label: 'A', says: '' }] },
        { key: 'term', label: 'Term', choices: [{ key: 'x', label: 'X', says: 'S', out: true, fills: { nope: 'v' } }, { key: 'x', label: 'Y', says: 'S', out: true }] },
        { key: 'term', label: 'Again', choices: [{ key: 'a', label: 'A', says: 'S' }, { key: 'b', label: 'B', says: 'S' }] },
      ],
      fields: [{ key: 'job', label: 'Job' }, { key: 'ok', label: '' }],
      levels: [{ key: 'l', label: 'Level one', picks: { term: 'x' } }],
    }) as SettingsDef
    const got = settingsDefProblems(bad)
    for (const want of [
      'Two settings share the key term.',
      'Setting 1 needs a key: a letter, then letters, digits or underscores.',
      'Setting 1 has no name.',
      'Setting 1 needs two choices or more.',
      'Setting 1, A, does not say what it means.',
      'Term has two choices with the key x.',
      'Term, X, fills a blank that is not on the list: nope.',
      'Term leaves the topic out on every choice.',
      'A blank cannot be named job. The paper fills that one itself.',
      'Blank 2 has no name.',
      'Level one: Pick .',
    ]) expect(got).toContain(want)
    expect(settingsDefProblems({ settings: [], fields: [], levels: [] })).toEqual(['Add a setting.'])
  })
})

describe('picks', () => {
  it('needs one of its own choices for every setting', () => {
    expect(picksProblem(def, null)).toBe(SETTINGS_PAPER_BARE)
    expect(picksProblem(def, { photos: 'standard' })).toBe('Pick How long secrecy lasts.')
    expect(picksProblem(def, { photos: 'loud', term: 'long' })).toBe('Pick Photos and video.')
    expect(picksProblem(def, { photos: 'off', term: 'long' })).toBeNull()
  })

  it('starts on the first level, or on the loosest choice of each setting', () => {
    expect(startPicks(def)).toEqual({ photos: 'standard', term: 'long' })
    expect(startPicks({ ...def, levels: [] })).toEqual({ photos: 'off', term: 'short' })
  })

  it('ranks a choice by its place, the loosest first', () => {
    expect(choiceRank(def, 'photos', 'off')).toBe(0)
    expect(choiceRank(def, 'photos', 'strict')).toBe(2)
    expect(choiceRank(def, 'photos', 'nope')).toBe(-1)
    expect(choiceRank(def, 'nope', 'off')).toBe(-1)
  })
})

describe('a clause’s Only when', () => {
  it('keeps a clause when every part of it is picked', () => {
    expect(whenKept(null, null)).toBe(true)
    expect(whenKept({ photos: 'strict' }, { photos: 'strict', term: 'long' })).toBe(true)
    expect(whenKept({ photos: 'strict' }, { photos: 'standard', term: 'long' })).toBe(false)
    expect(whenKept({ photos: 'strict', term: 'long' }, { photos: 'strict', term: 'short' })).toBe(false)
    expect(whenKept({ photos: 'strict' }, null)).toBe(false)
  })

  it('reads the column, an empty bag being a clause in every paper', () => {
    expect(whenFromRow(null)).toBeNull()
    expect(whenFromRow({})).toBeNull()
    expect(whenFromRow({ photos: 'strict', n: 3 })).toEqual({ photos: 'strict' })
  })

  it('refuses what the list does not have, in the database’s words', () => {
    expect(whenProblem(def, null, null)).toBeNull()
    expect(whenProblem(def, null, 'photos')).toBe('A wording of a place needs its Only when.')
    expect(whenProblem(null, { photos: 'strict' }, null)).toBe('This paper has no settings list. A clause is tied to a choice only on a paper that has one.')
    expect(whenProblem(def, { badges: 'on' }, null)).toBe("badges is not on this paper's settings list.")
    expect(whenProblem(def, { photos: 'loud' }, null)).toBe('Photos and video has no choice loud.')
    expect(whenProblem(def, { photos: 'strict' }, 'Not A Key')).toBe('That place does not read. Pick it again.')
    expect(whenProblem(def, { photos: 'strict' }, 'photos')).toBeNull()
  })

  it('says it in words', () => {
    expect(whenWords(def, null)).toBe('In every paper')
    expect(whenWords(def, { photos: 'strict' })).toBe('Only when Photos and video is Strict')
    expect(whenWords(null, { photos: 'strict' })).toBe('Only when photos is strict')
  })
})

describe('blanks', () => {
  it('fills from the picked choices, then from what was typed, only for blanks on the list', () => {
    expect(resolvedFields(def, { photos: 'off', term: 'short' }, null, 'en')).toEqual({ term_words: 'one year' })
    expect(resolvedFields(def, { photos: 'off', term: 'short' }, null, 'es')).toEqual({ term_words: 'un año' })
    expect(resolvedFields(def, { photos: 'off', term: 'long' }, null, 'es')).toEqual({ term_words: 'three years' })
    expect(resolvedFields(def, { photos: 'off', term: 'long' }, { term_words: ' ten years ', other: '  ', nope: 'x' }, 'en')).toEqual({ term_words: 'ten years' })
  })

  it('fills a clause’s blanks and names the first with no value', () => {
    expect(fillBlanks(def, 'Lasts {term_words}. {other} {job}', { term_words: 'one year' })).toBe('Lasts one year. {other} {job}')
    expect(blankMissing(def, 'Lasts {term_words}. {other}', { term_words: 'one year' })?.label).toBe('Other rules')
    expect(blankMissing(def, 'Lasts {term_words}. {job}', { term_words: 'one year' })).toBeNull()
  })
})

describe('places', () => {
  const book = [clause('a', 1, null, null), clause('b', 2, 'photos', { photos: 'standard' }), clause('c', 3, null, null), clause('d', 9, 'photos', { photos: 'strict' })]

  it('reads a later wording where its place is', () => {
    expect([...clausePlaces(book).entries()]).toEqual([['a', 1], ['b', 2], ['c', 3], ['d', 2]])
  })

  it('stops a paper at a place with no wording or with two, unless the pick leaves the topic out', () => {
    expect(placeProblem(def, book, { photos: 'standard', term: 'long' })).toBeNull()
    expect(placeProblem(def, book, { photos: 'off', term: 'long' })).toBeNull()
    expect(placeProblem(def, book.slice(0, 3), { photos: 'strict', term: 'long' })).toBe('Photos and video has no wording for Strict.')
    expect(placeProblem(def, [...book, clause('e', 10, 'photos', { photos: 'strict' })], { photos: 'strict', term: 'long' })).toBe('Photos and video has two wordings for Strict.')
  })

  it('lists every gap the Book can see without a job', () => {
    expect(bookGaps(def, book)).toEqual([])
    expect(bookGaps(def, book.slice(0, 3))).toEqual(['Photos and video has no wording for Strict.'])
    expect(bookGaps(def, [...book, clause('e', 10, 'photos', { photos: 'strict' }), clause('f', 11, 'term', { term: 'long' })])).toEqual([
      'Photos and video has two wordings for Strict.',
      'How long secrecy lasts has no wording for Short.',
    ])
    expect(bookGaps(def, [clause('g', 1, null, { photos: 'strict' })])).toEqual([])
  })

  it('names a new place after its setting', () => {
    expect(newSlotKey('photos', [])).toBe('photos')
    expect(newSlotKey('photos', ['photos'])).toBe('photos_2')
    expect(newSlotKey('photos', ['photos', 'photos_2'])).toBe('photos_3')
  })
})
