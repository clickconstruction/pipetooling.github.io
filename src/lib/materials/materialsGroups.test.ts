import { describe, expect, it } from 'vitest'

import { MATERIALS_TABS } from './materialsTabs'
import { MATERIALS_GROUP_WORDS, MATERIALS_TAB_LABELS, materialsGroupOf, materialsGroupsFor, materialsPressesFor, onSiteJobHref, trackBadges } from './materialsGroups'

describe('materialsGroupsFor', () => {
  it('gives the office three groups in the order a part lives', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) {
      expect(materialsGroupsFor(role)).toEqual([
        { key: 'plan', word: 'Plan', tabs: ['parts-book', 'assembly-book', 'assemblies-po'] },
        { key: 'purchase', word: 'Purchase', tabs: ['purchase-orders', 'po-generator', 'supply-houses', 'job-accounts'] },
        { key: 'track', word: 'Track', tabs: ['on-site'] },
      ])
    }
  })

  it('gives an estimator the same groups with the office lanes left out', () => {
    expect(materialsGroupsFor('estimator').map((g) => [g.key, g.tabs])).toEqual([
      ['plan', ['parts-book', 'assembly-book', 'assemblies-po']],
      ['purchase', ['purchase-orders', 'supply-houses']],
      ['track', ['on-site']],
    ])
  })

  it('gives a primary and a superintendent Plan and the third group, and no Purchase', () => {
    for (const role of ['primary', 'superintendent']) {
      expect(materialsGroupsFor(role).map((g) => [g.key, g.tabs])).toEqual([
        ['plan', ['parts-book', 'assembly-book']],
        ['track', ['on-site']],
      ])
    }
  })

  it('gives a field role and an unknown role nothing', () => {
    expect(materialsGroupsFor('helpers')).toEqual([])
    expect(materialsGroupsFor('subcontractor')).toEqual([])
    expect(materialsGroupsFor(null)).toEqual([])
  })

  it('files every tab under exactly one group and names it', () => {
    for (const tab of MATERIALS_TABS) {
      expect(MATERIALS_GROUP_WORDS[materialsGroupOf(tab)]).toBeTruthy()
      expect(MATERIALS_TAB_LABELS[tab]).toBeTruthy()
    }
    expect(materialsGroupOf('purchase-orders')).toBe('purchase')
    expect(materialsGroupOf('assemblies-po')).toBe('plan')
  })
})

describe('materialsPressesFor', () => {
  it('offers both presses to every role that opens On site', () => {
    for (const role of ['dev', 'controller', 'estimator', 'primary', 'superintendent']) {
      expect(materialsPressesFor(role)).toEqual(['print-labels', 'scan-label'])
    }
    expect(materialsPressesFor('helpers')).toEqual([])
  })
})

describe('trackBadges', () => {
  it('wears nothing until the desk has loaded, and nothing when no hand is needed', () => {
    expect(trackBadges(null, 'dev')).toEqual([])
    expect(trackBadges({ staleBoxes: 0, missingMoneyWeek: 0 }, 'dev')).toEqual([])
  })

  it('shows the boxes due a count to everyone and the money to the office alone', () => {
    const needs = { staleBoxes: 3, missingMoneyWeek: 444.95 }
    expect(trackBadges(needs, 'assistant')).toEqual([
      { text: '3 due a count', tone: 'amber' },
      { text: '$444.95 walked away', tone: 'red' },
    ])
    expect(trackBadges(needs, 'primary')).toEqual([{ text: '3 due a count', tone: 'amber' }])
    expect(trackBadges(needs, 'estimator')).toEqual([{ text: '3 due a count', tone: 'amber' }])
  })
})

describe('onSiteJobHref', () => {
  it('keeps the office on the page and sends everyone else to the phone screen', () => {
    expect(onSiteJobHref('controller', 'j1')).toBe('/materials?tab=on-site&job=j1')
    expect(onSiteJobHref('superintendent', 'j1')).toBe('/tally?tab=on-site&job=j1')
  })
})
