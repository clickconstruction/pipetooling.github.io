import { describe, expect, it } from 'vitest'
import { boxRowsOpenThePhoneScreen, materialsJobDoorHref, onSiteTabLink, opensMaterialsDesk } from './materialsJobDoor'

const OFFICE = ['dev', 'master_technician', 'assistant', 'controller']
const NOT_OFFICE = ['primary', 'superintendent', 'estimator', 'subcontractor', 'helpers']

describe('materialsJobDoorHref', () => {
  it('sends the office to Jobs → Materials on the job', () => {
    for (const role of OFFICE) expect(materialsJobDoorHref(role, 'j1'), role).toBe('/jobs?tab=materials&job=j1')
  })
  it('sends everyone else to the Tally’s On site tab, since Jobs → Materials turns them away', () => {
    for (const role of NOT_OFFICE) expect(materialsJobDoorHref(role, 'j1'), role).toBe('/tally?tab=on-site&job=j1')
  })
  it('treats a role not read yet as not the office’s', () => {
    expect(opensMaterialsDesk(null)).toBe(false)
    expect(materialsJobDoorHref(undefined, 'j1')).toBe(onSiteTabLink('j1'))
  })
})

describe('boxRowsOpenThePhoneScreen', () => {
  it('keeps the office’s rows on the materials page with the phone screen a second press', () => {
    for (const role of OFFICE) expect(boxRowsOpenThePhoneScreen(role, false), role).toBe(false)
  })
  it('opens the box itself for a primary, a superintendent and an estimator', () => {
    for (const role of ['primary', 'superintendent', 'estimator']) expect(boxRowsOpenThePhoneScreen(role, false), role).toBe(true)
  })
  it('opens the box itself in a field role’s search, whatever the role', () => {
    expect(boxRowsOpenThePhoneScreen('helpers', true)).toBe(true)
    expect(boxRowsOpenThePhoneScreen('dev', true)).toBe(true)
  })
})
