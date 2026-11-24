import { describe, expect, it } from 'vitest'
import { basisNote, confirmWords, levelFacts, startFlow, startSettings, withPaperOff, type PaperDef } from './documentBuilder'
import { basisNotePath, confirmPaths, factFieldLabel, factPath, sectionPath } from './flowFields'
import { changedPages, pageName, paperWordsAt, pathPage, revertPage, withPaperWords } from './paperEdit'
import { SECRECY_PAPER_FIXTURE as DEF } from './secrecyPaper.fixture'

const ON = startSettings(DEF)
const OFF = withPaperOff(ON)
const FLOW = startFlow()

describe('a topic’s section name', () => {
  it('is typed at its own path, and the typing changes the name the clause strip reads', () => {
    for (const t of DEF.topics) expect(paperWordsAt(DEF, sectionPath(t.key))).toBe(t.section)
    const key = DEF.topics[0]!.key
    const next = withPaperWords(DEF, sectionPath(key), 'A made-up section name')
    expect(next.topics[0]?.section).toBe('A made-up section name')
    // It is the topic's name page that changed, and the way back puts it back.
    expect(changedPages(next, DEF)).toEqual([`topic:${key}`])
    expect(revertPage(next, DEF, `topic:${key}`)).toEqual(DEF)
  })
})

describe('the name of a fact above the basis slider', () => {
  it('is typed at the path of the words the fact reads, on every level', () => {
    for (const level of DEF.levels) {
      const facts = levelFacts(DEF, level.id)
      expect(facts.length).toBeGreaterThan(1)
      for (const fact of facts) {
        const path = factPath(DEF, fact.key)
        expect(path).not.toBe('')
        expect(paperWordsAt(DEF, path)).toBe(fact.label)
      }
    }
  })

  it('names the site’s count by the paper’s own word for it, and a topic’s fact by its fact name', () => {
    expect(factPath(DEF, 'site')).toBe('words.siteFact')
    const withFact = DEF.topics.find((t) => t.fact != null)!
    expect(factPath(DEF, withFact.key)).toBe(`topic.${withFact.key}.fact`)
    expect(factFieldLabel(DEF, withFact.key)).toBe(`The name of the fact for ${withFact.label}`)
    expect(factFieldLabel(DEF, 'site')).toBe('The name of the fact that counts what the site must have')
    expect(factPath(DEF, 'no-such-fact')).toBe('')
  })

  it('falls to the topic’s label when the topic has a blank and no fact name, so the typing lands', () => {
    const key = DEF.topics.find((t) => t.fact != null)!.key
    const bare: PaperDef = { ...DEF, topics: DEF.topics.map((t) => (t.key === key ? (({ fact: _gone, ...rest }) => rest)(t) : t)) }
    const fact = levelFacts(bare, DEF.levels[0]!.id).find((f) => f.key === key)
    expect(fact?.label).toBe(bare.topics.find((t) => t.key === key)?.label)
    expect(factPath(bare, key)).toBe(`topic.${key}.label`)
    const typed = withPaperWords(bare, factPath(bare, key), 'A made-up name')
    expect(levelFacts(typed, DEF.levels[0]!.id).find((f) => f.key === key)?.label).toBe('A made-up name')
  })

  it('changes the fact as it is typed, and lists the page the words belong to', () => {
    const site = withPaperWords(DEF, factPath(DEF, 'site'), 'A made-up count')
    expect(levelFacts(site, DEF.levels[0]!.id).find((f) => f.key === 'site')?.label).toBe('A made-up count')
    expect(changedPages(site, DEF)).toEqual(['basis'])
    const key = DEF.topics.find((t) => t.fact != null)!.key
    const fact = withPaperWords(DEF, factPath(DEF, key), 'A made-up fact')
    expect(levelFacts(fact, DEF.levels[0]!.id).find((f) => f.key === key)?.label).toBe('A made-up fact')
    expect(changedPages(fact, DEF)).toEqual([`topic:${key}`])
  })
})

describe('what the basis page says when the whole paper is Off', () => {
  it('is a field only while the paper is Off: on, the line is a count the flow works out', () => {
    expect(basisNotePath(ON)).toBeNull()
    expect(basisNotePath(OFF)).toBe('words.offSays')
    expect(paperWordsAt(DEF, 'words.offSays')).toBe(basisNote(DEF, OFF))
  })

  it('belongs to the basis page, where it is read: typing it lists The basis, and the way back puts it back', () => {
    expect(pathPage('words.offSays')).toBe('basis')
    const next = withPaperWords(DEF, 'words.offSays', 'A made-up Off line.')
    expect(basisNote(next, OFF)).toBe('A made-up Off line.')
    expect(changedPages(next, DEF)).toEqual(['basis'])
    expect(pageName(next, 'basis')).toBe('The basis')
    expect(revertPage(next, DEF, 'basis')).toEqual(DEF)
    // The review's own words are still the review's.
    expect(pathPage('words.offReview')).toBe('review')
    expect(pathPage('words.confirmPress')).toBe('review')
  })
})

describe('the last step’s press and the line under it', () => {
  it('are typed at the paths of the words they read, Off and on', () => {
    for (const [s, flow] of [
      [ON, FLOW],
      [OFF, FLOW],
    ] as const) {
      const said = confirmWords(DEF, s, flow)
      const paths = confirmPaths(s, flow)
      expect(paperWordsAt(DEF, paths.label)).toBe(said.label)
      expect(paths.note).not.toBeNull()
      expect(paperWordsAt(DEF, paths.note as string)).toBe(said.note)
    }
    expect(confirmPaths(ON, FLOW)).toEqual({ label: 'words.confirmPress', note: 'words.beforeConfirm' })
    expect(confirmPaths(OFF, FLOW)).toEqual({ label: 'words.nothingPress', note: 'words.offNote' })
  })

  it('leave the line alone once the press is pressed: it is then a count of who was asked', () => {
    expect(confirmPaths(ON, { done: true })).toEqual({ label: 'words.confirmPress', note: null })
    // Off, nothing can be pressed, so the line stays the paper's own.
    expect(confirmPaths(OFF, { done: true }).note).toBe('words.offNote')
  })

  it('change the press and its line as they are typed, on the review page', () => {
    const next = withPaperWords(withPaperWords(DEF, 'words.confirmPress', 'A made-up press'), 'words.beforeConfirm', 'A made-up line.')
    expect(confirmWords(next, ON, FLOW)).toMatchObject({ label: 'A made-up press', note: 'A made-up line.' })
    expect(changedPages(next, DEF)).toEqual(['review'])
  })
})
