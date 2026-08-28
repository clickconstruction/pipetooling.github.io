import { describe, expect, it } from 'vitest'
import { SETTINGS_ZONE_ORDER, getZonedSettingsGroups } from './settingsGroups'

describe('getZonedSettingsGroups', () => {
  it('null role gets nothing', () => {
    expect(getZonedSettingsGroups(null)).toEqual([])
  })

  it('the default landing tab (first group) is Your account for every role', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent'] as const) {
      expect(getZonedSettingsGroups(role)[0]).toMatchObject({ id: 'settings-account', zone: 'you' })
    }
  })

  it('dev sees every tab, zones in order', () => {
    const groups = getZonedSettingsGroups('dev')
    expect(groups.map((g) => g.id)).toEqual([
      'settings-account',
      'settings-dashboard',
      'settings-jobs',
      'settings-catalogs',
      'settings-people',
      'settings-emails',
      'settings-company',
      'settings-usage',
      'settings-data',
      'settings-templates',
      'settings-digital-twins',
      'settings-advanced-tools',
      'settings-recent-push',
      'settings-guides',
      'settings-release-notes',
    ])
    // Zones appear in declaration order with no interleaving.
    const zoneSeq = groups.map((g) => g.zone)
    const firstIndex = SETTINGS_ZONE_ORDER.map((z) => zoneSeq.indexOf(z))
    expect([...firstIndex]).toEqual([...firstIndex].sort((a, b) => a - b))
  })

  it('subcontractor-like roles see only You + Activity logs + Help', () => {
    for (const role of ['subcontractor', 'helpers'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id)).toEqual([
        'settings-account',
        'settings-dashboard',
        'settings-recent-push',
        'settings-guides',
        'settings-release-notes',
      ])
    }
  })

  it('estimator gets Bids & materials + Company but not Jobs & billing or People', () => {
    const ids = getZonedSettingsGroups('estimator').map((g) => g.id)
    expect(ids).toContain('settings-catalogs')
    expect(ids).toContain('settings-company')
    expect(ids).not.toContain('settings-jobs')
    expect(ids).not.toContain('settings-people')
  })

  it('assistants keep Jobs & billing (Job Book kept its pre-reorg reach)', () => {
    for (const role of ['master_technician', 'assistant', 'controller'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id)).toContain('settings-jobs')
    }
  })

  it('master keeps People & teams and Company; deep-linked ids all survive the reorg', () => {
    const ids = getZonedSettingsGroups('master_technician').map((g) => g.id)
    expect(ids).toContain('settings-people')
    expect(ids).toContain('settings-company')
    // Inbound ?tab= links (Dashboard banners) — dev sees both targets.
    const devIds = getZonedSettingsGroups('dev').map((g) => g.id)
    expect(devIds).toContain('settings-data')
    expect(devIds).toContain('settings-people')
  })
})
