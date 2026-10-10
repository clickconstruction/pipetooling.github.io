/**
 * The Dashboard's Follow up line reads the GC projects page's own rows (the Board's B2b-ii-b, call E4): `loadGcProjects`,
 * then `loadGcBoardRows` with `money` as the reader's, so its count is Follow up's badge (`allPeople` on the same state).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { boardStateFromRows, type BoardRows } from './boardRows'
import { awardedClinicBoardRows } from './boardTestRows'
import { allPeople } from './projectPeople'

const loads = vi.hoisted(() => ({ projects: vi.fn(), board: vi.fn() }))
vi.mock('./gcIo', () => ({ loadGcProjects: loads.projects, loadGcBoardRows: loads.board }))

import { loadGcFollowUpNeeds } from './followUpNeedsIo'

let rows: BoardRows
beforeEach(() => {
  rows = awardedClinicBoardRows()
  loads.projects.mockReset().mockResolvedValue(rows.projects)
  loads.board.mockReset().mockResolvedValue(rows)
})

describe('the Dashboard’s Follow up line', () => {
  it('counts what Follow up’s badge counts, from the page’s own rows', async () => {
    const needs = await loadGcFollowUpNeeds(rows.today)
    expect(needs?.count).toBe(allPeople(boardStateFromRows(rows)).count)
    expect(needs?.title).toBe(`${needs?.count} to follow up on in GC mode`)
    expect(loads.board).toHaveBeenCalledWith(rows.projects, rows.today, { money: false })
  })

  it('reads our contract’s sends only for the money team', async () => {
    await loadGcFollowUpNeeds(rows.today, { money: true })
    expect(loads.board).toHaveBeenCalledWith(rows.projects, rows.today, { money: true })
  })

  it('reads nothing more with no GC project', async () => {
    loads.projects.mockResolvedValue([])
    expect(await loadGcFollowUpNeeds(rows.today)).toBeNull()
    expect(loads.board).not.toHaveBeenCalled()
  })
})
