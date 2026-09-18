import { describe, expect, it } from 'vitest'
import {
  decideLinkRefresh,
  emptyTally,
  groupRowsByStripeMode,
  linkMayBeStale,
  STRIPE_LINK_STALE_AFTER_DAYS,
  statusDrifted,
  stripeModeOfRow,
  summarizeLinkRefresh,
} from '../../../supabase/functions/_shared/stripeInvoiceLinkRefresh'

describe('stripeInvoiceLinkRefresh (v2.3589)', () => {
  it('reads NULL and unknown modes as live, test as test', () => {
    expect(stripeModeOfRow({ stripe_mode: null })).toBe('live')
    expect(stripeModeOfRow({ stripe_mode: 'live' })).toBe('live')
    expect(stripeModeOfRow({ stripe_mode: 'weird' })).toBe('live')
    expect(stripeModeOfRow({ stripe_mode: 'test' })).toBe('test')
  })

  it('groups rows by mode, legacy NULL rows with live', () => {
    const g = groupRowsByStripeMode([{ stripe_mode: null, id: 'a' }, { stripe_mode: 'test', id: 'b' }, { stripe_mode: 'live', id: 'c' }])
    expect(g.live.map((r) => r.id)).toEqual(['a', 'c'])
    expect(g.test.map((r) => r.id)).toEqual(['b'])
  })

  it('renews only when Stripe hands back a different, non-empty link', () => {
    expect(decideLinkRefresh({ hosted_invoice_url: 'https://a/1' }, { hosted_invoice_url: 'https://a/2', status: 'open' })).toEqual({ kind: 'renewed', url: 'https://a/2' })
    expect(decideLinkRefresh({ hosted_invoice_url: 'https://a/1' }, { hosted_invoice_url: 'https://a/1', status: 'open' })).toEqual({ kind: 'unchanged' })
    expect(decideLinkRefresh({ hosted_invoice_url: ' https://a/1 ' }, { hosted_invoice_url: 'https://a/1', status: 'open' })).toEqual({ kind: 'unchanged' })
    expect(decideLinkRefresh({ hosted_invoice_url: null }, { hosted_invoice_url: 'https://a/1', status: 'open' })).toEqual({ kind: 'renewed', url: 'https://a/1' })
    expect(decideLinkRefresh({ hosted_invoice_url: 'https://a/1' }, { hosted_invoice_url: '', status: 'open' })).toEqual({ kind: 'no_link' })
    expect(decideLinkRefresh({ hosted_invoice_url: 'https://a/1' }, { hosted_invoice_url: null, status: null })).toEqual({ kind: 'no_link' })
  })

  it('counts a status Stripe carries that the row does not, and never a blank', () => {
    expect(statusDrifted({ stripe_invoice_status: 'open' }, { hosted_invoice_url: null, status: 'paid' })).toBe(true)
    expect(statusDrifted({ stripe_invoice_status: 'open' }, { hosted_invoice_url: null, status: 'open' })).toBe(false)
    expect(statusDrifted({ stripe_invoice_status: null }, { hosted_invoice_url: null, status: 'open' })).toBe(true)
    expect(statusDrifted({ stripe_invoice_status: 'open' }, { hosted_invoice_url: null, status: '' })).toBe(false)
  })

  it('calls a link stale past the margin, and always when the billed date is unknown (v2.3590)', () => {
    const now = Date.parse('2026-09-18T12:00:00Z')
    const day = 86400 * 1000
    expect(STRIPE_LINK_STALE_AFTER_DAYS).toBe(25)
    expect(linkMayBeStale(new Date(now - 3 * day).toISOString(), now)).toBe(false)
    expect(linkMayBeStale(new Date(now - 24 * day).toISOString(), now)).toBe(false)
    expect(linkMayBeStale(new Date(now - 25 * day).toISOString(), now)).toBe(true)
    expect(linkMayBeStale(new Date(now - 90 * day).toISOString(), now)).toBe(true)
    expect(linkMayBeStale(null, now)).toBe(true)
    expect(linkMayBeStale('not a date', now)).toBe(true)
    expect(linkMayBeStale(new Date(now - 10 * day).toISOString(), now, 7)).toBe(true)
  })

  it('writes the one summary line', () => {
    const t = { ...emptyTally(), open: 62, live: 60, test: 2, renewed: 9, unchanged: 51, noLink: 0, failed: 2, statusDrift: 3 }
    expect(summarizeLinkRefresh(t, false)).toBe(
      'refresh-stripe-invoice-links: 62 open Stripe bill(s) (60 live · 2 test) · 9 link(s) renewed · 51 unchanged · 0 with no link from Stripe · 2 failed · 3 with a Stripe status the row does not carry · 0 skipped (no key for their mode)',
    )
    expect(summarizeLinkRefresh(emptyTally(), true).startsWith('refresh-stripe-invoice-links (dry run): 0 open')).toBe(true)
  })
})
