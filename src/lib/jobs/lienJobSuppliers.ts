/**
 * Supply houses on a lien job (v2.4404): what each house is paid and owed on one
 * job, whether it holds a job account there, and when its own § 53.056 notice
 * window closes — so the Lien desk can say, beside our claim, that a second
 * claim rides the same property.
 *
 * Pure. The money follows Materials → Held for suppliers (`jobAccountsFlow`):
 * allocated dollars = amount × pct / 100, a paid invoice is paid, an unpaid one
 * is owed, and an open credit memo (a negative amount) never joins an owed
 * figure. The house's notice date is OUR ESTIMATE: the desk's own rule
 * (`noticeDeadlineForMonth`) run on the months of the house's unpaid invoices.
 * The house keeps its own calendar.
 */

import { formatCurrency } from '../format'
import { formatYmdMonthDay } from './billedExpectedPay'
import { formatUsdNoCents } from './jobFormatting'
import { LIEN_DESK_LEAD_DAYS } from './lienDesk'
import { noticeDeadlineForMonth } from './lienDeadlines'
import { daysBetweenYmd } from './lienPayRunway'

const EPSILON = 0.005

export interface LienSupplierInvoiceInput {
  id: string
  supply_house_id: string
  amount: number | null
  is_paid: boolean
  /** The invoice's date — its month stands for the month the materials were furnished. */
  invoice_date: string | null
  /** The day the payment cleared, as a calendar day ('' / null when not paid or not dated). */
  paidYmd: string | null
  on_job_account: boolean
}

export interface LienSupplierAllocationInput {
  invoice_id: string
  job_id: string
  pct: number | null
}

/** The job's account at one house (`list_job_account_strip`), as far as this card reads it. */
export interface LienSupplierAccountInput {
  houseId: string
  state: 'open' | 'requested' | 'not_needed' | 'none'
  accountRef: string
  rep: { name: string; phone: string | null } | null
}

export interface LienSupplierHouse {
  houseId: string
  name: string
  invoiceCount: number
  unpaidCount: number
  paid: number
  owed: number
  /** The slice of `owed` on the house's job account. */
  owedOnJobAccount: number
  /** 'YYYY-MM' months of the unpaid invoices, oldest first, each once. */
  unpaidMonths: string[]
  firstPaidYmd: string | null
  account: LienSupplierAccountInput['state']
  accountRef: string
  rep: { name: string; phone: string | null } | null
}

export interface LienSupplierJob {
  jobId: string
  /** Owed desc, then paid desc. */
  houses: LienSupplierHouse[]
  paid: number
  owed: number
  owedOnJobAccount: number
  /** Houses with money still owed. */
  housesOwed: number
  /** The first day any house was paid on this job. */
  firstHousePaidYmd: string | null
  /** The first day the customer paid us on this job; null when nothing came in. */
  firstCustomerPaidYmd: string | null
}

export function buildLienSupplierJobs(input: {
  invoices: ReadonlyArray<LienSupplierInvoiceInput>
  allocations: ReadonlyArray<LienSupplierAllocationInput>
  houses: ReadonlyArray<{ id: string; name: string }>
  accountsByJob?: ReadonlyMap<string, ReadonlyArray<LienSupplierAccountInput>>
  firstCustomerPaidByJob?: ReadonlyMap<string, string>
}): Map<string, LienSupplierJob> {
  const invoiceById = new Map(input.invoices.map((inv) => [inv.id, inv]))
  const houseName = new Map(input.houses.map((h) => [h.id, h.name]))
  const byJob = new Map<string, Map<string, LienSupplierHouse>>()

  for (const alloc of input.allocations) {
    const inv = invoiceById.get(alloc.invoice_id)
    if (!inv) continue
    const allocated = (Number(inv.amount ?? 0) * Number(alloc.pct ?? 0)) / 100
    let housesOfJob = byJob.get(alloc.job_id)
    if (!housesOfJob) {
      housesOfJob = new Map()
      byJob.set(alloc.job_id, housesOfJob)
    }
    let house = housesOfJob.get(inv.supply_house_id)
    if (!house) {
      const account = (input.accountsByJob?.get(alloc.job_id) ?? []).find((a) => a.houseId === inv.supply_house_id)
      house = {
        houseId: inv.supply_house_id,
        name: (houseName.get(inv.supply_house_id) ?? '').trim() || 'Unknown supply house',
        invoiceCount: 0,
        unpaidCount: 0,
        paid: 0,
        owed: 0,
        owedOnJobAccount: 0,
        unpaidMonths: [],
        firstPaidYmd: null,
        account: account?.state ?? 'none',
        accountRef: account?.accountRef ?? '',
        rep: account?.rep ?? null,
      }
      housesOfJob.set(inv.supply_house_id, house)
    }
    house.invoiceCount++
    if (inv.is_paid) {
      house.paid += allocated
      const paidYmd = (inv.paidYmd ?? '').slice(0, 10)
      if (allocated > EPSILON && paidYmd && (!house.firstPaidYmd || paidYmd < house.firstPaidYmd)) house.firstPaidYmd = paidYmd
    } else if (allocated > 0) {
      house.owed += allocated
      if (inv.on_job_account) house.owedOnJobAccount += allocated
      house.unpaidCount++
      const month = (inv.invoice_date ?? '').slice(0, 7)
      if (/^\d{4}-\d{2}$/.test(month) && !house.unpaidMonths.includes(month)) house.unpaidMonths.push(month)
    }
  }

  const out = new Map<string, LienSupplierJob>()
  for (const [jobId, housesOfJob] of byJob) {
    const houses = [...housesOfJob.values()]
      .map((h) => ({ ...h, unpaidMonths: [...h.unpaidMonths].sort() }))
      .sort((a, b) => b.owed - a.owed || b.paid - a.paid || a.name.localeCompare(b.name))
    const paidDays = houses.map((h) => h.firstPaidYmd).filter((d): d is string => Boolean(d)).sort()
    out.set(jobId, {
      jobId,
      houses,
      paid: houses.reduce((s, h) => s + h.paid, 0),
      owed: houses.reduce((s, h) => s + h.owed, 0),
      owedOnJobAccount: houses.reduce((s, h) => s + h.owedOnJobAccount, 0),
      housesOwed: houses.filter((h) => h.owed > EPSILON).length,
      firstHousePaidYmd: paidDays[0] ?? null,
      firstCustomerPaidYmd: input.firstCustomerPaidByJob?.get(jobId) ?? null,
    })
  }
  return out
}

function housesWord(n: number): string {
  return `${n} ${n === 1 ? 'house' : 'houses'}`
}

function usd(n: number): string {
  return `$${formatCurrency(n)}`
}

// ---------- the mark on a row ----------

export interface LienSupplierMark {
  /** "3 houses owed $13,058" */
  words: string
  /** The short form a phone row has room for: "$13,058". */
  short: string
  /** Each owed house and its money, for the hover. */
  title: string
  /** A house that is owed holds a job account for this job — the storefront turns teal, as in the job window. */
  jobAccount: boolean
  owed: number
}

/** A row is marked only while a house is still owed on the job; a paid-up job stays plain. */
export function lienSupplierMark(job: LienSupplierJob | null | undefined): LienSupplierMark | null {
  if (!job || job.owed <= EPSILON) return null
  const owedHouses = job.houses.filter((h) => h.owed > EPSILON)
  const jobAccount = owedHouses.some((h) => h.account === 'open' || h.owedOnJobAccount > EPSILON)
  return {
    words: `${housesWord(owedHouses.length)} owed ${formatUsdNoCents(job.owed)}${jobAccount ? ' · job account' : ''}`,
    short: formatUsdNoCents(job.owed),
    title: `Still owed to supply houses on this job: ${owedHouses.map((h) => `${h.name} ${formatUsdNoCents(h.owed)}`).join(', ')}.${jobAccount ? ' A job account is open.' : ''}`,
    jobAccount,
    owed: job.owed,
  }
}

// ---------- the card on a job ----------

export type LienSupplierNotice =
  /** The house's next open window. */
  | { kind: 'open'; ymd: string; daysLeft: number; soon: boolean }
  /** Every unpaid month's window has closed; `ymd` is the last one to close. */
  | { kind: 'closed'; ymd: string }
  /** Nothing unpaid, or no invoice date to count from. */
  | { kind: 'none' }

export interface LienSupplierCardRow {
  houseId: string
  name: string
  /** "job account open · F-20417" / "job account requested" / "no job account" */
  accountWords: string
  accountOpen: boolean
  /** "rep Dana Ortiz" or '' */
  repWords: string
  /** "July materials" — the oldest unpaid month; '' when nothing is owed. */
  unpaidSince: string
  /** "9 unpaid of 14 invoices" / "14 invoices, all paid" */
  invoiceWords: string
  notice: LienSupplierNotice
  paid: number
  owed: number
  owedOnJobAccount: number
}

export interface LienSupplierCard {
  rows: LienSupplierCardRow[]
  paid: number
  owed: number
  /** "3 houses" */
  housesWord: string
  /** One bold line joining the two debts; null when it would add nothing. */
  verdict: string | null
  /** "We paid a house first on Jul 9. Alder's first payment to us came on Sep 2." — null unless we paid first. */
  paidFirst: string | null
  /** The folded line when every house is paid: "2 houses, all paid · $4,210.00". */
  paidLine: string
}

function monthName(key: string): string {
  return new Date(`${key}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
}

function longDay(ymd: string): string {
  return new Date(`${ymd.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
}

function longDayYear(ymd: string): string {
  return new Date(`${ymd.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/** The house's own notice window from its unpaid months, by the desk's rule for the property's kind. */
export function lienSupplierNotice(unpaidMonths: ReadonlyArray<string>, propertyKind: string, todayYmd: string): LienSupplierNotice {
  const deadlines = unpaidMonths
    .map((m) => noticeDeadlineForMonth(`${m}-01`, propertyKind))
    .filter(Boolean)
    .sort()
  if (deadlines.length === 0) return { kind: 'none' }
  const open = deadlines.find((d) => d >= todayYmd)
  if (!open) return { kind: 'closed', ymd: deadlines[deadlines.length - 1]! }
  const daysLeft = daysBetweenYmd(todayYmd, open) ?? 0
  return { kind: 'open', ymd: open, daysLeft, soon: daysLeft <= LIEN_DESK_LEAD_DAYS }
}

function accountWords(h: LienSupplierHouse): string {
  if (h.account === 'open') return `job account open${h.accountRef ? ` · ${h.accountRef}` : ''}`
  if (h.account === 'requested') return 'job account requested'
  return 'no job account'
}

export function buildLienSupplierCard(
  job: LienSupplierJob,
  ctx: {
    /** '' | 'residential' | 'non_residential' from the property record. */
    propertyKind: string
    todayYmd: string
    /** What the payer still owes us on this job. */
    openBalance: number
    /** Who pays us — the GC, else the customer; '' reads "the customer". */
    payerName: string
  },
): LienSupplierCard {
  const payer = ctx.payerName.trim() || 'the customer'
  const rows: LienSupplierCardRow[] = job.houses.map((h) => ({
    houseId: h.houseId,
    name: h.name,
    accountWords: accountWords(h),
    accountOpen: h.account === 'open',
    repWords: h.rep?.name ? `rep ${h.rep.name}` : '',
    unpaidSince: h.unpaidMonths.length ? `${monthName(h.unpaidMonths[0]!)} materials` : '',
    invoiceWords:
      h.unpaidCount > 0
        ? `${h.unpaidCount} unpaid of ${h.invoiceCount} ${h.invoiceCount === 1 ? 'invoice' : 'invoices'}`
        : `${h.invoiceCount} ${h.invoiceCount === 1 ? 'invoice' : 'invoices'}, all paid`,
    notice: h.owed > EPSILON ? lienSupplierNotice(h.unpaidMonths, ctx.propertyKind, ctx.todayYmd) : { kind: 'none' },
    paid: h.paid,
    owed: h.owed,
    owedOnJobAccount: h.owedOnJobAccount,
  }))

  let verdict: string | null = null
  if (job.owed > EPSILON && ctx.openBalance > EPSILON) {
    verdict =
      ctx.openBalance + EPSILON >= job.owed
        ? `The ${usd(ctx.openBalance)} ${payer} owes us covers what the houses are owed.`
        : `The houses are owed ${usd(job.owed - ctx.openBalance)} more than ${payer} owes us.`
  }

  let paidFirst: string | null = null
  if (job.firstHousePaidYmd && (!job.firstCustomerPaidYmd || job.firstHousePaidYmd < job.firstCustomerPaidYmd)) {
    paidFirst = job.firstCustomerPaidYmd
      ? `We paid a house first on ${formatYmdMonthDay(job.firstHousePaidYmd)}. ${payer === 'the customer' ? 'The customer' : payer}’s first payment to us came on ${formatYmdMonthDay(job.firstCustomerPaidYmd)}.`
      : `We paid a house first on ${formatYmdMonthDay(job.firstHousePaidYmd)}. No payment has come in on this job yet.`
  }

  return {
    rows,
    paid: job.paid,
    owed: job.owed,
    housesWord: housesWord(job.houses.length),
    verdict,
    paidFirst,
    paidLine: `${housesWord(job.houses.length)}, all paid · ${usd(job.paid)}`,
  }
}

// ---------- the paragraph for an email ----------

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']

/**
 * Copy for an email: short plain sentences, one fact each, so any of them can be
 * cut. A house whose window closed is named with its money only — that its lien
 * right may be gone is ours to know, not the reader's.
 */
export function lienSupplierEmailText(
  card: LienSupplierCard,
  ctx: { jobLabel: string; todayYmd: string; openBalance: number; firstHousePaidYmd: string | null; firstCustomerPaidYmd: string | null },
): string {
  const n = card.rows.length
  const one = n === 1
  const lines: string[] = []
  lines.push(`Supply houses on ${ctx.jobLabel}`)
  lines.push(`From our books on ${longDayYear(ctx.todayYmd)}.`)
  lines.push('')
  const intro = [`${NUMBER_WORDS[n] ?? String(n)} supply ${one ? 'house' : 'houses'} sold materials for this job.`]
  if (card.paid > EPSILON) intro.push(`We have paid ${one ? 'it' : 'them'} ${usd(card.paid)}.`)
  intro.push(card.owed > EPSILON ? `${one ? 'It is' : 'They are'} still owed ${usd(card.owed)}.` : `${one ? 'It is' : 'They are'} paid in full.`)
  lines.push(intro.join(' '))

  const owedRows = card.rows.filter((r) => r.owed > EPSILON)
  if (owedRows.length) lines.push('')
  for (const r of owedRows) {
    const s = [`${r.name} is owed ${usd(r.owed)}${r.owedOnJobAccount > EPSILON ? ' on a job account' : ''}.`]
    if (r.notice.kind === 'open') {
      if (r.unpaidSince) s.push(`Its oldest unpaid materials are from ${r.unpaidSince.replace(/ materials$/, '')}.`)
      s.push(`We expect its own notice by ${longDay(r.notice.ymd)}.`)
    }
    lines.push(s.join(' '))
  }

  if (owedRows.length) {
    lines.push('')
    const claim = ['A supply house’s notice is its own claim for materials.']
    if (ctx.openBalance > EPSILON) {
      claim.push(`It is not part of the ${usd(ctx.openBalance)} owed to us.`)
      claim.push('Our release does not cover it.')
      if (ctx.openBalance + EPSILON >= card.owed) claim.push(`Paying us the ${usd(ctx.openBalance)} is what lets us pay ${owedRows.length === 1 ? 'it' : 'them'}.`)
    } else {
      claim.push('Our release does not cover it.')
    }
    lines.push(claim.join(' '))
  }

  if (ctx.firstHousePaidYmd && (!ctx.firstCustomerPaidYmd || ctx.firstHousePaidYmd < ctx.firstCustomerPaidYmd)) {
    lines.push('')
    lines.push(
      ctx.firstCustomerPaidYmd
        ? `We paid a supply house on this job on ${longDay(ctx.firstHousePaidYmd)}. Your first payment to us came on ${longDay(ctx.firstCustomerPaidYmd)}.`
        : `We paid a supply house on this job on ${longDay(ctx.firstHousePaidYmd)}. We have not received a payment on this job yet.`,
    )
  }
  return lines.join('\n')
}
