import type { Database } from '../types/database'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { PhysicalInvoiceIssuer } from './physicalInvoiceIssuer'
import type { LienToolingFormPage, LienToolingPrefillState } from './lienToolingPrefillUrl'
import { splitJobAddressForPrefill } from './txLocalityAddressSplit'

export { splitJobAddressForPrefill }

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']

export type LienToolingPrefillContext = {
  job: JobWithDetails
  /** Billed invoice for this row when known; otherwise first billed line on job is used. */
  invoice: JobsLedgerInvoice | null
  issuer: PhysicalInvoiceIssuer | null
  senderNameFallback: string
  senderEmailFallback: string
}

function sumInvoiceAppliedFromJobPayments(job: JobWithDetails, invoiceId: string): number {
  let s = 0
  for (const p of job.payments ?? []) {
    if (p.invoice_id === invoiceId) s += Number(p.amount ?? 0)
  }
  return s
}

export function invoiceOpenRemainingOnJobForPrefill(inv: JobsLedgerInvoice, job: JobWithDetails): number {
  const applied = sumInvoiceAppliedFromJobPayments(job, inv.id)
  return Math.max(0, Number(inv.amount ?? 0) - applied)
}

function pickBilledInvoice(job: JobWithDetails, hint: JobsLedgerInvoice | null): JobsLedgerInvoice | null {
  if (hint && hint.status === 'billed' && hint.job_id === job.id) return hint
  const billed = (job.invoices ?? [])
    .filter((i) => i.status === 'billed')
    .slice()
    .sort((a, b) => a.sequence_order - b.sequence_order)
  return billed[0] ?? null
}

function moneyStr(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2)
}

function ymdFromIso(iso: string | null | undefined): string {
  if (!iso?.trim()) return ''
  const d = iso.trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDaysYmd(ymd: string, days: number): string {
  if (!ymd) return ''
  const base = new Date(ymd + 'T12:00:00')
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

function parseIssuerAddressLines(issuer: PhysicalIssuerLike): {
  street: string
  city: string
  state: string
  zip: string
} {
  const text = (issuer.addressText ?? '').trim()
  if (!text) return { street: '', city: '', state: 'Texas', zip: '' }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return { street: '', city: '', state: 'Texas', zip: '' }
  if (lines.length === 1) {
    return splitJobAddressForPrefill(lines[0]!)
  }
  const last = lines[lines.length - 1]!
  const m = last.match(/^(.+?),\s*([A-Za-z]{2})\s+([\d-]+)$/)
  if (m) {
    return {
      street: lines.slice(0, -1).join(', '),
      city: m[1]!.trim(),
      state: m[2]!.trim(),
      zip: m[3]!.trim(),
    }
  }
  return { street: lines.join(', '), city: '', state: 'Texas', zip: '' }
}

type PhysicalIssuerLike = Pick<PhysicalInvoiceIssuer, 'companyName' | 'addressText' | 'phone' | 'email'>

function fixtureSummary(job: JobWithDetails, maxItems: number): string {
  const fx = (job.fixtures ?? []).filter((f) => (f.name ?? '').trim())
  if (fx.length === 0) return ''
  const parts = fx.slice(0, maxItems).map((f) => `${(f.name ?? '').trim()} × ${Number(f.count ?? 0)}`)
  const more = fx.length > maxItems ? `; +${fx.length - maxItems} more` : ''
  return parts.join('; ') + more
}

function buildDemandLetter(
  job: JobWithDetails,
  inv: JobsLedgerInvoice | null,
  issuer: PhysicalInvoiceIssuer | null,
  senderNameFallback: string,
  senderEmailFallback: string,
): LienToolingPrefillState {
  const issuerAddr = issuer ? parseIssuerAddressLines(issuer) : { street: '', city: '', state: 'Texas', zip: '' }
  const clientAddr = splitJobAddressForPrefill(job.job_address ?? '')

  const invoiceDate =
    ymdFromIso(inv?.billed_at) || ymdFromIso(inv?.created_at) || todayYmd()
  const dueBase =
    ymdFromIso(inv?.estimated_bill_date) || ymdFromIso(job.last_bill_date) || invoiceDate
  const dueDate = dueBase || addDaysYmd(invoiceDate, 30)
  const payDeadline = dueDate || addDaysYmd(invoiceDate, 30)

  const invoiceTotal = inv != null ? Number(inv.amount ?? 0) : Number(job.revenue ?? 0)
  const paymentsReceived =
    inv != null ? sumInvoiceAppliedFromJobPayments(job, inv.id) : Number(job.payments_made ?? 0)
  const outstanding =
    inv != null
      ? invoiceOpenRemainingOnJobForPrefill(inv, job)
      : Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))

  const hcp = (job.hcp_number ?? '').trim()
  const invoiceNumber = hcp ? `HCP-${hcp}` : inv?.id?.slice(0, 8) ?? ''

  const jobTitle = (job.job_name ?? '').trim()
  const fx = fixtureSummary(job, 6)
  const serviceDescription = [jobTitle, fx].filter(Boolean).join(' — ') || jobTitle || 'Plumbing services'

  const workYmd = ymdFromIso(job.last_work_date) || invoiceDate

  return {
    'business-name': (issuer?.companyName ?? '').trim(),
    'sender-name': senderNameFallback.trim(),
    'business-address': issuerAddr.street,
    'business-city': issuerAddr.city,
    'business-state': issuerAddr.state || 'Texas',
    'business-zip': issuerAddr.zip,
    'business-phone': (issuer?.phone ?? '').trim(),
    'business-email': (issuer?.email ?? '').trim() || senderEmailFallback.trim(),
    'client-name': (job.customer_name ?? '').trim(),
    'client-address': clientAddr.street || (job.job_address ?? '').trim(),
    'client-city': clientAddr.city,
    'client-state': clientAddr.state || 'Texas',
    'client-zip': clientAddr.zip,
    'invoice-number': invoiceNumber,
    'invoice-date': invoiceDate,
    'due-date': dueDate,
    'payment-deadline': payDeadline,
    'service-description': serviceDescription,
    'service-dates': workYmd || invoiceDate,
    'completion-date': workYmd || invoiceDate,
    'invoice-total': moneyStr(invoiceTotal),
    'payments-received': moneyStr(paymentsReceived),
    'outstanding-balance': moneyStr(outstanding),
    'include-late-fees': false,
    'include-notarial': false,
    'payment-method': '',
  }
}

function buildMechanicsLien(
  job: JobWithDetails,
  inv: JobsLedgerInvoice | null,
  issuer: PhysicalInvoiceIssuer | null,
  senderNameFallback: string,
): LienToolingPrefillState {
  const claimAddr = issuer ? parseIssuerAddressLines(issuer) : { street: '', city: '', state: 'Texas', zip: '' }
  const prop = splitJobAddressForPrefill(job.job_address ?? '')
  const ownerName = (job.customer_name ?? '').trim()
  const unpaid =
    inv != null
      ? invoiceOpenRemainingOnJobForPrefill(inv, job)
      : Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))
  const workYmd = ymdFromIso(job.last_work_date) || todayYmd()
  const noticeYmd = ymdFromIso(inv?.billed_at) || ymdFromIso(inv?.created_at) || todayYmd()
  const jobTitle = (job.job_name ?? '').trim()
  const fx = fixtureSummary(job, 8)
  const workDesc = [jobTitle, fx].filter(Boolean).join(' — ') || jobTitle || 'Construction work'

  return {
    'claimant-name': senderNameFallback.trim(),
    'company-name': (issuer?.companyName ?? '').trim(),
    'claimant-address': claimAddr.street,
    'claimant-city': claimAddr.city,
    'claimant-state': claimAddr.state || 'Texas',
    'claimant-zip': claimAddr.zip,
    'owner-name': ownerName,
    'owner-address': prop.street || (job.job_address ?? '').trim(),
    'owner-city': prop.city,
    'owner-state': prop.state || 'Texas',
    'owner-zip': prop.zip,
    'property-address': prop.street || (job.job_address ?? '').trim(),
    'property-city': prop.city || '—',
    'property-state': prop.state || 'Texas',
    'property-zip': prop.zip || '—',
    'property-county': '',
    'legal-description': '',
    'work-description': workDesc,
    'work-start': workYmd,
    'work-end': workYmd,
    'unpaid-amount': moneyStr(unpaid),
    'customer-name': ownerName,
    'notice-date': noticeYmd,
    'contractor-name': (issuer?.companyName ?? '').trim(),
    'contractor-address': claimAddr.street,
    'contractor-city': claimAddr.city,
    'contractor-state': claimAddr.state,
    'contractor-zip': claimAddr.zip,
  }
}

function buildReleaseLien(
  job: JobWithDetails,
  inv: JobsLedgerInvoice | null,
  issuer: PhysicalInvoiceIssuer | null,
  senderNameFallback: string,
): LienToolingPrefillState {
  const claimAddr = issuer ? parseIssuerAddressLines(issuer) : { street: '', city: '', state: 'Texas', zip: '' }
  const prop = splitJobAddressForPrefill(job.job_address ?? '')
  const hcp = (job.hcp_number ?? '').trim()
  const ownerName = (job.customer_name ?? '').trim()
  const payYmd = todayYmd()
  const filingYmd = ymdFromIso(inv?.billed_at) || ymdFromIso(inv?.created_at) || todayYmd()

  return {
    'lien-reference': hcp ? `HCP-${hcp}` : '',
    'payment-date': payYmd,
    'claimant-name': senderNameFallback.trim(),
    'company-name': (issuer?.companyName ?? '').trim(),
    'claimant-address': claimAddr.street,
    'claimant-city': claimAddr.city || '—',
    'claimant-state': claimAddr.state || 'Texas',
    'claimant-zip': claimAddr.zip || '—',
    'filing-date': filingYmd,
    'property-description': (job.job_name ?? '').trim() || (job.job_address ?? '').trim(),
    'owner-name': ownerName,
    'property-county': '',
    'property-address': prop.street || (job.job_address ?? '').trim(),
    'property-city': prop.city || '—',
    'property-state': prop.state || 'Texas',
    'property-zip': prop.zip || '—',
  }
}

export function buildLienToolingPrefillState(
  form: LienToolingFormPage,
  ctx: LienToolingPrefillContext,
): LienToolingPrefillState {
  const inv = pickBilledInvoice(ctx.job, ctx.invoice)
  switch (form) {
    case 'demand-letter':
      return buildDemandLetter(
        ctx.job,
        inv,
        ctx.issuer,
        ctx.senderNameFallback,
        ctx.senderEmailFallback,
      )
    case 'mechanics-lien':
      return buildMechanicsLien(ctx.job, inv, ctx.issuer, ctx.senderNameFallback)
    case 'release-lien':
      return buildReleaseLien(ctx.job, inv, ctx.issuer, ctx.senderNameFallback)
    default: {
      const _exhaustive: never = form
      return _exhaustive
    }
  }
}
