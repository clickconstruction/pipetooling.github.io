/**
 * What changed under a quote, read on main's test data through `reachOf` (the Board's B2b-vi, call E3'). With the index the test
 * data carries (the prototype's own walk, written by schedule-test-state.ts), main names the same lines as the prototype's golden
 * test. With no index, as on a board that maps none, it names no guessed line and falls back to the trade's sheets.
 */
import { describe, expect, it } from 'vitest'
import { initialGcState } from './schedule/testState'
import { reachOf, staleChange, staleWords } from './stale'
import type { GcProject } from './types'

const boerne = (): GcProject => {
  const p = initialGcState().projects.find((x) => x.id === 'boerne')
  if (!p) throw new Error('no Boerne')
  return p
}

/** The project as a board that maps no index reads it. */
const withoutIndex = (p: GcProject): GcProject => {
  const bare = { ...p }
  delete bare.index
  return bare
}

/** Every quote on the project priced on older plans, with what changed under it in words. */
const staleQuotes = (project: GcProject) =>
  project.packages.flatMap((pkg) =>
    pkg.invites.flatMap((invite) => {
      const change = staleChange(project, pkg, invite)
      return change ? [[pkg.id, invite.id, staleWords(pkg, change)]] : []
    }),
  )

describe('what changed under a quote, on main', () => {
  it('names the lines the prototype names, through the index as it stands', () => {
    expect(staleQuotes(boerne())).toEqual([
      ['hvac', 'hvac-coolbreeze', 'Addendum 1 changed the HVAC sheets.'],
      ['elec', 'elec-voltage', 'Addendum 1 changed panels and feeders, and the trade as a whole.'],
    ])
  })

  it('names no guessed line when the project carries no index, and still names the trade', () => {
    expect(staleQuotes(withoutIndex(boerne()))).toEqual([
      ['hvac', 'hvac-coolbreeze', 'Addendum 1 changed the HVAC sheets.'],
      ['elec', 'elec-voltage', 'Addendum 1 changed the Electrical sheets.'],
    ])
  })

  it('reads the index and the trades, and nothing when there is no index', () => {
    const p = boerne()
    expect(reachOf(p).sheets).toBe(p.index?.sheets)
    expect(reachOf(p).trades).toBe(p.packages)
    expect(reachOf(withoutIndex(p))).toEqual({ sheets: [], specs: [], trades: p.packages })
  })
})
