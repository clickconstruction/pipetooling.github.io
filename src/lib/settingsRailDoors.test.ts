import { describe, expect, it } from 'vitest'
import { SETTINGS_VIEW_AS_HASH, isSettingsViewAsHash, settingsRailDoors } from './settingsRailDoors'

describe('settingsRailDoors — the View as… and Punch list doors under the Settings rail (v2.4041)', () => {
  it('a dev gets both doors, View as first', () => {
    expect(settingsRailDoors('dev', { impersonating: false }).map((d) => d.id)).toEqual(['view-as', 'punch-list'])
  })
  it('a dev who is already imitating someone keeps only the Punch list — Exit is the way back, not a second imitation', () => {
    expect(settingsRailDoors('dev', { impersonating: true }).map((d) => d.id)).toEqual(['punch-list'])
  })
  it('a master gets the Punch list only; the office, field and outside roles get no doors', () => {
    expect(settingsRailDoors('master_technician', { impersonating: false }).map((d) => d.id)).toEqual(['punch-list'])
    for (const role of ['assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'] as const) {
      expect(settingsRailDoors(role, { impersonating: false })).toEqual([])
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
