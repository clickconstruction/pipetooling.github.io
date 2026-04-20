export type StripeInvoiceLineDetail = {
  description: string
  quantity: number | null
  amount: number
}

export type StripeInvoiceDetailsSuccess = {
  success: true
  currency: string
  total: number
  amount_due: number
  amount_remaining: number
  amount_paid: number
  paid_at: number | null
  due_date: number | null
  invoice_number: string | null
  customer_name: string | null
  customer_email: string | null
  seller_name: string | null
  memo: string | null
  footer: string | null
  lines: StripeInvoiceLineDetail[]
}

export function parseStripeInvoiceDetailsResponse(raw: unknown): StripeInvoiceDetailsSuccess | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.success !== true) return null
  const currency = o.currency
  if (typeof currency !== 'string' || !currency.trim()) return null
  const total = o.total
  const amount_due = o.amount_due
  if (typeof total !== 'number' || Number.isNaN(total)) return null
  if (typeof amount_due !== 'number' || Number.isNaN(amount_due)) return null
  const dueRaw = o.due_date
  const due_date: number | null =
    dueRaw === null || dueRaw === undefined
      ? null
      : typeof dueRaw === 'number' && Number.isFinite(dueRaw)
        ? dueRaw
        : null
  const str = (k: string): string | null => {
    const v = o[k]
    return typeof v === 'string' && v.trim() ? v.trim() : v === null ? null : null
  }
  const ap = o.amount_paid
  const amount_paid = typeof ap === 'number' && !Number.isNaN(ap) ? ap : 0

  const arRaw = o.amount_remaining
  const amount_remaining =
    typeof arRaw === 'number' && !Number.isNaN(arRaw)
      ? Math.max(0, arRaw)
      : Math.max(0, total - amount_paid)

  const paidAtRaw = o.paid_at
  const paid_at =
    paidAtRaw === null || paidAtRaw === undefined
      ? null
      : typeof paidAtRaw === 'number' && Number.isFinite(paidAtRaw) && paidAtRaw > 0
        ? paidAtRaw
        : null

  const linesRaw = o.lines
  const lines: StripeInvoiceLineDetail[] = []
  if (Array.isArray(linesRaw)) {
    for (const item of linesRaw) {
      if (item == null || typeof item !== 'object') return null
      const li = item as Record<string, unknown>
      const desc = typeof li.description === 'string' ? li.description : ''
      const amt = li.amount
      if (typeof amt !== 'number' || Number.isNaN(amt)) return null
      const q = li.quantity
      const quantity =
        q === null || q === undefined
          ? null
          : typeof q === 'number' && !Number.isNaN(q)
            ? q
            : null
      lines.push({ description: desc, quantity, amount: amt })
    }
  }

  return {
    success: true,
    currency: currency.trim(),
    total,
    amount_due,
    amount_remaining,
    amount_paid,
    paid_at,
    due_date,
    invoice_number: str('invoice_number'),
    customer_name: str('customer_name'),
    customer_email: str('customer_email'),
    seller_name: str('seller_name'),
    memo: str('memo'),
    footer: str('footer'),
    lines,
  }
}
