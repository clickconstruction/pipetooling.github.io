import { describe, expect, it } from 'vitest'
import {
  EGG_PAGES,
  EGG_PAGE_GROUPS,
  eggSurfaceKeyForBidsTab,
  eggSurfaceKeyForPage,
  eggSurfaceLabel,
  eggSurfaceMatches,
  eggSurfaceVisibleForRole,
  normalizeEggSurfaces,
} from './easterEggSurfaceTree'

describe('normalizeEggSurfaces', () => {
  it('expands legacy followup into the two followup tab keys', () => {
    expect(normalizeEggSurfaces(['followup'])).toEqual(['t:/bids:builder-review', 't:/bids:submission-followup'])
  })

  it('drops unknown keys and dedupes, keeping order', () => {
    expect(normalizeEggSurfaces(['p:/jobs', 'p:/mars', 'followup', 't:/bids:builder-review', 'p:/jobs'])).toEqual([
      'p:/jobs',
      't:/bids:builder-review',
      't:/bids:submission-followup',
    ])
  })
})

describe('eggSurfaceMatches', () => {
  it('page surfaces match the path and its subpaths, any tab', () => {
    expect(eggSurfaceMatches('p:/jobs', '/jobs', null)).toBe(true)
    expect(eggSurfaceMatches('p:/jobs', '/jobs', 'reports')).toBe(true)
    expect(eggSurfaceMatches('p:/customers', '/customers/abc', null)).toBe(true)
    expect(eggSurfaceMatches('p:/jobs', '/jobsite', null)).toBe(false)
    expect(eggSurfaceMatches('p:/workflows', '/workflows/proj-1', null)).toBe(true)
  })

  it('bids tab surfaces match one tab, with bid-board as the no-param default', () => {
    expect(eggSurfaceMatches('t:/bids:pricing', '/bids', 'pricing')).toBe(true)
    expect(eggSurfaceMatches('t:/bids:pricing', '/bids', 'counts')).toBe(false)
    expect(eggSurfaceMatches('t:/bids:bid-board', '/bids', null)).toBe(true)
    expect(eggSurfaceMatches('t:/bids:pricing', '/jobs', 'pricing')).toBe(false)
  })
})

describe('eggSurfaceLabel', () => {
  it('labels pages plainly and bids tabs as Bids · Tab', () => {
    expect(eggSurfaceLabel('p:/dashboard')).toBe('Dashboard')
    expect(eggSurfaceLabel(eggSurfaceKeyForBidsTab('why-we-lost'))).toBe('Bids · Why We Lost')
  })
})

describe('eggSurfaceVisibleForRole', () => {
  it('follows the router guard for restricted roles', () => {
    expect(eggSurfaceVisibleForRole('p:/bids', 'estimator', false)).toBe(true)
    expect(eggSurfaceVisibleForRole('p:/projects', 'estimator', false)).toBe(false)
    expect(eggSurfaceVisibleForRole('p:/banking', 'estimator', false)).toBe(false)
    expect(eggSurfaceVisibleForRole('p:/prospects', 'estimator', false)).toBe(false)
    expect(eggSurfaceVisibleForRole('p:/prospects', 'estimator', true)).toBe(true)
    expect(eggSurfaceVisibleForRole('t:/bids:pricing', 'estimator', false)).toBe(true)
    expect(eggSurfaceVisibleForRole('p:/job-mode', 'subcontractor', false)).toBe(true)
    expect(eggSurfaceVisibleForRole('p:/jobs', 'subcontractor', false)).toBe(false)
    expect(eggSurfaceVisibleForRole('p:/workflows', 'superintendent', false)).toBe(true)
  })

  it('applies the in-page dev gates staff routing lets through', () => {
    expect(eggSurfaceVisibleForRole('p:/templates', 'master_technician', false)).toBe(false)
    expect(eggSurfaceVisibleForRole('p:/templates', 'dev', false)).toBe(true)
    expect(eggSurfaceVisibleForRole('p:/moneyfill', 'controller', false)).toBe(true)
    expect(eggSurfaceVisibleForRole('p:/moneyfill', 'assistant', false)).toBe(false)
    expect(eggSurfaceVisibleForRole('p:/partnerships', 'master_technician', false)).toBe(false)
  })
})

describe('EGG_PAGES', () => {
  it('every page sits in a known group and mints a valid key', () => {
    for (const page of EGG_PAGES) {
      expect(EGG_PAGE_GROUPS).toContain(page.group)
      expect(eggSurfaceMatches(eggSurfaceKeyForPage(page.path), page.path, null)).toBe(true)
    }
  })
})
