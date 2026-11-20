import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { documentBuilderById, type DocumentBuilderEntry } from './builders'
import {
  DOCUMENT_BUILDER_SELECT,
  builderRecordFromRow,
  builderRecordsByKey,
  builderRowPress,
  builderStanding,
  builderStandingChips,
  hasUnpublishedChanges,
  isBuilderRead,
  sameContents,
  type BuilderRecord,
} from './standing'

const SUB_NDA = documentBuilderById('sub-nda') as DocumentBuilderEntry

/** A row as the table hands it back. Every word in it is made up. */
const row = (over: Record<string, unknown> = {}) => ({
  key: 'sub-nda',
  kind: 'walked',
  draft: { title: 'A made-up paper' },
  published: null,
  revision: 0,
  published_at: null,
  read_revision: null,
  read_by_name: '',
  read_on: null,
  updated_at: '2026-11-19T15:00:00.000Z',
  ...over,
})
const rec = (over: Record<string, unknown> = {}) => builderRecordFromRow(row(over)) as BuilderRecord

describe('a row of the table as a record', () => {
  it('reads a draft on revision 0', () => {
    expect(rec()).toEqual({ key: 'sub-nda', kind: 'walked', draft: { title: 'A made-up paper' }, published: null, revision: 0, publishedAt: null, read: null, updatedAt: '2026-11-19T15:00:00.000Z' })
  })

  it('reads a published builder with its read mark, the name trimmed', () => {
    const got = rec({ published: { title: 'A made-up paper' }, revision: 2, published_at: '2026-11-20T15:00:00.000Z', read_revision: 2, read_by_name: ' Avery Stone ', read_on: '2026-11-20' })
    expect(got.revision).toBe(2)
    expect(got.published).toEqual({ title: 'A made-up paper' })
    expect(got.read).toEqual({ revision: 2, byName: 'Avery Stone', on: '2026-11-20' })
  })

  it('reads no mark from half of one', () => {
    expect(rec({ read_revision: 1, read_by_name: '', read_on: '2026-11-20' }).read).toBeNull()
    expect(rec({ read_revision: 1, read_by_name: 'Avery Stone', read_on: null }).read).toBeNull()
    expect(rec({ read_revision: null, read_by_name: 'Avery Stone', read_on: '2026-11-20' }).read).toBeNull()
  })

  it('answers null for a row that is not a builder’s', () => {
    for (const bad of [null, 'words', [], {}, row({ key: '' }), row({ kind: 'drawn' }), row({ draft: [] }), row({ draft: null }), row({ revision: -1 }), row({ revision: 1.5 }), row({ revision: '2' })]) {
      expect(builderRecordFromRow(bad)).toBeNull()
    }
  })

  it('keeps the rows by builder and leaves out a row it cannot read', () => {
    const got = builderRecordsByKey([row(), row({ key: 'insurance', kind: 'filled' }), { key: 'broken' }])
    expect([...got.keys()]).toEqual(['sub-nda', 'insurance'])
  })

  it('asks the table for every column a record reads', () => {
    for (const column of Object.keys(row())) expect(DOCUMENT_BUILDER_SELECT.split(', ')).toContain(column)
  })
})

describe('where a builder stands', () => {
  it('is not loaded with no row, a draft on revision 0, and published after that', () => {
    expect(builderStanding(null)).toBe('not-loaded')
    expect(builderStanding(rec())).toBe('draft')
    expect(builderStanding(rec({ published: { title: 'A made-up paper' }, revision: 1 }))).toBe('published')
  })

  it('loads the first draft while there is no row, then opens', () => {
    expect(builderRowPress(null)).toBe('load')
    expect(builderRowPress(rec())).toBe('open')
  })

  it('is read only while the mark names the published revision', () => {
    const marked = { read_revision: 1, read_by_name: 'Avery Stone', read_on: '2026-11-20' }
    expect(isBuilderRead(null)).toBe(false)
    expect(isBuilderRead(rec())).toBe(false)
    expect(isBuilderRead(rec({ published: {}, revision: 1, ...marked }))).toBe(true)
    expect(isBuilderRead(rec({ published: {}, revision: 2, ...marked }))).toBe(false)
  })

  it('compares two copies of one definition whatever order their keys were written in', () => {
    expect(sameContents({ a: 1, b: [{ x: 1, y: 2 }] }, { b: [{ y: 2, x: 1 }], a: 1 })).toBe(true)
    expect(sameContents({ a: 1, b: [1, 2] }, { a: 1, b: [2, 1] })).toBe(false)
    expect(sameContents({ a: 'one' }, { a: 'two' })).toBe(false)
  })

  it('compares as the stored copy does: a key holding undefined is no key at all', () => {
    expect(sameContents({ a: 1, b: undefined }, { a: 1 })).toBe(true)
    expect(sameContents({ a: 1 }, { b: undefined, a: 1 })).toBe(true)
    expect(sameContents({ list: [{ name: 'A made-up topic', fact: undefined }] }, { list: [{ name: 'A made-up topic' }] })).toBe(true)
    expect(sameContents({ a: { b: undefined } }, { a: {} })).toBe(true)
    // A key holding null is stored, so it is not the same as no key.
    expect(sameContents({ a: 1, b: null }, { a: 1 })).toBe(false)
    // A list keeps its places: JSON stores undefined in a list as null.
    expect(sameContents([1, undefined, 2], [1, null, 2])).toBe(true)
    expect(sameContents([1, undefined, 2], [1, 2])).toBe(false)
    for (const made of [{ a: 1, b: undefined, c: [undefined, { d: undefined, e: 'x' }] }, [undefined], { only: undefined }]) {
      expect(sameContents(made, JSON.parse(JSON.stringify(made)))).toBe(true)
    }
  })

  it('has changes not published once the draft moves on from the published copy', () => {
    expect(hasUnpublishedChanges(null)).toBe(false)
    expect(hasUnpublishedChanges(rec())).toBe(false)
    expect(hasUnpublishedChanges(rec({ published: { title: 'A made-up paper' }, revision: 1 }))).toBe(false)
    expect(hasUnpublishedChanges(rec({ draft: { title: 'A made-up paper, second pass' }, published: { title: 'A made-up paper' }, revision: 1 }))).toBe(true)
  })
})

describe('the chips', () => {
  it('say a builder with no row is not loaded yet, and nothing more', () => {
    expect(builderStandingChips(SUB_NDA, null)).toEqual([{ tone: 'wait', words: 'Not loaded yet' }])
  })

  it('say a draft is not published and no attorney has read it', () => {
    expect(builderStandingChips(SUB_NDA, rec())).toEqual([
      { tone: 'wait', words: 'Draft, not published' },
      { tone: 'warn', words: 'Not read by an attorney' },
    ])
  })

  it('name the published revision, and who read it and the day', () => {
    const read = rec({ published: { title: 'A made-up paper' }, revision: 2, read_revision: 2, read_by_name: 'Avery Stone', read_on: '2026-11-20' })
    expect(builderStandingChips(SUB_NDA, read)).toEqual([
      { tone: 'ok', words: 'Published, revision 2' },
      { tone: 'ok', words: 'Read by Avery Stone, Nov 20' },
    ])
  })

  it('say a new revision is unread again, and that the draft has moved on', () => {
    const moved = rec({ draft: { title: 'A made-up paper, third pass' }, published: { title: 'A made-up paper' }, revision: 3, read_revision: 2, read_by_name: 'Avery Stone', read_on: '2026-11-20' })
    expect(builderStandingChips(SUB_NDA, moved)).toEqual([
      { tone: 'ok', words: 'Published, revision 3' },
      { tone: 'warn', words: 'Changes not published' },
      { tone: 'warn', words: 'Not read by an attorney' },
    ])
  })

  it('read in plain words', () => {
    const every = [null, rec(), rec({ published: {}, revision: 2, read_revision: 2, read_by_name: 'Avery Stone', read_on: '2026-11-20' }), rec({ draft: { a: 1 }, published: {}, revision: 3 })]
    expect(every.flatMap((r) => builderStandingChips(SUB_NDA, r)).flatMap((c) => plainWordsFailures(c.words))).toEqual([])
  })
})
