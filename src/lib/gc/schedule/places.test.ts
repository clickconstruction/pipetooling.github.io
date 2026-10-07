/**
 * The tests of `gcPlaces.test.ts` on branch spike/gc-mode that read only these kernels and the made-up data,
 * moved word for word (the schedule's PR 1a). The data is `testState.ts`, the prototype's fixture cut to
 * what the kernels read. The tests that play the prototype's reducer or read another lane stay on the
 * spike, where they run against these kernels, until their presses and lanes reach main.
 */
import { describe, expect, it } from 'vitest'
import { placeGuess, placeRows } from './places'
import { initialGcState } from './testState'
import type { GcState } from '../types'

const ID = 'fairoaksd'

const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

describe('where a place comes from', () => {
  it('guesses each bar not done from its name, its trade or its stage, and leaves the frame with none', () => {
    expect(placeRows(initialGcState(), job(initialGcState())).map((r) => `${r.name}: ${r.guess ? `${r.guess.place}, ${r.guess.from}` : 'none'}`)).toEqual([
      'Structural steel · Erection: none',
      'Roofing · TPO membrane: Roof, name',
      'Roofing · Sheet metal and flashing: Roof, name',
      'Roofing · Roof curbs: Roof, name',
      'Electrical · Panels and feeders: Inside, stage',
      'Electrical · Lighting: Inside, stage',
      'Electrical · Site lighting: Site, name',
      'Electrical · Fire alarm: Inside, stage',
      'Plumbing · Top out: Inside, stage',
      'HVAC · Ductwork: Inside, stage',
      'HVAC · Rooftop units: Roof, name',
      'HVAC · Controls: Inside, stage',
      'Plumbing · Trim: Inside, stage',
      'HVAC · Test and balance: Inside, stage',
    ])
  })

  it('reads a floor or a suite from the name, the trade when the name says nothing, and whole words only', () => {
    expect(placeGuess('Framing and drywall', 'Framing, level 2')).toEqual({ place: 'Level 2', from: 'name' })
    expect(placeGuess('Painting', 'Suite 101 ceilings')).toEqual({ place: 'Suite 101', from: 'name' })
    expect(placeGuess('Glass and storefront', 'Interior storefront')).toEqual({ place: 'Inside', from: 'name' })
    expect(placeGuess('Roofing', 'Insulation')).toEqual({ place: 'Roof', from: 'trade' })
    expect(placeGuess('HVAC', 'Rooftop units')).toEqual({ place: 'Roof', from: 'name' })
    // "Composite" is no site, and the frame is the whole building: no guess.
    expect(placeGuess('Structural steel', 'Composite deck')).toBeNull()
    expect(placeGuess('Concrete', 'Slab on grade')).toBeNull()
  })
})
