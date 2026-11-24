import { describe, expect, it } from 'vitest'
import { lienDeskAimFrom, lienDeskReaimKey } from './lienDeskAim'
import { lienDeskFromSearch } from './lienDeskRoute'
import { lienWindowDeskDoorHref } from './lienWindowDeskDoor'

/** The Lien window's door back to the desk names the job on every list (punch list #335, Also seen). */
describe('lienWindowDeskDoorHref', () => {
  it('an affidavit and a retainage notice carry the job, as a notice always did', () => {
    expect(lienWindowDeskDoorHref('j1', 'notice')).toBe('/lien-desk?tab=notices&job=j1')
    expect(lienWindowDeskDoorHref('j1', 'affidavit')).toBe('/lien-desk?tab=affidavits&job=j1')
    expect(lienWindowDeskDoorHref('j1', 'retainage')).toBe('/lien-desk?tab=retainage&job=j1')
  })

  it('the desk reads the address back as an aim at that job on that list', () => {
    for (const kind of ['notice', 'affidavit', 'retainage'] as const) {
      const address = lienDeskFromSearch(new URLSearchParams(lienWindowDeskDoorHref('j1', kind).split('?')[1]))
      expect(address).toMatchObject({ kind, job: 'j1' })
      expect(lienDeskAimFrom(address.kind, address.job)).toEqual({ kind, jobId: 'j1' })
    }
  })
})

/** The desk treats a door as new when the job, the list it is named on or the press count changes. */
describe('lienDeskReaimKey', () => {
  it('the same job named on another list is a new aim: the window’s button from a job open on Monthly notices', () => {
    expect(lienDeskReaimKey('affidavit', 'j1', 0)).not.toBe(lienDeskReaimKey('notice', 'j1', 0))
    expect(lienDeskReaimKey('retainage', 'j1', 0)).not.toBe(lienDeskReaimKey('affidavit', 'j1', 0))
  })

  it('a new job and a door pressed again are new aims, as before', () => {
    expect(lienDeskReaimKey('notice', 'j2', 0)).not.toBe(lienDeskReaimKey('notice', 'j1', 0))
    expect(lienDeskReaimKey('notice', 'j1', 2)).not.toBe(lienDeskReaimKey('notice', 'j1', 1))
    expect(lienDeskReaimKey('notice', 'j1', undefined)).toBe(lienDeskReaimKey('notice', 'j1', 0))
  })

  it('no list named reads as Monthly notices, as the address does, and a view with no pane adds nothing', () => {
    expect(lienDeskReaimKey(null, 'j1', 0)).toBe(lienDeskReaimKey('notice', 'j1', 0))
    expect(lienDeskReaimKey(undefined, 'j1', 0)).toBe(lienDeskReaimKey('notice', 'j1', 0))
    // The desk's own view presses carry no job off Monthly notices: one key for every view.
    expect(lienDeskReaimKey('affidavit', null, 0)).toBe(lienDeskReaimKey('timeline', null, 0))
    expect(lienDeskReaimKey('calendar', '', 0)).toBe(lienDeskReaimKey('notice', null, 0))
  })
})
