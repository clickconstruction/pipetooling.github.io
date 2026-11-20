import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../lens/lensAudit'
import { hexToRgba } from '../lens/lensTokens'
import { pinLabelInkHex } from '../map/pinLabelInk'
import { ORANGE_UNDER_WORDS } from '../orangeUnderWords'
import { taskPlaceDotGroups, taskPlaceDots, type TaskPlace } from './taskPlace'
import { TASK_PLACE_LATE_COLOR, TASK_PLACE_RING_COLOR, TASK_PLACE_WORK_COLOR, taskPlaceDotColor, taskPlaceTeamDotLabel } from './taskPlaceColors'

const place = (name: string, lat: number): TaskPlace => ({ name, lat, lng: -98.3, accuracyM: null, setBy: null, setAt: null })

describe('the colour of work on the Checklist’s maps (v2.8045)', () => {
  it('is the Clock In bar’s safety orange, the shade white words read on', () => {
    expect(TASK_PLACE_WORK_COLOR).toBe(ORANGE_UNDER_WORDS)
    expect(pinLabelInkHex(TASK_PLACE_WORK_COLOR)).toBe('#ffffff')
    expect(contrastRatio(hexToRgba('#ffffff'), hexToRgba(TASK_PLACE_WORK_COLOR))).toBeGreaterThanOrEqual(4.5)
  })

  it('is no blue: the dark blue the owner saw on the leader’s map is gone', () => {
    const { r, g, b } = hexToRgba(TASK_PLACE_WORK_COLOR)
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
  })

  it('a dot is red when a task there is late and the work colour otherwise, an older task too', () => {
    expect(taskPlaceDotColor({ overdue: true })).toBe(TASK_PLACE_LATE_COLOR)
    expect(taskPlaceDotColor({ overdue: false })).toBe(TASK_PLACE_WORK_COLOR)
    const { dots } = taskPlaceDots([
      { id: 'late', place: place('Gate', 29.556), overdue: true },
      { id: 'old', place: place('Pump house', 29.55), old: true },
      { id: 'today', place: place('Barn', 29.54) },
    ])
    expect(taskPlaceDotGroups(dots).map(taskPlaceDotColor)).toEqual([TASK_PLACE_LATE_COLOR, TASK_PLACE_WORK_COLOR, TASK_PLACE_WORK_COLOR])
  })

  it('a place with a late task and an older one is red: late wins', () => {
    const { dots } = taskPlaceDots([
      { id: 'old', place: place('Pump house', 29.55), old: true },
      { id: 'late', place: place('Pump house', 29.55), overdue: true },
    ])
    expect(taskPlaceDotGroups(dots).map(taskPlaceDotColor)).toEqual([TASK_PLACE_LATE_COLOR])
  })

  it('late and work stand apart, and each stands apart from the white ring every dot wears', () => {
    expect(TASK_PLACE_LATE_COLOR).not.toBe(TASK_PLACE_WORK_COLOR)
    expect(TASK_PLACE_RING_COLOR).toBe('#ffffff')
    for (const fill of [TASK_PLACE_WORK_COLOR, TASK_PLACE_LATE_COLOR]) expect(contrastRatio(hexToRgba(TASK_PLACE_RING_COLOR), hexToRgba(fill))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('what a dot on the leader’s map wears', () => {
  const initialsOf = (id: string) => ({ theo: 'T', imani: 'IO' })[id] ?? '?'

  it('one person’s dot wears their initials, however many of their tasks are there', () => {
    expect(taskPlaceTeamDotLabel({ personIds: ['theo'], tasks: [{ id: 'd', title: 'Fix the latch', personId: 'theo' }] }, initialsOf)).toBe('T')
    expect(taskPlaceTeamDotLabel({ personIds: ['imani'], tasks: [{ id: 'a', title: 'A', personId: 'imani' }, { id: 'b', title: 'B', personId: 'imani' }] }, initialsOf)).toBe('IO')
  })

  it('a dot people share wears its count of tasks', () => {
    expect(taskPlaceTeamDotLabel({ personIds: ['theo', 'imani'], tasks: [{ id: 'a', title: 'A', personId: 'theo' }, { id: 'b', title: 'B', personId: 'imani' }, { id: 'e', title: 'E', personId: 'theo' }] }, initialsOf)).toBe('3')
  })

  it('a person the board cannot name still gets a mark', () => {
    expect(taskPlaceTeamDotLabel({ personIds: ['nobody'], tasks: [{ id: 'z', title: 'Z', personId: 'nobody' }] }, initialsOf)).toBe('?')
  })
})
