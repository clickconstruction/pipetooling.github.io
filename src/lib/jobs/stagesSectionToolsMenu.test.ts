import { describe, expect, it } from 'vitest'
import { buildStagesSectionToolsMenu } from './stagesSectionToolsMenu'

const base = {
  billedRowCount: 5,
  collectionsRowCount: 1,
  arBankTxUnallocatedCount: 16,
  capableToBillTotalFormatted: '12,345',
}

function keysOf(groups: ReturnType<typeof buildStagesSectionToolsMenu>) {
  return groups.flatMap((g) => g.items.map((i) => i.key))
}

describe('buildStagesSectionToolsMenu', () => {
  it('dev sees every tool, grouped under the three stage sections', () => {
    const groups = buildStagesSectionToolsMenu({ ...base, authRole: 'dev' })
    expect(groups.map((g) => g.section)).toEqual(['Working', 'Billed Awaiting Payment', 'Paid in Full'])
    expect(keysOf(groups)).toEqual([
      'capable-to-bill',
      'gc-review',
      'accounts-receivable',
      'billed-share-print',
      'paid-notifications',
      'paid-in-full-notifications',
    ])
  })

  it('master_technician matches dev (both notification settings included)', () => {
    expect(keysOf(buildStagesSectionToolsMenu({ ...base, authRole: 'master_technician' }))).toEqual(
      keysOf(buildStagesSectionToolsMenu({ ...base, authRole: 'dev' })),
    )
  })

  it('assistant and controller get Share / Print but not the notification settings', () => {
    for (const authRole of ['assistant', 'controller']) {
      const groups = buildStagesSectionToolsMenu({ ...base, authRole })
      expect(keysOf(groups)).toEqual(['capable-to-bill', 'gc-review', 'accounts-receivable', 'billed-share-print'])
      expect(groups.some((g) => g.section === 'Paid in Full')).toBe(false)
    }
  })

  it('primary can open Accounts Receivable but sees no admin tools', () => {
    const groups = buildStagesSectionToolsMenu({ ...base, authRole: 'primary' })
    expect(keysOf(groups)).toEqual(['capable-to-bill', 'gc-review', 'accounts-receivable'])
    const ar = groups.flatMap((g) => g.items).find((i) => i.key === 'accounts-receivable')
    expect(ar?.disabled).toBe(false)
  })

  it('superintendent sees Accounts Receivable disabled (mirrors the header button)', () => {
    const groups = buildStagesSectionToolsMenu({ ...base, authRole: 'superintendent' })
    const ar = groups.flatMap((g) => g.items).find((i) => i.key === 'accounts-receivable')
    expect(ar?.disabled).toBe(true)
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
  })
})
