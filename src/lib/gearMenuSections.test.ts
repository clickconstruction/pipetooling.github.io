import { describe, expect, it } from 'vitest'
import { GEAR_PAGE_ORDER, GEAR_SECTION_LABELS, gearModesRows, gearPagesInOrder, type GearPageKey } from './gearMenuSections'
import { canLeaveJobFieldReport } from './canLeaveJobFieldReport'
import { modeRowOfferedToRole } from './modeRow'
import { dispatchModeEligibleForRole } from './pageMode'

const none = Object.fromEntries(GEAR_PAGE_ORDER.map((p) => [p, false])) as Record<GearPageKey, boolean>
const all = Object.fromEntries(GEAR_PAGE_ORDER.map((p) => [p, true])) as Record<GearPageKey, boolean>

describe('the gear menu’s sections', () => {
  it('names four groups', () => {
    expect(GEAR_SECTION_LABELS).toEqual({ modes: 'Modes', show: 'Show', pages: 'Pages', help: 'Help and settings' })
  })

  it('lists each page once', () => {
    expect(new Set(GEAR_PAGE_ORDER).size).toBe(GEAR_PAGE_ORDER.length)
  })

  it('puts a crew’s pages first and the office’s pages last', () => {
    expect(gearPagesInOrder(all)).toEqual(['checklist', 'calendar', 'materials', 'map', 'customers', 'people', 'documents', 'banking', 'roadmap', 'partnerships'])
  })

  it('keeps the order whatever a person may open', () => {
    // A field hand on a phone: the Checklist and the Calendar.
    expect(gearPagesInOrder({ ...none, calendar: true, checklist: true })).toEqual(['checklist', 'calendar'])
    // An office role at a desk, where the header keeps its own links.
    expect(gearPagesInOrder({ ...none, roadmap: true, banking: true, documents: true, calendar: true })).toEqual(['calendar', 'documents', 'banking', 'roadmap'])
  })

  it('is empty when the menu holds no page, so no label is drawn over nothing', () => {
    expect(gearPagesInOrder(none)).toEqual([])
  })

  describe('the Modes rows (punch list #425)', () => {
    const rowsFor = (role: string) =>
      gearModesRows({ modeRow: modeRowOfferedToRole(role), jobEligible: canLeaveJobFieldReport(role), dispatchEligible: dispatchModeEligibleForRole(role) })

    it('a role with the mode row lists neither Job Mode nor Task Mode', () => {
      for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'subcontractor', 'helpers']) {
        expect(rowsFor(role).job, role).toBe(false)
        expect(rowsFor(role).task, role).toBe(false)
      }
    })

    it('whoever can hold Dispatch Mode keeps it under the label, and the rest have no Modes group at all', () => {
      for (const role of ['dev', 'master_technician', 'assistant', 'controller']) {
        expect(rowsFor(role), role).toEqual({ job: false, dispatch: true, task: false, label: true })
      }
      for (const role of ['primary', 'superintendent', 'subcontractor', 'helpers']) {
        expect(rowsFor(role), role).toEqual({ job: false, dispatch: false, task: false, label: false })
      }
    })

    it('the estimator, whose first page is Bids, has no row and keeps the rows it had', () => {
      expect(rowsFor('estimator')).toEqual({ job: true, dispatch: false, task: true, label: true })
    })
  })
})
