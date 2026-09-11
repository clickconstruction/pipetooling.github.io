import { bankTransferDetailsForPortal, parseBankTransferDetails, type BankTransferDetails } from '../bankTransferDetails'
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

export type PortalTestReport = {
  id: string
  jobId: string
  jobNumber: string
  jobLabel: string
  jobAddress: string | null
  /** "Sewer Pre-Test Hydrostatic" · "Gas Test". */
  reportLabel: string
  title: string
  result: 'pass' | 'fail' | null
  testDateYmd: string
  certifierName: string | null
  certifierLicense: string | null
  sentAt: string | null
}

export type PortalPayload = {
  company: PortalCompany
  customerName: string
  /** The number on file for the company (Customer Waiting, v2.3249) — prefills the request forms; null when none. */
  customerPhone: string | null
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
  /** Job contracts (Contract Desk PR 5): signed records and open signing links. */
  agreements: PortalAgreement[]
  /** Test reports (v2.3304): SENT hydrostatic / pinpoint / gas reports on the company's jobs — the PDF opens through open-test-report-pdf. */
  testReports: PortalTestReport[]
  /** Bank transfer details (v2.3308): the company's ACH / wire remittance details + check mailing address, from Supabase; null when the office has not entered them or turned the card off. */
  bankTransfer: BankTransferDetails | null
  /** Stage Plan PR 5: the stage sequence on jobs that share dates with this GC — the company's voice, never a name, no money. */
  stages: PortalJobStages[]
  /** Their Word PR 2: the latest pay-by date on record across the open bills (office-marked or the customer's own), null when none. */
  promise: { promisedYmd: string; source: 'office' | 'customer' } | null
}

/** Stage Plan PR 5: the GC's sequence, in the company's voice — mirrors `GcView` in `_shared/stagePlan.ts`. */
export type PortalGcStepState = 'done' | 'now' | 'next' | 'later'
export type PortalGcAsk = { start: string; end: string; note: string | null; answer: 'open' | 'accepted' | 'proposed'; answerNote: string | null }
export type PortalGcStep = { fixtureId: string; name: string; number: number; state: PortalGcStepState; line: string; pct: number | null; askable: boolean; ask: PortalGcAsk | null }
export type PortalGcAlso = { name: string; state: 'done' | 'now' | 'later'; line: string }
export type PortalGcView = { headline: string | null; steps: PortalGcStep[]; also: PortalGcAlso[] }
export type PortalJobStages = {
  jobId: string
  jobLabel: string
  jobAddress: string | null
  view: PortalGcView
  /** The window behind the `next` step — where "Need other dates?" lands; null when it has none. */
  askWindowId: string | null
  /** Our window on that step, to prefill the ask. */
  askWindow: { start: string; end: string } | null
}

export type PortalAgreement = {
  jobLabel: string
  jobAddress: string | null
  status: 'sent' | 'signed'
  templateName: string | null
  amountCents: number | null
  signedAt: string | null
  signerName: string | null
  sentAt: string | null
  signUrl: string | null
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
  const agreements: PortalAgreement[] = []
  if (Array.isArray(r.agreements)) {
    for (const a of r.agreements as Array<Record<string, unknown>>) {
      if (a == null || typeof a !== 'object') continue
      const status = a.status === 'signed' ? 'signed' : a.status === 'sent' ? 'sent' : null
      if (!status) continue
      agreements.push({
        jobLabel: str(a.jobLabel, 'Job'),
        jobAddress: typeof a.jobAddress === 'string' && a.jobAddress.trim() ? a.jobAddress : null,
        status,
        templateName: typeof a.templateName === 'string' && a.templateName.trim() ? a.templateName : null,
        amountCents: typeof a.amountCents === 'number' && Number.isFinite(a.amountCents) ? Math.round(a.amountCents) : null,
        signedAt: typeof a.signedAt === 'string' && a.signedAt ? a.signedAt : null,
        signerName: typeof a.signerName === 'string' && a.signerName.trim() ? a.signerName : null,
        sentAt: typeof a.sentAt === 'string' && a.sentAt ? a.sentAt : null,
        signUrl: typeof a.signUrl === 'string' && /^https?:\/\//.test(a.signUrl) ? a.signUrl : null,
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
    customerPhone: typeof r.customerPhone === 'string' && r.customerPhone.trim() ? r.customerPhone.trim() : null,
    audience: r.audience === 'gc' ? 'gc' : r.audience === 'all' ? 'all' : 'customer',
    bills,
    totalDue: num(r.totalDue) || Math.round(bills.reduce((s, b) => s + b.amount, 0) * 100) / 100,
    requestableJobs,
    requestableProperties,
    requestToken: typeof r.requestToken === 'string' && r.requestToken.trim() ? r.requestToken : null,
    slug: typeof r.slug === 'string' && r.slug.trim() ? r.slug.trim() : null,
    agreements,
    testReports: parsePortalTestReports(r.testReports),
    bankTransfer: bankTransferDetailsForPortal(parseBankTransferDetails(r.bankTransfer)),
    stages: Array.isArray(r.stages) ? r.stages.map(parseJobStages).filter((x): x is PortalJobStages => x != null) : [],
    promise: parsePortalPromise(r.promise),
  }
}

/** The Test reports card shows this many before "Show all" (v2.3312). */
export const PORTAL_TEST_REPORTS_CARD_LIMIT = 5

/** The card's fold: the first `limit` unless expanded; `hidden` is what "Show all" would add. */
export function foldPortalTestReports<T>(list: T[], expanded: boolean, limit = PORTAL_TEST_REPORTS_CARD_LIMIT): { visible: T[]; hidden: number } {
  if (expanded || list.length <= limit) return { visible: list, hidden: 0 }
  return { visible: list.slice(0, limit), hidden: list.length - limit }
}

/** "certified by Malachi Whites (#RMP41130)" — one spelling on the line and the card; null without a name. */
export function portalCertifierLine(name: string | null, license: string | null): string | null {
  const n = (name ?? '').trim()
  if (!n) return null
  const l = (license ?? '').trim()
  return `certified by ${n}${l ? ` (${l})` : ''}`
}

/** Test reports (v2.3304): a row needs an id, a label and a civil date; everything else degrades to null. */
export function parsePortalTestReports(raw: unknown): PortalTestReport[] {
  if (!Array.isArray(raw)) return []
  const out: PortalTestReport[] = []
  for (const t of raw as Array<Record<string, unknown>>) {
    if (t == null || typeof t !== 'object') continue
    const id = typeof t.id === 'string' ? t.id.trim() : ''
    const reportLabel = typeof t.reportLabel === 'string' ? t.reportLabel.trim() : ''
    const testDateYmd = typeof t.testDateYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.testDateYmd) ? t.testDateYmd : ''
    if (!id || !reportLabel || !testDateYmd) continue
    out.push({
      id,
      jobId: str(t.jobId),
      jobNumber: str(t.jobNumber),
      jobLabel: str(t.jobLabel, 'Job'),
      jobAddress: typeof t.jobAddress === 'string' && t.jobAddress.trim() ? t.jobAddress : null,
      reportLabel,
      title: str(t.title, `${reportLabel} Test Report`),
      result: t.result === 'pass' || t.result === 'fail' ? t.result : null,
      testDateYmd,
      certifierName: typeof t.certifierName === 'string' && t.certifierName.trim() ? t.certifierName : null,
      certifierLicense: typeof t.certifierLicense === 'string' && t.certifierLicense.trim() ? t.certifierLicense : null,
      sentAt: typeof t.sentAt === 'string' && t.sentAt ? t.sentAt : null,
    })
  }
  return out
}

function parsePortalPromise(raw: unknown): PortalPayload['promise'] {
  if (raw == null || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (typeof p.promisedYmd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.promisedYmd)) return null
  return { promisedYmd: p.promisedYmd, source: p.source === 'customer' ? 'customer' : 'office' }
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

function spanOrNull(raw: unknown): { start: string; end: string } | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const ok = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  return ok(r.start) && ok(r.end) ? { start: r.start, end: r.end } : null
}

function parseAsk(raw: unknown): PortalGcAsk | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const sp = spanOrNull({ start: r.start, end: r.end })
  if (!sp) return null
  const answer = r.answer === 'accepted' ? 'accepted' : r.answer === 'proposed' ? 'proposed' : 'open'
  return { ...sp, note: typeof r.note === 'string' && r.note.trim() ? r.note.trim() : null, answer, answerNote: typeof r.answerNote === 'string' && r.answerNote.trim() ? r.answerNote.trim() : null }
}

const STEP_STATES: PortalGcStepState[] = ['done', 'now', 'next', 'later']

function parseJobStages(raw: unknown): PortalJobStages | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const jobId = typeof r.jobId === 'string' ? r.jobId : ''
  const v = r.view
  if (!jobId || v == null || typeof v !== 'object') return null
  const view = v as Record<string, unknown>
  const steps: PortalGcStep[] = []
  for (const e of Array.isArray(view.steps) ? view.steps : []) {
    if (e == null || typeof e !== 'object') continue
    const x = e as Record<string, unknown>
    const state = STEP_STATES.includes(x.state as PortalGcStepState) ? (x.state as PortalGcStepState) : 'later'
    const pct = typeof x.pct === 'number' && Number.isFinite(x.pct) ? Math.max(0, Math.min(100, Math.round(x.pct))) : null
    steps.push({
      fixtureId: typeof x.fixtureId === 'string' ? x.fixtureId : '',
      name: typeof x.name === 'string' && x.name.trim() ? x.name.trim() : 'Stage',
      number: typeof x.number === 'number' && Number.isFinite(x.number) ? x.number : steps.length + 1,
      state,
      line: typeof x.line === 'string' ? x.line : '',
      pct,
      askable: x.askable === true,
      ask: parseAsk(x.ask),
    })
  }
  const also: PortalGcAlso[] = []
  for (const e of Array.isArray(view.also) ? view.also : []) {
    if (e == null || typeof e !== 'object') continue
    const x = e as Record<string, unknown>
    also.push({ name: typeof x.name === 'string' && x.name.trim() ? x.name.trim() : 'Stage', state: x.state === 'done' ? 'done' : x.state === 'now' ? 'now' : 'later', line: typeof x.line === 'string' ? x.line : '' })
  }
  if (steps.length === 0 && also.length === 0) return null
  return {
    jobId,
    jobLabel: typeof r.jobLabel === 'string' ? r.jobLabel : 'Job',
    jobAddress: typeof r.jobAddress === 'string' ? r.jobAddress : null,
    view: { headline: typeof view.headline === 'string' && view.headline.trim() ? view.headline : null, steps, also },
    askWindowId: typeof r.askWindowId === 'string' && r.askWindowId ? r.askWindowId : null,
    askWindow: spanOrNull(r.askWindow),
  }
}
