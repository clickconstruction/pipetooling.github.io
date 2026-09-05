import { describe, expect, it } from 'vitest'
import { buildStagesSectionToolsMenu } from './stagesSectionToolsMenu'

const base = {
  recentViewOpen: false,
  billedRowCount: 5,
  collectionsRowCount: 1,
  arBankTxUnallocatedCount: 16,
  capableToBillTotalFormatted: '12,345',
}

function keysOf(groups: ReturnType<typeof buildStagesSectionToolsMenu>) {
  return groups.flatMap((g) => g.items.map((i) => i.key))
}

describe('buildStagesSectionToolsMenu', () => {
  it('dev sees every tool, grouped under the stage sections', () => {
    const groups = buildStagesSectionToolsMenu({ ...base, authRole: 'dev' })
    expect(groups.map((g) => g.section)).toEqual([
      'Pipeline',
      'Working',
      'Ready to Bill',
      'Billed Awaiting Payment',
      'Paid in Full',
    ])
    expect(keysOf(groups)).toEqual([
      'recently-added',
      'weekly-movement',
      'weekly-money',
      'capable-to-bill',
      'ready-to-bill-notifications',
      'gc-review',
      'accounts-receivable',
      'billed-share-print',
      'billed-aging-chart',
      'billed-payment-forecast',
      'paid-notifications',
      'paid-profit-chart',
      'paid-in-full-notifications',
    ])
  })

  it('the paid profit Chart is dev/controller only — hidden for others', () => {
    for (const authRole of ['dev', 'controller']) {
      expect(keysOf(buildStagesSectionToolsMenu({ ...base, authRole }))).toContain('paid-profit-chart')
    }
    for (const authRole of ['master_technician', 'assistant', 'primary', 'superintendent', null]) {
      expect(keysOf(buildStagesSectionToolsMenu({ ...base, authRole }))).not.toContain('paid-profit-chart')
    }
  })

  it('the billed aging Chart is dev/controller only — hidden for others', () => {
    for (const authRole of ['dev', 'controller']) {
      expect(keysOf(buildStagesSectionToolsMenu({ ...base, authRole }))).toContain('billed-aging-chart')
    }
    for (const authRole of ['master_technician', 'assistant', 'primary', 'superintendent', null]) {
      expect(keysOf(buildStagesSectionToolsMenu({ ...base, authRole }))).not.toContain('billed-aging-chart')
    }
  })

  it('Ready to Bill notifications is dev/master only — group hidden for others', () => {
    for (const authRole of ['dev', 'master_technician']) {
      expect(keysOf(buildStagesSectionToolsMenu({ ...base, authRole }))).toContain(
        'ready-to-bill-notifications',
      )
    }
    for (const authRole of ['assistant', 'controller', 'primary', 'superintendent', null]) {
      const groups = buildStagesSectionToolsMenu({ ...base, authRole })
      expect(keysOf(groups)).not.toContain('ready-to-bill-notifications')
      expect(groups.some((g) => g.section === 'Ready to Bill')).toBe(false)
    }
  })

  it('weekly money is dev/controller only — hidden (not disabled) for others', () => {
    for (const authRole of ['dev', 'controller']) {
      expect(keysOf(buildStagesSectionToolsMenu({ ...base, authRole }))).toContain('weekly-money')
    }
    for (const authRole of ['master_technician', 'assistant', 'primary', 'superintendent', null]) {
      expect(keysOf(buildStagesSectionToolsMenu({ ...base, authRole }))).not.toContain('weekly-money')
    }
  })

  it('master_technician matches dev except the dev/controller-only tools', () => {
    expect(keysOf(buildStagesSectionToolsMenu({ ...base, authRole: 'master_technician' }))).toEqual(
      keysOf(buildStagesSectionToolsMenu({ ...base, authRole: 'dev' })).filter(
        (k) => k !== 'weekly-money' && k !== 'billed-aging-chart' && k !== 'paid-profit-chart',
      ),
    )
  })

  it('assistant and controller get Share / Print but not the notification settings', () => {
    const assistantKeys = keysOf(buildStagesSectionToolsMenu({ ...base, authRole: 'assistant' }))
    expect(assistantKeys).toEqual(['recently-added', 'weekly-movement', 'capable-to-bill', 'gc-review', 'accounts-receivable', 'billed-share-print', 'billed-payment-forecast'])
    const controllerGroups = buildStagesSectionToolsMenu({ ...base, authRole: 'controller' })
    expect(keysOf(controllerGroups)).toEqual([
      'recently-added',
      'weekly-movement',
      'weekly-money',
      'capable-to-bill',
      'gc-review',
      'accounts-receivable',
      'billed-share-print',
      'billed-aging-chart',
      'billed-payment-forecast',
      'paid-profit-chart',
    ])
    // Controller's Paid in Full group holds only the profit chart (no ⚙).
    const paidGroup = controllerGroups.find((g) => g.section === 'Paid in Full')
    expect(paidGroup?.items.map((i) => i.key)).toEqual(['paid-profit-chart'])
  })

  it('primary sees no admin tools; Accounts Receivable is disabled like every other non-office role (v2.2882, J4-8 dead branch removed)', () => {
    const groups = buildStagesSectionToolsMenu({ ...base, authRole: 'primary' })
    expect(keysOf(groups)).toEqual(['recently-added', 'weekly-movement', 'capable-to-bill', 'gc-review', 'accounts-receivable', 'billed-payment-forecast'])
    const ar = groups.flatMap((g) => g.items).find((i) => i.key === 'accounts-receivable')
    expect(ar?.disabled).toBe(true)
  })

  it('Accounts Receivable opens for dev / master / assistant / controller only', () => {
    const arDisabled = (authRole: string | null) =>
      buildStagesSectionToolsMenu({ ...base, authRole }).flatMap((g) => g.items).find((i) => i.key === 'accounts-receivable')?.disabled
    for (const authRole of ['dev', 'master_technician', 'assistant', 'controller']) expect(arDisabled(authRole)).toBe(false)
    for (const authRole of ['primary', 'superintendent', 'estimator', 'subcontractor', 'helpers', null]) expect(arDisabled(authRole)).toBe(true)
  })

  it('superintendent sees Accounts Receivable disabled (mirrors the header button)', () => {
    const groups = buildStagesSectionToolsMenu({ ...base, authRole: 'superintendent' })
    const ar = groups.flatMap((g) => g.items).find((i) => i.key === 'accounts-receivable')
    expect(ar?.disabled).toBe(true)
  })

  it('Payment forecast mirrors the header gate — hidden for superintendent and signed-out', () => {
    for (const authRole of ['dev', 'master_technician', 'assistant', 'controller', 'primary']) {
      expect(keysOf(buildStagesSectionToolsMenu({ ...base, authRole }))).toContain('billed-payment-forecast')
    }
    for (const authRole of ['superintendent', 'subcontractor', 'helpers', null]) {
      expect(keysOf(buildStagesSectionToolsMenu({ ...base, authRole }))).not.toContain('billed-payment-forecast')
    }
  })

  it('every item carries its board-button icon except gc-review (SVG supplied by the view)', () => {
    const items = buildStagesSectionToolsMenu({ ...base, authRole: 'dev' }).flatMap((g) => g.items)
    for (const item of items) {
      if (item.key === 'gc-review') expect(item.icon).toBeUndefined()
      else expect(item.icon, `item ${item.key} is missing an icon`).toBeTruthy()
    }
    // Spot-check the marks mirrored from the board buttons.
    const iconOf = (key: string) => items.find((i) => i.key === key)?.icon
    expect(iconOf('accounts-receivable')).toBe('💵')
    expect(iconOf('billed-share-print')).toBe('⇪')
    expect(iconOf('billed-aging-chart')).toBe('📊')
    expect(iconOf('billed-payment-forecast')).toBe('📅')
    expect(iconOf('paid-notifications')).toBe('⚙')
    expect(iconOf('recently-added')).toBe('🕒')
  })

  it('GC Review disables only when Billed and Collections are both empty', () => {
    const empty = buildStagesSectionToolsMenu({
      ...base,
      authRole: 'dev',
      billedRowCount: 0,
      collectionsRowCount: 0,
    })
    expect(empty.flatMap((g) => g.items).find((i) => i.key === 'gc-review')?.disabled).toBe(true)

    const collectionsOnly = buildStagesSectionToolsMenu({
      ...base,
      authRole: 'dev',
      billedRowCount: 0,
      collectionsRowCount: 2,
    })
    expect(collectionsOnly.flatMap((g) => g.items).find((i) => i.key === 'gc-review')?.disabled).toBe(false)
  })

  it('Accounts Receivable badge appears only for a positive count', () => {
    const withBadge = buildStagesSectionToolsMenu({ ...base, authRole: 'dev' })
    expect(withBadge.flatMap((g) => g.items).find((i) => i.key === 'accounts-receivable')?.badgeCount).toBe(16)

    for (const arBankTxUnallocatedCount of [0, null]) {
      const groups = buildStagesSectionToolsMenu({ ...base, authRole: 'dev', arBankTxUnallocatedCount })
      expect(
        groups.flatMap((g) => g.items).find((i) => i.key === 'accounts-receivable')?.badgeCount,
      ).toBeUndefined()
    }
  })

  it('Capable of Being Billed label carries the preformatted total', () => {
    const groups = buildStagesSectionToolsMenu({ ...base, authRole: 'assistant' })
    expect(groups.flatMap((g) => g.items).find((i) => i.key === 'capable-to-bill')?.label).toBe(
      'Capable of Being Billed: $12,345',
    )
    // While header stats are still loading the view passes '…' (same value the
    // Working header shows) — the label must carry it through, not read $0.
    const loading = buildStagesSectionToolsMenu({ ...base, authRole: 'assistant', capableToBillTotalFormatted: '…' })
    expect(loading.flatMap((g) => g.items).find((i) => i.key === 'capable-to-bill')?.label).toBe(
      'Capable of Being Billed: $…',
    )
  })
})

describe('recently-added menu item (v2.1973)', () => {
  it('every role gets it, first in the Pipeline group', () => {
    for (const authRole of ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', null]) {
      const groups = buildStagesSectionToolsMenu({ ...base, authRole })
      expect(groups[0]!.items[0]!.key).toBe('recently-added')
      expect(groups[0]!.items[0]!.label).toBe('Recently added')
    }
  })

  it('label flips to the exit while the flat view is open', () => {
    const groups = buildStagesSectionToolsMenu({ ...base, authRole: 'dev', recentViewOpen: true })
    expect(groups[0]!.items[0]!.label).toBe('Back to board')
  })
})
