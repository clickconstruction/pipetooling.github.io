import type { PortalPropertyNotice } from '../../../supabase/functions/_shared/portalPropertyNotices'
import type { ChecksEventIn, ChecksJobIn } from '../jobs/gcChecksApplied'
export type { PortalPropertyNotice } from '../../../supabase/functions/_shared/portalPropertyNotices'
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
  /** The bill's id (v2.4304: its lien waiver note keys on it); null for a job-level shell or a function from before it. */
  invoiceId: string | null
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

/**
 * Share this bill (v2.3375): a bill on the viewer's job that someone else pays
 * and the office chose to show them. Listed for their records — no Pay
 * button, never in the balance.
 */
export type PortalSharedBill = {
  /** The bill's id (v2.4304: the owner's lien waiver note keys on it); null for a shell or a function from before it. */
  invoiceId: string | null
  /** The job's id, the handle "Ask the office" sends back (v2.3378); null from a function that predates it. */
  jobId: string | null
  jobLabel: string
  jobNumber: string
  jobName: string | null
  serviceTag: PortalTradeTag | null
  jobAddress: string | null
  /** Still open (dollars). */
  amount: number
  billedAmount: number
  totalPaid: number
  billedOn: string | null
  /** Who the bill went to. */
  billedTo: string
  /** The viewer's role on the job: the GC seeing a customer's bill, or the customer seeing the builder's. */
  viewerRole: 'gc' | 'customer'
}

export type PortalPayload = {
  company: PortalCompany
  customerName: string
  /** The number on file for the company (Customer Waiting, v2.3249) — prefills the request forms; null when none. */
  customerPhone: string | null
  audience: 'customer' | 'gc' | 'all'
  bills: PortalBill[]
  /** Share this bill (v2.3375): what someone else pays and the office shared with this viewer. */
  sharedBills: PortalSharedBill[]
  /** The notice on your property (v2.3825): recorded § 53.056 notices on the jobs this viewer owns — `_shared/portalPropertyNotices.ts`. */
  propertyNotices: PortalPropertyNotice[]
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
  /** Your payments (v2.4053): the viewer's jobs with the bills they pay and the payments on them, pre-scoped by `_shared/portalChecks.ts`; null from a function without it. */
  checks: PortalChecksPayload | null
  /** Waivers (v2.4278): one row per sent bill the viewer pays, with the conditional and unconditional lien waivers it carries — `_shared/portalWaivers.ts`; [] from a function without it. */
  waivers: PortalWaiverRow[]
  /** Records for an owner (punch list #86): the request the office offered on this portal and not yet sent — to sign, or signed; null from an older function. */
  ownerRecords: PortalOwnerRecords | null
}

export type PortalOwnerRecords = { id: string; address: string; ownerName: string; offeredOn: string; signed: { on: string; name: string } | null; /** Sent on the portal (shape B): the day, and the packet's PDF as a signed URL, or null while the copy is still being kept. */ sent: { on: string; downloadUrl: string | null } | null }

export type PortalChecksPayload = { jobs: ChecksJobIn[]; events: ChecksEventIn[] }

/** A half shows once it is signed (v2.4304): signed (not yet emailed) or sent; anything else is none. */
export type PortalWaiverHalfState = 'none' | 'signed' | 'sent'
export type PortalWaiverHalf = {
  state: PortalWaiverHalfState
  ymd: string | null
  pdfUrl: string | null
  /** conditional_progress · conditional_final · unconditional_progress · unconditional_final; null from a function before v2.4304. */
  formType: string | null
  signerName: string | null
}
export type PortalWaiverRow = {
  /** payer: a bill the viewer pays · owner: a bill on the viewer's property that the office shared with them (v2.4304). */
  audience: 'payer' | 'owner'
  jobId: string
  jobLabel: string
  jobAddress: string | null
  invoiceId: string
  billLabel: string
  amount: number
  billedYmd: string | null
  paid: boolean
  final: boolean
  conditional: PortalWaiverHalf
  unconditional: PortalWaiverHalf
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
  /** Who signed — both signers of a two-frame agreement (v2.4596), and on a part-signed one, who has so far. */
  signerName: string | null
  /** v2.4596: "Sam Owner signed · waiting on Alex Owner" while one of two has signed; absent from an older function. */
  signingProgress?: string | null
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
        invoiceId: typeof b.invoiceId === 'string' && b.invoiceId.trim() ? b.invoiceId : null,
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
  // The notice on your property (v2.3825): tolerant of the field's absence (a function from before it).
  const propertyNotices: PortalPropertyNotice[] = []
  if (Array.isArray(r.propertyNotices)) {
    for (const n of r.propertyNotices as Array<Record<string, unknown>>) {
      if (n == null || typeof n !== 'object') continue
      const claim = num(n.claim)
      const mailedOn = typeof n.mailedOn === 'string' && /^\d{4}-\d{2}-\d{2}/.test(n.mailedOn) ? n.mailedOn.slice(0, 10) : ''
      if (claim <= 0 || !mailedOn) continue
      propertyNotices.push({
        key: str(n.key, mailedOn),
        address: str(n.address),
        jobNumbers: Array.isArray(n.jobNumbers) ? (n.jobNumbers as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [],
        gcName: str(n.gcName),
        claimantName: str(n.claimantName),
        contactPerson: str(n.contactPerson),
        claim,
        months: Array.isArray(n.months) ? (n.months as unknown[]).filter((x): x is string => typeof x === 'string' && /^\d{4}-\d{2}$/.test(x)) : [],
        mailedOn,
      })
    }
  }
  // Share this bill (v2.3375): tolerant of the field's absence (a function from before it).
  const sharedBills: PortalSharedBill[] = []
  if (Array.isArray(r.sharedBills)) {
    for (const b of r.sharedBills as Array<Record<string, unknown>>) {
      if (b == null || typeof b !== 'object') continue
      const amount = num(b.amount)
      if (amount <= 0) continue
      const billedTo = typeof b.billedTo === 'string' ? b.billedTo.trim() : ''
      if (!billedTo) continue
      sharedBills.push({
        invoiceId: typeof b.invoiceId === 'string' && b.invoiceId.trim() ? b.invoiceId : null,
        jobId: typeof b.jobId === 'string' && b.jobId.trim() ? b.jobId : null,
        jobLabel: str(b.jobLabel, 'Job'),
        jobNumber: str(b.jobNumber),
        jobName: typeof b.jobName === 'string' && b.jobName.trim() ? b.jobName : null,
        serviceTag: b.serviceTag === 'plum' || b.serviceTag === 'elec' || b.serviceTag === 'hvac' ? b.serviceTag : null,
        jobAddress: typeof b.jobAddress === 'string' && b.jobAddress.trim() ? b.jobAddress : null,
        amount,
        billedAmount: num(b.billedAmount) || amount,
        totalPaid: num(b.totalPaid),
        billedOn: typeof b.billedOn === 'string' && /^\d{4}-\d{2}-\d{2}/.test(b.billedOn) ? b.billedOn.slice(0, 10) : null,
        billedTo,
        viewerRole: b.viewerRole === 'gc' ? 'gc' : 'customer',
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
        signingProgress: typeof a.signingProgress === 'string' && a.signingProgress.trim() ? a.signingProgress.trim() : null,
        sentAt: typeof a.sentAt === 'string' && a.sentAt ? a.sentAt : null,
        signUrl: typeof a.signUrl === 'string' && /^https?:\/\//.test(a.signUrl) ? a.signUrl : null,
      })
    }
  }
  const waivers: PortalWaiverRow[] = []
  if (Array.isArray(r.waivers)) {
    const half = (h: unknown): PortalWaiverHalf => {
      const o = h && typeof h === 'object' ? (h as Record<string, unknown>) : {}
      // A function from before v2.4304 also sends "signing": the page shows a waiver only once signed.
      const state: PortalWaiverHalfState = o.state === 'sent' || o.state === 'signed' ? o.state : 'none'
      return {
        state,
        ymd: typeof o.ymd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.ymd) ? o.ymd : null,
        pdfUrl: typeof o.pdfUrl === 'string' && /^https?:\/\//.test(o.pdfUrl) ? o.pdfUrl : null,
        formType: typeof o.formType === 'string' && o.formType.trim() ? o.formType : null,
        signerName: typeof o.signerName === 'string' && o.signerName.trim() ? o.signerName.trim() : null,
      }
    }
    for (const w of r.waivers as Array<Record<string, unknown>>) {
      if (w == null || typeof w !== 'object' || typeof w.jobId !== 'string' || typeof w.invoiceId !== 'string') continue
      const conditional = half(w.conditional)
      const unconditional = half(w.unconditional)
      if (conditional.state === 'none' && unconditional.state === 'none') continue
      waivers.push({
        audience: w.audience === 'owner' ? 'owner' : 'payer',
        jobId: w.jobId,
        jobLabel: str(w.jobLabel, 'Job'),
        jobAddress: typeof w.jobAddress === 'string' && w.jobAddress.trim() ? w.jobAddress : null,
        invoiceId: w.invoiceId,
        billLabel: str(w.billLabel, 'Bill'),
        amount: num(w.amount),
        billedYmd: typeof w.billedYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(w.billedYmd) ? w.billedYmd : null,
        paid: w.paid === true,
        final: w.final === true,
        conditional,
        unconditional,
      })
    }
  }
  let ownerRecords: PortalOwnerRecords | null = null
  if (r.ownerRecords && typeof r.ownerRecords === 'object') {
    const o = r.ownerRecords as Record<string, unknown>
    const sg = o.signed && typeof o.signed === 'object' ? (o.signed as Record<string, unknown>) : null
    const st = o.sent && typeof o.sent === 'object' ? (o.sent as Record<string, unknown>) : null
    if (typeof o.id === 'string' && o.id && typeof o.offeredOn === 'string') {
      ownerRecords = {
        id: o.id,
        address: typeof o.address === 'string' ? o.address : '',
        ownerName: typeof o.ownerName === 'string' ? o.ownerName : '',
        offeredOn: o.offeredOn,
        signed: sg && typeof sg.on === 'string' ? { on: sg.on, name: typeof sg.name === 'string' ? sg.name : '' } : null,
        sent: st && typeof st.on === 'string' ? { on: st.on, downloadUrl: typeof st.downloadUrl === 'string' && /^https?:\/\//.test(st.downloadUrl) ? st.downloadUrl : null } : null,
      }
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
    sharedBills,
    propertyNotices,
    totalDue: num(r.totalDue) || Math.round(bills.reduce((s, b) => s + b.amount, 0) * 100) / 100,
    requestableJobs,
    requestableProperties,
    requestToken: typeof r.requestToken === 'string' && r.requestToken.trim() ? r.requestToken : null,
    slug: typeof r.slug === 'string' && r.slug.trim() ? r.slug.trim() : null,
    agreements,
    waivers,
    ownerRecords,
    testReports: parsePortalTestReports(r.testReports),
    bankTransfer: bankTransferDetailsForPortal(parseBankTransferDetails(r.bankTransfer)),
    stages: Array.isArray(r.stages) ? r.stages.map(parseJobStages).filter((x): x is PortalJobStages => x != null) : [],
    promise: parsePortalPromise(r.promise),
    checks: parsePortalChecks(r.checks),
  }
}

/** Tolerant of the block's absence and of a malformed row — a bad job or event is dropped, never the page. */
export function parsePortalChecks(raw: unknown): PortalChecksPayload | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!Array.isArray(r.jobs)) return null
  const ymd = (v: unknown): string | null => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)
  const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
  const jobs: ChecksJobIn[] = []
  for (const j of r.jobs as Array<Record<string, unknown>>) {
    if (j == null || typeof j !== 'object' || typeof j.id !== 'string' || !j.id) continue
    const jobId = j.id
    const invoices = Array.isArray(j.invoices) ? (j.invoices as Array<Record<string, unknown>>) : []
    const payments = Array.isArray(j.payments) ? (j.payments as Array<Record<string, unknown>>) : []
    jobs.push({
      id: jobId,
      hcp_number: text(j.hcp_number),
      click_number: text(j.click_number),
      job_name: text(j.job_name),
      job_address: text(j.job_address),
      customer_id: str(j.customer_id, 'viewer'),
      gc_customer_id: null,
      bill_to_party: null,
      lien_retainage_held: typeof j.lien_retainage_held === 'number' ? j.lien_retainage_held : null,
      revenue: typeof j.revenue === 'number' ? j.revenue : null,
      invoices: invoices
        .filter((i) => i != null && typeof i === 'object' && typeof i.id === 'string' && i.id)
        .map((i) => ({ id: i.id as string, job_id: jobId, sequence_order: typeof i.sequence_order === 'number' ? i.sequence_order : null, amount: num(i.amount), status: str(i.status, 'billed'), billed_at: ymd(i.billed_at) })),
      payments: payments
        .filter((p) => p != null && typeof p === 'object' && typeof p.id === 'string' && p.id)
        .map((p) => ({
          id: p.id as string,
          job_id: jobId,
          invoice_id: text(p.invoice_id),
          amount: num(p.amount),
          paid_on: ymd(p.paid_on),
          sent_on: ymd(p.sent_on),
          payment_type: text(p.payment_type),
          reference_number: text(p.reference_number),
          sequence_order: typeof p.sequence_order === 'number' ? p.sequence_order : null,
        })),
    })
  }
  const events: ChecksEventIn[] = []
  if (Array.isArray(r.events)) {
    for (const e of r.events as Array<Record<string, unknown>>) {
      if (e == null || typeof e !== 'object' || typeof e.id !== 'string' || typeof e.created_at !== 'string') continue
      events.push({ id: e.id, kind: str(e.kind), payment_id: text(e.payment_id), from_job_id: text(e.from_job_id), to_job_id: text(e.to_job_id), amount: num(e.amount), created_at: e.created_at })
    }
  }
  return { jobs, events }
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
