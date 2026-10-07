/**
 * Main's own tests for where the work is (G-83; the schedule's PR 1a): places set, tidied, taken off
 * and refused, and what a move does to a crowded place, run through the kernels on the test data.
 * On Fair Oaks D no bar has a place; with every guess kept, inside has three trades at once until
 * Fri Oct 9 (the spike's own cases).
 */
import { describe, expect, it } from 'vitest'
import type { GcState } from '../types'
import { planMove } from './moves'
import { crowdingAfterMove, keptPlaces, placeChanges, placeRows, placesLogWords, withPlaces } from './places'
import { scheduleItems } from './schedule'
import { initialGcState } from './testState'

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!
const lineOf = (s: GcState, label: string) => scheduleItems(s, job(s)).find((i) => i.label === label && i.pkg)!.activity.lineId

/** The made-up job with the places sent, as Keep these places and the opened bar send them. */
function withPlacesSet(s: GcState, places: Record<string, string | null>): GcState {
  const changes = placeChanges(job(s).schedule!.activities, places)!
  return { ...s, projects: s.projects.map((p) => (p.id === ID ? { ...p, schedule: { ...p.schedule!, activities: withPlaces(p.schedule!.activities, changes) } } : p)) }
}
/** Every guess kept. */
function guessesKept(s = initialGcState()): GcState {
  return withPlacesSet(s, Object.fromEntries(placeRows(s, job(s)).flatMap((r) => (r.guess ? [[r.lineId, r.guess.place]] : []))))
}

describe('a bar’s place', () => {
  it('keeps every guess in one press, and says so in the log', () => {
    const s = initialGcState()
    expect(keptPlaces(job(s)).size).toBe(0)
    const guesses = Object.fromEntries(placeRows(s, job(s)).flatMap((r) => (r.guess ? [[r.lineId, r.guess.place]] : [])))
    expect(placesLogWords(job(s), placeChanges(job(s).schedule!.activities, guesses)!)).toBe('Set places on 13 bars at Fair Oaks Shops, Building D.')
    const after = guessesKept()
    expect(keptPlaces(job(after)).size).toBe(13)
    expect(keptPlaces(job(after)).get(lineOf(after, 'Rooftop units'))).toBe('Roof')
  })

  it('sets one place tidied, takes it off, and refuses what cannot take one', () => {
    const s = initialGcState()
    const topOut = lineOf(s, 'Top out')
    const activities = job(s).schedule!.activities
    expect(placeChanges(activities, { [topOut]: '  Level   2 ' })).toEqual([{ lineId: topOut, place: 'Level 2' }])
    const set = withPlacesSet(s, { [topOut]: '  Level   2 ' })
    expect(job(set).schedule!.activities.find((a) => a.lineId === topOut)?.place).toBe('Level 2')
    expect(placesLogWords(job(set), [{ lineId: topOut, place: 'Level 2' }])).toBe('Set the place of Top out to Level 2.')
    // The same place again changes nothing.
    expect(placeChanges(job(set).schedule!.activities, { [topOut]: 'Level 2' })).toEqual([])
    for (const off of [null, '   ']) {
      const changes = placeChanges(job(set).schedule!.activities, { [topOut]: off })!
      expect(changes).toEqual([{ lineId: topOut, place: null }])
      expect(withPlaces(job(set).schedule!.activities, changes).find((a) => a.lineId === topOut)).not.toHaveProperty('place')
      expect(placesLogWords(job(set), changes)).toBe('Took the place off Top out.')
    }
    expect(placesLogWords(job(set), [{ lineId: topOut, place: null }, { lineId: lineOf(s, 'Trim'), place: 'Level 2' }])).toBe('Set places on 1 bar at Fair Oaks Shops, Building D and took 1 off.')
    expect(placeChanges(activities, { 'fairoaksd-insp-roughin': 'Inside' })).toBeNull()
    expect(placeChanges(activities, { nope: 'Inside' })).toBeNull()
    expect(placeChanges(activities, { [topOut]: 'x'.repeat(41) })).toBeNull()
  })
})

describe('what a move does to a crowded place', () => {
  it('says before a move saves when it crowds a place or clears one, and nothing with no places kept', () => {
    const s = guessesKept()
    const fire = lineOf(s, 'Fire alarm')
    expect(crowdingAfterMove(s, job(s), planMove(job(s), fire, '2026-11-30', '2026-12-18')!.activities)).toEqual([{ words: 'Too many in one place: Inside would have 3 trades at once, Mon Nov 30 to Fri Dec 4.', tone: 'amber' }])
    const topOut = lineOf(s, 'Top out')
    expect(crowdingAfterMove(s, job(s), planMove(job(s), topOut, '2026-10-10', '2026-10-21')!.activities)).toEqual([{ words: 'Too many in one place: this clears Inside, Fri Oct 2 to Fri Oct 9.', tone: 'green' }])
    const fresh = initialGcState()
    expect(crowdingAfterMove(fresh, job(fresh), planMove(job(fresh), fire, '2026-11-30', '2026-12-18')!.activities)).toEqual([])
  })
})
