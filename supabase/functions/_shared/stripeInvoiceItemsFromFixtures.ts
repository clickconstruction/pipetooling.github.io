import {
  resolveInvoiceLineDescription,
  STRIPE_INVOICE_LINE_DESCRIPTION_MAX,
} from './stripeLineDescription.ts'

export type JobFixtureForStripe = {
  name: string
  count: number
  line_unit_price: number | null
  line_description: string | null
  sequence_order: number
}

export type StripeInvoiceLineItem = { amount: number; description: string }

function clampLineDescription(text: string): string {
  const t = text.trim()
  if (t.length <= STRIPE_INVOICE_LINE_DESCRIPTION_MAX) return t
  return t.slice(0, STRIPE_INVOICE_LINE_DESCRIPTION_MAX)
}

function fixtureStripeDescription(row: JobFixtureForStripe): string {
  const name = (row.name ?? '').trim()
  const scope = (row.line_description ?? '').trim()
  let s = name
  if (scope) s = `${name} — ${scope}`
  if (!s.trim()) s = 'Line item'
  return clampLineDescription(s)
}

function lineExtendedCents(row: JobFixtureForStripe): number {
  const c = Number(row.count)
  const qty = Number.isFinite(c) && c > 0 ? c : 1
  const unit = row.line_unit_price != null && Number.isFinite(Number(row.line_unit_price)) ? Number(row.line_unit_price) : 0
  const dollars = qty * unit
  if (!Number.isFinite(dollars) || dollars <= 0) return 0
  return Math.max(1, Math.round(dollars * 100))
}

/** Largest-remainder allocation of `target` cents across positive raw buckets. */
function allocateProportionalCents(rawCents: number[], target: number): number[] {
  const n = rawCents.length
  const S = rawCents.reduce((a, b) => a + b, 0)
  if (n === 0 || S <= 0) return rawCents.map(() => 0)
  if (target === S) return [...rawCents]

  const exact = rawCents.map((c) => (target * c) / S)
  const floors = exact.map((e) => Math.floor(e))
  let sumFloors = floors.reduce((a, b) => a + b, 0)
  let rem = target - sumFloors
  const frac = exact.map((e, i) => ({ i, f: e - Math.floor(e) }))
  frac.sort((a, b) => (b.f !== a.f ? b.f - a.f : a.i - b.i))
  const out = [...floors]
  for (let k = 0; k < rem && k < n; k++) {
    out[frac[k].i]++
  }
  return out
}

export function buildStripeInvoiceItemsFromFixtures(params: {
  fixtures: JobFixtureForStripe[]
  targetAmountCents: number
  lineDescriptionOverride?: string | null
  customerName: string
  jobName: string | null
  hcpNumber: string | null
}): { ok: true; items: StripeInvoiceLineItem[] } | { ok: false; error: string } {
  const {
    fixtures,
    targetAmountCents,
    lineDescriptionOverride,
    customerName,
    jobName,
    hcpNumber,
  } = params

  if (!Number.isFinite(targetAmountCents) || targetAmountCents < 1) {
    return { ok: false, error: 'Amount too small' }
  }

  const singleLine = resolveInvoiceLineDescription({
    override: lineDescriptionOverride,
    customerName,
    jobName,
    hcpNumber,
  })
  if (!singleLine.ok) {
    return { ok: false, error: singleLine.error }
  }

  const overrideTrim =
    typeof lineDescriptionOverride === 'string' ? lineDescriptionOverride.trim() : ''
  if (overrideTrim.length > 0) {
    return {
      ok: true,
      items: [{ amount: targetAmountCents, description: singleLine.lineDesc }],
    }
  }

  const sorted = [...fixtures].sort((a, b) => {
    const ao = Number(a.sequence_order) || 0
    const bo = Number(b.sequence_order) || 0
    return ao - bo
  })

  const billable = sorted.filter((row) => {
    if (!(row.name ?? '').trim()) return false
    return lineExtendedCents(row) > 0
  })

  if (billable.length === 0) {
    return {
      ok: true,
      items: [{ amount: targetAmountCents, description: singleLine.lineDesc }],
    }
  }

  const rawCents = billable.map((row) => lineExtendedCents(row))
  const sumRaw = rawCents.reduce((a, b) => a + b, 0)
  if (sumRaw <= 0) {
    return {
      ok: true,
      items: [{ amount: targetAmountCents, description: singleLine.lineDesc }],
    }
  }

  const allocated =
    targetAmountCents === sumRaw ? rawCents : allocateProportionalCents(rawCents, targetAmountCents)

  const items: StripeInvoiceLineItem[] = []
  for (let i = 0; i < billable.length; i++) {
    const amt = allocated[i] ?? 0
    if (amt <= 0) continue
    items.push({
      amount: amt,
      description: fixtureStripeDescription(billable[i]),
    })
  }

  let sumItems = items.reduce((s, it) => s + it.amount, 0)
  const drift = targetAmountCents - sumItems
  if (drift !== 0 && items.length > 0) {
    items[items.length - 1].amount += drift
    sumItems = items.reduce((s, it) => s + it.amount, 0)
  }

  if (items.length === 0 || sumItems !== targetAmountCents) {
    return {
      ok: true,
      items: [{ amount: targetAmountCents, description: singleLine.lineDesc }],
    }
  }

  return { ok: true, items }
}
