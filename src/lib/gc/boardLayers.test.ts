import { describe, expect, it } from 'vitest'
import { boardLayers, ringReady, RING_LAYERS, type BoardLayers } from './boardLayers'
import { NO_DRAWS } from './drawRows'
import { stageProgress } from './progress'
import { initialGcState } from './schedule/testState'
import type { GcStage } from './types'

const ALL: Set<GcStage> = new Set(['pursuing', 'buyout', 'building'])
/** Every layer read, each empty. */
const everyLayer = (): BoardLayers => ({ logs: [], clockIns: [], changeOrders: [], draws: NO_DRAWS, submittals: { submittals: [], rounds: [], holds: [] }, changeRequests: [], punch: [], schedules: new Map(), crewPercents: [] })

describe('the board with what the ring counts laid over it (the Board’s B2b-vi-c)', () => {
  it('leaves the board as it was when no layer is given', () => {
    const board = initialGcState()
    expect(boardLayers(board, {})).toBe(board)
  })

  it('lays a job’s schedule on it, and takes one off a job read with none', () => {
    const board = initialGcState()
    const helotes = board.projects.find((p) => p.id === 'helotes')!
    const fair = board.projects.find((p) => p.id === 'fairoaksd')!
    const laid = boardLayers(board, { schedules: new Map([['helotes', fair.schedule!], ['fairoaksd', null]]) })
    expect(helotes.schedule).toBeUndefined()
    expect(laid.projects.find((p) => p.id === 'helotes')?.schedule).toBe(fair.schedule)
    expect(laid.projects.find((p) => p.id === 'fairoaksd')?.schedule).toBeUndefined()
  })

  it('reads Get started’s schedule step from the schedule laid on, so buying out waits for it', () => {
    const board = initialGcState()
    const helotes = (s: typeof board) => s.projects.find((p) => p.id === 'helotes')!
    const step = (s: typeof board) => stageProgress(s, helotes(s)).groups.find((g) => g.key === 'schedule')?.items[0]?.done
    expect(step(board)).toBe(false)
    const fair = board.projects.find((p) => p.id === 'fairoaksd')!
    expect(step(boardLayers(board, { schedules: new Map([['helotes', fair.schedule!]]) }))).toBe(true)
  })

  it('draws a stage’s ring only once every layer it counts was read', () => {
    expect([...ringReady(ALL, {})]).toEqual(['pursuing'])
    expect([...ringReady(ALL, { schedules: new Map() })].sort()).toEqual(['buyout', 'pursuing'])
    const allButPunch = everyLayer()
    delete allButPunch.punch
    expect([...ringReady(ALL, allButPunch)].sort()).toEqual(['buyout', 'pursuing'])
    expect([...ringReady(ALL, everyLayer())].sort()).toEqual(['building', 'buyout', 'pursuing'])
  })

  it('never draws a stage the reader may not see, whatever was read', () => {
    expect([...ringReady(new Set<GcStage>(['pursuing']), everyLayer())]).toEqual(['pursuing'])
  })

  it('counts every layer for Building, and nothing beyond the board for Bidding', () => {
    expect([...RING_LAYERS.building].sort()).toEqual(Object.keys(everyLayer()).sort())
    expect(RING_LAYERS.pursuing).toEqual([])
  })
})
