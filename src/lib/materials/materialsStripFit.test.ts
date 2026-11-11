import { describe, expect, it } from 'vitest'

import { foldedGroupLabel, stripFit, type StripFitInput } from './materialsStripFit'

/** The office's strip, in round numbers near the real ones: open 380 / 590 / 320, folded 90 / 120 / 170, 21 between. */
const office = (over: Partial<StripFitInput>): StripFitInput => ({
  groups: ['plan', 'purchase', 'track'],
  here: 'track',
  opened: null,
  openWidths: { plan: 380, purchase: 590, track: 320 },
  foldWidths: { plan: 90, purchase: 120, track: 170 },
  gap: 21,
  available: 1400,
  ...over,
})

describe('stripFit', () => {
  it('leaves everything open when the strip fits, and before anything is measured', () => {
    expect(stripFit(office({ available: 1332 }))).toEqual({ shape: 'row', open: ['plan', 'purchase', 'track'] })
    expect(stripFit(office({ available: 0 }))).toEqual({ shape: 'row', open: ['plan', 'purchase', 'track'] })
  })

  it('folds only what has to fold: on Track at 1,180 Purchase folds and Plan stays', () => {
    // all open = 1332; plan + track open with purchase folded = 380 + 120 + 320 + 42 = 862
    expect(stripFit(office({ available: 1180 }))).toEqual({ shape: 'row', open: ['plan', 'track'] })
  })

  it('keeps Track open beside Plan on Parts Book, so its presses stay on screen', () => {
    expect(stripFit(office({ here: 'plan', available: 1180 }))).toEqual({ shape: 'row', open: ['plan', 'track'] })
    // on Supply houses: purchase open (590) + plan open (380) + track folded (170) + 42 = 1182 > 1180, so Plan folds and Track fits
    expect(stripFit(office({ here: 'purchase', available: 1180 }))).toEqual({ shape: 'row', open: ['purchase', 'track'] })
  })

  it('at a tablet’s width only the group with the open tab stays', () => {
    // track open + two folded = 320 + 90 + 120 + 42 = 572; adding plan = 862 > 700
    expect(stripFit(office({ available: 700 }))).toEqual({ shape: 'row', open: ['track'] })
  })

  it('a pressed group opens first, then the open tab’s group if there is still room', () => {
    expect(stripFit(office({ opened: 'purchase', available: 1180 }))).toEqual({ shape: 'row', open: ['purchase', 'track'] })
    // at 700 Purchase alone fits (590 + 90 + 170 + 42 = 892 > 700): too wide even alone, so the names take their own row
    expect(stripFit(office({ opened: 'purchase', available: 700 }))).toEqual({ shape: 'rows', open: ['purchase'] })
    // Plan pressed at 700: 380 + 120 + 170 + 42 = 712 > 700 as well
    expect(stripFit(office({ opened: 'plan', available: 760 }))).toEqual({ shape: 'row', open: ['plan'] })
  })

  it('on a phone the names take a row and the open group’s tabs sit under them', () => {
    expect(stripFit(office({ available: 343 }))).toEqual({ shape: 'rows', open: ['track'] })
    expect(stripFit(office({ available: 343, opened: 'plan' }))).toEqual({ shape: 'rows', open: ['plan'] })
  })

  it('two groups fit where three do not: a primary’s strip stays whole at 700', () => {
    const primary: StripFitInput = { groups: ['plan', 'track'], here: 'plan', opened: null, openWidths: { plan: 270, track: 320 }, foldWidths: { plan: 90, track: 170 }, gap: 21, available: 700 }
    expect(stripFit(primary)).toEqual({ shape: 'row', open: ['plan', 'track'] })
    expect(stripFit({ ...primary, available: 500 })).toEqual({ shape: 'row', open: ['plan'] })
  })

  it('ignores a pressed group the role does not have, and an empty strip', () => {
    expect(stripFit({ groups: ['plan', 'track'], here: 'plan', opened: 'purchase', openWidths: { plan: 270, track: 320 }, foldWidths: { plan: 90, track: 170 }, gap: 21, available: 500 })).toEqual({ shape: 'row', open: ['plan'] })
    expect(stripFit({ groups: [], here: 'plan', opened: null, openWidths: {}, foldWidths: {}, gap: 21, available: 500 })).toEqual({ shape: 'row', open: [] })
  })
})

describe('foldedGroupLabel', () => {
  it('names the group, where the open tab is and what needs a hand', () => {
    expect(foldedGroupLabel('Purchase', null, [])).toBe('Purchase. Show its tabs.')
    expect(foldedGroupLabel('Track', 'On site', ['3 due a count'])).toBe('Track, on On site, 3 due a count. Show its tabs.')
    // an open name on the phone's row is its name and its badges: there is nothing left to show
    expect(foldedGroupLabel('Track', null, ['3 due a count'], false)).toBe('Track, 3 due a count')
  })
})
