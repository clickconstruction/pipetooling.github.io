/** Keep in sync with `src/lib/stripeInvoiceLineDescription.ts` (app preview copy). */
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
