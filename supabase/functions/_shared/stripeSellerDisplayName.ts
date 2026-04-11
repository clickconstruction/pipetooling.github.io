import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno'

/** Hosted invoice / PDF “From” uses customer-facing branding; `account_name` is often the legal entity. */
export async function stripeSellerDisplayName(stripe: Stripe, inv: Stripe.Invoice): Promise<string | null> {
  const fromInvoice =
    typeof inv.account_name === 'string' && inv.account_name.trim() ? inv.account_name.trim() : null

  const issuer = inv.issuer
  let connectAccountId: string | undefined
  if (
    issuer &&
    typeof issuer === 'object' &&
    issuer.type === 'account' &&
    typeof issuer.account === 'string' &&
    issuer.account.trim()
  ) {
    connectAccountId = issuer.account.trim()
  }

  try {
    const acct = connectAccountId
      ? await stripe.accounts.retrieve(connectAccountId)
      : await stripe.accounts.retrieve()
    const bp = acct.business_profile?.name
    if (typeof bp === 'string' && bp.trim()) {
      return bp.trim()
    }
  } catch (e) {
    console.warn('stripeSellerDisplayName: accounts.retrieve', e)
  }

  return fromInvoice
}
