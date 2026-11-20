/** Editing a walked builder on the GC's view (punch list #404, step 7). The paper is the made-up one. */
import { describe, expect, it } from 'vitest'
import { PAPER_OFF, breachGroups, type PaperDef } from './documentBuilder'
import { paperDefProblems } from './definition'
import {
  PAPER_NEW_LINE,
  changedPages,
  isPathChanged,
  mapRows,
  pageName,
  pageOpens,
  paperPages,
  paperWordsAt,
  pathPage,
  revertPage,
  walkedNote,
  walkedPublishPress,
  withPaperLine,
  withPaperWords,
  withoutPaperLine,
} from './paperEdit'
import { SECRECY_PAPER_FIXTURE } from './secrecyPaper.fixture'

const paper = (): PaperDef => JSON.parse(JSON.stringify(SECRECY_PAPER_FIXTURE)) as PaperDef
const KEPT = 'Sending or posting a job photo to anyone outside the job.'

describe('a path', () => {
  it('reads the words it names, and null for what is not there', () => {
    const def = paper()
    expect(paperWordsAt(def, 'notice.title')).toBe(def.notice.title)
    expect(paperWordsAt(def, 'notice.lines.0')).toBe(def.notice.lines[0])
    expect(paperWordsAt(def, 'site.lead')).toBe(def.site.lead)
    expect(paperWordsAt(def, 'words.basisAsk')).toBe(def.words.basisAsk)
    expect(paperWordsAt(def, 'topic.photos.label')).toBe('Photos and video')
    expect(paperWordsAt(def, 'topic.photos.offSays')).toBe(def.topics[0]?.offSays)
    expect(paperWordsAt(def, 'topic.photos.std.says')).toBe(def.topics[0]?.levels.std?.says)
    expect(paperWordsAt(def, 'topic.photos.std.breach.2')).toBe(KEPT)
    for (const none of ['nope', 'notice.lines.99', 'topic.nope.label', 'topic.photos.nope.says', 'topic.photos.std.breach.99', 'words.nope']) expect(paperWordsAt(def, none)).toBeNull()
  })

  it('names the page it is on', () => {
    expect(pathPage('notice.lines.0')).toBe('notice')
    expect(pathPage('site.title')).toBe('site')
    expect(pathPage('words.basisHow')).toBe('basis')
    expect(pathPage('words.reviewTitle')).toBe('review')
    expect(pathPage('topic.photos.label')).toBe('topic:photos')
    expect(pathPage('topic.photos.offSays')).toBe(`topic:photos:${PAPER_OFF}`)
    expect(pathPage('topic.photos.mid.breach.0')).toBe('topic:photos:mid')
  })
})

describe('typing', () => {
  it('changes the words at a path and nothing else, on a copy', () => {
    const def = paper()
    const next = withPaperWords(def, 'topic.photos.std.says', 'A made-up line.')
    expect(paperWordsAt(next, 'topic.photos.std.says')).toBe('A made-up line.')
    expect(def.topics[0]?.levels.std?.says).not.toBe('A made-up line.')
    expect(changedPages(next, def)).toEqual(['topic:photos:std'])
    expect(withPaperWords(def, 'topic.nope.label', 'x')).toBe(def)
    expect(withPaperWords(def, 'notice.title', def.notice.title)).toBe(def)
  })

  it('changes a breach line on every stricter level that keeps it, so it stays one rule', () => {
    const def = paper()
    const next = withPaperWords(def, 'topic.photos.std.breach.2', 'Sending a job photo to anyone outside the job.')
    for (const level of ['std', 'gov', 'mid']) expect(next.topics[0]?.levels[level]?.breach).toContain('Sending a job photo to anyone outside the job.')
    expect(JSON.stringify(next)).not.toContain(KEPT)
    expect(breachGroups(next, 'photos', 'gov').carried).toContain('Sending a job photo to anyone outside the job.')
  })

  it('adds a line at the end of a list and takes one off', () => {
    const def = paper()
    const more = withPaperLine(def, 'notice.lines')
    expect(more.notice.lines).toEqual([...def.notice.lines, PAPER_NEW_LINE])
    expect(withoutPaperLine(more, 'notice.lines', more.notice.lines.length - 1).notice.lines).toEqual(def.notice.lines)
    const site = withPaperLine(def, 'topic.photos.std.site')
    expect(site.topics[0]?.levels.std?.site.slice(-1)).toEqual([PAPER_NEW_LINE])
    expect(withPaperLine(def, 'topic.nope.std.site')).toBe(def)
    expect(withoutPaperLine(def, 'notice.lines', 99)).toBe(def)
  })

  it('takes a breach line off every stricter level that keeps it', () => {
    const def = paper()
    const next = withoutPaperLine(def, 'topic.photos.std.breach', 2)
    expect(JSON.stringify(next.topics[0])).not.toContain(KEPT)
    expect(next.topics[0]?.levels.std?.breach).toHaveLength(2)
  })
})

describe('pages', () => {
  it('lists every page in the flow’s order, with Off only where a topic can be left out', () => {
    const pages = paperPages(paper())
    expect(pages.slice(0, 4)).toEqual(['notice', 'basis', 'site', 'topic:photos'])
    expect(pages).toContain(`topic:photos:${PAPER_OFF}`)
    expect(pages).not.toContain(`topic:term:${PAPER_OFF}`)
    expect(pages.slice(-1)).toEqual(['review'])
    expect(pages.filter((p) => /^topic:[a-z]+:(std|gov|mid|strict)$/.test(p))).toHaveLength(28)
  })

  it('names what changed since the published revision, and nothing before the first publish', () => {
    const published = paper()
    let draft = withPaperWords(published, 'notice.title', 'Before anything else')
    draft = withPaperWords(draft, 'words.basisAsk', 'Pick a level.')
    draft = withPaperWords(draft, 'topic.term.label', 'How long it lasts')
    draft = withPaperWords(draft, 'topic.photos.offSays', 'No photo rule.')
    expect(changedPages(draft, published)).toEqual(['notice', 'basis', 'topic:photos:off', 'topic:term'])
    expect(changedPages(draft, null)).toEqual([])
    expect(isPathChanged(draft, published, 'notice.title')).toBe(true)
    expect(isPathChanged(draft, published, 'notice.tick')).toBe(false)
    expect(isPathChanged(draft, null, 'notice.title')).toBe(false)
    expect(changedPages(draft, published).map((p) => pageName(draft, p))).toEqual(['Before you start', 'The basis', 'Photos and video, Off', 'How long it lasts, its name'])
    expect(pageName(draft, 'topic:photos:gov')).toBe('Photos and video, Elevated')
  })

  it('puts one page back as published and leaves the others changed', () => {
    const published = paper()
    let draft = withPaperWords(published, 'notice.title', 'Before anything else')
    draft = withPaperWords(draft, 'topic.photos.std.says', 'A made-up line.')
    draft = withPaperWords(draft, 'words.reviewTitle', 'The whole paper')
    const back = revertPage(draft, published, 'topic:photos:std')
    expect(changedPages(back, published)).toEqual(['notice', 'review'])
    expect(changedPages(revertPage(revertPage(back, published, 'notice'), published, 'review'), published)).toEqual([])
  })

  it('opens a page on its step, a topic at its level', () => {
    expect(pageOpens('notice')).toEqual({ step: 'notice' })
    expect(pageOpens('topic:photos')).toEqual({ step: 'photos' })
    expect(pageOpens('topic:photos:mid')).toEqual({ step: 'photos', stop: 'mid' })
    expect(pageOpens(`topic:photos:${PAPER_OFF}`)).toEqual({ step: 'photos', stop: PAPER_OFF })
  })
})

describe('the map', () => {
  it('is a row a topic and a column a level, each cell saying what the level means and whether it changed', () => {
    const published = paper()
    const draft = withPaperWords(published, 'topic.devices.gov.says', 'A made-up line.')
    const rows = mapRows(draft, published)
    expect(rows).toHaveLength(7)
    expect(rows.every((r) => r.cells.length === 4)).toBe(true)
    expect(rows.flatMap((r) => r.cells).filter((c) => c.changed).map((c) => c.page)).toEqual(['topic:devices:gov'])
    expect(rows[1]?.cells[1]).toMatchObject({ level: 'gov', says: 'A made-up line.', changed: true })
  })
})

describe('publishing', () => {
  it('names the next revision, is dead with nothing changed, and lists what stops it', () => {
    const def = paper()
    expect(paperDefProblems(def)).toEqual([])
    expect(walkedPublishPress(def, { revision: 0, published: null })).toEqual({ label: 'Publish revision 1', dead: false, why: [] })
    expect(walkedPublishPress(def, { revision: 2, published: paper() })).toEqual({ label: 'Nothing to publish', dead: true, why: [] })
    const typed = withPaperWords(def, 'notice.title', 'Before anything else')
    expect(walkedPublishPress(typed, { revision: 2, published: paper() })).toMatchObject({ label: 'Publish revision 3', dead: false })
    const untyped = withPaperLine(def, 'notice.lines')
    expect(walkedPublishPress(untyped, { revision: 2, published: paper() })).toEqual({ label: 'Publish revision 3', dead: true, why: ['A new line has no words yet.'] })
    const empty = withPaperWords(def, 'topic.photos.std.says', ' ')
    expect(walkedPublishPress(empty, { revision: 0, published: null }).why).toEqual(['Photos and video at Standard does not say what it means.'])
  })

  it('says what someone outside sees now', () => {
    expect(walkedNote({ revision: 0 }, 0)).toBe('Nobody outside sees this until you publish.')
    expect(walkedNote({ revision: 2 }, 0)).toBe('Everyone outside sees revision 2, as you do.')
    expect(walkedNote({ revision: 2 }, 3)).toBe('Changed. Everyone outside sees revision 2 until you publish.')
  })
})
