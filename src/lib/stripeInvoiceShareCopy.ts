export type StripeInvoiceShareCopyInput = {
  customerName: string | null
  payUrl: string
  amountLabel: string
  jobName: string | null
  hcpNumber: string | null
}

export function buildStripeInvoiceEmailSubject(jobName: string | null): string {
  const j = (jobName ?? '').trim() || 'Your invoice'
  return `Invoice — ${j}`
}

export function buildStripeInvoiceEmailBody(p: StripeInvoiceShareCopyInput): string {
  const name = (p.customerName ?? '').trim() || 'there'
  const url = p.payUrl.trim()
  const job = (p.jobName ?? '').trim() || '—'
  const hcp = (p.hcpNumber ?? '').trim() || '—'
  return `Hi ${name},

Please view and pay your invoice here:
${url}

Amount: ${p.amountLabel}
Job: ${job} (HCP ${hcp})

Thank you!`
}

export function buildStripeInvoiceSmsText(p: StripeInvoiceShareCopyInput): string {
  const url = p.payUrl.trim()
  const job = (p.jobName ?? '').trim() || 'your job'
  return `Your invoice for ${job} (${p.amountLabel}): ${url}`
}
