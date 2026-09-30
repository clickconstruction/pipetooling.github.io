/**
 * The GC's statement, one property at a time (v2.4255).
 *
 * The statement used to be one flat table sorted by address: a property with
 * seven open bills printed its address seven times, one property typed four
 * ways read as four places, and nothing said what a property owed. This is the
 * statement regrouped: the total first, one block per property with its own
 * subtotal, one line per bill, and under a bill the payment recorded against it.
 *
 * One module for every lane — Draft Message, Preview, Copy for email (the
 * client, through `src/lib/jobsDocuments/gcStatementEmail.ts`) and the
 * scheduled dispatcher (`gc-statement-email-dispatch/render.ts`). Each lane
 * maps its own rows to `StatementBillIn`; the grouping, the words and the HTML
 * are written once here, so the lanes cannot drift.
 *
 * What counts as one property: jobs linked to the same property record
 * (`jobs_ledger.customer_address_id`), and jobs whose cleaned address matches
 * (`normalizeAddressKey` — the portal's rule). A job with no address stands alone.
 *
 * Money: `owed` is the row's amount as the board and GC Review count it, and
 * the payment line under a bill names only the payments recorded against THAT
 * bill — so paid and owed on one line always add up to the bill. Money on the
 * job that no bill carries is not worded here; the office is told before it
 * sends (`gcStatementUnmatchedPayments`, client).
 *
 * Pure, no Deno: tested from `src/lib/jobsDocuments/gcStatementByProperty.test.ts`.
 */
import { joinList, formatYmdLong, formatYmdShort, money, paymentLabelWords, type PaidByPayment } from './billPaidBy.ts'
import type { GcCheck } from './gcChecksApplied.ts'
import { portalAccountCardHtml } from './portalAccountCard.ts'
import { normalizeAddressKey, splitAddress } from './portalProperties.ts'

export const GC_STATEMENT_COMPANY_NAME = 'Click Plumbing and Electrical'
export const GC_STATEMENT_FOOTER_LINE = 'Questions about a bill? Reply to this email or call the office.'
/** Attribution tag on the pay link (journey-map #46 telemetry): lets the portal's view counter tell a statement click from any other open. */
export const GC_STATEMENT_PAY_LINK_SRC = 'gc-statement'
/** The sentence on the account card: the statement's card is also how the GC pays. */
export const GC_STATEMENT_CARD_BLURB = 'Pay online and see every open bill and payment, with no login.'

const INK = '#16283c'
const CREAM = '#f6f3ec'
const MUTED = '#5b6676'
const RULE = '#e4dfd3'
const PAID = '#1a6b43'

export const escapeHtml = (s: string): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Footer line (v2.2133): names the office number from Settings → Company → invoice issuer; the bare line without one. */
export function gcStatementFooterLine(officePhone?: string | null): string {
  const phone = (officePhone ?? '').trim()
  return phone ? `Questions about a bill? Reply to this email or call the office at ${phone}.` : GC_STATEMENT_FOOTER_LINE
}

/** `tel:` target for the office number — US 10/11-digit → +1…, else +digits; null when no digits. */
export function officePhoneTelHref(officePhone?: string | null): string | null {
  const d = (officePhone ?? '').replace(/\D/g, '')
  if (!d) return null
  if (d.length === 10) return `tel:+1${d}`
  if (d.length === 11 && d.startsWith('1')) return `tel:+${d}`
  return `tel:+${d}`
}

/** HTML footer (v2.2158): the footer sentence with the office number as a tap-to-call link. */
export function gcStatementFooterHtml(officePhone?: string | null): string {
  const phone = (officePhone ?? '').trim()
  const tel = officePhoneTelHref(phone)
  if (!phone || !tel) return escapeHtml(GC_STATEMENT_FOOTER_LINE)
  return `Questions about a bill? Reply to this email or call the office at <a href="${escapeHtml(tel)}" style="color:#6b7280;font-weight:bold;text-decoration:none;white-space:nowrap">${escapeHtml(phone)}</a>.`
}

/** Intro paragraph (journey-map #46): the dev-saved template body, escaped, newlines as <br>. '' when blank. */
export function gcStatementIntroHtml(introText: string | null | undefined): string {
  const text = (introText ?? '').trim()
  if (!text) return ''
  return `<p style="margin:0 0 12px;font-size:14px;color:#111827;line-height:1.45">${escapeHtml(text).replace(/\n/g, '<br>')}</p>
  `
}

/** The portal URL with the statement's `src` tag appended; null without a portal. */
export function gcStatementPayUrl(portalUrl: string | null | undefined): string | null {
  const url = (portalUrl ?? '').trim()
  if (!url) return null
  return `${url}${url.includes('?') ? '&' : '?'}src=${GC_STATEMENT_PAY_LINK_SRC}`
}

/** The plain-text pay line. */
export function gcStatementPayLineText(portalUrl: string | null | undefined): string | null {
  const href = gcStatementPayUrl(portalUrl)
  return href ? `Pay online any time at ${href} — this statement stays current there.` : null
}

/** One open row of the statement, as either lane knows it. */
export type StatementBillIn = {
  /** Stable row key: the bill's id, or the job's for a balance with no bill behind it. */
  key: string
  jobId: string
  jobNumber?: string | null
  jobName?: string | null
  jobAddress?: string | null
  customerName?: string | null
  /** The job's property record, when it is linked to one. */
  propertyId?: string | null
  /** The day the bill was sent (YYYY-MM-DD); null when unknown. */
  sentYmd?: string | null
  /** True when `sentYmd` is the estimated bill date, not the day it was sent. */
  sentIsEstimate?: boolean
  /** The bill's amount; null for a job balance with no bill behind it (then it is what is owed plus what was paid). */
  billed?: number | null
  /** What is still owed on this row — the board's figure. */
  owed: number
  /** Payments recorded against this bill; for a job balance, every payment on the job. */
  payments?: readonly PaidByPayment[] | null
  /** The job's recorded retainage; when what is left is within it, the line says so. */
  retainageHeld?: number | string | null
}

export type StatementBillLine = {
  key: string
  jobId: string
  /** "Job 868", or '' when the job has no number. */
  job: string
  /** The job's name when it says something the reader does not already know; '' otherwise. */
  name: string
  /** "Aug 18" · "Mar 16, 2025" (another year) · "Aug 2 (est.)" · "—". */
  sent: string
  billed: number
  paid: number
  owed: number
  /** "$5,000.00 paid by #4417 on Sep 8, of $14,800.00 billed"; '' when nothing is paid. */
  paidWords: string
}

export type StatementProperty = {
  key: string
  /** The street, or the job's name for a job with no address. */
  street: string
  city: string | null
  hasAddress: boolean
  bills: StatementBillLine[]
  owed: number
}

export type StatementModel = {
  properties: StatementProperty[]
  billCount: number
  billed: number
  paid: number
  owed: number
  /** "19 open bills at 6 properties. $103,701.00 billed, $22,600.00 paid so far." — '' with no rows. */
  summary: string
}

const round2 = (n: number): number => Math.round(n * 100) / 100
const num = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
const ymdOf = (v: string | null | undefined): string | null => {
  const s = (v ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}
/** Lower-case words only — how two names or two streets are compared. */
const words = (s: string | null | undefined): string => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** The statement's year, read off its date line ("Sep 30, 2026"); null when the line carries none. */
export function statementYearOf(dateStr: string): number | null {
  const m = /(\d{4})\s*$/.exec(dateStr ?? '')
  return m ? Number(m[1]) : null
}

/** The day a bill was sent: short inside the statement's own year, with the year otherwise. */
export function statementSentWords(sentYmd: string | null | undefined, isEstimate: boolean | undefined, statementYear: number | null): string {
  const ymd = ymdOf(sentYmd)
  if (!ymd) return '—'
  const day = statementYear != null && Number(ymd.slice(0, 4)) === statementYear ? formatYmdShort(ymd) : formatYmdLong(ymd)
  return isEstimate ? `${day} (est.)` : day
}

/**
 * The job's name as the GC needs it. A name that repeats the address the block
 * is already headed by ("Service Visit — 628 Terrell Rd (HCP 867)") loses the
 * repeat; a name that is only the GC's or the customer's own name says nothing
 * and is dropped.
 */
export function statementJobName(name: string | null | undefined, ctx: { streets: readonly string[]; knownNames: ReadonlyArray<string | null | undefined> }): string {
  let n = (name ?? '').trim().replace(/\s*\(HCP\s*#?\s*\d+\)\s*$/i, '').trim()
  if (!n) return ''
  const streets = ctx.streets.map(words).filter(Boolean)
  const isStreet = (w: string): boolean => /^\d/.test(w) && streets.some((s) => s.startsWith(w) || w.startsWith(s))
  for (;;) {
    const m = /^(.*\S)\s+[—–-]\s+(\S.*)$/.exec(n)
    if (!m || !isStreet(words(m[2]))) break
    n = (m[1] ?? '').trim()
  }
  const w = words(n)
  if (!w || isStreet(w)) return ''
  for (const other of ctx.knownNames) {
    const o = words(other)
    if (o && (o === w || ` ${o} `.includes(` ${w} `))) return ''
  }
  return n
}

/** What is paid on a row and how the line under it reads. */
function paidOn(bill: StatementBillIn): { billed: number; paid: number; owed: number; paidWords: string } {
  const owed = round2(Math.max(0, num(bill.owed)))
  const payments = bill.payments ?? []
  const rowsTotal = round2(payments.reduce((s, p) => s + num(p.amount), 0))
  const billed = round2(bill.billed == null ? owed + Math.max(0, rowsTotal) : Math.max(num(bill.billed), owed))
  const paid = round2(billed - owed)
  if (paid <= 0.005) return { billed, paid: 0, owed, paidWords: '' }
  const dated = [...payments].sort((a, b) => (ymdOf(a.paid_on) ?? '9999').localeCompare(ymdOf(b.paid_on) ?? '9999'))
  const labels = [...new Set(dated.map(paymentLabelWords))]
  // The rows must account for what is paid, or the line names no payment — the arithmetic on the page never lies.
  const by = labels.length > 0 && Math.abs(rowsTotal - paid) <= 0.005 ? ` paid by ${joinList(labels)}` : ' paid so far'
  const held = round2(Math.max(0, num(bill.retainageHeld)))
  const retainage = owed > 0.005 && held > 0 && owed <= held + 0.005 ? ' · what is left is the retainage you hold' : ''
  return { billed, paid, owed, paidWords: `${money(paid)}${by}, of ${money(billed)} billed${retainage}` }
}

/** Which rows stand on one property: the same property record, or the same cleaned address. */
function propertyRoots(bills: readonly StatementBillIn[]): string[] {
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    let r = k
    while ((parent.get(r) ?? r) !== r) r = parent.get(r) as string
    parent.set(k, r)
    return r
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(rb, ra)
  }
  const keys = bills.map((b) => {
    const address = (b.jobAddress ?? '').trim()
    const addressKey = address ? `a:${normalizeAddressKey(address)}` : null
    const propertyKey = (b.propertyId ?? '').trim() ? `p:${(b.propertyId as string).trim()}` : null
    if (propertyKey && addressKey) union(propertyKey, addressKey)
    return propertyKey ?? addressKey ?? `j:${b.jobId}`
  })
  return keys.map(find)
}

const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

export function buildStatementModel(bills: readonly StatementBillIn[], opts: { payerName: string; statementYear: number | null }): StatementModel {
  const roots = propertyRoots(bills)
  const byRoot = new Map<string, StatementBillIn[]>()
  bills.forEach((b, i) => {
    const root = roots[i] as string
    const held = byRoot.get(root)
    if (held) held.push(b)
    else byRoot.set(root, [b])
  })

  const properties: StatementProperty[] = []
  for (const [key, group] of byRoot) {
    // The heading: the spelling that names a city, the most used one among those, the first seen on a tie.
    const spellings = new Map<string, { street: string; city: string | null; count: number; order: number }>()
    group.forEach((b, i) => {
      const address = (b.jobAddress ?? '').replace(/\s+/g, ' ').trim()
      if (!address) return
      const { street, city } = splitAddress(address)
      const id = `${street}|${city ?? ''}`
      const held = spellings.get(id)
      if (held) held.count++
      else spellings.set(id, { street, city, count: 1, order: i })
    })
    const heading = [...spellings.values()].sort((a, b) => Number(!!b.city) - Number(!!a.city) || b.count - a.count || a.order - b.order)[0]
    const hasAddress = !!heading
    const nameHeading = (group.find((b) => (b.jobName ?? '').trim())?.jobName ?? '').trim()
    const street = heading ? heading.street : nameHeading || 'No address on file'
    const streets = [...spellings.values()].map((s) => s.street)

    const lines = group
      .map((b) => {
        const amounts = paidOn(b)
        const number = (b.jobNumber ?? '').trim()
        const name = hasAddress ? statementJobName(b.jobName, { streets, knownNames: [opts.payerName, b.customerName] }) : ''
        return {
          line: {
            key: b.key,
            jobId: b.jobId,
            job: number && number !== '—' ? `Job ${number}` : '',
            name,
            sent: statementSentWords(b.sentYmd, b.sentIsEstimate, opts.statementYear),
            ...amounts,
          } satisfies StatementBillLine,
          sentYmd: ymdOf(b.sentYmd) ?? '9999',
          number,
        }
      })
      // Oldest bill first; the larger balance, then the job number, settle a tie.
      .sort((a, b) => compareText(a.sentYmd, b.sentYmd) || b.line.owed - a.line.owed || compareText(a.number, b.number) || compareText(a.line.key, b.line.key))
      .map((x) => x.line)

    properties.push({
      key,
      street,
      city: heading?.city ?? null,
      hasAddress,
      bills: lines,
      owed: round2(lines.reduce((s, l) => s + l.owed, 0)),
    })
  }
  // Address A→Z, as the statement always read (v2.1434); a job with no address goes last.
  properties.sort(
    (a, b) =>
      Number(!a.hasAddress) - Number(!b.hasAddress) ||
      compareText(`${a.street} ${a.city ?? ''}`.toLowerCase(), `${b.street} ${b.city ?? ''}`.toLowerCase()) ||
      compareText(a.key, b.key),
  )

  const all = properties.flatMap((p) => p.bills)
  const billed = round2(all.reduce((s, l) => s + l.billed, 0))
  const owed = round2(all.reduce((s, l) => s + l.owed, 0))
  const paid = round2(billed - owed)
  const counts = all.length === 0 ? '' : `${plural(all.length, 'open bill', 'open bills')} at ${plural(properties.length, 'property', 'properties')}.`
  const summary = counts && paid > 0.005 ? `${counts} ${money(billed)} billed, ${money(paid)} paid so far.` : counts
  return { properties, billCount: all.length, billed, paid, owed, summary }
}

/** One payment the GC sent, for "Payments we have received" (v2.4260). */
export type StatementReceivedIn = {
  key: string
  /** The day it was received (YYYY-MM-DD); null when none was recorded. */
  onYmd: string | null
  /** "Check #4402" · "ACH" · "Bank deposit" · "Payment". */
  label: string
  amount: number
  /** Where it went, one entry per job: "1780 FM 1343 · Job 372", with ", now paid in full" when the job is. */
  where: string[]
}

/** How many days back the statement's payments list reaches. */
export const STATEMENT_RECEIVED_DAYS = 30

/**
 * The checks kernel's folded payments (`buildGcChecksReport(...).checks`, already
 * limited to the window) as the statement lists them — every check the GC sent,
 * newest first, each with the property and job it landed on. `jobs` gives each
 * job's address and number, since a check's lines carry only the job id.
 */
export function statementReceivedFromChecks(
  checks: readonly GcCheck[],
  jobs: ReadonlyMap<string, { address?: string | null; number?: string | null }>,
): StatementReceivedIn[] {
  return checks.map((c) => {
    const byJob = new Map<string, { paidInFull: boolean }>()
    for (const l of c.lines) {
      const held = byJob.get(l.jobId)
      byJob.set(l.jobId, { paidInFull: (held?.paidInFull ?? true) && l.jobPaidInFull })
    }
    const where = [...byJob].map(([jobId, { paidInFull }]) => {
      const job = jobs.get(jobId)
      const address = (job?.address ?? '').replace(/\s+/g, ' ').trim()
      const street = address ? splitAddress(address).street : ''
      const number = (job?.number ?? '').trim()
      const place = [street, number ? `Job ${number}` : ''].filter(Boolean).join(' · ') || 'a job'
      return paidInFull ? `${place}, now paid in full` : place
    })
    return {
      key: c.key,
      onYmd: c.receivedYmd,
      label: c.kind === 'check' && c.number ? `Check ${c.label}` : c.label,
      amount: c.amount,
      where,
    }
  })
}

export type StatementRenderInput = {
  /** Who the statement is for — the GC, or the development. */
  payerName: string
  /** "Sep 30, 2026". */
  dateStr: string
  bills: readonly StatementBillIn[]
  officePhone?: string | null
  /** The GC's portal; omit/null for no account card and no pay line. */
  portalUrl?: string | null
  /** What the QR code's `<img>` loads — `cid:portal-qr` in a real send, a data URL in a preview; null draws the card without a code. */
  qrImgSrc?: string | null
  /** The editable intro above the statement. */
  introText?: string | null
  /**
   * "Payments we have received" (v2.4260): the GC's payments since `receivedSinceYmd`,
   * newest first. Omit/undefined for no block (a development statement, or a lane
   * that could not read them); an empty list prints the block saying none came.
   */
  received?: readonly StatementReceivedIn[] | null
  receivedSinceYmd?: string | null
}

/** The sentence under the block's heading. */
export function statementReceivedIntro(sinceYmd: string | null | undefined, count: number): string {
  const since = ymdOf(sinceYmd)
  const window = since ? `since ${formatYmdLong(since)}` : 'on record'
  return count === 0
    ? `No payments received ${window}. If you sent one, reply and we will find it.`
    : `${count === 1 ? 'One payment' : `${count} payments`} ${window}, newest first. If one you sent is missing, reply and we will find it.`
}

const modelOf = (input: StatementRenderInput): StatementModel =>
  buildStatementModel(input.bills, { payerName: input.payerName, statementYear: statementYearOf(input.dateStr) })

/** The statement as an HTML fragment: tables and inline styles, so Gmail, Outlook and Apple Mail draw it alike. */
export function renderStatementByPropertyHtml(input: StatementRenderInput): string {
  const model = modelOf(input)
  const cell = `padding:7px 8px;border-bottom:1px solid ${RULE};font-size:14px;line-height:1.35`
  const head = (label: string, align: 'left' | 'right') =>
    `<th style="padding:0 8px 5px;font-size:11px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:${MUTED};text-align:${align}">${label}</th>`
  const blocks = model.properties
    .map((p) => {
      const under = [p.city ?? '', plural(p.bills.length, 'open bill', 'open bills')].filter(Boolean).join(' · ')
      const rows = p.bills
        .map((l) => {
          const label = l.job ? `${escapeHtml(l.job)}${l.name ? `<span style="color:${MUTED}"> · ${escapeHtml(l.name)}</span>` : ''}` : escapeHtml(l.name || (p.hasAddress ? 'Open bill' : 'Open balance'))
          return `<tr>
        <td style="${cell};color:${INK}">${label}${l.paidWords ? `<br /><span style="font-size:12.5px;color:${PAID}">${escapeHtml(l.paidWords)}</span>` : ''}</td>
        <td style="${cell};color:${MUTED};white-space:nowrap;vertical-align:top">${escapeHtml(l.sent)}</td>
        <td style="${cell};color:${INK};font-weight:600;text-align:right;white-space:nowrap;vertical-align:top">${money(l.owed)}</td>
      </tr>`
        })
        .join('')
      return `<tr>
        <td colspan="2" style="padding:8px;background:${CREAM};font-size:15px;color:${INK}"><strong>${escapeHtml(p.street)}</strong> <span style="font-size:12.5px;color:${MUTED}">${escapeHtml(under)}</span></td>
        <td style="padding:8px;background:${CREAM};font-size:15px;font-weight:700;color:${INK};text-align:right;white-space:nowrap;vertical-align:top">${money(p.owed)}</td>
      </tr>${rows}
      <tr><td colspan="3" style="height:12px;font-size:0;line-height:0">&nbsp;</td></tr>`
    })
    .join('')
  const card = portalAccountCardHtml(input.portalUrl, input.qrImgSrc, { href: gcStatementPayUrl(input.portalUrl), blurb: GC_STATEMENT_CARD_BLURB })
  return `<div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;color:${INK}">
  ${gcStatementIntroHtml(input.introText)}<div style="background:${INK};color:#ffffff;padding:14px 18px;border-radius:6px 6px 0 0">
    <div style="font-size:16px;font-weight:600">${escapeHtml(GC_STATEMENT_COMPANY_NAME)}</div>
    <div style="font-size:13px;color:#c9d2dd">Statement for ${escapeHtml(input.payerName)} · ${escapeHtml(input.dateStr)}</div>
  </div>
  <div style="padding:16px 0 0">
    <div style="padding:0 8px;font-size:13px;color:${MUTED}">Owed now</div>
    <div style="padding:0 8px;font-size:28px;font-weight:700;line-height:1.2;color:${INK}">${money(model.owed)}</div>${model.summary ? `
    <div style="padding:3px 8px 0;font-size:13px;color:${MUTED}">${escapeHtml(model.summary)}</div>` : ''}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;margin-top:18px">
      <tr>${head('Bill', 'left')}${head('Sent', 'left')}${head('Still owed', 'right')}</tr>
      ${blocks}
      <tr>
        <td colspan="2" style="padding:10px 8px 0;border-top:2px solid ${INK};font-size:16px;font-weight:700;color:${INK}">Total owed</td>
        <td style="padding:10px 8px 0;border-top:2px solid ${INK};font-size:16px;font-weight:700;color:${INK};text-align:right;white-space:nowrap">${money(model.owed)}</td>
      </tr>
    </table>${receivedHtml(input)}${card ? `
    <div style="padding-top:22px">${card}</div>` : ''}
    <p style="margin:${card ? '0' : '18px 0 0'};padding-top:12px;border-top:1px solid ${RULE};font-size:13px;color:#6b7280">${gcStatementFooterHtml(input.officePhone)}</p>
  </div>
</div>`
}

/** "Payments we have received" — '' when the lane brought none. */
function receivedHtml(input: StatementRenderInput): string {
  const rows = input.received
  if (rows == null) return ''
  const cell = `padding:6px 8px;border-bottom:1px solid ${RULE};font-size:13.5px;line-height:1.35;vertical-align:top`
  const lines = rows
    .map(
      (r) => `<tr>
        <td style="${cell};color:${MUTED};white-space:nowrap">${escapeHtml(r.onYmd ? formatYmdShort(r.onYmd) : '—')}</td>
        <td style="${cell};color:${INK}">${escapeHtml(r.label)}<span style="color:${MUTED}"> to ${escapeHtml(joinList(r.where))}</span></td>
        <td style="${cell};color:${PAID};font-weight:600;text-align:right;white-space:nowrap">${money(r.amount)}</td>
      </tr>`,
    )
    .join('')
  return `
    <div style="padding:22px 8px 0;font-size:15px;font-weight:600;color:${INK}">Payments we have received</div>
    <div style="padding:1px 8px 6px;font-size:12.5px;color:${MUTED}">${escapeHtml(statementReceivedIntro(input.receivedSinceYmd, rows.length))}</div>${
      lines ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse">${lines}
    </table>` : ''
    }`
}

/** The same statement for a text-only mail client. */
export function renderStatementByPropertyText(input: StatementRenderInput): string {
  const model = modelOf(input)
  const intro = (input.introText ?? '').trim()
  const blocks = model.properties.flatMap((p) => [
    `${[p.street, p.city ?? ''].filter(Boolean).join(', ')} — ${money(p.owed)}`,
    ...p.bills.map((l) => {
      const label = [l.job, l.name].filter(Boolean).join(' · ') || (p.hasAddress ? 'Open bill' : 'Open balance')
      return `- ${label} — sent ${l.sent} — ${money(l.owed)}${l.paidWords ? ` (${l.paidWords})` : ''}`
    }),
    '',
  ])
  const payLine = gcStatementPayLineText(input.portalUrl)
  return [
    ...(intro ? [intro, ''] : []),
    GC_STATEMENT_COMPANY_NAME,
    `Statement for ${input.payerName} · ${input.dateStr}`,
    '',
    `Owed now: ${money(model.owed)}`,
    ...(model.summary ? [model.summary] : []),
    '',
    ...blocks,
    `Total owed: ${money(model.owed)}`,
    '',
    ...(input.received != null
      ? [
          'Payments we have received',
          statementReceivedIntro(input.receivedSinceYmd, input.received.length),
          ...input.received.map((r) => `- ${r.onYmd ? formatYmdShort(r.onYmd) : '—'} — ${r.label} to ${joinList(r.where)} — ${money(r.amount)}`),
          '',
        ]
      : []),
    ...(payLine ? [payLine, ''] : []),
    gcStatementFooterLine(input.officePhone),
  ].join('\n')
}
