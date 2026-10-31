/**
 * gc-customer-email's pure half (GC mode, Owner Billing's O4b): who may send, what a request may carry, who gets each
 * kind and what it is about, and the email around the lines the window wrote. The words are the window's
 * (`src/lib/gc/customerEmail.ts`); this frames them the way `gc-trade-email` frames a trade partner's. Dependency-free,
 * so the app's tests import it straight from here.
 */

/**
 * Who may email a GC customer: the money team (the Owner Billing door), never a training account or a digital twin.
 * The client's copy is `GC_MONEY_TEAM` in `src/lib/gc/access.ts`; `access.test.ts` holds the two to each other.
 */
export const GC_CUSTOMER_EMAIL_ROLES: readonly string[] = ['dev', 'master_technician', 'controller']

/** The GC entity's name on every email to a GC customer (the owner's call 12: Click Construction). */
export const GC_CUSTOMER_EMAIL_FROM_NAME = 'Click Construction'

/**
 * The kinds. O4b-1: our pay application to the customer, and the ask to the architect to certify it. O4b-2: the bill
 * the architect certified, to the customer, and a change order for them to sign. O5b: our reminder to pay a late bill,
 * its words the ones `gc_remind_customer_to_pay` filed. O6b-2: our bill for the interest on late bills. Building's U7b:
 * the weekly report on a job we are building, its words the `gc_weekly_reports` row the window kept. The Board's
 * B6-d-iii-b: our contract to sign in their portal, the send's own file attached by the function. The schedule's PR 15a:
 * the customer's schedule on its own (G-94), its words the `gc_schedule_sends` row the Schedule window kept.
 */
export const GC_CUSTOMER_EMAIL_KINDS = ['pay_app', 'certify_ask', 'certified', 'change_order', 'reminder', 'interest_bill', 'weekly', 'contract', 'schedule'] as const
export type GcCustomerEmailKind = (typeof GC_CUSTOMER_EMAIL_KINDS)[number]

/** Who each kind goes to: the project's customer, or its architect (`gc_projects.architect_customer_id`). */
export const GC_CUSTOMER_EMAIL_TO: Record<GcCustomerEmailKind, 'customer' | 'architect'> = {
  pay_app: 'customer',
  certify_ask: 'architect',
  certified: 'customer',
  change_order: 'customer',
  reminder: 'customer',
  interest_bill: 'customer',
  weekly: 'customer',
  contract: 'customer',
  schedule: 'customer',
}

/** The row each kind is about: a pay application, a change order, a reminder to pay, an interest bill, a weekly report, a send of our contract, or the customer's schedule as sent. */
export type GcCustomerEmailSource = 'gc_owner_pay_apps' | 'gc_change_orders' | 'gc_owner_pay_reminders' | 'gc_owner_interest_bills' | 'gc_weekly_reports' | 'gc_owner_contract_sends' | 'gc_schedule_sends'
export const GC_CUSTOMER_EMAIL_SOURCE: Record<GcCustomerEmailKind, GcCustomerEmailSource> = {
  pay_app: 'gc_owner_pay_apps',
  certify_ask: 'gc_owner_pay_apps',
  certified: 'gc_owner_pay_apps',
  change_order: 'gc_change_orders',
  reminder: 'gc_owner_pay_reminders',
  interest_bill: 'gc_owner_interest_bills',
  weekly: 'gc_weekly_reports',
  contract: 'gc_owner_contract_sends',
  schedule: 'gc_schedule_sends',
}

/**
 * Who may send each kind. The money team for every bill and change (`GC_CUSTOMER_EMAIL_ROLES`). The weekly report is
 * Building's: whoever can read its row through RLS may send it (dev while Building is built; Building's door decides the
 * schedule's team, and whether reading is still enough then). The customer's schedule is the Schedule's, the same way: its
 * row read through RLS (a dev until the schedule's PR 10, then the job's team). It carries no money. A test copy passes
 * the same gate.
 */
export const GC_CUSTOMER_EMAIL_GATE: Record<GcCustomerEmailKind, 'moneyTeam' | 'row'> = {
  pay_app: 'moneyTeam',
  certify_ask: 'moneyTeam',
  certified: 'moneyTeam',
  change_order: 'moneyTeam',
  reminder: 'moneyTeam',
  interest_bill: 'moneyTeam',
  weekly: 'row',
  // Our contract goes with the price by line, Our number's.
  contract: 'moneyTeam',
  schedule: 'row',
}

/**
 * Which of a customer row's addresses each kind goes to: the billing address first for a bill, the contact first for the
 * weekly report and the customer's schedule, which are for the person who runs the job for them (`customerContactEmail`),
 * and for our contract, whose signer is their owner, not their payables.
 */
export const GC_CUSTOMER_EMAIL_ADDRESS: Record<GcCustomerEmailKind, 'billing' | 'contact'> = {
  pay_app: 'billing',
  certify_ask: 'billing',
  certified: 'billing',
  change_order: 'billing',
  reminder: 'billing',
  interest_bill: 'billing',
  weekly: 'contact',
  contract: 'contact',
  schedule: 'contact',
}

/**
 * Whether the email is framed: our closing lines after the window's. The weekly report carries its own greeting and
 * sign-off (`weeklyReportText`), and so does the customer's schedule (`customerScheduleLetter`), so nothing is added after
 * either.
 */
export const GC_CUSTOMER_EMAIL_FRAMED: Record<GcCustomerEmailKind, boolean> = {
  pay_app: true,
  certify_ask: true,
  certified: true,
  change_order: true,
  reminder: true,
  interest_bill: true,
  weekly: false,
  contract: true,
  schedule: false,
}

/**
 * The sent copy's kind (docs/SENT_COPIES.md) for each email kind. The pay application and the ask carry the form,
 * `bill_gc_pay_app`; the certified bill is its own kind, so the window tells the two apart. Both begin `bill`, so the
 * Documents page sorts them under Bills (`sentKindGroup`), and neither is `pay_application`, the Pipeline's G702
 * workbook. A change order changes our contract with the customer: `job_contract_gc_change_order`, under Contracts.
 * A reminder to pay is a bill's too: `bill_gc_reminder`, under Bills, and so is an interest bill: `bill_gc_interest`.
 */
export const GC_CUSTOMER_EMAIL_FILED_AS: Record<GcCustomerEmailKind, string> = {
  pay_app: 'bill_gc_pay_app',
  certify_ask: 'bill_gc_pay_app',
  certified: 'bill_gc_certified',
  change_order: 'job_contract_gc_change_order',
  reminder: 'bill_gc_reminder',
  interest_bill: 'bill_gc_interest',
  // A report on the job, not a bill: `field_report`'s prefix, so the Documents page sorts it under Statements.
  weekly: 'field_report_gc_weekly',
  // Our contract with the customer, kept in Documents until SENT_COPIES' step 4 lists it.
  contract: 'gc_owner_contract',
  // The customer's schedule on its own, beside the weekly report under Statements.
  schedule: 'field_report_gc_schedule',
}

/** The sent copies' kinds about rows of one table, for the window's *Emailed to* lines. */
export function gcCustomerEmailCopyKinds(table: GcCustomerEmailSource): string[] {
  return [...new Set(GC_CUSTOMER_EMAIL_KINDS.filter((k) => GC_CUSTOMER_EMAIL_SOURCE[k] === table).map((k) => GC_CUSTOMER_EMAIL_FILED_AS[k]))]
}

/**
 * The kinds that add the customer's portal link when they already have one (never minted here): the certified bill,
 * the reminder to pay it and the interest bill, which the portal lists. It has no Pay there yet, since the bill is not on Stripe, so the line
 * says *see*, not *pay*.
 */
export const GC_CUSTOMER_EMAIL_PORTAL_LINE: Record<GcCustomerEmailKind, boolean> = {
  pay_app: false,
  certify_ask: false,
  certified: true,
  change_order: false,
  reminder: true,
  interest_bill: true,
  // The schedule's PR 15b: their portal shows the schedule the report sums up, with Building's two conditions
  // (`gcCustomerEmailPortalOn`). The portal shows no reports, so the line promises their schedule.
  weekly: true,
  // Required, never left off: they sign it there. With no link where GC jobs show, the kind refuses noPortal.
  contract: true,
  // Since the schedule's PR 15b, when their portal shows the schedule, in its own words (`gcCustomerEmailPortalOn`).
  schedule: true,
}
export const GC_CUSTOMER_EMAIL_PORTAL_WORDS = 'You can see this bill in your portal:'
/** Our contract's portal line: they sign it there. */
export const GC_CUSTOMER_EMAIL_CONTRACT_PORTAL_WORDS = 'Read it and sign it in your portal:'
/** The schedule's and the Friday report's portal line (the schedule's PR 15b): their portal shows the schedule. */
export const GC_CUSTOMER_EMAIL_SCHEDULE_PORTAL_WORDS = 'You can see your schedule in your portal:'

/** The words a kind's portal line says, when they are not a bill's: our contract's, or the schedule's. */
export function gcCustomerEmailPortalWords(kind: GcCustomerEmailKind): string | undefined {
  if (kind === 'contract') return GC_CUSTOMER_EMAIL_CONTRACT_PORTAL_WORDS
  if (kind === 'schedule' || kind === 'weekly') return GC_CUSTOMER_EMAIL_SCHEDULE_PORTAL_WORDS
  return undefined
}

/**
 * Whether a kind's email looks for their portal link (our contract always does, and refuses without one). The schedule's
 * and the Friday report's, with Building's two conditions (the schedule's PR 15b, amendment 3): never when the row copies
 * the architect, who would get the customer's own link to their bills and contract, and only on a job with a schedule
 * drawn, since their portal shows none before.
 */
export function gcCustomerEmailPortalOn(input: { kind: GcCustomerEmailKind; copyArchitect: boolean; scheduleDrawn: boolean }): boolean {
  if (!GC_CUSTOMER_EMAIL_PORTAL_LINE[input.kind]) return false
  if (input.kind === 'schedule' || input.kind === 'weekly') return !input.copyArchitect && input.scheduleDrawn
  return true
}

/**
 * The portal link a GC job's email goes with: one where their GC jobs, and so the job's bills, show. The merged link
 * (`all`) first, at its short address when it has one, then a customer view (`customer`). Never a general
 * contractor's view (`gc`), which shows no GC job of ours, so a line to it would land on a page without the bill.
 * Null: none on. Our contract then refuses noPortal; every other kind goes with no portal line.
 */
export function gcJobsPortalUrl(
  links: ReadonlyArray<{ audience: string; token: string | null; revoked_at?: string | null }>,
  slug: string | null | undefined,
  appOrigin: string,
  shortOrigin: string,
): string | null {
  const active = links.filter((l) => l.revoked_at == null && !!(l.token ?? '').trim())
  const origin = appOrigin.replace(/\/+$/, '')
  const all = active.find((l) => l.audience === 'all')
  if (all?.token) return (slug ?? '').trim() ? `${shortOrigin}${(slug ?? '').trim()}` : `${origin}/portal?t=${all.token.trim()}`
  const customer = active.find((l) => l.audience === 'customer')
  return customer?.token ? `${origin}/portal?t=${customer.token.trim()}` : null
}

/** The largest contract file an email attaches, under Resend's message limit. Over it: `tooLarge`. */
export const GC_CUSTOMER_EMAIL_MAX_CONTRACT_BYTES = 30 * 1024 * 1024

/** Our contract's attachment name: the office's file name as Resend takes one, always a .pdf. */
export function gcContractAttachmentName(name: string): string {
  const base = name.replace(/\.pdf$/i, '').replace(/[^\w.() -]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110)
  return `${base || 'Our contract'}.pdf`
}

/** A file's bytes as base64 for an attachment, a chunk at a time so a long file never overflows the call stack. */
export function bytesBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

/** The form's PDF, base64, under the same cap `send-lien-release-email` keeps. */
export const GC_CUSTOMER_EMAIL_MAX_PDF_BASE64 = 6_000_000

/** Each refusal and its HTTP status. The window says each one in words (`gcCustomerEmailRefusal`). */
export const CUSTOMER_EMAIL_ERRORS = {
  signIn: 401,
  moneyTeamOnly: 403,
  readOnly: 403,
  badRequest: 400,
  notFound: 404,
  otherProject: 409,
  notCertified: 409,
  notSent: 409,
  alreadySent: 409,
  noEmail: 422,
  // Our contract (B6-d-iii-b): no link where GC jobs show; the send's file is not the bytes it hashed; a newer send went;
  // they signed it already.
  noPortal: 422,
  fileChanged: 409,
  notNewest: 409,
  alreadySigned: 409,
  // The stored file is over what one email carries (Resend takes about 40 MB a message): their portal has it.
  tooLarge: 413,
  sendFailed: 502,
  failed: 500,
} as const
export type CustomerEmailErrorKey = keyof typeof CUSTOMER_EMAIL_ERRORS

export interface GcCustomerEmailRequest {
  projectId: string
  kind: GcCustomerEmailKind
  /** The row the email is about: a pay application or a change order, by `GC_CUSTOMER_EMAIL_SOURCE`. */
  sourceId: string
  subject: string
  /** The email, one paragraph a line, the greeting first. */
  lines: string[]
  /** The pay application's form, made in the window (`payAppPdf`). Never with our contract: the function attaches its file. */
  pdf: { filename: string; base64: string } | null
  /**
   * A test copy: built as the real email would be, to the caller's own address only, `[TEST]` before the subject, with no
   * copy to anyone, nothing filed and nothing written back. The caller's gate runs as for a real send.
   */
  test?: boolean
}

/** A test copy's email type on `email_send_log`, so no reader counts it as a send. */
export const GC_CUSTOMER_EMAIL_TEST_TYPE = 'gc_customer_email_test'

/** The email type every kind logs on `email_send_log` when it goes for real. */
export const GC_CUSTOMER_EMAIL_TYPE = 'gc_customer_email'

/** One `email_send_log` row, as the double-send guard reads it. */
export interface GcCustomerEmailLogRow {
  id: string
  email_type: string | null
  to_emails: readonly string[] | null
  subject: string | null
  created_at: string
}

/**
 * The double-send guard (gc 4's note 3 on the schedule's PR 15): a row kind (a reminder, a weekly report, the
 * customer's schedule) whose send went through Resend but whose `email_send_log_id` write-back failed still reads
 * unsent, so a second press would email them twice. Before it sends, the function looks for that send in the log:
 * the live type (never a test's), the address it is about to send to, the row's own subject, logged no earlier than
 * the row was made. The log row's id when one is there, else null. Only the case where the log failed too is left.
 */
export function gcCustomerEmailLoggedAlready(
  logs: readonly GcCustomerEmailLogRow[],
  sending: { address: string; subject: string; since: string },
): string | null {
  const address = sending.address.trim().toLowerCase()
  const subject = sending.subject.trim()
  const since = Date.parse(sending.since)
  if (!address || !subject || Number.isNaN(since)) return null
  const hit = logs.find(
    (l) =>
      l.email_type === GC_CUSTOMER_EMAIL_TYPE &&
      (l.subject ?? '').trim() === subject &&
      (l.to_emails ?? []).some((t) => t.trim().toLowerCase() === address) &&
      Date.parse(l.created_at) >= since,
  )
  return hit ? hit.id : null
}

/** A test copy's subject. */
export function gcCustomerEmailTestSubject(subject: string): string {
  return `[TEST] ${subject.trim()}`
}

/**
 * Who is copied: the architect, on a weekly report whose row says so, at their address. Never on a test copy, never with
 * no address, and never twice to the address it already goes to.
 */
export function gcCustomerEmailCc(input: { copyArchitect: boolean; test: boolean; architectAddress: string; address: string }): string[] {
  const cc = input.architectAddress.trim()
  if (!input.copyArchitect || input.test || !cc || cc.toLowerCase() === input.address.trim().toLowerCase()) return []
  return [cc]
}

/** A weekly report's body as the email's paragraphs: split on blank lines, each kept with its own line breaks. */
export function gcWeeklyReportLines(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((para) => para.trim())
    .filter(Boolean)
}

/**
 * The lines a request may carry: 30, and 80 for the customer's schedule, a line a stage and a date to meet. The function
 * sends that kind's row, never the request's lines, but the request is checked first.
 */
export function gcCustomerEmailMaxLines(kind: GcCustomerEmailKind): number {
  return kind === 'schedule' || kind === 'interest_bill' ? 80 : 30
}

/**
 * A table inside the lines (v2.6158, punch list #217 outside-5): a line that starts with `| ` is a row of cells split
 * on ` | `, and one that starts with `|= ` is the sum row, drawn under a rule with its empty cells folded into the
 * label. A run of them is one table, its first row the head. The lines stay plain strings, so a reminder's row keeps
 * them as it keeps every other line, and a text-only reader sees the cells joined by dots.
 */
export const GC_EMAIL_TABLE_MARK = '|'
export const GC_EMAIL_TABLE_SUM_MARK = '|='

/** The lines of one table: the head, each row, and the sum row when there is one. A cell never carries a bar. */
export function gcEmailTableLines(head: readonly string[], rows: readonly (readonly string[])[], sum?: readonly string[]): string[] {
  const line = (cells: readonly string[], mark: string) => `${mark} ${cells.map((c) => c.replace(/\|/g, '/').trim()).join(' | ')} |`
  return [line(head, GC_EMAIL_TABLE_MARK), ...rows.map((r) => line(r, GC_EMAIL_TABLE_MARK)), ...(sum ? [line(sum, GC_EMAIL_TABLE_SUM_MARK)] : [])]
}

/** A line read back as a table row, or null for a paragraph. */
export function gcEmailTableRow(line: string): { cells: string[]; sum: boolean } | null {
  const sum = line.startsWith(`${GC_EMAIL_TABLE_SUM_MARK} `)
  if (!sum && !line.startsWith(`${GC_EMAIL_TABLE_MARK} `)) return null
  const body = line.slice(sum ? GC_EMAIL_TABLE_SUM_MARK.length : GC_EMAIL_TABLE_MARK.length).replace(/\s*\|\s*$/, '')
  return { cells: body.split('|').map((c) => c.trim()), sum }
}

/** A cell that reads as a figure: a dollar amount, a count, a minus. The column lines up on the right. */
export function gcEmailCellIsFigure(cell: string): boolean {
  return /^[−-]?\$|^\d/.test(cell)
}

/** A table's rows as a text-only reader sees them: the cells that say something, joined by dots. */
export function gcEmailTableText(rows: readonly { cells: string[]; sum: boolean }[]): string[] {
  return rows.map((r) => r.cells.filter((c) => c !== '').join(' · '))
}

type GcEmailBlock = { kind: 'p'; text: string } | { kind: 'table'; rows: { cells: string[]; sum: boolean }[] }

/** The lines as paragraphs and tables, a run of table lines one table. */
export function gcEmailBlocks(lines: readonly string[]): GcEmailBlock[] {
  const out: GcEmailBlock[] = []
  for (const l of lines) {
    const row = gcEmailTableRow(l)
    if (!row) {
      out.push({ kind: 'p', text: l })
      continue
    }
    const last = out[out.length - 1]
    if (last && last.kind === 'table') last.rows.push(row)
    else out.push({ kind: 'table', rows: [row] })
  }
  return out
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** What a request may carry, checked before anything is read. */
export function parseCustomerEmail(body: unknown): { ok: true; req: GcCustomerEmailRequest } | { ok: false } {
  if (!body || typeof body !== 'object') return { ok: false }
  const b = body as Record<string, unknown>
  const kind = b.kind
  if (typeof kind !== 'string' || !(GC_CUSTOMER_EMAIL_KINDS as readonly string[]).includes(kind)) return { ok: false }
  const projectId = typeof b.projectId === 'string' ? b.projectId : ''
  const sourceId = typeof b.sourceId === 'string' ? b.sourceId : ''
  if (!UUID.test(projectId) || !UUID.test(sourceId)) return { ok: false }
  const subject = typeof b.subject === 'string' ? b.subject.trim() : ''
  if (!subject || subject.length > 200) return { ok: false }
  if (!Array.isArray(b.lines) || b.lines.length === 0 || b.lines.length > gcCustomerEmailMaxLines(kind as GcCustomerEmailKind)) return { ok: false }
  const lines = b.lines.map((l) => (typeof l === 'string' ? l.trim() : ''))
  if (lines.some((l) => l === '' || l.length > 2000)) return { ok: false }
  let pdf: GcCustomerEmailRequest['pdf'] = null
  if (b.pdf != null) {
    const p = b.pdf as Record<string, unknown>
    const filename = typeof p.filename === 'string' ? p.filename.trim() : ''
    const base64 = typeof p.base64 === 'string' ? p.base64.replace(/\s+/g, '') : ''
    if (!/^[\w.() -]{1,120}\.pdf$/i.test(filename)) return { ok: false }
    if (!base64 || base64.length > GC_CUSTOMER_EMAIL_MAX_PDF_BASE64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return { ok: false }
    pdf = { filename, base64 }
  }
  // Our contract goes with the send's own file, read and checked by the function, never one the window sends.
  if (kind === 'contract' && pdf) return { ok: false }
  return { ok: true, req: { projectId, kind: kind as GcCustomerEmailKind, sourceId, subject, lines, pdf, ...(b.test === true ? { test: true } : {}) } }
}

const INK = '#16283c'
const PAPER = '#f6f3ec'
const MUTED = '#5a6b7e'
const HAIR = '#ddd6c8'
const FONT = `-apple-system, 'Segoe UI', Roboto, sans-serif`
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface GcCustomerEmailInput {
  subject: string
  /** One paragraph a line, the greeting first. */
  lines: string[]
  /** Who signs it: the project manager, else who sent it. */
  signer: string
  /** Our name: `GC_CUSTOMER_EMAIL_FROM_NAME`. */
  gc: string
  /**
   * With our closing lines after the window's (`GC_CUSTOMER_EMAIL_FRAMED`). False: the lines carry their own greeting and
   * sign-off, each kept with its line breaks. Unset: framed.
   */
  framed?: boolean
  /** The customer's portal, for the kinds that link it (`GC_CUSTOMER_EMAIL_PORTAL_LINE`). Null: no line. */
  portalUrl?: string | null
  /** The portal line's words. Unset: a bill's (`GC_CUSTOMER_EMAIL_PORTAL_WORDS`). */
  portalWords?: string
  /**
   * The bill's card fee when their portal offers Pay by card (O8c: the switch on, the bill certified, not on Stripe
   * and nothing paid). With a portal link, the portal line says they may pay by card there, and the fee follows.
   */
  cardFee?: number | null
}

/** The portal line when the portal offers Pay by card (O8c). */
export const GC_CUSTOMER_EMAIL_CARD_PORTAL_WORDS = 'Or pay it by card in your portal:'

/** "Paying by card adds a 3% card fee of $8,666.37." */
export function gcCustomerEmailCardFeeLine(fee: number): string {
  return `Paying by card adds a 3% card fee of $${fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
}

/**
 * A table in the email, in the GC statement email's layout: a head over a two-point rule, a hairline under each row,
 * figures on the right, and the sum row bold under a rule with its empty cells folded into its label.
 */
function gcEmailTableHtml(rows: readonly { cells: string[]; sum: boolean }[]): string {
  const [head, ...body] = rows
  if (!head) return ''
  const figures = head.cells.map((_, i) => body.filter((r) => !r.sum).some((r) => (r.cells[i] ?? '') !== '') && body.filter((r) => !r.sum).every((r) => (r.cells[i] ?? '') === '' || gcEmailCellIsFigure(r.cells[i] ?? '')))
  const align = (i: number) => (figures[i] ? 'right' : 'left')
  const th = head.cells.map((c, i) => `<th style="padding:6px;border-bottom:2px solid ${INK};font-size:12px;color:${MUTED};font-weight:600;text-align:${align(i)}">${esc(c)}</th>`).join('')
  const tr = body
    .map((r) => {
      if (r.sum) {
        const kept = r.cells.map((c, i) => ({ c, i })).filter(({ c, i }) => i === 0 || c !== '')
        const span = (k: number) => (k + 1 < kept.length ? (kept[k + 1]?.i ?? r.cells.length) - (kept[k]?.i ?? 0) : r.cells.length - (kept[k]?.i ?? 0))
        return `<tr>${kept.map(({ c, i }, k) => `<td colspan="${span(k)}" style="padding:9px 6px;border-top:2px solid ${INK};font-size:14px;font-weight:bold;text-align:${i === 0 ? 'left' : align(i)}">${esc(c)}</td>`).join('')}</tr>`
      }
      return `<tr>${r.cells.map((c, i) => `<td style="padding:7px 6px;border-bottom:1px solid ${HAIR};font-size:13px;vertical-align:top;text-align:${align(i)}${figures[i] ? ';white-space:nowrap' : ''}">${esc(c)}</td>`).join('')}</tr>`
    })
    .join('')
  return `<table style="width:100%;border-collapse:collapse;margin:0 0 12px"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`
}

/**
 * The email a GC customer or its architect reads: our name on top, the window's lines, the portal line when there is
 * one, then who it is from.
 */
export function buildGcCustomerEmail(input: GcCustomerEmailInput): { subject: string; text: string; html: string } {
  const subject = input.subject.trim()
  const portal = /^https:\/\/\S+$/.test((input.portalUrl ?? '').trim()) ? input.portalUrl!.trim() : null
  const shown = portal ? portal.replace(/^https:\/\//, '').replace(/\/$/, '') : ''
  // A card offer goes only with a bill's portal line, never under other words (our contract is not a bill).
  const fee = portal && input.portalWords === undefined && typeof input.cardFee === 'number' && input.cardFee > 0 ? input.cardFee : null
  const words = fee !== null ? GC_CUSTOMER_EMAIL_CARD_PORTAL_WORDS : (input.portalWords ?? GC_CUSTOMER_EMAIL_PORTAL_WORDS)
  const feeLine = fee !== null ? gcCustomerEmailCardFeeLine(fee) : null
  const framed = input.framed !== false
  const blocks = gcEmailBlocks(input.lines)
  const text = [
    ...blocks.flatMap((b) => (b.kind === 'p' ? [b.text, ''] : [...gcEmailTableText(b.rows), ''])),
    ...(portal ? [`${words} ${portal}`, ''] : []),
    ...(feeLine ? [feeLine, ''] : []),
    ...(framed ? ['Thank you,', input.signer, input.gc] : []),
  ]
    .join('\n')
    .replace(/\n+$/, '')
  // Unframed lines keep their own breaks (a section's title and its list); each is escaped before the break goes in.
  const p = (s: string) => `<p style="margin:0 0 12px">${framed ? esc(s) : esc(s).replace(/\n/g, '<br>')}</p>`
  const portalP = portal
    ? `<p style="margin:0 0 12px">${esc(words)} <a href="${esc(portal)}" style="color:${INK}">${esc(shown)}</a></p>` + (feeLine ? p(feeLine) : '')
    : ''
  const html =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#ffffff">` +
    `<div style="max-width:560px;margin:0 auto;padding:16px;font-family:${FONT}">` +
    `<div style="background:${PAPER};color:${INK};border:1px solid ${INK};border-radius:10px;overflow:hidden">` +
    `<div style="background:${INK};color:${PAPER};padding:10px 16px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase">${esc(input.gc)}</div>` +
    `<div style="padding:16px;font-size:15px;line-height:1.5">` +
    blocks.map((b) => (b.kind === 'p' ? p(b.text) : gcEmailTableHtml(b.rows))).join('') +
    portalP +
    (framed ? `<p style="margin:0;padding-top:10px;border-top:1px solid ${HAIR};color:${MUTED};font-size:13px">Thank you,<br>${esc(input.signer)}<br>${esc(input.gc)}</p>` : '') +
    `</div></div></div></body></html>`
  return { subject, text, html }
}
