import { describe, expect, it } from 'vitest'
import { compareLabels } from './onSite'
import { addPressLabel, boxNameVerdict, isBoxName, movedWordsNote, nameTakenBy, nextFreeName, parseBoxName, readTypedName, sentenceWords, siteBoxesFor, siteLetters, whereWithWords, type SiteBox } from './boxName'

const box = (label: string, over: Partial<SiteBox> = {}): SiteBox => ({ id: label.toLowerCase(), label, kind: 'cage', retiredAt: null, createdAt: '2026-11-01T12:00:00Z', ...over })

describe('parseBoxName', () => {
  it('reads one to three letters, a number from 1 to 999 and one letter after it', () => {
    expect(parseBoxName('R7')).toEqual({ letters: 'R', number: 7, tail: '' })
    expect(parseBoxName(' ab12 ')).toEqual({ letters: 'AB', number: 12, tail: '' })
    expect(parseBoxName('G24B')).toEqual({ letters: 'G', number: 24, tail: 'B' })
    expect(parseBoxName('XYZ999A')).toEqual({ letters: 'XYZ', number: 999, tail: 'A' })
  })

  it('refuses zeros in front, four letters, a fourth digit, two letters after, words and Unsorted', () => {
    for (const bad of ['R007', 'R0', 'ABCD1', 'R1000', 'G24BC', 'R76 TOILETS', 'CONCRETE MIX', 'Unsorted', 'A1 (2)', '', '7']) expect(isBoxName(bad), bad).toBe(false)
  })
})

describe('readTypedName', () => {
  it('splits the words off a name and says them as a line', () => {
    expect(readTypedName('R76 TOILETS')).toEqual({ kind: 'name', name: 'R76', words: 'Toilets', zerosDropped: false })
    expect(readTypedName('  r 76   kohler  toilets ')).toEqual({ kind: 'name', name: 'R76', words: 'Kohler toilets', zerosDropped: false })
    expect(readTypedName('G24B')).toEqual({ kind: 'name', name: 'G24B', words: '', zerosDropped: false })
    expect(readTypedName('g24b copper')).toEqual({ kind: 'name', name: 'G24B', words: 'Copper', zerosDropped: false })
    expect(readTypedName('R007')).toEqual({ kind: 'name', name: 'R7', words: '', zerosDropped: true })
  })

  it('reads letters alone, words alone, nothing, and a number off the rule', () => {
    expect(readTypedName('r')).toEqual({ kind: 'letters', letters: 'R' })
    expect(readTypedName('CONCRETE MIX')).toEqual({ kind: 'words', words: 'Concrete mix' })
    expect(readTypedName('MISL PILE OF JUNK PIPE')).toEqual({ kind: 'words', words: 'Misl pile of junk pipe' })
    expect(readTypedName('4 inch pvc')).toEqual({ kind: 'words', words: '4 inch pvc' })
    expect(readTypedName('ABCD1')).toEqual({ kind: 'words', words: 'Abcd1' })
    expect(readTypedName('   ')).toEqual({ kind: 'empty' })
    expect(readTypedName('T8678')).toEqual({ kind: 'big-number', typed: 'T8678' })
    expect(readTypedName('A0')).toEqual({ kind: 'big-number', typed: 'A0' })
  })

  it('says words as a line reads', () => {
    expect(sentenceWords(' PVC  FITTINGS ')).toBe('Pvc fittings')
    expect(sentenceWords('')).toBe('')
  })
})

describe('siteLetters and nextFreeName', () => {
  const site = [box('R1'), box('R2'), box('R3', { retiredAt: '2026-11-02T00:00:00Z' }), box('A1', { retiredAt: '2026-11-02T00:00:00Z' }), box('A2', { retiredAt: '2026-11-02T00:00:00Z' }), box('G5'), box('CONCRETE MIX'), box('Unsorted', { kind: 'unsorted' })]

  it('reads the letters most live boxes carry, old names and Unsorted aside', () => {
    expect(siteLetters(site)).toBe('R')
  })

  it('breaks a tie by the newest live box', () => {
    expect(siteLetters([box('A1', { createdAt: '2026-11-01T00:00:00Z' }), box('R1', { createdAt: '2026-11-03T00:00:00Z' })])).toBe('R')
    expect(siteLetters([box('B1'), box('A1')])).toBe('A')
  })

  it('has no letter for a site with no boxes or old names only', () => {
    expect(siteLetters([])).toBeNull()
    expect(siteLetters([box('CONCRETE MIX'), box('Cage A')])).toBeNull()
    expect(nextFreeName([])).toBeNull()
  })

  it('offers one past the highest number, a retired box’s number never again', () => {
    expect(nextFreeName(site)).toBe('R4')
    expect(nextFreeName(site, 'A')).toBe('A3')
    expect(nextFreeName(site, 'g')).toBe('G6')
    expect(nextFreeName(site, 'Q')).toBe('Q1')
  })

  it('counts a lettered twin’s number as taken: G24B makes G25 the next, and G24 is never offered', () => {
    expect(nextFreeName([box('G23'), box('G24B')])).toBe('G25')
  })

  it('reads by number, not by text: R9 then R10', () => {
    expect(nextFreeName([box('R9'), box('R10')])).toBe('R11')
  })

  it('runs out at 999', () => {
    expect(nextFreeName([box('R999')])).toBeNull()
  })
})

describe('boxNameVerdict', () => {
  const site = [box('R1'), box('R2'), box('R12'), box('R88'), box('G24B'), box('R3', { retiredAt: '2026-11-02T00:00:00Z' })]

  it('offers the next free name when nothing is typed', () => {
    expect(boxNameVerdict('', site)).toEqual({ ok: true, name: 'R89', words: '', say: 'R89 is the next free name on this site.', tone: 'ok' })
    expect(addPressLabel(boxNameVerdict('', site))).toBe('Add R89')
  })

  it('keeps a typed name and moves its words', () => {
    expect(boxNameVerdict('R90 TOILETS', site)).toEqual({ ok: true, name: 'R90', words: 'Toilets', say: 'The name is R90.', tone: 'ok' })
    expect(boxNameVerdict('R007', site)).toMatchObject({ ok: true, name: 'R7', say: 'Zeros in front are dropped. The name is R7.' })
    expect(boxNameVerdict('G24C', site)).toMatchObject({ ok: true, name: 'G24C' })
  })

  it('gives words alone the next free name', () => {
    expect(boxNameVerdict('concrete mix', site)).toEqual({ ok: true, name: 'R89', words: 'Concrete mix', say: 'No letter and number in that. The next free name is R89.', tone: 'wait' })
  })

  it('gives letters alone the next free name under them', () => {
    expect(boxNameVerdict('g', site)).toEqual({ ok: true, name: 'G25', words: '', say: 'G25 is the next free G name on this site.', tone: 'ok' })
    expect(boxNameVerdict('Q', site)).toMatchObject({ ok: true, name: 'Q1', say: 'Q1 is the first Q box on this site.' })
  })

  it('refuses a live name on the site, a retired one aside, and a number off the rule', () => {
    expect(boxNameVerdict('r12 copper', site)).toEqual({ ok: false, name: null, words: 'Copper', say: 'R12 is already on this site. Pick another name, or take R89.' })
    expect(boxNameVerdict('R3', site)).toMatchObject({ ok: true, name: 'R3' })
    expect(boxNameVerdict('T8678', site)).toEqual({ ok: false, name: null, words: '', say: 'A number runs from 1 to 999. T8678 cannot be a name.' })
    expect(addPressLabel(boxNameVerdict('T8678', site))).toBe('Add it')
  })

  it('lets a box keep its own name', () => {
    expect(boxNameVerdict('R12', site, 'r12')).toMatchObject({ ok: true, name: 'R12' })
    expect(nameTakenBy(site, 'r12', 'r12')).toBeNull()
    expect(nameTakenBy(site, 'r12')?.label).toBe('R12')
  })

  it('asks for the letter once on a site with no named box', () => {
    expect(boxNameVerdict('', [])).toEqual({ ok: false, name: null, words: '', say: 'This site has no named box yet. Type the letters painted on the steel and the number 1, like R1.' })
    expect(boxNameVerdict('toilets', [box('Cage A')])).toMatchObject({ ok: false, words: 'Toilets', say: expect.stringContaining('No letter and number in that. This site has no named box yet.') })
    expect(boxNameVerdict('R1', [])).toMatchObject({ ok: true, name: 'R1' })
    expect(boxNameVerdict('R', [])).toMatchObject({ ok: true, name: 'R1', say: 'R1 is the first R box on this site.' })
  })

  it('says where the words go', () => {
    expect(movedWordsNote('Toilets')).toBe('“Toilets” goes on the where line for now. Soon it will be the box’s own line.')
    expect(whereWithWords('', 'Toilets')).toBe('Toilets')
    expect(whereWithWords(' by the north  stair ', 'Toilets')).toBe('by the north stair · Toilets')
    expect(whereWithWords(' by the stair ', '')).toBe('by the stair')
  })
})

describe('siteBoxesFor', () => {
  it('takes the other jobs’ boxes from the site read and this job’s from the store', () => {
    const rows = [{ ...box('R1'), jobId: 'j1' }, { ...box('R2'), jobId: 'j2' }]
    const own = [box('R1'), box('R5')]
    expect(siteBoxesFor('j1', rows, own).map((b) => b.label)).toEqual(['R2', 'R1', 'R5'])
  })
})

describe('compareLabels with a letter after the number', () => {
  it('sorts as people read: G2, G10, G24, G24B, G25', () => {
    expect(['G25', 'G24B', 'G10', 'G24', 'G2'].sort(compareLabels)).toEqual(['G2', 'G10', 'G24', 'G24B', 'G25'])
  })
})
