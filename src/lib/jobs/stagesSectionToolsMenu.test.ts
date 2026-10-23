import { describe, expect, it } from 'vitest'
import { buildStagesSectionToolsMenu } from './stagesSectionToolsMenu'

const base = {
  recentViewOpen: false,
  billedRowCount: 5,
  collectionsRowCount: 1,
  arBankTxUnallocatedCount: 16,
  capableToBillTotalFormatted: '12,345',
  collectionsHeaderCount: '1',
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
      'Collections',
      'Paid in Full',
    ])
    expect(keysOf(groups)).toEqual([
      'lien-desk',
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
      'legal-desk',
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
    expect(assistantKeys).toEqual(['lien-desk', 'recently-added', 'weekly-movement', 'capable-to-bill', 'gc-review', 'accounts-receivable', 'billed-share-print', 'billed-payment-forecast', 'legal-desk'])
    const controllerGroups = buildStagesSectionToolsMenu({ ...base, authRole: 'controller' })
    expect(keysOf(controllerGroups)).toEqual([
      'lien-desk',
      'recently-added',
      'weekly-movement',
      'weekly-money',
      'capable-to-bill',
      'gc-review',
      'accounts-receivable',
      'billed-share-print',
      'billed-aging-chart',
      'billed-payment-forecast',
      'legal-desk',
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

  it('every item names its line icon: the owner\u2019s picks (v2.4524), the notification rows and the charts sharing one each', () => {
    const items = buildStagesSectionToolsMenu({ ...base, authRole: 'dev' }).flatMap((g) => g.items)
    expect(Object.fromEntries(items.map((i) => [i.key, i.icon]))).toEqual({
      'lien-desk': 'gavel',
      'recently-added': 'history',
      'weekly-movement': 'route',
      'weekly-money': 'cash',
      'capable-to-bill': 'file-dollar',
      'ready-to-bill-notifications': 'bell',
      'gc-review': 'building',
      'accounts-receivable': 'bank',
      'billed-share-print': 'share',
      'billed-aging-chart': 'chart-bar',
      'billed-payment-forecast': 'calendar-bars',
      'paid-notifications': 'bell',
      'legal-desk': 'scales',
      'paid-profit-chart': 'chart-bar',
      'paid-in-full-notifications': 'bell',
    })
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
  it('every role gets it, in the Pipeline group — first for the roles without a Lien desk row (v2.3799)', () => {
    for (const authRole of ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'superintendent', null]) {
      const groups = buildStagesSectionToolsMenu({ ...base, authRole })
      const item = groups[0]!.items.find((i) => i.key === 'recently-added')
      expect(item?.label).toBe('Recently added')
    }
    expect(buildStagesSectionToolsMenu({ ...base, authRole: 'primary' })[0]!.items[0]!.key).toBe('recently-added')
  })

  it('label flips to the exit while the flat view is open', () => {
    const groups = buildStagesSectionToolsMenu({ ...base, authRole: 'dev', recentViewOpen: true })
    expect(groups[0]!.items.find((i) => i.key === 'recently-added')?.label).toBe('Back to board')
  })
})

describe('Legal desk row (v2.5750): the Collections header\u2019s ⚖ Legal button, in the menu', () => {
  const legalRow = (groups: ReturnType<typeof buildStagesSectionToolsMenu>) => groups.flatMap((g) => g.items).find((i) => i.key === 'legal-desk')

  it('is the one row of a Collections group between Billed and Paid in Full, for the office, with the scales', () => {
    for (const authRole of ['dev', 'master_technician', 'assistant', 'controller']) {
      const groups = buildStagesSectionToolsMenu({ ...base, authRole })
      const sections = groups.map((g) => g.section)
      expect(sections.indexOf('Collections')).toBe(sections.indexOf('Billed Awaiting Payment') + 1)
      expect(groups.find((g) => g.section === 'Collections')?.items).toEqual([
        expect.objectContaining({ key: 'legal-desk', label: 'Legal desk', icon: 'scales', disabled: false }),
      ])
    }
  })

  it('is hidden, not disabled, for roles the header draws no button for', () => {
    for (const authRole of ['primary', 'superintendent', 'estimator', 'helpers', null]) {
      const groups = buildStagesSectionToolsMenu({ ...base, authRole })
      expect(keysOf(groups)).not.toContain('legal-desk')
      expect(groups.some((g) => g.section === 'Collections')).toBe(false)
    }
  })

  it('disables on the Collections header\u2019s 0, as the header button does — never on the lazily loaded rows', () => {
    expect(legalRow(buildStagesSectionToolsMenu({ ...base, authRole: 'dev', collectionsHeaderCount: '0', collectionsRowCount: 0 }))?.disabled).toBe(true)
    // A fresh page: the header already says 6 while the rows are still unfetched.
    expect(legalRow(buildStagesSectionToolsMenu({ ...base, authRole: 'dev', collectionsHeaderCount: '6', collectionsRowCount: 0 }))?.disabled).toBe(false)
    // Stats still loading: open, like the header.
    expect(legalRow(buildStagesSectionToolsMenu({ ...base, authRole: 'dev', collectionsHeaderCount: '…', collectionsRowCount: 0 }))?.disabled).toBe(false)
  })

  it('wears the firm\u2019s waiting acts as its badge, and none while that loads or is zero', () => {
    expect(legalRow(buildStagesSectionToolsMenu({ ...base, authRole: 'controller', legalDeskCount: 3 }))?.badgeCount).toBe(3)
    for (const legalDeskCount of [0, null, undefined]) {
      expect(legalRow(buildStagesSectionToolsMenu({ ...base, authRole: 'controller', legalDeskCount }))).not.toHaveProperty('badgeCount')
    }
  })
})

describe('Lien desk row (v2.3405; leads the menu since v2.3799, punch list #34)', () => {
  it('is the first row of the Pipeline group for the office, with the desk count as its badge', () => {
    for (const authRole of ['dev', 'master_technician', 'assistant', 'controller']) {
      const groups = buildStagesSectionToolsMenu({ ...base, authRole, lienDeskCount: 16 })
      expect(groups[0]!.section).toBe('Pipeline')
      expect(groups[0]!.items[0]).toMatchObject({ key: 'lien-desk', label: 'Lien desk', icon: 'gavel', badgeCount: 16 })
      // Not under Collections, where the Legal desk's row lives (v2.5750).
      expect(groups.find((g) => g.section === 'Collections')?.items.map((i) => i.key)).toEqual(['legal-desk'])
    }
  })

  it('carries no badge while the count loads or is zero, and is hidden from roles without Accounts Receivable', () => {
    expect(buildStagesSectionToolsMenu({ ...base, authRole: 'dev', lienDeskCount: null })[0]!.items[0]).not.toHaveProperty('badgeCount')
    expect(buildStagesSectionToolsMenu({ ...base, authRole: 'dev', lienDeskCount: 0 })[0]!.items[0]).not.toHaveProperty('badgeCount')
    for (const authRole of ['primary', 'superintendent', 'helpers', null]) {
      expect(keysOf(buildStagesSectionToolsMenu({ ...base, authRole, lienDeskCount: 16 }))).not.toContain('lien-desk')
    }
  })
})
