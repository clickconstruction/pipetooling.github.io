// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getBillingStripeModePref,
  setBillingStripeModePref,
  stripeDashboardInvoiceUrl,
  stripeModeInvokeBody,
} from './billingStripeModePref'
import { stripeModeForBillingFromRole } from './voidStripeInvoiceForRevert'

const LS_KEY = 'pipetooling-billing-stripe-mode-pref'

describe('billingStripeModePref (A5)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to live when unset', () => {
    expect(getBillingStripeModePref()).toBe('live')
  })

  it('round-trips test and live', () => {
    setBillingStripeModePref('test')
    expect(getBillingStripeModePref()).toBe('test')
    setBillingStripeModePref('live')
    expect(getBillingStripeModePref()).toBe('live')
  })

  it('migrates legacy/unknown stored values to live', () => {
    localStorage.setItem(LS_KEY, 'auto')
    expect(getBillingStripeModePref()).toBe('live')
    expect(localStorage.getItem(LS_KEY)).toBe('live')
    localStorage.setItem(LS_KEY, 'garbage')
    expect(getBillingStripeModePref()).toBe('live')
  })

  it('stripeModeInvokeBody wraps the pref', () => {
    expect(stripeModeInvokeBody('test')).toEqual({ stripe_mode: 'test' })
    expect(stripeModeInvokeBody('live')).toEqual({ stripe_mode: 'live' })
  })

  it('dashboard URL uses the test path only in test mode', () => {
    expect(stripeDashboardInvoiceUrl('in_123', 'test')).toContain('/test/invoices/in_123')
    expect(stripeDashboardInvoiceUrl('in_123', 'live')).toBe('https://dashboard.stripe.com/invoices/in_123')
  })
})

describe('stripeModeForBillingFromRole (the dev gate)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('only dev reads the pref; every other role is pinned live', () => {
    setBillingStripeModePref('test')
    expect(stripeModeForBillingFromRole('dev')).toBe('test')
    for (const role of ['master_technician', 'assistant', 'controller', 'subcontractor', 'helpers', 'estimator', 'primary', 'superintendent', null, undefined]) {
      expect(stripeModeForBillingFromRole(role as never)).toBe('live')
    }
  })
})
