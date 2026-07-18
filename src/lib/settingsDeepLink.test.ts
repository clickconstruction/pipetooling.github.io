import { describe, expect, it } from 'vitest'
import { resolveSettingsDeepLink } from './settingsDeepLink'

describe('resolveSettingsDeepLink', () => {
  it('resolves ?tab= to a tab with no anchor', () => {
    expect(resolveSettingsDeepLink('?tab=settings-data', '')).toEqual({ tabId: 'settings-data', anchorId: null })
    expect(resolveSettingsDeepLink('tab=settings-people', '')).toEqual({ tabId: 'settings-people', anchorId: null })
  })

  it('maps known section-anchor hashes to their owning tab + anchor', () => {
    expect(resolveSettingsDeepLink('', '#settings-time-off')).toEqual({
      tabId: 'settings-account',
      anchorId: 'settings-time-off',
    })
    expect(resolveSettingsDeepLink('', 'settings-salary-workday')).toEqual({
      tabId: 'settings-account',
      anchorId: 'settings-salary-workday',
    })
  })

  it('treats a tab-shaped hash like ?tab=', () => {
    expect(resolveSettingsDeepLink('', '#settings-jobs')).toEqual({ tabId: 'settings-jobs', anchorId: null })
  })

  it('?tab= wins over a tab-shaped hash, but a section anchor still scrolls', () => {
    expect(resolveSettingsDeepLink('?tab=settings-data', '#settings-jobs')).toEqual({
      tabId: 'settings-data',
      anchorId: null,
    })
    expect(resolveSettingsDeepLink('?tab=settings-account', '#settings-time-off')).toEqual({
      tabId: 'settings-account',
      anchorId: 'settings-time-off',
    })
  })

  it('ignores non-settings values and empty inputs', () => {
    expect(resolveSettingsDeepLink('?tab=bogus', '')).toEqual({ tabId: null, anchorId: null })
    expect(resolveSettingsDeepLink('', '#other-anchor')).toEqual({ tabId: null, anchorId: null })
    expect(resolveSettingsDeepLink('', '')).toEqual({ tabId: null, anchorId: null })
  })

  it('ignores unrelated query params', () => {
    expect(resolveSettingsDeepLink('?foo=1&tab=settings-templates', '')).toEqual({
      tabId: 'settings-templates',
      anchorId: null,
    })
  })
})
