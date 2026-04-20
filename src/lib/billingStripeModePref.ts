const LS_KEY = 'pipetooling-billing-stripe-mode-pref'

export type BillingStripeModePref = 'test' | 'live'

export function getBillingStripeModePref(): BillingStripeModePref {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === 'test' || v === 'live') return v
    // Migrate removed `auto`, unknown values, etc. to current app default (live).
    if (v === 'auto' || v != null) {
      localStorage.setItem(LS_KEY, 'live')
    }
  } catch {
    /* private mode */
  }
  return 'live'
}

export function setBillingStripeModePref(p: BillingStripeModePref): void {
  try {
    localStorage.setItem(LS_KEY, p)
  } catch {
    /* ignore */
  }
}

export function stripeModeInvokeBody(pref: BillingStripeModePref): { stripe_mode: BillingStripeModePref } {
  return { stripe_mode: pref }
}

/** Stripe Dashboard deep link for an invoice (test vs live path). */
export function stripeDashboardInvoiceUrl(invoiceId: string, mode: BillingStripeModePref): string {
  const id = encodeURIComponent(invoiceId.trim())
  return mode === 'test'
    ? `https://dashboard.stripe.com/test/invoices/${id}`
    : `https://dashboard.stripe.com/invoices/${id}`
}
