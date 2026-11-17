import { describe, expect, it } from 'vitest'
import { lienRunJourneyFoldWords, lienRunJourneyLine, lienWindowHeadFoldWords, lienWindowHeadFolded, lienWindowHeadStartsFolded, lienWindowScrollIsPaper } from './lienPhoneWindows'
import type { LienRunNode } from './lienRunParts'

const node = (step: LienRunNode['step'], label: string, over: Partial<LienRunNode> = {}): LienRunNode => ({ step, label, count: '0 of 7', state: 'todo', ...over })

describe('lienWindowHeadFolded', () => {
  const paper = { scrollHeight: 4203, clientHeight: 168, foldable: 275 }

  it('folds once the paper is 48 px down, and not before', () => {
    expect(lienWindowHeadFolded({ ...paper, folded: false, scrollTop: 0 })).toBe(false)
    expect(lienWindowHeadFolded({ ...paper, folded: false, scrollTop: 48 })).toBe(false)
    expect(lienWindowHeadFolded({ ...paper, folded: false, scrollTop: 49 })).toBe(true)
  })

  it('stays folded until the paper is back at its very top', () => {
    expect(lienWindowHeadFolded({ ...paper, folded: true, scrollTop: 300 })).toBe(true)
    expect(lienWindowHeadFolded({ ...paper, folded: true, scrollTop: 3 })).toBe(true)
    expect(lienWindowHeadFolded({ ...paper, folded: true, scrollTop: 2 })).toBe(false)
    expect(lienWindowHeadFolded({ ...paper, folded: true, scrollTop: 0 })).toBe(false)
  })

  it('does not fold over a short paper that would fit whole with the header gone, so it cannot flap', () => {
    // 520 of content in a 300 px window scrolls 220; with a 275 px header gone it would not scroll at all.
    expect(lienWindowHeadFolded({ folded: false, scrollTop: 120, scrollHeight: 520, clientHeight: 300, foldable: 275 })).toBe(false)
    // 700 of content: 125 px of scroll left after the fold, enough.
    expect(lienWindowHeadFolded({ folded: false, scrollTop: 120, scrollHeight: 700, clientHeight: 300, foldable: 275 })).toBe(true)
  })
})

describe('a header too tall for the screen', () => {
  it('starts folded when the paper would open with under 140 px, and only once the page has heights', () => {
    expect(lienWindowHeadStartsFolded({ card: 520, paper: 24 })).toBe(true)
    expect(lienWindowHeadStartsFolded({ card: 720, paper: 225 })).toBe(false)
    expect(lienWindowHeadStartsFolded({ card: 720, paper: 139 })).toBe(true)
    expect(lienWindowHeadStartsFolded({ card: 0, paper: 0 })).toBe(false)
  })

  it('held folded, a scroll to the top does not bring it back', () => {
    expect(lienWindowHeadFolded({ folded: true, held: true, scrollTop: 0, scrollHeight: 4000, clientHeight: 300, foldable: 0 })).toBe(true)
    expect(lienWindowHeadFolded({ folded: true, held: false, scrollTop: 0, scrollHeight: 4000, clientHeight: 300, foldable: 0 })).toBe(false)
  })

  it('its press says what it will do', () => {
    expect(lienWindowHeadFoldWords(true)).toEqual({ label: 'Show the next step and the job’s details', mark: '▾' })
    expect(lienWindowHeadFoldWords(false)).toEqual({ label: 'Hide the next step and the job’s details', mark: '▴' })
  })
})

describe('lienWindowScrollIsPaper', () => {
  it('is a scroll up and down outside the header', () => {
    expect(lienWindowScrollIsPaper({ scrollHeight: 4203, clientHeight: 168, insideHead: false })).toBe(true)
  })
  it('is not the tab strip sliding sideways, nor a list inside the header', () => {
    expect(lienWindowScrollIsPaper({ scrollHeight: 40, clientHeight: 40, insideHead: false })).toBe(false)
    expect(lienWindowScrollIsPaper({ scrollHeight: 900, clientHeight: 300, insideHead: true })).toBe(false)
  })
})

describe('lienRunJourneyLine', () => {
  it('says the step the run is on with its count, amber while it stands on what stops a notice', () => {
    const nodes = [node(1, 'Get them right', { state: 'now', count: '8 of 15 are ready' }), node(2, 'Print'), node(3, 'Mail and record')]
    expect(lienRunJourneyLine(nodes)).toEqual({ head: 'Step 1 of 3 · Get them right', count: '8 of 15 are ready', warn: true, done: false })
  })

  it('a later step is not a warning', () => {
    const nodes = [node(1, 'Get them right', { state: 'done' }), node(2, 'Print', { state: 'done' }), node(3, 'Mail and record', { state: 'now', count: '7 of 9 numbers typed' })]
    expect(lienRunJourneyLine(nodes)).toEqual({ head: 'Step 3 of 3 · Mail and record', count: '7 of 9 numbers typed', warn: false, done: false })
  })

  it('says so when nothing is in the run', () => {
    expect(lienRunJourneyLine([node(1, 'Get them right'), node(2, 'Print'), node(3, 'Mail and record')])).toEqual({ head: 'Nothing is in this run', count: '', warn: false, done: true })
  })

  it('the fold says what a press does', () => {
    expect([false, true].map(lienRunJourneyFoldWords)).toEqual(['Show the three steps', 'Hide the three steps'])
  })
})
