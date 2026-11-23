import { describe, expect, it } from 'vitest'
import { GEAR_MODE_LIST_ORDER, GEAR_PAGE_ORDER, GEAR_SECTION_LABELS, gearModeRowTip, gearModesRows, gearPagesInOrder, type GearPageKey } from './gearMenuSections'
import { canLeaveJobFieldReport } from './canLeaveJobFieldReport'
import { modeRowDrawnHere } from './modeRow'
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
    const rowsFor = (role: string, phone: boolean) =>
      gearModesRows({ modeRow: modeRowDrawnHere(role, phone), jobEligible: canLeaveJobFieldReport(role), dispatchEligible: dispatchModeEligibleForRole(role) })
    const WITH_THE_ROW = ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', 'subcontractor', 'helpers']

    it('on a phone a role with the mode row lists neither Job Mode nor Task Mode', () => {
      for (const role of WITH_THE_ROW) {
        expect(rowsFor(role, true).list, role).toEqual([])
        expect(rowsFor(role, true).job, role).toBe(false)
        expect(rowsFor(role, true).task, role).toBe(false)
      }
    })

    it('on a phone whoever can hold Dispatch Mode keeps it under the label, and the rest have no Modes group at all', () => {
      for (const role of ['dev', 'master_technician', 'assistant', 'controller']) {
        expect(rowsFor(role, true), role).toEqual({ list: [], job: false, dispatch: true, task: false, label: true })
      }
      for (const role of ['primary', 'superintendent', 'subcontractor', 'helpers']) {
        expect(rowsFor(role, true), role).toEqual({ list: [], job: false, dispatch: false, task: false, label: false })
      }
    })

    it('on a desk every role has the list of three under the label: Dashboard, Job Mode, Task Mode', () => {
      for (const role of [...WITH_THE_ROW, 'estimator']) {
        const rows = rowsFor(role, false)
        expect(rows.list, role).toEqual(['full', 'job', 'task'])
        expect(rows.job && rows.task && rows.label, role).toBe(true)
        expect(rows.dispatch, role).toBe(dispatchModeEligibleForRole(role))
      }
    })

    it('the estimator, who has no row, has the list at a phone’s width too', () => {
      expect(rowsFor('estimator', true)).toEqual({ list: ['full', 'job', 'task'], job: true, dispatch: false, task: true, label: true })
    })

    it('leaves Job Mode out of the list for whoever cannot hold it', () => {
      expect(gearModesRows({ modeRow: false, jobEligible: false, dispatchEligible: false })).toEqual({ list: ['full', 'task'], job: false, dispatch: false, task: true, label: true })
    })

    it('puts the Dashboard first and Task Mode, pressed least, last', () => {
      expect(GEAR_MODE_LIST_ORDER).toEqual(['full', 'job', 'task'])
    })

    it('a row’s tip says what a press does, or that the mode is on', () => {
      expect(gearModeRowTip('full', true)).toBe('You are on the Dashboard, with no mode on top')
      expect(gearModeRowTip('full', false)).toBe('Switch to the Dashboard')
      expect(gearModeRowTip('job', true)).toBe('Job Mode is on')
      expect(gearModeRowTip('job', false)).toBe('Switch to Job Mode')
      expect(gearModeRowTip('task', true)).toBe('Task Mode is on')
      expect(gearModeRowTip('task', false)).toBe('Turn Task Mode on. This device shows only your checklist.')
    })
  })
})
