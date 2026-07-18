import { describe, expect, it } from 'vitest'
import {
  filterPinnedByRole,
  filterPinsToShow,
  getAllowedPathsForRole,
  getPinnedChipDisplay,
  getTallyLinkAccessibleName,
  type PinnedRowFinancialTotals,
} from './dashboardPinnedRow'
import type { PinnedItem } from './pinnedTabs'

const noTotals: PinnedRowFinancialTotals = {
  costMatrixTotal: null,
  billedCount: null,
  billedTotal: null,
  supplyHousesAPTotal: null,
  subLaborDueTotal: null,
}

describe('getAllowedPathsForRole', () => {
  it('returns the subcontractor set for subcontractor and helpers', () => {
    for (const role of ['subcontractor', 'helpers']) {
      const allowed = getAllowedPathsForRole(role)
      expect(allowed).not.toBeNull()
      expect(allowed!.has('/tally')).toBe(true)
      expect(allowed!.has('/jobs')).toBe(false)
    }
  })

  it('treats null role as primary (prevents flash before role loads)', () => {
    const allowed = getAllowedPathsForRole(null)
    expect(allowed).toEqual(getAllowedPathsForRole('primary'))
    expect(allowed!.has('/jobs')).toBe(true)
    expect(allowed!.has('/projects')).toBe(false)
  })

  it('gives superintendent projects and workflows access', () => {
    const allowed = getAllowedPathsForRole('superintendent')
    expect(allowed!.has('/projects')).toBe(true)
    expect(allowed!.has('/workflows')).toBe(true)
  })

  it('returns null (no filter) for dev, master_technician, assistant, controller', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) {
      expect(getAllowedPathsForRole(role)).toBeNull()
    }
  })

  it('adds /prospects for estimators only with prospects access', () => {
    expect(getAllowedPathsForRole('estimator', false)!.has('/prospects')).toBe(false)
    expect(getAllowedPathsForRole('estimator', true)!.has('/prospects')).toBe(true)
    expect(getAllowedPathsForRole('estimator', true)!.has('/people')).toBe(true)
  })
})

describe('filterPinnedByRole', () => {
  const pins: PinnedItem[] = [
    { path: '/jobs', label: 'Jobs', tab: 'billing' },
    { path: '/people', label: 'People', tab: 'hours' },
    { path: '/tally', label: 'Tally' },
  ]

  it('passes everything through for unfiltered roles', () => {
    expect(filterPinnedByRole(pins, 'dev')).toEqual(pins)
    expect(filterPinnedByRole(pins, 'assistant')).toEqual(pins)
  })

  it('filters to the role path set', () => {
    expect(filterPinnedByRole(pins, 'subcontractor')).toEqual([{ path: '/tally', label: 'Tally' }])
    expect(filterPinnedByRole(pins, 'primary').map((p) => p.path)).toEqual(['/jobs', '/tally'])
  })

  it('lets estimators keep /people pins', () => {
    expect(filterPinnedByRole(pins, 'estimator').map((p) => p.path)).toEqual(['/people', '/tally'])
  })
})

describe('filterPinsToShow', () => {
  it('drops dashboard/self pins and the Materials external-team pin', () => {
    const pins: PinnedItem[] = [
      { path: '/dashboard', label: 'Dashboard' },
      { path: '/', label: 'Home' },
      { path: '/materials', label: 'Materials', tab: 'external-team' },
      { path: '/materials', label: 'Materials', tab: 'parts-book' },
      { path: '/jobs', label: 'Jobs', tab: 'billed' },
    ]
    expect(filterPinsToShow(pins)).toEqual([
      { path: '/materials', label: 'Materials', tab: 'parts-book' },
      { path: '/jobs', label: 'Jobs', tab: 'billed' },
    ])
  })
})

describe('getPinnedChipDisplay', () => {
  it('formats a plain pin without a tab as path + stored label', () => {
    expect(getPinnedChipDisplay({ path: '/calendar', label: 'Calendar' }, noTotals)).toEqual({
      to: '/calendar',
      label: 'Calendar',
    })
  })

  it('formats a generic tab pin with tab in the link and a humanized tab suffix', () => {
    expect(getPinnedChipDisplay({ path: '/bids', label: 'Bids', tab: 'bid-board' }, noTotals)).toEqual({
      to: '/bids?tab=bid-board',
      label: 'Bids · bid board',
    })
    expect(getPinnedChipDisplay({ path: '/jobs', label: 'Jobs', tab: 'combined-labor' }, noTotals).label).toBe(
      'Jobs · combined labor',
    )
  })

  it('shows the cost-matrix pin as a rounded Internal Team total', () => {
    const pin: PinnedItem = { path: '/people', label: 'People · hours', tab: 'hours' }
    expect(getPinnedChipDisplay(pin, { ...noTotals, costMatrixTotal: 12345.67 })).toEqual({
      to: '/people?tab=hours',
      label: 'Internal Team: $12,346',
    })
    expect(getPinnedChipDisplay(pin, noTotals).label).toBe('People · hours')
  })

  it('routes the billed pin to stages with the by-name total flag and shows count + 2-decimal total', () => {
    const pin: PinnedItem = { path: '/jobs', label: 'Jobs · billed', tab: 'billed' }
    expect(getPinnedChipDisplay(pin, { ...noTotals, billedCount: 3, billedTotal: 1500.5 })).toEqual({
      to: '/jobs?tab=stages&showBilledTotalByName=true',
      label: 'Billed Awaiting Payment (3): $1,500.50',
    })
  })

  it('shows a loading label for the billed pin until both count and total arrive', () => {
    const pin: PinnedItem = { path: '/jobs', label: 'Jobs · billed', tab: 'billed' }
    expect(getPinnedChipDisplay(pin, { ...noTotals, billedCount: 3 }).label).toBe('Billed Awaiting Payment…')
    expect(getPinnedChipDisplay(pin, { ...noTotals, billedTotal: 10 }).label).toBe('Billed Awaiting Payment…')
  })

  it('shows the supply-houses pin as a rounded Supply Houses total', () => {
    const pin: PinnedItem = { path: '/materials', label: 'Materials · supply houses', tab: 'supply-houses' }
    expect(getPinnedChipDisplay(pin, { ...noTotals, supplyHousesAPTotal: 999.4 })).toEqual({
      to: '/materials?tab=supply-houses',
      label: 'Supply Houses: $999',
    })
    expect(getPinnedChipDisplay(pin, noTotals).label).toBe('Materials · supply houses')
  })

  it('routes the sub-labor-due pin straight to sub_sheet_ledger with a 2-decimal total', () => {
    const pin: PinnedItem = { path: '/jobs', label: 'Jobs · sub sheet ledger', tab: 'sub_sheet_ledger' }
    expect(getPinnedChipDisplay(pin, { ...noTotals, subLaborDueTotal: 250 })).toEqual({
      to: '/jobs?tab=sub_sheet_ledger',
      label: 'Sub Labor Due: $250.00',
    })
    expect(getPinnedChipDisplay(pin, noTotals).label).toBe('Jobs · sub sheet ledger')
  })
})

describe('getTallyLinkAccessibleName', () => {
  it('is the plain label when the count is null or zero', () => {
    expect(getTallyLinkAccessibleName(null)).toBe('Job Parts Tally')
    expect(getTallyLinkAccessibleName(0)).toBe('Job Parts Tally')
  })

  it('pluralizes the unlinked-transaction count', () => {
    expect(getTallyLinkAccessibleName(1)).toBe('Job Parts Tally, 1 unlinked transaction')
    expect(getTallyLinkAccessibleName(7)).toBe('Job Parts Tally, 7 unlinked transactions')
  })
})
