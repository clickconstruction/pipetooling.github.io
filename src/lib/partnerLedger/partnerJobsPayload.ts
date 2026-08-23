/**
 * Shapes for the partner's §5 jobs window (get_my_partner_jobs /
 * get_my_partner_job_costing and their dev `_as` twins) — shared by the
 * Dashboard "Your jobs" card and the partner statement page so both read the
 * payload the same way. Pure parsers; fail-soft (null on a non-payload).
 */

export type PartnerJobRow = {
  job_id: string
  label: string
  job_name: string | null
  status: string | null
  confirmed_at: string | null
  /** null until the partner_jobs_payload migration adds it — pill fail-softs */
  service_type_name: string | null
  profit_share: number | null
}

export type PartnerJobsPayload = { rows: PartnerJobRow[]; costingOn: boolean }

export type PartnerJobCosting = {
  label: string
  revenue: number | null
  as_of: string
  hours: { name: string; hours: number }[]
  supply_invoices: { vendor: string | null; invoice_number: string | null; invoice_date: string | null; invoice_amount: number; pct: number; allocated: number }[]
  card_charges: { counterparty: string | null; posted_at: string | null; allocated: number }[]
  direct: { description: string; amount: number }[]
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const numOrNull = (v: unknown): number | null => (v != null && Number.isFinite(Number(v)) ? Number(v) : null)

/** `{ exists: true, costing_on, rows: [...] }` → rows; anything else → null. */
export function parsePartnerJobsPayload(data: unknown): PartnerJobsPayload | null {
  if (!data || typeof data !== 'object' || (data as Record<string, unknown>).exists !== true) return null
  const d = data as Record<string, unknown>
  const rows: PartnerJobRow[] = Array.isArray(d.rows)
    ? (d.rows as Record<string, unknown>[])
        .filter((r) => typeof r.job_id === 'string')
        .map((r) => ({
          job_id: String(r.job_id),
          label: String(r.label ?? ''),
          job_name: str(r.job_name),
          status: str(r.status),
          confirmed_at: str(r.confirmed_at),
          service_type_name: str(r.service_type_name),
          profit_share: numOrNull(r.profit_share),
        }))
    : []
  return { rows, costingOn: d.costing_on === true }
}

export function parsePartnerJobCosting(data: unknown): PartnerJobCosting {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  return {
    label: String(d.label ?? ''),
    revenue: numOrNull(d.revenue),
    as_of: String(d.as_of ?? ''),
    hours: Array.isArray(d.hours) ? (d.hours as Record<string, unknown>[]).map((h) => ({ name: String(h.name ?? ''), hours: Number(h.hours) || 0 })) : [],
    supply_invoices: Array.isArray(d.supply_invoices)
      ? (d.supply_invoices as Record<string, unknown>[]).map((i) => ({
          vendor: str(i.vendor),
          invoice_number: str(i.invoice_number),
          invoice_date: str(i.invoice_date),
          invoice_amount: Number(i.invoice_amount) || 0,
          pct: Number(i.pct) || 0,
          allocated: Number(i.allocated) || 0,
        }))
      : [],
    card_charges: Array.isArray(d.card_charges)
      ? (d.card_charges as Record<string, unknown>[]).map((c) => ({
          counterparty: str(c.counterparty),
          posted_at: str(c.posted_at),
          allocated: Number(c.allocated) || 0,
        }))
      : [],
    direct: Array.isArray(d.direct) ? (d.direct as Record<string, unknown>[]).map((m) => ({ description: String(m.description ?? ''), amount: Number(m.amount) || 0 })) : [],
  }
}
