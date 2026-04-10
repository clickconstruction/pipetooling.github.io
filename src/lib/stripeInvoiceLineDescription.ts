/** Keep in sync with `supabase/functions/_shared/stripeLineDescription.ts` (Edge). */
export function buildStripeInvoiceLineDescription(
  customerName: string,
  jobName: string | null,
  hcpNumber: string | null,
): string {
  const name = customerName.trim() || 'Customer'
  const job = (jobName ?? '').trim() || 'Job'
  const hcp = (hcpNumber ?? '').trim() || '—'
  if (name === job) {
    return `${name} · HCP ${hcp}`
  }
  return `${name} · ${job} · HCP ${hcp}`
}
