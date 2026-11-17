import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { TASK_MAP_NOT_OPENED, TASK_MAP_SHEET_FOOT, TASK_MAP_SHEET_TITLE, taskMapStarts } from './taskDoerActs'

describe('a map from the person doing the task', () => {
  it('offers a line by hand, a walked line and a point, in that order', () => {
    expect(taskMapStarts(true).map((r) => r.key)).toEqual(['line', 'walk', 'place'])
    expect(taskMapStarts(true).map((r) => r.label)).toEqual(['Draw it by hand', 'Walk or drive it', 'Leave a point'])
  })
  it('leaves the walk out on a device that cannot say where it is', () => {
    expect(taskMapStarts(false).map((r) => r.key)).toEqual(['line', 'place'])
  })
  it('every word a person reads is plain', () => {
    for (const row of taskMapStarts(true)) expect(plainWordsFailures(row.words)).toEqual([])
    for (const s of [TASK_MAP_SHEET_TITLE, TASK_MAP_SHEET_FOOT, TASK_MAP_NOT_OPENED]) expect(plainWordsFailures(s)).toEqual([])
  })
})
