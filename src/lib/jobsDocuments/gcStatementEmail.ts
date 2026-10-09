import type { GcReviewGroup, GcReviewGroupBy } from '../gcReviewRollup'
import { formatCurrency } from '../jobs/jobFormatting'
import {
  GC_STATEMENT_COMPANY_NAME,
  STATEMENT_RECEIVED_DAYS,
  escapeHtml,
  gcStatementFooterHtml,
  gcStatementFooterLine,
  gcStatementIntroHtml,
  renderStatementByPropertyHtml,
  renderStatementByPropertyText,
  statementReceivedFromChecks,
  type StatementBillIn,
  type StatementReceivedIn,
} from '../../../supabase/functions/_shared/gcStatementByProperty'
import { ymdPlusDays } from '../../../supabase/functions/_shared/customerSample'
import { gcBulkHeldLines, type GcStatementHeldWhy } from '../../../supabase/functions/_shared/gcStatementGate'
import { buildGcChecksReport } from '../jobs/gcChecksApplied'
import type { GcChecksInputs } from '../jobs/gcChecksAppliedIo'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { PORTAL_QR_CONTENT_ID } from '../../../supabase/functions/_shared/portalAccountCard'
import { qrMatrix } from '../../../supabase/functions/_shared/qrMatrix'
import { bytesToBase64, qrPngBytes } from '../../../supabase/functions/_shared/qrPng'

/**
 * GC-facing statement email (v2.1414) — what a General Contractor actually
 * receives, whether pasted into a personal email (Copy for email →
 * copyRichHtmlToClipboard) or sent by the app (send-gc-statement-email).
 *
 * Deliberately different from the internal gcStatementReport print: no
 * days-past-due pressure language, no internal vocabulary.
 *
 * The statement for one GC reads one property at a time (v2.4255): the total
 * first, a block per property with its subtotal, a line per bill with the
 * payment recorded against it, and the account card with its QR code. It is
 * written once, in `supabase/functions/_shared/gcStatementByProperty.ts`, and
 * the scheduled dispatcher (`gc-statement-email-dispatch/render.ts`) calls the
 * same module — this file only maps GC Review's rows onto it.
 * `gcStatementEmailParity.test.ts` pins the two mappings on one fixture.
 *
 * "Share all" (every GC in one email) keeps its flat table below; KEEP IT IN
 * SYNC with render.ts `renderGcShareAllHtml` / `renderGcShareAllText`.
 */

export {
  GC_STATEMENT_COMPANY_NAME,
  GC_STATEMENT_FOOTER_LINE,
  GC_STATEMENT_PAY_LINK_SRC,
  gcStatementFooterHtml,
  gcStatementFooterLine,
  gcStatementIntroHtml,
  gcStatementPayLineText,
  gcStatementPayUrl,
  officePhoneTelHref,
} from '../../../supabase/functions/_shared/gcStatementByProperty'

/** Subject-line short name (v2.2131, owner copy): "Click Plumbing open balances: Aug 22, 2026". */
export const GC_STATEMENT_SUBJECT_NAME = 'Click Plumbing'

export type GcStatementEmailOpts = {
  dateStr?: string
  groupBy?: GcReviewGroupBy
  officePhone?: string | null
  /** The GC's portal link (v2.2151) — draws the "Your account, any time" card; omit/null for none. */
  portalUrl?: string | null
  /**
   * What the card's QR code loads (v2.4255): `GC_STATEMENT_QR_CID_SRC` in a
   * send (the function attaches the file), a data URL in a preview
   * (`gcStatementQrDataUrl`). Omit/null for a card without a code — Copy for
   * email, where a pasted picture may not travel.
   */
  qrImgSrc?: string | null
  /**
   * Intro paragraph above the statement (journey-map #46): the dev-saved
   * `gc_statement_scheduled` template body, rendered — the same words the
   * scheduled lane prepends. Omit/blank for none (the personal Copy lane adds
   * its own line by hand).
   */
  introText?: string | null
  /**
   * "Payments we have received" (v2.4260): the GC's checks of the last
   * `STATEMENT_RECEIVED_DAYS` days and where each went (`gcStatementReceived`).
   * Omit while they are still being read, or for a development statement — no
   * block prints; an empty list prints the block saying none came.
   */
  received?: readonly StatementReceivedIn[] | null
  receivedSinceYmd?: string | null
}

/** What the Draft Message and Copy lanes carry for the payments block, once the GC's checks are read. */
export type GcStatementReceived = { received: StatementReceivedIn[]; receivedSinceYmd: string }

/**
 * The payments block's rows from a GC's checks (the rows Find a check and the
 * printed sheet read, `fetchGcChecksInputs`): every check received in the last
 * `STATEMENT_RECEIVED_DAYS` days before `todayYmd`, newest first, each with the
 * property and job it landed on. Mirror of the dispatcher's `receivedFor`.
 */
export function gcStatementReceived(inputs: GcChecksInputs, gcId: string, todayYmd: string): GcStatementReceived {
  const receivedSinceYmd = ymdPlusDays(todayYmd, -STATEMENT_RECEIVED_DAYS)
  const report = buildGcChecksReport({ gcId, ...inputs, sinceYmd: receivedSinceYmd })
  const jobs = new Map(inputs.jobs.map((j) => [j.id, { address: j.job_address ?? null, number: effectiveJobLedgerNumber(j.hcp_number, j.click_number) }]))
  return { received: statementReceivedFromChecks(report.checks, jobs), receivedSinceYmd }
}

/** The QR code as an email loads it: an inline attachment the send function adds under this Content-ID. */
export const GC_STATEMENT_QR_CID_SRC = `cid:${PORTAL_QR_CONTENT_ID}`

/** The portal's QR code as a data URL, for a preview a browser draws (it cannot load `cid:`); null when the address is too long for a code. */
export function gcStatementQrDataUrl(portalUrl: string | null | undefined): string | null {
  const url = (portalUrl ?? '').trim()
  const modules = url ? qrMatrix(url) : null
  return modules ? `data:image/png;base64,${bytesToBase64(qrPngBytes(modules))}` : null
}

/**
 * Row label for the Share-all table (journey-map #46 duplicate-name fix): the
 * address leads; the job name falls back to the lead only when there is no
 * address, and then the sub-line must not print it again ("Water Heater /
 * Water Heater"). Mirror of render.ts `rowLabel`.
 */
export function gcStatementRowLabel(jobAddress: string | null | undefined, jobName: string | null | undefined, jobNumber: string | null | undefined): { lead: string; sub: string } {
  const address = (jobAddress ?? '').trim()
  const name = (jobName ?? '').trim()
  const num = (jobNumber ?? '').trim()
  const lead = address || name || '—'
  const sub = [num && num !== '—' ? `Job ${num}` : '', name && name !== lead ? name : ''].filter(Boolean).join(' · ')
  return { lead, sub }
}

/** Recipient-neutral on purpose — safe to paste to anyone without leaking another GC's name. */
export function gcStatementEmailSubject(_group: GcReviewGroup, dateStr: string): string {
  return `${GC_STATEMENT_SUBJECT_NAME} open balances: ${dateStr}`
}

/** GC Review's rows as the shared statement reads them — mirror of render.ts `statementBillsOf`. */
export function gcStatementBillsOf(group: GcReviewGroup): StatementBillIn[] {
  return group.rows.map((r) => ({
    key: r.key,
    jobId: r.jobId,
    jobNumber: r.hcp,
    jobName: r.jobName,
    jobAddress: r.jobAddress,
    customerName: r.customerName,
    propertyId: r.propertyId ?? null,
    sentYmd: r.referenceYmd ?? null,
    sentIsEstimate: r.referenceIsEstimate ?? false,
    // A row built without its bill (an old caller, a hand-made fixture) is worded as owed in full.
    billed: r.billed === undefined ? r.remaining : r.billed,
    owed: r.remaining,
    payments: r.billed === undefined ? [] : r.billPayments ?? [],
    retainageHeld: r.retainageHeld ?? null,
  }))
}

/**
 * Money put on a job with no bill picked — for the office, before it sends. Since v2.5006 (the
 * owner's call of 2026-10-09) the statement counts it the way the portal does: the part of the job
 * on no bill first, then the oldest bills. This is information, not a warning: the office sees which
 * jobs it applies to and can pick a bill instead. One entry per job, largest first.
 */
export function gcStatementUnmatchedPayments(group: GcReviewGroup): Array<{ jobId: string; hcp: string; amount: number }> {
  const byJob = new Map<string, { jobId: string; hcp: string; amount: number }>()
  for (const r of group.rows) {
    const amount = Math.round((r.unmatchedOnJob ?? 0) * 100) / 100
    if (amount > 0.005 && !byJob.has(r.jobId)) byJob.set(r.jobId, { jobId: r.jobId, hcp: r.hcp, amount })
  }
  return [...byJob.values()].sort((a, b) => b.amount - a.amount || a.hcp.localeCompare(b.hcp))
}

/** The office's sentence for `gcStatementUnmatchedPayments`; '' when every payment sits on a bill. */
export function gcStatementUnmatchedWords(group: GcReviewGroup): string {
  const jobs = gcStatementUnmatchedPayments(group)
  if (jobs.length === 0) return ''
  const list = jobs.map((j) => `${j.hcp && j.hcp !== '—' ? `Job ${j.hcp}` : 'A job with no number'} $${formatCurrency(j.amount)}`).join(' · ')
  return `Paid on the job with no bill picked: ${list}. The statement counts it as the portal does, first for the work on no bill, then for the oldest bills. To put it on a different bill, pick the bill in Edit Job → Payments.`
}

const statementRowsHtml = (rows: GcReviewGroup['rows']): string =>
  rows
    .map((r) => {
      const { lead, sub } = gcStatementRowLabel(r.jobAddress, r.jobName, r.hcp)
      // The line under the bill (v2.4100): what paid it — mirror of render.ts `rowPaidBy`.
      const paidBy = (r.paidBy ?? '').trim()
      return `<tr>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;line-height:1.3">${escapeHtml(lead)}${sub ? `<br /><span style="font-size:11px;color:#6b7280">${escapeHtml(sub)}</span>` : ''}${paidBy ? `<br /><span style="font-size:11px;color:#6b7280">${escapeHtml(paidBy)}</span>` : ''}</td>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;white-space:nowrap;vertical-align:top">${escapeHtml(r.referenceDateDisplay)}</td>
        <td style="padding:7px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;vertical-align:top">$${formatCurrency(r.remaining)}</td>
      </tr>`
    })
    .join('')

const statementRowText = (r: GcReviewGroup['rows'][number]): string => {
  const { lead, sub } = gcStatementRowLabel(r.jobAddress, r.jobName, r.hcp)
  const paidBy = (r.paidBy ?? '').trim()
  return `- ${lead}${sub ? ` (${sub})` : ''} — billed ${r.referenceDateDisplay} — $${formatCurrency(r.remaining)}${paidBy ? ` — ${paidBy}` : ''}`
}

const statementTableHeadHtml = `<thead><tr>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:left">Job address</th>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:left">Bill sent</th>
      <th style="padding:6px;border-bottom:2px solid #9ca3af;font-size:12px;color:#4b5563;text-align:right">Amount owed</th>
    </tr></thead>`

const todayStr = (): string => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** The email body as an HTML fragment (for clipboard + the send pipeline wraps it itself). */
export function buildGcStatementEmailHtml(
  group: GcReviewGroup,
  opts?: GcStatementEmailOpts,
): string {
  return renderStatementByPropertyHtml({
    payerName: group.gcName,
    dateStr: opts?.dateStr ?? todayStr(),
    bills: gcStatementBillsOf(group),
    officePhone: opts?.officePhone,
    portalUrl: opts?.portalUrl,
    received: opts?.received,
    receivedSinceYmd: opts?.receivedSinceYmd,
    qrImgSrc: opts?.qrImgSrc,
    introText: opts?.introText,
  })
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

/** The GCs a whole report left out (v2.5022): held until their bills are checked, and why. */
export type GcReportHeld = ReadonlyArray<{ name: string; why: GcStatementHeldWhy }>

export function buildGcReviewShareAllEmailHtml(
  report: { groups: GcReviewGroup[]; grandTotal: number; held?: GcReportHeld },
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
  ${gcBulkHeldLines(report.held ?? []).map((line) => `<p style="margin:2px 0 4px;font-size:12px;color:#92400e">${escapeHtml(line)}</p>`).join('')}${sectionsHtml}
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
  report: { groups: GcReviewGroup[]; grandTotal: number; held?: GcReportHeld },
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
    ...gcBulkHeldLines(report.held ?? []),
    '',
    ...sections,
    `Total owed: $${formatCurrency(report.grandTotal)}`,
    '',
    gcStatementFooterLine(opts?.officePhone),
  ].join('\n')
}

/**
 * Standalone document for the Email… dialog's Preview (v2.2061): the exact
 * email body the recipient gets, headed by the subject line, on a plain light
 * page (email clients render light regardless of app theme). The QR code is
 * drawn from the portal address as a data URL — a browser cannot load the
 * `cid:` a real send carries.
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
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:20px">${buildGcStatementEmailHtml(group, { ...opts, qrImgSrc: opts?.qrImgSrc ?? gcStatementQrDataUrl(opts?.portalUrl) })}</div>
  </div>
</body></html>`
}

/** Plain-text fallback for text-only paste targets. */
export function buildGcStatementEmailText(
  group: GcReviewGroup,
  opts?: GcStatementEmailOpts,
): string {
  return renderStatementByPropertyText({
    payerName: group.gcName,
    dateStr: opts?.dateStr ?? todayStr(),
    bills: gcStatementBillsOf(group),
    officePhone: opts?.officePhone,
    portalUrl: opts?.portalUrl,
    received: opts?.received,
    receivedSinceYmd: opts?.receivedSinceYmd,
    introText: opts?.introText,
  })
}
