import { describe, expect, it } from 'vitest'
import { taskPlaceWhereIAmPress } from './taskPlaceMapPress'

describe('the map’s Show where I am press', () => {
  it('names itself by what a press does: show, then find again', () => {
    expect(taskPlaceWhereIAmPress({ asking: false, found: false })).toEqual({ state: 'idle', label: 'Show where I am' })
    expect(taskPlaceWhereIAmPress({ asking: false, found: true })).toEqual({ state: 'found', label: 'Find me again' })
  })

  it('says it is finding the person while the phone is asked, a second time too', () => {
    expect(taskPlaceWhereIAmPress({ asking: true, found: false })).toEqual({ state: 'asking', label: 'Finding you…' })
    expect(taskPlaceWhereIAmPress({ asking: true, found: true })).toEqual({ state: 'asking', label: 'Finding you…' })
  })
})
