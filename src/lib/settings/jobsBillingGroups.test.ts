import { describe, expect, it } from 'vitest'
import {
  JOBS_BILLING_CARDS,
  JOBS_BILLING_CHILD_ANCHORS,
  JOBS_BILLING_GROUPS,
  jobsBillingActiveGroup,
  jobsBillingAnchorToTab,
  jobsBillingCardBySlug,
  jobsBillingCardIsTarget,
  jobsBillingGroupsFor,
} from './jobsBillingGroups'

describe('jobsBillingGroups (punch list #261)', () => {
  it('holds 27 cards under six headings, every slug and anchor once', () => {
    expect(JOBS_BILLING_GROUPS.map((g) => g.id)).toEqual(['money', 'record', 'bill', 'liens', 'notices', 'repairs'])
    expect(JOBS_BILLING_CARDS).toHaveLength(27)
    expect(new Set(JOBS_BILLING_CARDS.map((c) => c.slug)).size).toBe(27)
    expect(new Set(JOBS_BILLING_CARDS.map((c) => c.anchor)).size).toBe(27)
    for (const c of JOBS_BILLING_CARDS) {
      expect(c.anchor.startsWith('settings-')).toBe(true)
      expect(c.title.trim()).toBe(c.title)
      expect(c.line.trim()).toBe(c.line)
    }
  })

  it('keeps the law firms on the anchor the Legal desk has linked since v2.4711', () => {
    expect(jobsBillingCardBySlug('legal-firm').anchor).toBe('settings-legal-firm')
  })

  it('the three cards the owner moved (call 2) are off the tab, and no card carries a fold flag any more (call 1: every card folds)', () => {
    const slugs = JOBS_BILLING_CARDS.map((c) => c.slug as string)
    expect(slugs).not.toContain('hcp-reconcile')
    expect(slugs).not.toContain('sub-pay')
    expect(slugs).not.toContain('office-county')
    for (const c of JOBS_BILLING_CARDS) expect('fold' in c).toBe(false)
  })

  it('a dev sees every heading, a master four, the office two, the controller the cut-off too, a tech nothing', () => {
    expect(jobsBillingGroupsFor('dev').map((g) => g.cards.length)).toEqual([8, 7, 4, 4, 2, 2])
    const master = jobsBillingGroupsFor('master_technician')
    expect(master.map((g) => g.id)).toEqual(['money', 'record', 'liens', 'notices'])
    expect(master.flatMap((g) => g.cards.map((c) => c.slug))).toEqual(['job-book', 'gc-card', 'gc-cutoff', 'line-budgets', 'stage-checklists', 'machine-templates', 'photos', 'test-reports', 'owner-of-record', 'gc-office-notices', 'gc-customer-notice'])
    const office = jobsBillingGroupsFor('assistant')
    expect(office.map((g) => g.id)).toEqual(['money', 'record'])
    expect(office.flatMap((g) => g.cards.map((c) => c.slug))).toEqual(['job-book', 'stage-checklists', 'machine-templates', 'photos', 'test-reports'])
    expect(jobsBillingGroupsFor('controller').flatMap((g) => g.cards.map((c) => c.slug))).toContain('gc-cutoff')
    expect(jobsBillingGroupsFor('helpers')).toEqual([])
    expect(jobsBillingGroupsFor(null)).toEqual([])
  })

  it('maps every card and heading anchor to the tab for the deep links', () => {
    const map = jobsBillingAnchorToTab()
    expect(Object.keys(map)).toHaveLength(27 + 6)
    expect(map['settings-jobs-rates']).toBe('settings-jobs')
    expect(map['settings-legal-firm']).toBe('settings-jobs')
    expect(map['settings-jobs-group-money']).toBe('settings-jobs')
  })

  it('a card is the target by its own anchor or a child anchor inside it', () => {
    const rates = jobsBillingCardBySlug('rates')
    expect(jobsBillingCardIsTarget(rates, 'settings-jobs-rates')).toBe(true)
    expect(jobsBillingCardIsTarget(rates, 'who-counts-as-what')).toBe(true)
    expect(jobsBillingCardIsTarget(rates, 'settings-jobs-markup')).toBe(false)
    expect(jobsBillingCardIsTarget(rates, '')).toBe(false)
    for (const child of Object.values(JOBS_BILLING_CHILD_ANCHORS)) expect(JOBS_BILLING_CARDS.some((c) => c.anchor === child)).toBe(true)
  })

  it('lights the last heading whose top is above the line', () => {
    const tops = [
      { id: 'money' as const, top: -400 },
      { id: 'record' as const, top: 20 },
      { id: 'bill' as const, top: 900 },
    ]
    expect(jobsBillingActiveGroup(tops, 60)).toBe('record')
    expect(jobsBillingActiveGroup(tops, 0)).toBe('money')
    expect(jobsBillingActiveGroup([{ id: 'money', top: 300 }], 60)).toBeNull()
    expect(jobsBillingActiveGroup([{ id: 'money', top: null }], 60)).toBeNull()
  })
})
