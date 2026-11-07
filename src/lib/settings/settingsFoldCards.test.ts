import { describe, expect, it } from 'vitest'
import { MOVED_SETTINGS_CARDS, MOVED_SETTINGS_CARD_LIST, movedSettingsCardAnchorNow, movedSettingsCardAnchorToTab, settingsCardIsTarget } from './settingsFoldCards'
import { JOBS_BILLING_CARDS } from './jobsBillingGroups'

describe('settingsFoldCards (punch list #261 PR 2)', () => {
  it('the three moved cards each sit on a tab of their own with a new anchor and the old one', () => {
    expect(MOVED_SETTINGS_CARD_LIST.map((c) => [c.slug, c.tab])).toEqual([
      ['hcp-reconcile', 'settings-data'],
      ['sub-pay', 'settings-people'],
      ['office-county', 'settings-company'],
    ])
    for (const c of MOVED_SETTINGS_CARD_LIST) {
      expect(c.anchor.startsWith(`${c.tab}-`)).toBe(true)
      expect(c.movedFrom).toEqual([`settings-jobs-${c.slug}`])
      expect(JOBS_BILLING_CARDS.some((j) => j.anchor === c.anchor || c.movedFrom.includes(j.anchor))).toBe(false)
    }
  })

  it('a moved card is the target by its new anchor or its old one; a child anchor opens the card that holds it', () => {
    const hcp = MOVED_SETTINGS_CARDS['hcp-reconcile']
    expect(settingsCardIsTarget(hcp, 'settings-data-hcp-reconcile')).toBe(true)
    expect(settingsCardIsTarget(hcp, 'settings-jobs-hcp-reconcile')).toBe(true)
    expect(settingsCardIsTarget(hcp, 'settings-jobs-rates')).toBe(false)
    expect(settingsCardIsTarget(hcp, '')).toBe(false)
    const rates = JOBS_BILLING_CARDS.find((c) => c.slug === 'rates')!
    expect(settingsCardIsTarget(rates, 'who-counts-as-what')).toBe(true)
    expect(settingsCardIsTarget(rates, 'settings-jobs-hcp-reconcile')).toBe(false)
  })

  it('maps every anchor, new and old, to the tab, and every old anchor to the one the card carries now', () => {
    const toTab = movedSettingsCardAnchorToTab()
    expect(Object.keys(toTab)).toHaveLength(6)
    expect(toTab['settings-jobs-sub-pay']).toBe('settings-people')
    expect(toTab['settings-people-sub-pay']).toBe('settings-people')
    expect(movedSettingsCardAnchorNow()).toEqual({
      'settings-jobs-hcp-reconcile': 'settings-data-hcp-reconcile',
      'settings-jobs-sub-pay': 'settings-people-sub-pay',
      'settings-jobs-office-county': 'settings-company-office-county',
    })
  })
})
