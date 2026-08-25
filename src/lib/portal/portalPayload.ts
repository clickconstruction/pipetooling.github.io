/**
 * Customer portal payload parsing (portal train PR 1). The /portal page
 * receives this from the customer-portal edge function; the parser is
 * defensive because the page renders for customers with no login and no
 * second chance — a malformed field degrades to a safe blank, never a crash.
 */

export type PortalCompany = {
  name: string
  cityLine: string
  licenseLine: string
  phone: string
  email: string
}

export type PortalBill = {
  jobLabel: string
  jobNumber: string
  /** Bare job name — the line-one fallback when a job has no address. */
  jobName: string | null
  /** 'plum' | 'elec' | 'hvac' (the board's trade tags); null = no tag rendered. */
  serviceTag: PortalTradeTag | null
  jobAddress: string | null
  amount: number
  billedOn: string | null
  payUrl: string | null
  checkRef: string
  /** Merged 'all' view: this row is on someone else's property (they're the GC). */
  asGc: boolean
  /** Owner's name for the AS GC tag, when known. */
  ownerName: string | null
  /** Payments already applied to this bill, oldest first (v2.2313). */
  payments: Array<{ date: string | null; method: string; amount: number }>
  /** Sum of payments (dollars); may exceed the rows when only the aggregate is known. */
  totalPaid: number
}

export type PortalPayload = {
  company: PortalCompany
  customerName: string
  audience: 'customer' | 'gc' | 'all'
  bills: PortalBill[]
  totalDue: number
  requestableJobs: Array<{ id: string; label: string }>
  /** Visit-picker rows (v2.2037): one per address, street + city only. */
  requestableProperties: Array<{ jobId: string; street: string; city: string | null }>
  /** Token for form submits when the page was opened by slug (same capability). */
  requestToken: string | null
  /** The company's short portal address (merged view only) — powers the footer QR. */
  slug: string | null
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

export function parsePortalPayload(raw: unknown): PortalPayload | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.customerName !== 'string') return null
  const companyRaw = (r.company ?? {}) as Record<string, unknown>
  const bills: PortalBill[] = []
  if (Array.isArray(r.bills)) {
    for (const b of r.bills as Array<Record<string, unknown>>) {
      if (b == null || typeof b !== 'object') continue
      const amount = num(b.amount)
      if (amount <= 0) continue
      bills.push({
        jobLabel: str(b.jobLabel, 'Job'),
        jobNumber: str(b.jobNumber),
        jobName: typeof b.jobName === 'string' && b.jobName.trim() ? b.jobName : null,
        serviceTag: b.serviceTag === 'plum' || b.serviceTag === 'elec' || b.serviceTag === 'hvac' ? b.serviceTag : null,
        jobAddress: typeof b.jobAddress === 'string' && b.jobAddress.trim() ? b.jobAddress : null,
        amount,
        billedOn: typeof b.billedOn === 'string' && /^\d{4}-\d{2}-\d{2}/.test(b.billedOn) ? b.billedOn.slice(0, 10) : null,
        payUrl: typeof b.payUrl === 'string' && /^https:\/\//.test(b.payUrl) ? b.payUrl : null,
        checkRef: str(b.checkRef),
        asGc: b.asGc === true,
        ownerName: typeof b.ownerName === 'string' && b.ownerName.trim() ? b.ownerName : null,
        payments: Array.isArray(b.payments)
          ? (b.payments as Array<Record<string, unknown>>)
              .filter((p) => p != null && typeof p === 'object' && num(p.amount) > 0)
              .map((p) => ({
                date: typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(p.date) ? p.date.slice(0, 10) : null,
                method: str(p.method, 'Payment'),
                amount: num(p.amount),
              }))
          : [],
        totalPaid: num(b.totalPaid),
      })
    }
  }
  const requestableJobs: PortalPayload['requestableJobs'] = []
  if (Array.isArray(r.requestableJobs)) {
    for (const j of r.requestableJobs as Array<Record<string, unknown>>) {
      if (j == null || typeof j.id !== 'string' || typeof j.label !== 'string') continue
      requestableJobs.push({ id: j.id, label: j.label })
    }
  }
  const requestableProperties: PortalPayload['requestableProperties'] = []
  if (Array.isArray(r.requestableProperties)) {
    for (const p of r.requestableProperties as Array<Record<string, unknown>>) {
      if (p == null || typeof p.jobId !== 'string' || typeof p.street !== 'string' || !p.street.trim()) continue
      requestableProperties.push({
        jobId: p.jobId,
        street: p.street.trim(),
        city: typeof p.city === 'string' && p.city.trim() ? p.city.trim() : null,
      })
    }
  }
  return {
    company: {
      name: str(companyRaw.name, 'Click Plumbing and Electrical'),
      cityLine: str(companyRaw.cityLine),
      licenseLine: str(companyRaw.licenseLine),
      phone: str(companyRaw.phone),
      email: str(companyRaw.email),
    },
    customerName: r.customerName,
    audience: r.audience === 'gc' ? 'gc' : r.audience === 'all' ? 'all' : 'customer',
    bills,
    totalDue: num(r.totalDue) || Math.round(bills.reduce((s, b) => s + b.amount, 0) * 100) / 100,
    requestableJobs,
    requestableProperties,
    requestToken: typeof r.requestToken === 'string' && r.requestToken.trim() ? r.requestToken : null,
    slug: typeof r.slug === 'string' && r.slug.trim() ? r.slug.trim() : null,
  }
}

/** "Aug 4, 2026" from a YYYY-MM-DD string, TZ-safe (no Date parsing of bare dates). */
export function formatPortalDate(ymd: string | null): string | null {
  if (!ymd) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return null
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}, ${m[1]}`
}

/**
 * Age sub-line for the statement's Billed column (v2.2038): "today" /
 * "yesterday" / "N days ago". `aging` flips at 30 days — the page warms the
 * line to copper, a quiet nudge on a customer-facing document. Null when the
 * bill has no date (or a malformed/future one) — no line renders.
 */
export function portalDaysSinceBilled(
  billedYmd: string | null,
  todayYmd: string,
): { label: string; aging: boolean } | null {
  if (!billedYmd) return null
  const parse = (ymd: string): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
    if (!m) return null
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  const from = parse(billedYmd)
  const to = parse(todayYmd)
  if (from == null || to == null) return null
  const days = Math.round((to - from) / 86_400_000)
  if (days < 0) return null
  if (days === 0) return { label: 'today', aging: false }
  if (days === 1) return { label: 'yesterday', aging: false }
  return { label: `${days} days ago`, aging: days >= 30 }
}

export type PortalTradeTag = 'plum' | 'elec' | 'hvac'

/**
 * The company's trade colors (source of truth: BID_SERVICE_TYPE_TAGS in
 * src/utils/unifiedJobBidSearch.ts — duplicated here so the customer-facing
 * portal bundle stays lean). Colored TEXT on the statement, never a pill.
 */
export const PORTAL_TRADE_COLORS: Record<PortalTradeTag, string> = {
  plum: '#e17235',
  elec: '#EE9310',
  hvac: '#06b6d4',
}

/**
 * Statement line split (v2.2041 trade-first job lines): street rides the
 * headline, city/state drop to the quiet line. Split at the FIRST comma —
 * "415 Springtown Way, San Marcos, TX 78666" → street + "San Marcos, TX
 * 78666"; a comma-less address stays whole with no second line.
 */
export function splitPortalAddress(address: string | null): { street: string; rest: string | null } | null {
  const a = (address ?? '').trim()
  if (!a) return null
  const i = a.indexOf(',')
  if (i < 0) return { street: a, rest: null }
  const street = a.slice(0, i).trim()
  const rest = a.slice(i + 1).trim()
  if (!street) return { street: a, rest: null }
  return { street, rest: rest || null }
}

/** "$1,700.00" — the portal always shows cents (it is a statement). */
export function formatPortalUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
