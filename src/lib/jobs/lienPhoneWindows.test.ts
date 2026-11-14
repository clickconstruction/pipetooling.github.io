import { describe, expect, it } from 'vitest'
import { lienRunJourneyFoldWords, lienRunJourneyLine, lienWindowHeadFoldWords, lienWindowHeadFolded, lienWindowHeadStartsFolded, lienWindowScrollIsPaper } from './lienPhoneWindows'
import type { RunJourneyNode } from './runJourney'

const node = (key: RunJourneyNode['key'], label: string, over: Partial<RunJourneyNode> = {}): RunJourneyNode => ({ key, label, count: '0 of 7', done: false, state: 'todo', note: null, ...over })

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
  it('says the step the run stands on, the first not done, with its count and what blocks it', () => {
    const nodes = [node('built', 'Built', { done: true, state: 'done', count: '7 of 7' }), node('signed', 'Signed', { state: 'blocked', note: '7 wait on Sam' }), node('sent', 'Sent', { done: true, state: 'done', count: '7 of 7' }), node('mailed', 'In the mail'), node('recorded', 'Recorded'), node('delivered', 'Delivered')]
    expect(lienRunJourneyLine({ nodes })).toEqual({ head: 'Step 2 of 6 · Signed', count: '0 of 7 · 7 wait on Sam', warn: true, done: false })
  })

  it('a step with nothing in its way is not a warning', () => {
    const nodes = [node('built', 'Built', { done: true, state: 'done', count: '3 of 3' }), node('signed', 'Signed', { done: true, state: 'done', count: '3 of 3' }), node('sent', 'Sent', { state: 'now', count: '1 of 3' })]
    expect(lienRunJourneyLine({ nodes })).toEqual({ head: 'Step 3 of 3 · Sent', count: '1 of 3', warn: false, done: false })
  })

  it('says so when every step is done', () => {
    const nodes = [node('built', 'Built', { done: true, state: 'done', count: '3 of 3' }), node('delivered', 'Delivered', { done: true, state: 'done', count: '3 of 3' })]
    expect(lienRunJourneyLine({ nodes })).toEqual({ head: 'All 2 steps done', count: '3 of 3', warn: false, done: true })
  })

  it('the fold says what a press does', () => {
    expect([false, true].map(lienRunJourneyFoldWords)).toEqual(['Show the six steps', 'Hide the six steps'])
  })
})
