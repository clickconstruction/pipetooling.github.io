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
  jobAddress: string | null
  amount: number
  billedOn: string | null
  payUrl: string | null
  checkRef: string
}

export type PortalPayload = {
  company: PortalCompany
  customerName: string
  audience: 'customer' | 'gc'
  bills: PortalBill[]
  totalDue: number
  requestableJobs: Array<{ id: string; label: string }>
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
        jobAddress: typeof b.jobAddress === 'string' && b.jobAddress.trim() ? b.jobAddress : null,
        amount,
        billedOn: typeof b.billedOn === 'string' && /^\d{4}-\d{2}-\d{2}/.test(b.billedOn) ? b.billedOn.slice(0, 10) : null,
        payUrl: typeof b.payUrl === 'string' && /^https:\/\//.test(b.payUrl) ? b.payUrl : null,
        checkRef: str(b.checkRef),
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
  return {
    company: {
      name: str(companyRaw.name, 'Click Plumbing and Electrical'),
      cityLine: str(companyRaw.cityLine),
      licenseLine: str(companyRaw.licenseLine),
      phone: str(companyRaw.phone),
      email: str(companyRaw.email),
    },
    customerName: r.customerName,
    audience: r.audience === 'gc' ? 'gc' : 'customer',
    bills,
    totalDue: num(r.totalDue) || Math.round(bills.reduce((s, b) => s + b.amount, 0) * 100) / 100,
    requestableJobs,
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

/** "$1,700.00" — the portal always shows cents (it is a statement). */
export function formatPortalUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
