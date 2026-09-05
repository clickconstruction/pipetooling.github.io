import type { GcReviewGroup, GcReviewGroupBy } from '../gcReviewRollup'
import { formatCurrency } from '../jobs/jobFormatting'

/**
 * GC-facing statement email (v2.1414) — what a General Contractor actually
 * receives, whether pasted into a personal email (Copy for email →
 * copyRichHtmlToClipboard) or sent by the app (send-gc-statement-email).
 *
 * Deliberately different from the internal gcStatementReport print: leads with
 * the three things a GC cares about — job address, the date the bill was
 * sent, and the amount owed — with the job number small underneath for
 * reference. No days-past-due pressure language, no internal vocabulary.
 * Table-based with inline styles so Gmail/Outlook/Apple Mail render it
 * faithfully.
 *
 * KEEP IN SYNC with supabase/functions/gc-statement-email-dispatch/render.ts —
 * the scheduled lane renders the same statement server-side from the RPC
 * payload. `gcStatementEmailParity.test.ts` pins the two byte-for-byte.
 */

export const GC_STATEMENT_COMPANY_NAME = 'Click Plumbing and Electrical'
/** Subject-line short name (v2.2131, owner copy): "Click Plumbing open balances: Aug 22, 2026". */
export const GC_STATEMENT_SUBJECT_NAME = 'Click Plumbing'
export const GC_STATEMENT_FOOTER_LINE =
  'Questions about a bill? Reply to this email or call the office.'

/**
 * Footer line (v2.2133, owner copy): names the office number from Settings →
 * Company → invoice issuer (`physical_invoice_issuer_v1.phone`). Falls back to
 * the bare line when no number is configured.
 */
export function gcStatementFooterLine(officePhone?: string | null): string {
  const phone = (officePhone ?? '').trim()
  return phone ? `Questions about a bill? Reply to this email or call the office at ${phone}.` : GC_STATEMENT_FOOTER_LINE
}

export type GcStatementEmailOpts = {
  dateStr?: string
  groupBy?: GcReviewGroupBy
  officePhone?: string | null
  /** The GC's portal link (v2.2151) — renders the "Your account, any time" card with its Pay online line; omit/null for none. */
  portalUrl?: string | null
  /**
   * Intro paragraph above the statement (journey-map #46): the dev-saved
   * `gc_statement_scheduled` template body, rendered — the same words the
   * scheduled lane prepends. Omit/blank for none (the personal Copy lane adds
   * its own line by hand).
   */
  introText?: string | null
}

/**
 * Attribution tag on the pay link (journey-map #46 telemetry): the portal
 * counts views, and `?src=gc-statement` lets #37's counter tell a statement
 * click from any other open. The portal ignores unknown query keys.
 */
export const GC_STATEMENT_PAY_LINK_SRC = 'gc-statement'

/** The portal URL with the statement's `src` tag appended — mirror of render.ts `payUrl`. */
export function gcStatementPayUrl(portalUrl: string | null | undefined): string | null {
  const url = (portalUrl ?? '').trim()
  if (!url) return null
  return `${url}${url.includes('?') ? '&' : '?'}src=${GC_STATEMENT_PAY_LINK_SRC}`
}

/**
 * Portal card under the statement table (v2.2151; says how to pay since
 * journey-map #46 — "Pay online any time at …", the office-side promise the
 * GC's copy never carried). Mirror of gc-statement-email-dispatch/render.ts
 * `portalCardHtml` — keep in sync.
 */
export function gcStatementPortalCardHtml(portalUrl: string | null | undefined): string {
  const url = (portalUrl ?? '').trim()
  const href = gcStatementPayUrl(url)
  if (!url || !href) return ''
  const shown = url.replace(/^https?:\/\//, '')
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin-top:14px"><tr>
    <td style="border:1px solid #ddd6c8;border-left:4px solid #b0662f;background:#fbf7f0;border-radius:6px;padding:12px 14px">
      <p style="margin:0;font-size:14px;font-weight:bold;color:#16283c">Your account, any time</p>
      <p style="margin:3px 0 0;font-size:13px;color:#5a6b7e;line-height:1.4">Pay online any time at <a href="${escapeHtml(href)}" style="color:#b0662f;font-weight:bold;text-decoration:none">${escapeHtml(shown)}</a> — this statement stays current there.</p>
    </td>
  </tr></table>`
}

/** Plain-text counterpart of the portal card — the same pay line. */
export function gcStatementPayLineText(portalUrl: string | null | undefined): string | null {
  const href = gcStatementPayUrl(portalUrl)
  return href ? `Pay online any time at ${href} — this statement stays current there.` : null
}

const escapeHtml = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Intro paragraph (journey-map #46): the editable template body, escaped with
 * newlines as <br>, inside the statement's own font so it reads as one email.
 * Mirror of render.ts `introHtml`.
 */
export function gcStatementIntroHtml(introText: string | null | undefined): string {
  const text = (introText ?? '').trim()
  if (!text) return ''
  return `<p style="margin:0 0 12px;font-size:14px;color:#111827;line-height:1.45">${escapeHtml(text).replace(/\n/g, '<br>')}</p>
  `
}

/**
 * Row label (journey-map #46 duplicate-name fix): the address leads; the job
 * name falls back to the lead only when there is no address, and then the
 * sub-line must not print it again ("Water Heater / Water Heater").
 * Mirror of render.ts `rowLabel`.
 */
export function gcStatementRowLabel(jobAddress: string | null | undefined, jobName: string | null | undefined, jobNumber: string | null | undefined): { lead: string; sub: string } {
  const address = (jobAddress ?? '').trim()
  const name = (jobName ?? '').trim()
  const num = (jobNumber ?? '').trim()
  const lead = address || name || '—'
  const sub = [num && num !== '—' ? `Job ${num}` : '', name && name !== lead ? name : ''].filter(Boolean).join(' · ')
  return { lead, sub }
}

/** `tel:` target for the office number — US 10/11-digit → +1…, else +digits; null when no digits. */
export function officePhoneTelHref(officePhone?: string | null): string | null {
  const d = (officePhone ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.length === 10) return `tel:+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `tel:+${d}`
  return `tel:+${d}`
}

/**
 * HTML footer (v2.2158): same sentence as gcStatementFooterLine, with the
 * office number as a tap-to-call link. Mirror of the dispatcher's render.ts
 * `gcStatementFooterHtml` — keep in sync.
 */
export function gcStatementFooterHtml(officePhone?: string | null): string {
  const phone = (officePhone ?? '').trim()
  const tel = officePhoneTelHref(phone)
  if (!phone || !tel) return escapeHtml(GC_STATEMENT_FOOTER_LINE)
  return `Questions about a bill? Reply to this email or call the office at <a href="${escapeHtml(tel)}" style="color:#6b7280;font-weight:bold;text-decoration:none;white-space:nowrap">${escapeHtml(phone)}</a>.`
}

/** Recipient-neutral on purpose — safe to paste to anyone without leaking another GC's name. */
export function gcStatementEmailSubject(_group: GcReviewGroup, dateStr: string): string {
  return `${GC_STATEMENT_SUBJECT_NAME} open balances: ${dateStr}`
}

const statementRowsHtml = (rows: GcReviewGroup['rows']): string =>
  rows
    .map((r) => {
      const { lead, sub } = gcStatementRowLabel(r.jobAddress, r.jobName, r.hcp)
      return `<tr>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;line-height:1.3">${escapeHtml(lead)}${sub ? `<br /><span style="font-size:11px;color:#6b7280">${escapeHtml(sub)}</span>` : ''}</td>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;white-space:nowrap;vertical-align:top">${escapeHtml(r.referenceDateDisplay)}</td>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;vertical-align:top">$${formatCurrency(r.remaining)}</td>
      </tr>`
    })
    .join('')

const statementRowText = (r: GcReviewGroup['rows'][number]): string => {
  const { lead, sub } = gcStatementRowLabel(r.jobAddress, r.jobName, r.hcp)
  return `- ${lead}${sub ? ` (${sub})` : ''} — billed ${r.referenceDateDisplay} — $${formatCurrency(r.remaining)}`
}

const statementTableHeadHtml = `<thead><tr>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:left">Job address</th>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:left">Bill sent</th>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:right">Amount owed</th>
    </tr></thead>`

/** The email body as an HTML fragment (for clipboard + the send pipeline wraps it itself). */
export function buildGcStatementEmailHtml(
  group: GcReviewGroup,
  opts?: GcStatementEmailOpts,
): string {
  const dateStr = opts?.dateStr ?? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
  ${gcStatementIntroHtml(opts?.introText)}<p style="margin:0;font-size:16px;font-weight:bold;color:#111827">${escapeHtml(GC_STATEMENT_COMPANY_NAME)}</p>
  <p style="margin:2px 0 12px;font-size:13px;color:#4b5563">Statement for ${escapeHtml(group.gcName)} · ${escapeHtml(dateStr)}</p>
  <table style="width:100%;border-collapse:collapse">
    ${statementTableHeadHtml}
    <tbody>${statementRowsHtml(group.rows)}
      <tr>
        <td colspan="2" style="padding:9px 6px;font-size:14px;font-weight:bold;color:#111827">Total owed</td>
        <td style="padding:9px 6px;font-size:14px;font-weight:bold;color:#111827;text-align:right">$${formatCurrency(group.subtotal)}</td>
      </tr>
    </tbody>
  </table>${gcStatementPortalCardHtml(opts?.portalUrl)}
  <p style="margin:12px 0 0;font-size:12px;color:#6b7280">${gcStatementFooterHtml(opts?.officePhone)}</p>
</div>`
}

/**
 * "Share all" (v2.1420): the FULL GC Review report as one email — every
 * GC/development section with its own table and subtotal, then the grand
 * total. Same recipient-safe vocabulary as the per-GC statement (no
 * days-past-due, no internal terms), so it can go to someone inside or
 * outside the company.
 */
export function gcReviewShareAllEmailSubject(groupBy: GcReviewGroupBy, dateStr: string): string {
  const scope = groupBy === 'development' ? 'all developments' : 'all GCs'
  return `Open balances (${scope}) — ${GC_STATEMENT_COMPANY_NAME} — ${dateStr}`
}

export function buildGcReviewShareAllEmailHtml(
  report: { groups: GcReviewGroup[]; grandTotal: number },
  opts?: GcStatementEmailOpts,
): string {
  const dateStr = opts?.dateStr ?? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const scope = opts?.groupBy === 'development' ? 'development' : 'GC'
  const sectionsHtml = report.groups
    .map(
      (g) => `<p style="margin:16px 0 4px;font-size:14px;font-weight:bold;color:#111827">${escapeHtml(g.gcName)} <span style="font-weight:normal;font-size:12px;color:#6b7280">· ${g.jobCount} job${g.jobCount === 1 ? '' : 's'} · $${formatCurrency(g.subtotal)}</span></p>
  <table style="width:100%;border-collapse:collapse">
    ${statementTableHeadHtml}
    <tbody>${statementRowsHtml(g.rows)}</tbody>
  </table>`,
    )
    .join('\n  ')
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
  ${gcStatementIntroHtml(opts?.introText)}<p style="margin:0;font-size:16px;font-weight:bold;color:#111827">${escapeHtml(GC_STATEMENT_COMPANY_NAME)}</p>
  <p style="margin:2px 0 4px;font-size:13px;color:#4b5563">Open balances by ${scope} · ${escapeHtml(dateStr)}</p>
  ${sectionsHtml}
  <table style="width:100%;border-collapse:collapse;margin-top:14px">
    <tbody>
      <tr>
        <td style="padding:9px 6px;border-top:2px solid #9ca3af;font-size:14px;font-weight:bold;color:#111827">Total owed</td>
        <td style="padding:9px 6px;border-top:2px solid #9ca3af;font-size:14px;font-weight:bold;color:#111827;text-align:right">$${formatCurrency(report.grandTotal)}</td>
      </tr>
    </tbody>
  </table>
  <p style="margin:12px 0 0;font-size:12px;color:#6b7280">${gcStatementFooterHtml(opts?.officePhone)}</p>
</div>`
}

const introTextLines = (introText: string | null | undefined): string[] => {
  const text = (introText ?? '').trim()
  return text ? [text, ''] : []
}

export function buildGcReviewShareAllEmailText(
  report: { groups: GcReviewGroup[]; grandTotal: number },
  opts?: GcStatementEmailOpts,
): string {
  const dateStr = opts?.dateStr ?? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const scope = opts?.groupBy === 'development' ? 'development' : 'GC'
  const sections = report.groups.flatMap((g) => [
    `${g.gcName} · ${g.jobCount} job${g.jobCount === 1 ? '' : 's'} · $${formatCurrency(g.subtotal)}`,
    ...g.rows.map(statementRowText),
    '',
  ])
  return [
    ...introTextLines(opts?.introText),
    GC_STATEMENT_COMPANY_NAME,
    `Open balances by ${scope} · ${dateStr}`,
    '',
    ...sections,
    `Total owed: $${formatCurrency(report.grandTotal)}`,
    '',
    gcStatementFooterLine(opts?.officePhone),
  ].join('\n')
}

/**
 * Standalone document for the Email… dialog's Preview window (v2.2061): the
 * exact email body the recipient gets, headed by the subject line, on a plain
 * light page (email clients render light regardless of app theme).
 */
export function buildGcStatementEmailPreviewHtml(
  group: GcReviewGroup,
  subject: string,
  opts?: GcStatementEmailOpts,
): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>Statement preview — ${escapeHtml(group.gcName)}</title></head>
<body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:20px 16px">
    <p style="margin:0 0 2px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280">Preview — what the recipient sees</p>
    <p style="margin:0 0 14px;font-size:13px;color:#374151"><strong>Subject:</strong> ${escapeHtml(subject)}</p>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:20px">${buildGcStatementEmailHtml(group, opts)}</div>
  </div>
</body></html>`
}

/** Plain-text fallback for text-only paste targets. */
export function buildGcStatementEmailText(
  group: GcReviewGroup,
  opts?: GcStatementEmailOpts,
): string {
  const dateStr = opts?.dateStr ?? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const payLine = gcStatementPayLineText(opts?.portalUrl)
  return [
    ...introTextLines(opts?.introText),
    GC_STATEMENT_COMPANY_NAME,
    `Statement for ${group.gcName} · ${dateStr}`,
    '',
    ...group.rows.map(statementRowText),
    '',
    `Total owed: $${formatCurrency(group.subtotal)}`,
    '',
    ...(payLine ? [payLine, ''] : []),
    gcStatementFooterLine(opts?.officePhone),
  ].join('\n')
}
