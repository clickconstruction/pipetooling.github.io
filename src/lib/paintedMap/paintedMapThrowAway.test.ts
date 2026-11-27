import { describe, expect, it } from 'vitest'
import {
  PAINTED_MAP_COPY_KEPT_DAYS,
  PAINTED_MAP_TEST_THROW_AWAY,
  PAINTED_MAP_THROW_AWAY_NO_ANSWER,
  paintedMapThrowAwayDoor,
  paintedMapThrownAwayFrom,
  paintedMapThrownAwayWords,
} from './paintedMapThrowAway'
import { plainWordsFailures } from '../plainWords'

const TEST_MAP = { name: 'ZZ Test way in' }
const REAL_MAP = { name: 'The way in for deliveries' }

describe('throwing a painted map away, and the copy a test map keeps (punch list #443, row 15)', () => {
  it('keeps a copy for a dev on a test map, and for nobody else', () => {
    expect(paintedMapThrowAwayDoor('dev', TEST_MAP)).toBe('copy')
    for (const role of ['master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', '', null, undefined]) {
      expect(paintedMapThrowAwayDoor(role, TEST_MAP)).toBe('plain')
    }
  })

  it('reads a test map by the ZZ rule: any case, after trimming, and at the start of the name only', () => {
    for (const name of ['ZZ Test way in', 'zz walk', '  Zz gate map', 'ZZ']) expect(paintedMapThrowAwayDoor('dev', { name })).toBe('copy')
    for (const name of ['The way in for deliveries', 'Lot 4 ZZ', 'Z Z map', '', null, undefined]) expect(paintedMapThrowAwayDoor('dev', { name })).toBe('plain')
    expect(paintedMapThrowAwayDoor('dev', REAL_MAP)).toBe('plain')
  })

  it('leaves a job’s own list of places, and a window with no map, on today’s door', () => {
    expect(paintedMapThrowAwayDoor('dev', { name: 'ZZ Test list', jobList: true })).toBe('plain')
    expect(paintedMapThrowAwayDoor('dev', { name: 'ZZ Test way in', jobList: false })).toBe('copy')
    expect(paintedMapThrowAwayDoor('dev', null)).toBe('plain')
    expect(paintedMapThrowAwayDoor('dev', undefined)).toBe('plain')
  })

  it('the confirm says the copy, the days, the photos and what loses the map, and its button names the act', () => {
    expect(PAINTED_MAP_COPY_KEPT_DAYS).toBe(90)
    expect(PAINTED_MAP_TEST_THROW_AWAY).toEqual({
      title: 'Throw this test map away?',
      body: 'The map, its lines and its places go for everyone. A developer can put this test map back from Recently deleted for 90 days. Its photos stay. A task that carries this map keeps itself and loses the map. So does a place on Materials on site. Putting the map back does not put it back on them.',
      confirm: 'Throw the test map away',
      cancel: 'Cancel',
    })
    expect(PAINTED_MAP_TEST_THROW_AWAY.body).not.toMatch(/cannot be undone/i)
  })

  it('reads the function’s answer, and takes anything else for no answer', () => {
    expect(paintedMapThrownAwayFrom({ ok: true, map_id: 'm1', name: 'ZZ Test way in', copied: { painted_maps: 1, painted_map_lines: 2, painted_map_places: 2, painted_map_links: 1, painted_map_link_visits: 1 }, total: 7, carriers: { checklist_items: 1, checklist_tech_tree_group_tasks: 2, job_places: 3 } })).toEqual({ copied: 7, tasks: 3, places: 3 })
    expect(paintedMapThrownAwayFrom({ ok: true, total: 1, carriers: { checklist_items: 0, checklist_tech_tree_group_tasks: 0, job_places: 0 } })).toEqual({ copied: 1, tasks: 0, places: 0 })
    // A count that is missing or is no number is none, never a guess.
    expect(paintedMapThrownAwayFrom({ ok: true })).toEqual({ copied: 0, tasks: 0, places: 0 })
    expect(paintedMapThrownAwayFrom({ ok: true, total: 'seven', carriers: ['x'] })).toEqual({ copied: 0, tasks: 0, places: 0 })
    for (const answer of [null, undefined, '', 'ok', 1, true, [], [{ ok: true }], {}, { ok: false }, { ok: 'true' }]) expect(paintedMapThrownAwayFrom(answer)).toBeNull()
  })

  it('says where the copy is, and counts what lost the map only when something did', () => {
    const kept = 'The test map was thrown away. A developer can put it back from Recently deleted for 90 days.'
    expect(paintedMapThrownAwayWords({ copied: 7, tasks: 0, places: 0 })).toBe(kept)
    expect(paintedMapThrownAwayWords({ copied: 7, tasks: 1, places: 0 })).toBe(`${kept} 1 task lost the map.`)
    expect(paintedMapThrownAwayWords({ copied: 7, tasks: 3, places: 0 })).toBe(`${kept} 3 tasks lost the map.`)
    expect(paintedMapThrownAwayWords({ copied: 7, tasks: 0, places: 1 })).toBe(`${kept} 1 place on Materials on site lost the map.`)
    expect(paintedMapThrownAwayWords({ copied: 7, tasks: 2, places: 2 })).toBe(`${kept} 2 tasks and 2 places on Materials on site lost the map.`)
  })

  it('keeps every sentence a first-timer reads to the plain-words rules', () => {
    const words = [
      PAINTED_MAP_TEST_THROW_AWAY.title,
      PAINTED_MAP_TEST_THROW_AWAY.body,
      PAINTED_MAP_THROW_AWAY_NO_ANSWER,
      paintedMapThrownAwayWords({ copied: 7, tasks: 0, places: 0 }),
      paintedMapThrownAwayWords({ copied: 7, tasks: 2, places: 2 }),
    ]
    for (const w of words) expect(plainWordsFailures(w)).toEqual([])
  })
})
