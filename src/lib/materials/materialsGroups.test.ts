import { describe, expect, it } from 'vitest'

import { MATERIALS_TABS } from './materialsTabs'
import { MATERIALS_GROUP_WORDS, MATERIALS_PHONE_PRESS_LABELS, MATERIALS_TAB_LABELS, groupOnlyTab, materialsGroupOf, materialsGroupsFor, materialsPhonePresses, materialsPressesFor, onSiteJobHref, trackBadges } from './materialsGroups'

describe('materialsGroupsFor', () => {
  it('gives the office three groups in the order a part lives', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller']) {
      expect(materialsGroupsFor(role)).toEqual([
        { key: 'plan', word: 'Plan', tabs: ['parts-book', 'assembly-book', 'assemblies-po'] },
        { key: 'purchase', word: 'Purchase', tabs: ['purchase-orders', 'po-generator', 'supply-houses', 'job-accounts', 'what-we-buy'] },
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
  it('offers Scan a label and Print labels to every role that opens On site, and Print future stickers to the roles that may mint a run', () => {
    for (const role of ['dev', 'controller', 'primary', 'superintendent']) {
      expect(materialsPressesFor(role)).toEqual(['scan-label', 'print-labels', 'print-stickers'])
    }
    // An estimator opens On site and prints labels, and prints no run (the card's call 6: the office, a primary, a superintendent).
    expect(materialsPressesFor('estimator')).toEqual(['scan-label', 'print-labels'])
    expect(materialsPressesFor('helpers')).toEqual([])
  })
})

describe('the phone’s row of names (v2.8282)', () => {
  it('a group with one tab is that tab, and a group with several is not', () => {
    const [plan, purchase, track] = materialsGroupsFor('dev')
    expect(groupOnlyTab(track!)).toBe('on-site')
    expect(groupOnlyTab(plan!)).toBeNull()
    expect(groupOnlyTab(purchase!)).toBeNull()
    expect(groupOnlyTab({ tabs: [] })).toBeNull()
  })

  it('draws scan then print for a role with the presses, and nothing for a role without', () => {
    expect(materialsPhonePresses(materialsPressesFor('dev'))).toEqual(['scan', 'print'])
    // an estimator prints labels, so the one print press is still there
    expect(materialsPhonePresses(materialsPressesFor('estimator'))).toEqual(['scan', 'print'])
    expect(materialsPhonePresses(materialsPressesFor('helpers'))).toEqual([])
    expect(materialsPhonePresses(['scan-label'])).toEqual(['scan'])
    expect(MATERIALS_PHONE_PRESS_LABELS).toEqual({ scan: 'Scan a label', print: 'Print' })
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

  it('names the short lines for the office when none of them has a price, where there is no money to name', () => {
    expect(trackBadges({ staleBoxes: 0, missingMoneyWeek: 0, missingLines: 4 }, 'assistant')).toEqual([{ text: '4 lines came up short', tone: 'amber' }])
    expect(trackBadges({ staleBoxes: 0, missingMoneyWeek: 0, missingLines: 1 }, 'dev')).toEqual([{ text: '1 line came up short', tone: 'amber' }])
    // Money, when there is any, is still the badge; and a field role sees neither.
    expect(trackBadges({ staleBoxes: 0, missingMoneyWeek: 12.5, missingLines: 4 }, 'assistant')).toEqual([{ text: '$12.50 walked away', tone: 'red' }])
    expect(trackBadges({ staleBoxes: 0, missingMoneyWeek: 0, missingLines: 4 }, 'primary')).toEqual([])
  })
})

describe('onSiteJobHref', () => {
  it('keeps the office on the page and sends everyone else to the phone screen', () => {
    expect(onSiteJobHref('controller', 'j1')).toBe('/materials?tab=on-site&job=j1')
    expect(onSiteJobHref('superintendent', 'j1')).toBe('/tally?tab=on-site&job=j1')
  })
})
