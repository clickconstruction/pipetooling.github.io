import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { paperDefProblems, parsePaperDef, readPaperDef } from './definition'
import { PAPER_NAMES_PAGE, PAPER_NAME_KEYS, changedPages, isPathChanged, pageName, paperPages, paperWordsAt, pathPage, revertPage, withPaperWords } from './paperEdit'
import { PAPER_NAMES_WORDS, PAPER_NAME_FIELDS, paperNameRows } from './paperNames'
import { SECRECY_PAPER_FIXTURE as DEF } from './secrecyPaper.fixture'

describe('the paper’s own names as fields', () => {
  it('are four, each at its own path, in the order the card lists them', () => {
    expect(PAPER_NAME_FIELDS.map((f) => [f.key, f.path, f.label])).toEqual([
      ['title', 'paper.title', 'Title'],
      ['job', 'paper.job', 'Job'],
      ['company', 'paper.company', 'Your company'],
      ['protectedParty', 'paper.protectedParty', 'Who it protects'],
    ])
    expect(PAPER_NAME_FIELDS.map((f) => f.key)).toEqual([...PAPER_NAME_KEYS])
  })

  it('read the words the paper holds, and the card’s rows say them', () => {
    for (const f of PAPER_NAME_FIELDS) expect(paperWordsAt(DEF, f.path)).toBe(DEF[f.key])
    expect(paperNameRows(DEF).map((r) => r.words)).toEqual([DEF.title, DEF.job, DEF.company, DEF.protectedParty])
    expect(paperWordsAt(DEF, 'paper.id')).toBeNull()
    expect(paperWordsAt(DEF, 'paper.words')).toBeNull()
    expect(paperWordsAt(DEF, 'paper')).toBeNull()
  })

  it('change one name and nothing else, and a path that names nothing changes nothing', () => {
    for (const f of PAPER_NAME_FIELDS) {
      const next = withPaperWords(DEF, f.path, 'A made-up name')
      expect(next[f.key]).toBe('A made-up name')
      expect({ ...next, [f.key]: DEF[f.key] }).toEqual(DEF)
    }
    expect(withPaperWords(DEF, 'paper.id', 'another-id')).toBe(DEF)
    expect(withPaperWords(DEF, 'paper.title', DEF.title)).toBe(DEF)
  })
})

describe('the page the names are on', () => {
  it('is the paper’s own, and no page of the flow', () => {
    for (const f of PAPER_NAME_FIELDS) expect(pathPage(f.path)).toBe(PAPER_NAMES_PAGE)
    expect(paperPages(DEF)).not.toContain(PAPER_NAMES_PAGE)
    expect(pageName(DEF, PAPER_NAMES_PAGE)).toBe("The paper's names")
  })

  it('leads the list of what changed, is marked changed, and goes back as one', () => {
    let draft = withPaperWords(DEF, 'paper.company', 'A made-up company')
    draft = withPaperWords(draft, 'paper.job', 'A made-up job')
    draft = withPaperWords(draft, 'notice.title', 'A made-up title for the first page')
    expect(changedPages(draft, DEF)).toEqual([PAPER_NAMES_PAGE, 'notice'])
    expect(isPathChanged(draft, DEF, 'paper.company')).toBe(true)
    expect(isPathChanged(draft, DEF, 'paper.title')).toBe(false)
    // Before the first publish nothing is changed, the names included.
    expect(changedPages(draft, null)).toEqual([])
    const back = revertPage(draft, DEF, PAPER_NAMES_PAGE)
    expect([back.title, back.job, back.company, back.protectedParty]).toEqual([DEF.title, DEF.job, DEF.company, DEF.protectedParty])
    expect(changedPages(back, DEF)).toEqual(['notice'])
    // The first page's change is still there: the way back puts back the names alone.
    expect(back.notice.title).toBe('A made-up title for the first page')
  })
})

describe('what a name must still say', () => {
  it('holds the publish while a name is empty, and names which', () => {
    expect(paperDefProblems(DEF)).toEqual([])
    expect(paperDefProblems(withPaperWords(DEF, 'paper.title', '  '))).toEqual(['The paper has no title.'])
    expect(paperDefProblems(withPaperWords(DEF, 'paper.job', ''))).toEqual(['The paper names no job.'])
    expect(paperDefProblems(withPaperWords(DEF, 'paper.company', ''))).toEqual(['The paper names no company.'])
    expect(paperDefProblems(withPaperWords(DEF, 'paper.protectedParty', ''))).toEqual(['The paper does not say who it protects.'])
  })

  it('still opens a draft with an empty name: only its shape is read to open it', () => {
    const draft = JSON.parse(JSON.stringify(withPaperWords(DEF, 'paper.title', '')))
    expect(parsePaperDef(draft).ok).toBe(true)
    expect(readPaperDef(draft).ok).toBe(false)
  })

  it('is a name and not a line: a name with a dash or over twenty words is not held to the plain-words rules', () => {
    const named = withPaperWords(DEF, 'paper.title', 'Job Secrecy Agreement (test) - a made-up title')
    expect(paperDefProblems(named)).toEqual([])
  })
})

describe('the card’s words', () => {
  it('are plain words', () => {
    expect([PAPER_NAMES_WORDS.title, PAPER_NAMES_WORDS.lead, PAPER_NAMES_WORDS.fine, ...PAPER_NAME_FIELDS.flatMap((f) => [f.label, f.field])].flatMap((t) => plainWordsFailures(t))).toEqual([])
  })
})
