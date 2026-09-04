/**
 * The job-contract document model (Contract Desk PR 2): what a service
 * agreement says, where each line comes from on the job, and the one HTML
 * rendering the office preview, the customer's page, and (PR 3) the PDF all
 * share. Pure — no I/O. The terms body itself is a Contract Book document
 * (audience = customer) or the built-in default below.
 */

export type PaymentTermsKey = 'half_down' | 'on_completion' | 'progress' | 'custom'

export const PAYMENT_TERMS_PRESETS: ReadonlyArray<{ key: PaymentTermsKey; label: string }> = [
  { key: 'half_down', label: '50% down, balance on completion' },
  { key: 'on_completion', label: 'Due on completion' },
  { key: 'progress', label: 'Progress billing' },
  { key: 'custom', label: 'Custom…' },
]

export type JobContractFields = {
  /** Plain-words scope, one line per item. */
  scope_lines: string[]
  exclusions: string
  /** null = no fixed amount (time and materials; "billed at completion"). */
  amount_cents: number | null
  payment_terms_key: PaymentTermsKey
  /** Free text used when payment_terms_key === 'custom'. */
  payment_terms_text: string
  start_date: string | null
  completion_date: string | null
  /** Optional customer-facing note above the terms. */
  note: string
}

export const EMPTY_JOB_CONTRACT_FIELDS: JobContractFields = {
  scope_lines: [],
  exclusions: '',
  amount_cents: null,
  payment_terms_key: 'half_down',
  payment_terms_text: '',
  start_date: null,
  completion_date: null,
  note: '',
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function isPaymentTermsKey(v: unknown): v is PaymentTermsKey {
  return v === 'half_down' || v === 'on_completion' || v === 'progress' || v === 'custom'
}

/** Tolerant parse of the jsonb snapshot — unknown shapes degrade to the empty document, never throw. */
export function parseJobContractFields(raw: unknown): JobContractFields {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...EMPTY_JOB_CONTRACT_FIELDS }
  const o = raw as Record<string, unknown>
  const amount = o.amount_cents
  const scope = Array.isArray(o.scope_lines) ? o.scope_lines.filter((x): x is string => typeof x === 'string') : []
  return {
    scope_lines: scope,
    exclusions: str(o.exclusions),
    amount_cents: typeof amount === 'number' && Number.isFinite(amount) ? Math.round(amount) : null,
    payment_terms_key: isPaymentTermsKey(o.payment_terms_key) ? o.payment_terms_key : 'half_down',
    payment_terms_text: str(o.payment_terms_text),
    start_date: str(o.start_date) || null,
    completion_date: str(o.completion_date) || null,
    note: str(o.note),
  }
}

export function formatContractMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

/** The payment line the customer reads, with the amounts filled in. */
export function paymentTermsSentence(fields: Pick<JobContractFields, 'amount_cents' | 'payment_terms_key' | 'payment_terms_text'>): string {
  const amt = fields.amount_cents
  switch (fields.payment_terms_key) {
    case 'half_down':
      return amt != null
        ? `50% down (${formatContractMoney(Math.round(amt / 2))}) to begin work, balance due on completion.`
        : '50% down to begin work, balance due on completion.'
    case 'on_completion':
      return 'Full amount due on completion of the work.'
    case 'progress':
      return 'Progress billing: invoiced as work completes; each invoice is due on receipt.'
    default:
      return fields.payment_terms_text.trim() || 'Payment terms as agreed.'
  }
}

export type JobForContractPrefill = {
  job_name: string | null
  job_address: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  revenue: number | null
  fixtures?: ReadonlyArray<{ name: string; count: number; line_description: string | null }>
}

export type EstimateLineForPrefill = { line_item: string; description: string; quantity: number }

/**
 * First-open defaults from the job: scope from the accepted estimate's lines
 * when there is one, else the job's fixtures; amount from the accepted
 * estimate's total, else the job's revenue. Nothing here is a merge field the
 * office has to learn — it is editable text from the first render.
 */
export function buildJobContractPrefill(input: {
  job: JobForContractPrefill
  estimateLines?: ReadonlyArray<EstimateLineForPrefill>
  acceptedTotalCents?: number | null
}): JobContractFields {
  const { job } = input
  const lines: string[] = []
  const est = input.estimateLines ?? []
  if (est.length > 0) {
    for (const l of est) {
      const name = l.line_item.trim()
      const desc = l.description.trim()
      if (!name && !desc) continue
      const qty = l.quantity > 1 ? `${l.quantity} × ` : ''
      lines.push(desc && desc !== name ? `${qty}${name || 'Item'} — ${desc}` : `${qty}${name || desc}`)
    }
  } else {
    for (const f of job.fixtures ?? []) {
      const name = f.name.trim()
      if (!name) continue
      const qty = f.count > 1 ? `${f.count} × ` : ''
      const desc = (f.line_description ?? '').trim()
      lines.push(desc ? `${qty}${name} — ${desc}` : `${qty}${name}`)
    }
  }
  if (lines.length === 0 && (job.job_name ?? '').trim()) lines.push((job.job_name ?? '').trim())
  const revenueCents = job.revenue != null && Number.isFinite(Number(job.revenue)) && Number(job.revenue) > 0
    ? Math.round(Number(job.revenue) * 100)
    : null
  const amount = input.acceptedTotalCents != null && input.acceptedTotalCents > 0 ? Math.round(input.acceptedTotalCents) : revenueCents
  return {
    ...EMPTY_JOB_CONTRACT_FIELDS,
    scope_lines: lines,
    amount_cents: amount,
  }
}

export function jobContractHeading(job: Pick<JobForContractPrefill, 'job_address' | 'job_name'>): string {
  const addr = (job.job_address ?? '').trim()
  if (addr) return `Service agreement for ${addr.split(',')[0]?.trim() || addr}`
  const name = (job.job_name ?? '').trim()
  return name ? `Service agreement — ${name}` : 'Service agreement'
}

/** Built-in terms used until the office adds a customer template to the Contract Book. */
export const DEFAULT_JOB_CONTRACT_TERMS_PLAIN = `1. Scope. Contractor agrees to perform the work described above at the property listed, in a workmanlike manner and in accordance with applicable codes. Work not listed is not included.

2. Changes. Additional or changed work will be priced in writing and approved by the Customer before it proceeds. Approved changes become part of this agreement.

3. Payment. Payment is due as stated above. Balances unpaid 30 days after the due date accrue interest at the lesser of 1.5% per month or the maximum allowed by law, plus reasonable costs of collection.

4. Materials and site. Customer will provide reasonable access to the property and utilities needed for the work. Materials remain Contractor's property until paid for in full. Concealed conditions (rot, corrosion, code deficiencies, hidden lines) that require additional work are not included and will be handled as a change.

5. Warranty. Contractor warrants its labor for one year from completion. Manufacturer warranties apply to materials and equipment. The warranty does not cover damage from misuse, freezing, or work by others.

6. Permits and inspections. Where required, Contractor will obtain permits and schedule inspections; permit fees are included only if stated in the scope.

7. Cancellation. Either party may cancel before work begins with written notice; the Customer is responsible for materials already ordered for the job.

8. Electronic signature. The parties agree to conduct this transaction electronically. A typed or drawn signature on this document has the same force and effect as a handwritten signature.`

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export type JobContractIssuer = {
  companyName: string
  addressText: string
  phone: string
  email: string
  tagline: string
  licenseLine: string
}

export type JobContractRenderInput = {
  heading: string
  jobNumber: string
  jobAddress: string
  customerName: string
  recipientName: string
  dateLabel: string
  revision: number
  fields: JobContractFields
  /** Already-sanitized HTML for the terms body (renderContractBodyToSafeHtml output). */
  termsHtml: string
  templateName: string | null
  issuer: JobContractIssuer | null
  /** Absolute URL of the brand image, if any. */
  brandImageUrl?: string | null
  signature?: {
    printedName: string
    auditLine: string
    /** Drawn signature as a data: or https: URL. */
    imageUrl?: string | null
    /** Short record ID printed inside the frame (J922-1B0C4D). */
    recordId?: string | null
    /** Right-hand stamp under the name (e.g. "Sep 2, 2026, 7:14 PM CT"). */
    whenLabel?: string | null
    /** "Signed on paper" frames paper records. */
    paper?: boolean
  } | null
}

/**
 * The document, as one self-contained HTML string (pinned light, prints on
 * one to two pages). Used by the office preview window and PR 3's PDF; the
 * customer page renders the same sections in React.
 */
export function buildJobContractDocumentHtml(input: JobContractRenderInput): string {
  const f = input.fields
  const scope = f.scope_lines.map((l) => l.trim()).filter(Boolean)
  const issuer = input.issuer
  const amountLine = f.amount_cents != null ? formatContractMoney(f.amount_cents) : 'Billed at completion (time and materials)'
  const dates = [f.start_date ? `Start: ${escapeHtml(f.start_date)}` : '', f.completion_date ? `Estimated completion: ${escapeHtml(f.completion_date)}` : '']
    .filter(Boolean)
    .join(' · ')
  const sig = input.signature
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(input.heading)}</title>
<style>
  body{margin:0;background:#fff;color:#111827;font:14px/1.5 -apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .page{max-width:760px;margin:0 auto;padding:32px 36px 48px}
  .head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid #c2410c;padding-bottom:12px}
  .co{font-weight:700;font-size:15px;color:#7c2d12}.co small{display:block;font-weight:400;color:#4b5563;font-size:12px;white-space:pre-line}
  h1{font-size:22px;margin:18px 0 4px;line-height:1.2}
  .kv{color:#4b5563;font-size:13px}.kv b{color:#111827}
  h2{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#c2410c;margin:22px 0 6px}
  ul{margin:0;padding-left:20px}li{margin:3px 0}
  .tot{display:flex;justify-content:space-between;font-weight:700;font-size:17px;border-top:1px solid #e5e7eb;padding-top:8px;margin-top:6px}
  .terms{font-size:12.5px;color:#1f2937;white-space:normal}.terms p{margin:0 0 8px}
  .sig{margin-top:26px;border-top:1px solid #e5e7eb;padding-top:14px}
  .sigrow{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
  .frame{position:relative;display:inline-block;padding:12px 18px 9px;border:1.5px solid #c2410c;border-radius:6px;min-width:180px}
  .frame .tag{position:absolute;top:-8px;left:10px;background:#fff;padding:0 6px;font:700 9px/1 -apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#c2410c}
  .frame .id{position:absolute;bottom:-7px;right:10px;background:#fff;padding:0 6px;font:10px/1 ui-monospace,Menlo,monospace;color:#6b7280}
  .frame .mark{font:38px/1 "Great Vibes","Brush Script MT",cursive;color:#111827;white-space:nowrap}
  .frame img{max-height:60px;max-width:260px;display:block}
  .frame .empty{font:13px -apple-system,sans-serif;color:#9ca3af}
  .who{text-align:right}.who b{display:block;font-size:13px}.who span{font-size:11px;color:#6b7280}
  .audit{font-size:11px;color:#6b7280;margin-top:12px}
  .foot{margin-top:28px;font-size:11px;color:#6b7280;text-align:center;white-space:pre-line}
  @media print{.page{padding:0}}
</style></head><body><div class="page">
<div class="head"><div class="co">${escapeHtml(issuer?.companyName || 'Contractor')}<small>${escapeHtml([issuer?.addressText, issuer?.phone, issuer?.email].filter(Boolean).join('\n'))}</small></div>${
    input.brandImageUrl ? `<img src="${escapeHtml(input.brandImageUrl)}" alt="" style="max-width:140px;max-height:56px">` : ''
  }</div>
<h1>${escapeHtml(input.heading)}</h1>
<div class="kv">Job <b>#${escapeHtml(input.jobNumber)}</b> · for <b>${escapeHtml(input.customerName || input.recipientName || 'Customer')}</b> · ${escapeHtml(input.dateLabel)}${input.revision > 1 ? ` · rev ${input.revision}` : ''}</div>
${input.jobAddress ? `<div class="kv">Property: ${escapeHtml(input.jobAddress)}</div>` : ''}
${f.note.trim() ? `<p style="margin:14px 0 0">${escapeHtml(f.note.trim())}</p>` : ''}
<h2>Work we'll do</h2>
${scope.length > 0 ? `<ul>${scope.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : '<p class="kv">Scope as discussed.</p>'}
${f.exclusions.trim() ? `<p class="kv" style="margin-top:6px">Not included: ${escapeHtml(f.exclusions.trim())}</p>` : ''}
${dates ? `<p class="kv">${dates}</p>` : ''}
<h2>Price &amp; payment</h2>
<div class="tot"><span>Contract amount</span><span>${escapeHtml(amountLine)}</span></div>
<p class="kv" style="margin:6px 0 0">${escapeHtml(paymentTermsSentence(f))}</p>
<h2>Terms${input.templateName ? ` · ${escapeHtml(input.templateName)}` : ''}</h2>
<div class="terms">${input.termsHtml}</div>
<div class="sig"><h2 style="margin-top:0">Customer signature</h2>
<div class="sigrow"><div class="frame"><span class="tag">${sig?.paper ? 'Signed on paper' : 'Signed electronically'}</span>${
    sig
      ? sig.imageUrl
        ? `<img src="${escapeHtml(sig.imageUrl)}" alt="Signature of ${escapeHtml(sig.printedName)}">`
        : `<div class="mark">${escapeHtml(sig.printedName)}</div>`
      : '<div class="empty">Not yet signed</div>'
  }${sig?.recordId ? `<span class="id">${escapeHtml(sig.recordId)}</span>` : ''}</div>${
    sig ? `<div class="who"><b>${escapeHtml(sig.printedName)}</b><span>${escapeHtml(sig.whenLabel ?? '')}</span></div>` : ''
  }</div>
${sig ? `<div class="audit">${escapeHtml(sig.auditLine)}</div>` : ''}
</div>
${issuer ? `<div class="foot">${escapeHtml([issuer.tagline, issuer.companyName, issuer.addressText, issuer.phone ? `Ph: ${issuer.phone}` : '', issuer.licenseLine].filter(Boolean).join('\n'))}</div>` : ''}
</div></body></html>`
}

/** Google Docs / Drive / Sheets links the office keeps signed contracts in (v2.2744). */
export function isGoogleDocsUrl(raw: string | null | undefined): boolean {
  const v = (raw ?? '').trim()
  if (!v) return false
  try {
    const u = new URL(v)
    if (u.protocol !== 'https:') return false
    return /(^|\.)docs\.google\.com$/.test(u.hostname) || /(^|\.)drive\.google\.com$/.test(u.hostname)
  } catch {
    return false
  }
}

export function isHttpUrl(raw: string | null | undefined): boolean {
  const v = (raw ?? '').trim()
  if (!v) return false
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/** "docs.google.com/document/d/1kX9…Qz4" — enough to recognise the doc without the query string. */
export function shortDocumentLabel(raw: string | null | undefined): string {
  const v = (raw ?? '').trim()
  if (!v) return ''
  try {
    const u = new URL(v)
    const parts = u.pathname.split('/').filter(Boolean)
    const dIdx = parts.indexOf('d')
    const id = dIdx >= 0 ? parts[dIdx + 1] ?? '' : parts[parts.length - 1] ?? ''
    const shortId = id.length > 12 ? `${id.slice(0, 4)}…${id.slice(-3)}` : id
    const prefix = dIdx >= 0 ? parts.slice(0, dIdx + 1).join('/') : parts.slice(0, -1).join('/')
    return `${u.hostname}${prefix ? `/${prefix}` : ''}${shortId ? `/${shortId}` : ''}`
  } catch {
    return v.length > 48 ? `${v.slice(0, 45)}…` : v
  }
}
