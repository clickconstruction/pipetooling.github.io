import { describe, expect, it } from 'vitest'
import { resolveSettingsDeepLink } from './settingsDeepLink'

describe('resolveSettingsDeepLink', () => {
  it('resolves ?tab= to a tab with no anchor', () => {
    expect(resolveSettingsDeepLink('?tab=settings-data', '')).toEqual({ tabId: 'settings-data', anchorId: null })
    expect(resolveSettingsDeepLink('tab=settings-people', '')).toEqual({ tabId: 'settings-people', anchorId: null })
  })

  it('lands the collections law firm block on Jobs & billing, from the Legal desk’s firm window', () => {
    expect(resolveSettingsDeepLink('?tab=settings-jobs', '#settings-legal-firm')).toEqual({ tabId: 'settings-jobs', anchorId: 'settings-legal-firm' })
    expect(resolveSettingsDeepLink('', '#settings-legal-firm')).toEqual({ tabId: 'settings-jobs', anchorId: 'settings-legal-firm' })
  })

  it('lands the Dev MCP keys anchor on Your account', () => {
    expect(resolveSettingsDeepLink('', '#settings-dev-mcp-keys')).toEqual({ tabId: 'settings-account', anchorId: 'settings-dev-mcp-keys' })
  })

  it('maps known section-anchor hashes to their owning tab + anchor', () => {
    expect(resolveSettingsDeepLink('', '#settings-time-off')).toEqual({
      tabId: 'settings-account',
      anchorId: 'settings-time-off',
    })
    expect(resolveSettingsDeepLink('', '#settings-recently-deleted')).toEqual({
      tabId: 'settings-data',
      anchorId: 'settings-recently-deleted',
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

  it('lands a Contracts & terms card, and the editors the tab opens', () => {
    expect(resolveSettingsDeepLink('', '#settings-contract-bid-terms')).toEqual({ tabId: 'settings-contracts', anchorId: 'settings-contract-bid-terms' })
    expect(resolveSettingsDeepLink('?tab=settings-contracts', '#settings-contract-job-standard-terms')).toEqual({ tabId: 'settings-contracts', anchorId: 'settings-contract-job-standard-terms' })
    // The tab's own id is still a tab, not a card.
    expect(resolveSettingsDeepLink('', '#settings-contracts')).toEqual({ tabId: 'settings-contracts', anchorId: null })
    expect(resolveSettingsDeepLink('', '#settings-estimate-public-terms')).toEqual({ tabId: 'settings-catalogs', anchorId: 'settings-estimate-public-terms' })
    expect(resolveSettingsDeepLink('', '#settings-bid-cover-letter-defaults')).toEqual({ tabId: 'settings-catalogs', anchorId: 'settings-bid-cover-letter-defaults' })
  })

  it('ignores unrelated query params', () => {
    expect(resolveSettingsDeepLink('?foo=1&tab=settings-templates', '')).toEqual({
      tabId: 'settings-templates',
      anchorId: null,
    })
  })
})
