import { describe, expect, it } from 'vitest'
import { resolveSettingsDeepLink } from './settingsDeepLink'

describe('resolveSettingsDeepLink', () => {
  it('resolves ?tab= to a tab with no anchor', () => {
    expect(resolveSettingsDeepLink('?tab=settings-data', '')).toEqual({ tabId: 'settings-data', anchorId: null })
    expect(resolveSettingsDeepLink('tab=settings-people', '')).toEqual({ tabId: 'settings-people', anchorId: null })
  })

  it('lands the collections law firm block on Jobs, bills and liens, from the Legal desk’s firm window', () => {
    expect(resolveSettingsDeepLink('?tab=settings-jobs', '#settings-legal-firm')).toEqual({ tabId: 'settings-jobs', anchorId: 'settings-legal-firm' })
    expect(resolveSettingsDeepLink('', '#settings-legal-firm')).toEqual({ tabId: 'settings-jobs', anchorId: 'settings-legal-firm' })
  })

  it('lands the switch card’s doors on their Phone and texts cards', () => {
    expect(resolveSettingsDeepLink('?tab=settings-phone-texts', '#settings-phone-texts-hours')).toEqual({ tabId: 'settings-phone-texts', anchorId: 'settings-phone-texts-hours' })
    expect(resolveSettingsDeepLink('', '#settings-phone-texts-reminders')).toEqual({ tabId: 'settings-phone-texts', anchorId: 'settings-phone-texts-reminders' })
  })

  it('lands every Jobs, bills and liens card and heading on the tab, and a child anchor opens its card (punch list #261)', () => {
    expect(resolveSettingsDeepLink('?tab=settings-jobs', '#settings-jobs-rates')).toEqual({ tabId: 'settings-jobs', anchorId: 'settings-jobs-rates' })
    expect(resolveSettingsDeepLink('', '#settings-jobs-stage-checklists')).toEqual({ tabId: 'settings-jobs', anchorId: 'settings-jobs-stage-checklists' })
    expect(resolveSettingsDeepLink('', '#settings-jobs-group-liens')).toEqual({ tabId: 'settings-jobs', anchorId: 'settings-jobs-group-liens' })
    expect(resolveSettingsDeepLink('?tab=settings-jobs', '#who-counts-as-what')).toEqual({ tabId: 'settings-jobs', anchorId: 'who-counts-as-what' })
    expect(resolveSettingsDeepLink('', '#who-counts-as-what')).toEqual({ tabId: 'settings-jobs', anchorId: 'who-counts-as-what' })
  })

  it('a card that left Jobs, bills and liens (punch list #261 PR 2) answers on its new tab by its new anchor and its old one', () => {
    expect(resolveSettingsDeepLink('', '#settings-data-hcp-reconcile')).toEqual({ tabId: 'settings-data', anchorId: 'settings-data-hcp-reconcile' })
    expect(resolveSettingsDeepLink('', '#settings-jobs-hcp-reconcile')).toEqual({ tabId: 'settings-data', anchorId: 'settings-data-hcp-reconcile' })
    // The dev door and the guides carried `?tab=settings-jobs` before the move: the card's tab wins.
    expect(resolveSettingsDeepLink('?tab=settings-jobs', '#settings-jobs-hcp-reconcile')).toEqual({ tabId: 'settings-data', anchorId: 'settings-data-hcp-reconcile' })
    expect(resolveSettingsDeepLink('', '#settings-jobs-sub-pay')).toEqual({ tabId: 'settings-people', anchorId: 'settings-people-sub-pay' })
    expect(resolveSettingsDeepLink('', '#settings-jobs-office-county')).toEqual({ tabId: 'settings-company', anchorId: 'settings-company-office-county' })
  })

  it('lands the Dev MCP keys anchor on Your account', () => {
    expect(resolveSettingsDeepLink('', '#settings-dev-mcp-keys')).toEqual({ tabId: 'settings-account', anchorId: 'settings-dev-mcp-keys' })
  })

  it('lands the My email in Messages card on Your account, with the tab or by its anchor alone (punch list #230)', () => {
    expect(resolveSettingsDeepLink('?tab=settings-account', '#settings-my-mail')).toEqual({ tabId: 'settings-account', anchorId: 'settings-my-mail' })
    expect(resolveSettingsDeepLink('', '#settings-my-mail')).toEqual({ tabId: 'settings-account', anchorId: 'settings-my-mail' })
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
    // A paper's card on Contracts and clauses (Messages, cut 4c): the approvers' Needs you opens it.
    expect(resolveSettingsDeepLink('?tab=settings-clauses', '#settings-clause-paper-00000000-0000-0000-0000-00000000c1c1')).toEqual({ tabId: 'settings-clauses', anchorId: 'settings-clause-paper-00000000-0000-0000-0000-00000000c1c1' })
    expect(resolveSettingsDeepLink('', '#settings-clause-paper-00000000-0000-0000-0000-00000000c1c1')).toEqual({ tabId: 'settings-clauses', anchorId: 'settings-clause-paper-00000000-0000-0000-0000-00000000c1c1' })
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
