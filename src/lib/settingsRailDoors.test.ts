import { describe, expect, it } from 'vitest'
import { SETTINGS_VIEW_AS_HASH, TALLY_PATH, isSettingsViewAsHash, settingsRailDoors } from './settingsRailDoors'

describe('settingsRailDoors — the Job Parts Tally, View as… and Punch list doors under the Settings rail (v2.4041, v2.4061)', () => {
  it('a dev gets all three doors: the Tally (everyone) first, then View as, then the Punch list', () => {
    expect(settingsRailDoors('dev', { impersonating: false }).map((d) => d.id)).toEqual(['tally', 'view-as', 'punch-list'])
  })
  it('page doors carry their path; View as has none (it opens the panel)', () => {
    const doors = settingsRailDoors('dev', { impersonating: false })
    expect(doors.map((d) => d.to)).toEqual([TALLY_PATH, undefined, '/punch-list'])
    expect(TALLY_PATH).toBe('/tally')
  })
  it('a dev who is already imitating someone keeps only the Punch list — Exit is the way back, not a second imitation', () => {
    expect(settingsRailDoors('dev', { impersonating: true }).map((d) => d.id)).toEqual(['tally', 'punch-list'])
  })
  it('a master gets the Tally and the Punch list; every other role gets the Tally alone — it is on every role\'s path list', () => {
    expect(settingsRailDoors('master_technician', { impersonating: false }).map((d) => d.id)).toEqual(['tally', 'punch-list'])
    for (const role of ['assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'] as const) {
      expect(settingsRailDoors(role, { impersonating: false }).map((d) => d.id)).toEqual(['tally'])
    }
    expect(settingsRailDoors(null, { impersonating: false })).toEqual([])
    expect(settingsRailDoors(undefined, { impersonating: false })).toEqual([])
  })
  it('every door carries a label and a title for the chip', () => {
    for (const d of settingsRailDoors('dev', { impersonating: false })) {
      expect(d.label.length).toBeGreaterThan(0)
      expect(d.title.length).toBeGreaterThan(0)
    }
  })
  it('the address-bar door is #view-as, any case, with or without the hash', () => {
    expect(SETTINGS_VIEW_AS_HASH).toBe('#view-as')
    expect(isSettingsViewAsHash('#view-as')).toBe(true)
    expect(isSettingsViewAsHash('view-as')).toBe(true)
    expect(isSettingsViewAsHash('#View-As')).toBe(true)
    expect(isSettingsViewAsHash('#settings-account')).toBe(false)
    expect(isSettingsViewAsHash('')).toBe(false)
    expect(isSettingsViewAsHash(null)).toBe(false)
    expect(isSettingsViewAsHash(undefined)).toBe(false)
  })
})
