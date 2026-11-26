import { describe, expect, it } from 'vitest'
import { BOX_ROW_EMPTY, boxRowState, boxScreenFromMaterials, cameFromMaterials, materialsJobPage, withoutStaleFrom } from './boxRow'

const now = new Date('2026-11-22T15:00:00Z')
const last = (daysAgo: number) => ({ at: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), byName: 'Robert' })

describe('a box as one row (v2.8284)', () => {
  it('an empty box nobody has counted reads Empty, in the muted colour', () => {
    expect(boxRowState({ kind: 'cage', parts: 0, lineIsApps: false, last: null, now })).toEqual({ partsWords: null, stateWords: BOX_ROW_EMPTY, amber: false, empty: true })
  })

  it('a box with parts says how many and how its count stands, amber when a count is due', () => {
    expect(boxRowState({ kind: 'cage', parts: 3, lineIsApps: false, last: null, now })).toEqual({ partsWords: '3 parts', stateWords: 'never counted', amber: true, empty: false })
    const fresh = boxRowState({ kind: 'box', parts: 1, lineIsApps: false, last: last(1), now })
    expect(fresh.partsWords).toBe('1 part')
    expect(fresh.amber).toBe(false)
    expect(boxRowState({ kind: 'box', parts: 1, lineIsApps: false, last: last(21), now })).toMatchObject({ stateWords: 'counted 21 days ago', amber: true })
  })

  it('leaves the count of parts out where the box’s own line already says it, and Unsorted says what to do', () => {
    expect(boxRowState({ kind: 'cage', parts: 2, lineIsApps: true, last: last(1), now }).partsWords).toBeNull()
    expect(boxRowState({ kind: 'unsorted', parts: 4, lineIsApps: false, last: null, now })).toEqual({ partsWords: '4 parts', stateWords: 'put them in a cage', amber: false, empty: false })
  })

  it('a box emptied after a count keeps its count state, and may still be pressed to add a part', () => {
    expect(boxRowState({ kind: 'cage', parts: 0, lineIsApps: false, last: last(2), now })).toMatchObject({ partsWords: '0 parts', amber: false, empty: true })
  })

  it('an empty box is never amber, however old its count; a Can’t find with none left still asks for one (punch list #398)', () => {
    expect(boxRowState({ kind: 'cage', parts: 0, lineIsApps: false, last: last(21), now })).toMatchObject({ stateWords: 'counted 21 days ago', amber: false, empty: true })
    expect(boxRowState({ kind: 'cage', parts: 0, lineIsApps: false, last: last(21), now, cannot: 2 })).toMatchObject({ stateWords: 'counted 21 days ago', amber: true, empty: true })
    expect(boxRowState({ kind: 'cage', parts: 0, lineIsApps: false, last: last(1), now, cannot: 2 })).toMatchObject({ amber: false })
  })

  it('the desk’s row opens the Tally’s box screen marked as from Materials, and that screen comes back to the job', () => {
    expect(boxScreenFromMaterials('j1', 'c1')).toBe('/tally?tab=on-site&job=j1&container=c1&from=materials')
    expect(materialsJobPage('j1')).toBe('/materials?tab=on-site&job=j1')
  })

  it('the mark lasts while a box is on the address, and leaves with it', () => {
    const open = new URLSearchParams('tab=on-site&job=j1&container=c1&from=materials')
    expect(cameFromMaterials(open)).toBe(true)
    expect(withoutStaleFrom(open)).toBeNull()
    // the box closed: the person is on the Tally's own list, and the mark goes
    expect(withoutStaleFrom(new URLSearchParams('tab=on-site&job=j1&from=materials'))?.toString()).toBe('tab=on-site&job=j1')
    expect(withoutStaleFrom(new URLSearchParams('tab=on-site&job=j1'))).toBeNull()
    expect(cameFromMaterials(new URLSearchParams('tab=on-site&from=tally'))).toBe(false)
  })
})
