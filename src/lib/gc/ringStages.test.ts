import { describe, expect, it } from 'vitest'
import { GC_OFFICE_TEAM } from './access'
import { GC_TABLE_DOORS } from './doors'
import { GC_OTHER_SOURCES, RING_SOURCES, ringStages, sourceReaders } from './ringStages'

describe('which stages’ rings a reader sees (the Board’s B2b-vi-c)', () => {
  it('names every source a ring counts, in the doors or in the other sources, never both', () => {
    for (const [stage, sources] of Object.entries(RING_SOURCES)) {
      for (const s of sources) {
        expect(sourceReaders(s), `${stage}: ${s} is in neither map`).not.toBeNull()
        expect(Boolean(GC_TABLE_DOORS[s]) && Boolean(GC_OTHER_SOURCES[s]), `${s} is in both maps`).toBe(false)
      }
    }
  })

  it('counts each later stage on everything the stage before it counts', () => {
    expect(RING_SOURCES.pursuing.every((s) => RING_SOURCES.buyout.includes(s))).toBe(true)
    expect(RING_SOURCES.buyout.every((s) => RING_SOURCES.building.includes(s))).toBe(true)
  })

  it('reads a table the money team reads beyond its door: a leader passes gc_sows', () => {
    expect(GC_TABLE_DOORS.gc_sows?.door).toBe('dev')
    expect(sourceReaders('gc_sows')).toEqual(expect.arrayContaining(['dev', 'master_technician', 'controller']))
    expect(sourceReaders('gc_sows')).not.toContain('estimator')
  })

  it('gives each office role today’s rings: bidding for everyone, buying out for the money team since the schedule’s door (its PR 10), building for a dev only', () => {
    const today = Object.fromEntries(GC_OFFICE_TEAM.map((role) => [role, [...ringStages(role)].sort()]))
    expect(today).toEqual({
      dev: ['building', 'buyout', 'pursuing'],
      master_technician: ['buyout', 'pursuing'],
      assistant: ['pursuing'],
      controller: ['buyout', 'pursuing'],
      estimator: ['pursuing'],
    })
  })

  it('gives no ring to someone outside the office, or to no one signed in', () => {
    expect([...ringStages('subcontractor')]).toEqual([])
    expect([...ringStages(null)]).toEqual([])
  })
})
