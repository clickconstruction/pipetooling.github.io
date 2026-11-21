import { describe, expect, it } from 'vitest'
import { GEAR_PAGE_ORDER, GEAR_SECTION_LABELS, gearPagesInOrder, type GearPageKey } from './gearMenuSections'

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
})
