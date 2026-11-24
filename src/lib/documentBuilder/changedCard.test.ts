import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { plainSentence, sentenceParts } from '../valuesInPlace'
import { CHANGED_LEGEND, changedCardEmpty, changedCardHead, changedRows, shownPageId } from './changedCard'
import { PAPER_OFF, flowSteps } from './documentBuilder'
import { changedPages, pageName, pageOpens, paperPages, withPaperWords } from './paperEdit'
import { SECRECY_PAPER_FIXTURE as DEF } from './secrecyPaper.fixture'

const TOPIC = DEF.topics.find((t) => !t.inEveryPaper) ?? DEF.topics[0]!
const [LOOSE, NEXT] = DEF.levels.map((l) => l.id) as [string, string]

describe('the page the flow shows, by the map’s own name', () => {
  it('names a topic at its level or at Off, and the four pages that are no topic', () => {
    expect(shownPageId(DEF, { step: TOPIC.key, stop: NEXT })).toBe(`topic:${TOPIC.key}:${NEXT}`)
    expect(shownPageId(DEF, { step: TOPIC.key, stop: PAPER_OFF })).toBe(`topic:${TOPIC.key}:${PAPER_OFF}`)
    for (const step of ['notice', 'basis', 'site', 'review']) expect(shownPageId(DEF, { step })).toBe(step)
  })

  it('names nothing before the flow says where it is, for a topic with no stop, and for a step the paper lacks', () => {
    expect(shownPageId(DEF, null)).toBeNull()
    expect(shownPageId(DEF, undefined)).toBeNull()
    expect(shownPageId(DEF, { step: TOPIC.key })).toBeNull()
    expect(shownPageId(DEF, { step: 'no-such-step' })).toBeNull()
  })

  it('answers a page of the paper for every step of the flow, and the page the map opens is the page shown', () => {
    const pages = new Set(paperPages(DEF))
    for (const step of flowSteps(DEF)) {
      const id = shownPageId(DEF, { step: step.key, stop: LOOSE })
      expect(id).not.toBeNull()
      expect(pages.has(id as string)).toBe(true)
    }
    // A cell's page, opened through `pageOpens`, reads back as that page.
    const cell = `topic:${TOPIC.key}:${NEXT}`
    expect(shownPageId(DEF, pageOpens(cell))).toBe(cell)
  })
})

describe('the card’s head and its empty lines', () => {
  it('counts the pages, with the count and the revision marked as values', () => {
    expect(plainSentence(changedCardHead(2, 1))).toBe('1 page changed since revision 2')
    expect(plainSentence(changedCardHead(2, 3))).toBe('3 pages changed since revision 2')
    expect(sentenceParts(changedCardHead(2, 3))).toEqual([{ kind: 'count', text: '3 pages' }, ' changed since revision ', { kind: 'revision', text: '2' }])
    expect(plainSentence(changedCardHead(4, 0))).toBe('Nothing changed since revision 4')
    expect(changedCardHead(0, 0)).toBe('Not published yet')
    // Before the first publish nothing can differ, whatever the count handed in.
    expect(changedCardHead(0, 5)).toBe('Not published yet')
  })

  it('says what to press before the first publish, that nothing waits when nothing changed, and nothing over a list', () => {
    expect(changedCardEmpty(0, 0)).toBe('Every word here is a draft. Publish to make revision 1.')
    expect(changedCardEmpty(3, 0)).toBe('Nothing waiting on a publish. This is revision 3.')
    expect(changedCardEmpty(3, 2)).toBeNull()
  })

  it('names the two marks in the fields’ own words, in plain words', () => {
    expect(CHANGED_LEGEND).toEqual([
      { mark: 'usual', words: 'As published' },
      { mark: 'own', words: 'Changed, not published' },
    ])
    const said = [...CHANGED_LEGEND.map((l) => l.words), plainSentence(changedCardHead(2, 3)), plainSentence(changedCardHead(2, 0)), changedCardHead(0, 0), changedCardEmpty(0, 0) ?? '', changedCardEmpty(3, 0) ?? '']
    expect(said.flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})

describe('the rows of the card', () => {
  const levelPage = `topic:${TOPIC.key}:${NEXT}`
  const offPage = `topic:${TOPIC.key}:${PAPER_OFF}`
  const namePage = `topic:${TOPIC.key}`
  const nextName = DEF.levels.find((l) => l.id === NEXT)?.name

  it('says a topic’s name, then its level apart from the words', () => {
    expect(changedRows(DEF, [levelPage])).toEqual([{ page: levelPage, label: TOPIC.label, level: { stop: NEXT, name: nextName }, part: null, open: false }])
    expect(changedRows(DEF, [offPage])[0]).toMatchObject({ label: TOPIC.label, level: { stop: PAPER_OFF, name: 'Off' }, part: null })
    expect(changedRows(DEF, [namePage])[0]).toMatchObject({ label: TOPIC.label, level: null, part: 'Its name' })
  })

  it('names the four pages that are no topic', () => {
    expect(changedRows(DEF, ['notice', 'basis', 'site', 'review']).map((r) => [r.label, r.level, r.part])).toEqual([
      ['Before you start', null, null],
      ['The basis', null, null],
      ['Match the paper to the site', null, null],
      ['Review', null, null],
    ])
  })

  it('marks the page open on the right, and no other', () => {
    const rows = changedRows(DEF, ['notice', levelPage, offPage], levelPage)
    expect(rows.map((r) => r.open)).toEqual([false, true, false])
    expect(changedRows(DEF, ['notice'], 'notice')[0]?.open).toBe(true)
    expect(changedRows(DEF, ['notice', levelPage]).some((r) => r.open)).toBe(false)
  })

  it('lists what really changed: a draft with one level’s words typed over gives one row, at that level', () => {
    const draft = withPaperWords(DEF, `topic.${TOPIC.key}.${NEXT}.says`, 'Made-up words for the test.')
    const changed = changedPages(draft, DEF)
    expect(changed).toEqual([levelPage])
    const [row] = changedRows(draft, changed, shownPageId(draft, { step: TOPIC.key, stop: NEXT }))
    expect(row).toMatchObject({ page: levelPage, label: TOPIC.label, open: true })
    // The row's pieces say what `pageName` says in one string, which the presses still read aloud.
    expect(`${row?.label}, ${row?.level?.name}`).toBe(pageName(draft, levelPage))
  })
})
