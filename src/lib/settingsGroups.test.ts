import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SETTINGS_ZONE_ORDER, getZonedSettingsGroups, canSeeWhatCustomersSee } from './settingsGroups'

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
      'settings-training',
      'settings-emails',
      'settings-what-customers-see',
      'settings-what-the-team-sees',
      'settings-what-everyone-sees',
      'settings-contracts',
      'settings-clauses',
      'settings-phone-texts',
      'settings-flows',
      'settings-company',
      'settings-dev-doors',
      'settings-usage',
      'settings-data',
      'settings-templates',
      'settings-digital-twins',
      'settings-advanced-tools',
      'settings-recent-push',
      'settings-guides',
      'settings-release-notes',
      'settings-ship-pace',
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

  it('the owner gets Emails & reports and What the team sees, not What everyone sees; nobody else gets the two (punch list #188, rows 4 and 5)', () => {
    const owner = getZonedSettingsGroups('master_technician').map((g) => g.id)
    expect(owner).toContain('settings-emails')
    expect(owner).toContain('settings-what-the-team-sees')
    expect(owner).not.toContain('settings-what-everyone-sees')
    for (const role of ['assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'] as const) {
      const ids = getZonedSettingsGroups(role).map((g) => g.id)
      expect(ids, role).not.toContain('settings-emails')
      expect(ids, role).not.toContain('settings-what-the-team-sees')
    }
  })

  it('the office team gets How fast a change ships, and nobody else does (v2.6399)', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const) {
      const ids = getZonedSettingsGroups(role).map((g) => g.id)
      expect(ids).toContain('settings-ship-pace')
      expect(ids.indexOf('settings-ship-pace')).toBe(ids.indexOf('settings-release-notes') + 1)
    }
    for (const role of ['superintendent', 'subcontractor', 'helpers', 'primary'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id)).not.toContain('settings-ship-pace')
    }
  })

  it('the office team gets Contracts and clauses, and nobody else does (Messages, cut 4c)', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id)).toContain('settings-clauses')
    }
    for (const role of ['superintendent', 'subcontractor', 'helpers', 'primary'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id)).not.toContain('settings-clauses')
    }
  })

  it('the office team gets Phone and texts, and nobody else does (Messages, cut 2)', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id)).toContain('settings-phone-texts')
    }
    for (const role of ['superintendent', 'subcontractor', 'helpers', 'primary'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id)).not.toContain('settings-phone-texts')
    }
  })

  it('the office team gets Flows, and nobody else does (Messages, cut 4)', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id)).toContain('settings-flows')
    }
    for (const role of ['superintendent', 'subcontractor', 'helpers', 'primary'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id)).not.toContain('settings-flows')
    }
  })

  it('estimator gets Bids & materials + Company but not Jobs, bills and liens or People', () => {
    const ids = getZonedSettingsGroups('estimator').map((g) => g.id)
    expect(ids).toContain('settings-catalogs')
    expect(ids).toContain('settings-company')
    expect(ids).not.toContain('settings-jobs')
    expect(ids).not.toContain('settings-people')
  })

  it('assistants keep Jobs, bills and liens (Job Book kept its pre-reorg reach)', () => {
    for (const role of ['master_technician', 'assistant', 'controller'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id)).toContain('settings-jobs')
    }
  })

  it('People & teams is the office’s: dev, owner, assistant and controller, nobody else (punch list #188, rows 12 and 22)', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id), role).toContain('settings-people')
    }
    for (const role of ['estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id), role).not.toContain('settings-people')
    }
  })

  it('Bids & materials opens to the estimator, the owner and a dev (punch list #188 rows 27–29)', () => {
    for (const role of ['dev', 'estimator', 'master_technician'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id), role).toContain('settings-catalogs')
    }
    for (const role of ['assistant', 'controller', 'primary', 'superintendent', 'subcontractor', 'helpers'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id), role).not.toContain('settings-catalogs')
    }
  })

  it('Training and Usage open to the owner with a dev, and to nobody else (punch list #188 rows 6 and 7)', () => {
    for (const role of ['dev', 'master_technician'] as const) {
      const ids = getZonedSettingsGroups(role).map((g) => g.id)
      expect(ids, role).toContain('settings-training')
      expect(ids, role).toContain('settings-usage')
    }
    for (const role of ['assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'] as const) {
      const ids = getZonedSettingsGroups(role).map((g) => g.id)
      expect(ids, role).not.toContain('settings-training')
      expect(ids, role).not.toContain('settings-usage')
    }
  })

  it('Data & recovery opens to the controller and the owner for their sweeps, and to nobody else but a dev (punch list #188 rows 25, 74, 77)', () => {
    expect(getZonedSettingsGroups('controller').map((g) => g.id)).toContain('settings-data')
    expect(getZonedSettingsGroups('master_technician').map((g) => g.id)).toContain('settings-data')
    for (const role of ['assistant', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'] as const) {
      expect(getZonedSettingsGroups(role).map((g) => g.id), role).not.toContain('settings-data')
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
  it('What customers see opens to the office (v2.3507): dev, master, assistant-like — not subs, estimators, primaries, superintendents', () => {
    expect(canSeeWhatCustomersSee('dev')).toBe(true)
    expect(canSeeWhatCustomersSee('master_technician')).toBe(true)
    expect(canSeeWhatCustomersSee('assistant')).toBe(true)
    expect(canSeeWhatCustomersSee('controller')).toBe(true)
    for (const r of ['subcontractor', 'helpers', 'estimator', 'primary', 'superintendent'] as const) expect(canSeeWhatCustomersSee(r), r).toBe(false)
    expect(canSeeWhatCustomersSee(null)).toBe(false)
    expect(getZonedSettingsGroups('assistant').some((g) => g.id === 'settings-what-customers-see')).toBe(true)
    expect(getZonedSettingsGroups('estimator').some((g) => g.id === 'settings-what-customers-see')).toBe(false)
  })
})

/**
 * The smoke suite's Settings tab list (v2.3816). `e2e/settings-tabs.spec.ts` clicks every
 * dev-visible tab by its exact label, but the suite runs after deploy and never gates a PR —
 * so v2.3705's "Digital twins" → "Digital twins & samples" rename left it red on every run.
 * This test gates: rename a tab and CI names the spec line to change in the same PR.
 */
describe('e2e/settings-tabs.spec.ts follows the tab list', () => {
  const spec = readFileSync(resolve(__dirname, '../../e2e/settings-tabs.spec.ts'), 'utf8')
  const tabsBlock = spec.slice(spec.indexOf('const TABS'), spec.indexOf(']\n', spec.indexOf('const TABS')))
  const specLabels = [...tabsBlock.matchAll(/label: '([^']+)'/g)].map((m) => m[1] ?? '')
  const devLabels = getZonedSettingsGroups('dev').map((g) => g.label)

  it('reads the spec’s tab list', () => {
    expect(specLabels.length).toBeGreaterThan(10)
  })
  it('every label the spec clicks is a tab a dev sees', () => {
    expect(specLabels.filter((l) => !devLabels.includes(l))).toEqual([])
  })
  it('every tab a dev sees is in the spec, in the same order', () => {
    expect(specLabels).toEqual(devLabels)
  })
})
