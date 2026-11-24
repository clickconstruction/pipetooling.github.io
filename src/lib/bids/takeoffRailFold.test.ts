import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { railFitsBeside } from './takeoffSheetFit'
import {
  RAIL_FOLD_STORAGE_KEY,
  RAIL_FOLD_WORDS,
  parseRailChoice,
  railMode,
  railPressOutcome,
  railStartsFolded,
  railStripFacts,
  readStoredRailChoice,
  writeStoredRailChoice,
} from './takeoffRailFold'

describe('railMode', () => {
  it('keeps the rail beside the list in a wide window until the person folds it', () => {
    expect(railMode({ fits: true, choice: null, panelOpen: false })).toBe('beside')
    expect(railMode({ fits: true, choice: 'open', panelOpen: false })).toBe('beside')
    expect(railMode({ fits: true, choice: 'folded', panelOpen: false })).toBe('folded')
  })

  it('always starts folded in a narrow window, whatever was chosen in a wide one', () => {
    expect(railMode({ fits: false, choice: null, panelOpen: false })).toBe('folded')
    expect(railMode({ fits: false, choice: 'open', panelOpen: false })).toBe('folded')
    expect(railMode({ fits: false, choice: 'folded', panelOpen: false })).toBe('folded')
  })

  it('opens over the list in a narrow window only while the person has it open', () => {
    expect(railMode({ fits: false, choice: 'folded', panelOpen: true })).toBe('over')
    expect(railMode({ fits: false, choice: null, panelOpen: true })).toBe('over')
  })

  it('never draws a panel over the list in a wide window', () => {
    expect(railMode({ fits: true, choice: 'open', panelOpen: true })).toBe('beside')
    expect(railMode({ fits: true, choice: 'folded', panelOpen: true })).toBe('folded')
  })
})

describe('railStartsFolded', () => {
  it('answers the measured windows: 1,400 px opens, 1,100, 900 and 760 start folded', () => {
    const at = (sheet: number) => railStartsFolded({ fits: railFitsBeside(sheet), choice: null })
    expect(at(1222)).toBe(false)
    expect(at(922)).toBe(true)
    expect(at(722)).toBe(true)
    expect(at(630)).toBe(true)
  })

  it('starts folded in a wide window only for the person who folded it', () => {
    expect(railStartsFolded({ fits: true, choice: 'folded' })).toBe(true)
    expect(railStartsFolded({ fits: true, choice: 'open' })).toBe(false)
  })
})

describe('railPressOutcome', () => {
  it('keeps a wide window’s press as the choice', () => {
    expect(railPressOutcome('hide', true)).toEqual({ panelOpen: false, choice: 'folded' })
    expect(railPressOutcome('show', true)).toEqual({ panelOpen: false, choice: 'open' })
  })

  it('keeps nothing of a narrow window’s press: it opens and shuts the panel', () => {
    expect(railPressOutcome('show', false)).toEqual({ panelOpen: true, choice: null })
    expect(railPressOutcome('hide', false)).toEqual({ panelOpen: false, choice: null })
  })
})

describe('the kept choice', () => {
  const store = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
  }

  it('reads back what was written, under its own key', () => {
    const s = store()
    expect(readStoredRailChoice(s)).toBeNull()
    writeStoredRailChoice(s, 'folded')
    expect(s.m.get(RAIL_FOLD_STORAGE_KEY)).toBe('folded')
    expect(readStoredRailChoice(s)).toBe('folded')
    writeStoredRailChoice(s, 'open')
    expect(readStoredRailChoice(s)).toBe('open')
  })

  it('reads anything else as no choice', () => {
    expect(parseRailChoice('over')).toBeNull()
    expect(parseRailChoice('')).toBeNull()
    expect(parseRailChoice(null)).toBeNull()
    expect(parseRailChoice(undefined)).toBeNull()
  })

  it('draws right when the browser refuses: a read is no choice and a write does nothing', () => {
    const refuses = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(readStoredRailChoice(refuses)).toBeNull()
    expect(() => writeStoredRailChoice(refuses, 'folded')).not.toThrow()
    expect(readStoredRailChoice(null)).toBeNull()
    expect(() => writeStoredRailChoice(undefined, 'open')).not.toThrow()
  })
})

describe('railStripFacts', () => {
  it('says costed as N of M, amber until every fixture has lines', () => {
    expect(railStripFacts({ costed: 4, fixtures: 10, uncosted: 6, noCost: 6 })).toMatchObject({ costed: '4 of 10', allCosted: false, noCost: 6 })
    expect(railStripFacts({ costed: 10, fixtures: 10, uncosted: 0, noCost: 0 })).toMatchObject({ costed: '10 of 10', allCosted: true, noCost: 0 })
    expect(railStripFacts({ costed: 0, fixtures: 0, uncosted: 0, noCost: 0 }).allCosted).toBe(false)
  })

  it('counts a fixture whose lines all price at $0 as no cost, though it is costed', () => {
    const f = railStripFacts({ costed: 10, fixtures: 10, uncosted: 0, noCost: 1 })
    expect(f.allCosted).toBe(true)
    expect(f.noCost).toBe(1)
    expect(f.noCostSentence).toBe('1 fixture carries no material cost. Pricing shows it as no cost.')
  })

  it('says nothing in red when every fixture carries a cost', () => {
    const f = railStripFacts({ costed: 3, fixtures: 3, uncosted: 0, noCost: 0 })
    expect(f.noCost).toBe(0)
    expect(f.noCostSentence).toBe('')
  })

  it('writes the chip’s sentence in plain words', () => {
    for (const n of [1, 2, 26]) {
      const f = railStripFacts({ costed: 0, fixtures: 30, uncosted: 30, noCost: n })
      expect(plainWordsFailures(f.noCostSentence)).toEqual([])
      expect(f.noCostSentence.startsWith(`${n} fixture`)).toBe(true)
    }
  })

  it('names the press by what it does', () => {
    expect(RAIL_FOLD_WORDS.show).toBe('Show')
    expect(RAIL_FOLD_WORDS.hide).toBe('Hide')
    expect(RAIL_FOLD_WORDS.showName).toBe('Show What Pricing sees')
    expect(RAIL_FOLD_WORDS.hideName).toBe('Hide What Pricing sees')
  })
})
