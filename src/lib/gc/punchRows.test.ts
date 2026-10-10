import { describe, expect, it } from 'vitest'
import { punchCounts, punchWords } from './buildingPunch'
import { punchItemOf, withPunch, type PunchRow } from './punchRows'
import { initialGcState } from './schedule/testState'

const row = (over: Partial<PunchRow>): PunchRow => ({
  id: 'pi-1',
  project_id: 'stoneoak',
  package_id: 'sdry',
  position: 0,
  text: 'Patch the corner bead by the drive-through window',
  where_on: null,
  added_on: '2026-09-22',
  fixed_on: null,
  checked_on: null,
  sent_back_times: 0,
  sent_back_note: null,
  sent_back_on: null,
  removed_at: null,
  ...over,
})

describe('punchItemOf', () => {
  it('reads an open item as the kernels do, with no place and no send-back', () => {
    expect(punchItemOf(row({}))).toEqual({
      id: 'pi-1',
      packageId: 'sdry',
      text: 'Patch the corner bead by the drive-through window',
      addedOn: '2026-09-22',
      fixedOn: null,
      checkedOn: null,
    })
  })

  it('carries where it is and a send-back with its count, note and day', () => {
    const item = punchItemOf(row({ where_on: 'Room 104', fixed_on: '2026-09-25', sent_back_times: 2, sent_back_note: 'Still a seam showing', sent_back_on: '2026-09-27' }))
    expect(item.where).toBe('Room 104')
    expect(item.sentBack).toEqual({ times: 2, note: 'Still a seam showing', on: '2026-09-27' })
  })
})

describe('withPunch', () => {
  it('lays each job’s items over it in the order they were added, and the kernels count them', () => {
    const state = withPunch(initialGcState(), [
      row({ id: 'pi-2', position: 1, fixed_on: '2026-09-26' }),
      row({ id: 'pi-1', position: 0 }),
      row({ id: 'pi-3', position: 2, fixed_on: '2026-09-26', checked_on: '2026-09-28' }),
    ])
    const stoneOak = state.projects.find((p) => p.id === 'stoneoak')!
    expect(stoneOak.punch?.map((i) => i.id)).toEqual(['pi-1', 'pi-2', 'pi-3'])
    const c = punchCounts(stoneOak, 'sdry')
    expect(c).toEqual({ open: 1, fixed: 1, done: 1, total: 3 })
    expect(punchWords(c)).toBe('1 to fix, 1 fixed and waiting on our check, 1 checked')
  })

  it('drops an item taken off (U3b): it stays in the table and nobody reads it', () => {
    const state = withPunch(initialGcState(), [row({ id: 'pi-1' }), row({ id: 'pi-2', position: 1, removed_at: '2026-10-09T20:00:00Z' })])
    expect(state.projects.find((p) => p.id === 'stoneoak')!.punch?.map((i) => i.id)).toEqual(['pi-1'])
  })

  it('leaves a job with no rows as it was, and no rows at all returns the same state', () => {
    const base = initialGcState()
    const fairOaks = base.projects.find((p) => p.id === 'fairoaksd')!
    const state = withPunch(base, [row({})])
    expect(state.projects.find((p) => p.id === 'fairoaksd')!.punch).toBe(fairOaks.punch)
    expect(withPunch(base, [])).toBe(base)
  })
})
