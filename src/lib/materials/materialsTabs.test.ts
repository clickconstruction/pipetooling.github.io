import { describe, expect, it } from 'vitest'

import {
  MATERIALS_TABS,
  canAccessMaterials,
  canOpenMaterialsTab,
  isOfficeMaterialsTab,
  materialsTabsFor,
  resolveMaterialsTab,
  supplyHousesPaneFor,
} from './materialsTabs'

const ALL_ROLES = ['dev', 'master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent'] as const

describe('materialsTabsFor', () => {
  it('gives office roles every tab in canonical order', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) {
      expect(materialsTabsFor(role)).toEqual([...MATERIALS_TABS])
    }
  })

  it('gives estimators the books and the PO lanes, never the office ledgers', () => {
    expect(materialsTabsFor('estimator')).toEqual(['parts-book', 'assembly-book', 'assemblies-po', 'purchase-orders'])
    expect(canOpenMaterialsTab('estimator', 'supply-houses')).toBe(false)
    expect(canOpenMaterialsTab('estimator', 'job-accounts')).toBe(false)
    expect(canOpenMaterialsTab('estimator', 'po-generator')).toBe(false)
  })

  it('gives primaries and superintendents the two books only', () => {
    expect(materialsTabsFor('primary')).toEqual(['parts-book', 'assembly-book'])
    expect(materialsTabsFor('superintendent')).toEqual(['parts-book', 'assembly-book'])
  })

  it('gives field roles and unknown roles nothing', () => {
    expect(materialsTabsFor('subcontractor')).toEqual([])
    expect(materialsTabsFor('helpers')).toEqual([])
    expect(materialsTabsFor(null)).toEqual([])
    expect(materialsTabsFor(undefined)).toEqual([])
    expect(materialsTabsFor('digital_twin')).toEqual([])
  })

  it('covers all nine roles', () => {
    const allowed = ALL_ROLES.filter((r) => canAccessMaterials(r))
    expect(allowed).toEqual(['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'])
  })
})

describe('isOfficeMaterialsTab', () => {
  it('names the three office lanes', () => {
    expect(MATERIALS_TABS.filter(isOfficeMaterialsTab)).toEqual(['supply-houses', 'job-accounts', 'po-generator'])
  })
})

describe('resolveMaterialsTab', () => {
  it('writes the default into a URL with no tab', () => {
    expect(resolveMaterialsTab('dev', null)).toEqual({ tab: 'parts-book', redirect: true })
    expect(resolveMaterialsTab('estimator', '')).toEqual({ tab: 'parts-book', redirect: true })
  })

  it('keeps a tab the role may open', () => {
    expect(resolveMaterialsTab('assistant', 'job-accounts')).toEqual({ tab: 'job-accounts', redirect: false })
    expect(resolveMaterialsTab('estimator', 'purchase-orders')).toEqual({ tab: 'purchase-orders', redirect: false })
  })

  it('sends a role away from a tab it may not open', () => {
    expect(resolveMaterialsTab('estimator', 'supply-houses')).toEqual({ tab: 'parts-book', redirect: true })
    expect(resolveMaterialsTab('estimator', 'po-generator')).toEqual({ tab: 'parts-book', redirect: true })
    expect(resolveMaterialsTab('primary', 'purchase-orders')).toEqual({ tab: 'parts-book', redirect: true })
    expect(resolveMaterialsTab('superintendent', 'assemblies-po')).toEqual({ tab: 'parts-book', redirect: true })
  })

  it('leaves an unknown slug alone', () => {
    expect(resolveMaterialsTab('dev', 'not-a-tab')).toEqual({ tab: null, redirect: false })
  })
})

describe('supplyHousesPaneFor', () => {
  it('gives the office both panes and everyone else nothing (until the estimator door opens)', () => {
    expect(supplyHousesPaneFor('dev')).toBe('office')
    expect(supplyHousesPaneFor('controller')).toBe('office')
    expect(supplyHousesPaneFor('estimator')).toBeNull()
    expect(supplyHousesPaneFor('primary')).toBeNull()
    expect(supplyHousesPaneFor(null)).toBeNull()
  })
})
