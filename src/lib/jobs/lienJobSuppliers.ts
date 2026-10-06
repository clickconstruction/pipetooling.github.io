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
 * The house keeps its own calendar, so what the house told us (v2.4411,
 * `job_supply_house_words`: its own balance, the day its notice goes out) is
 * shown over the estimate wherever it is on record.
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

/** What the house told us about a job (v2.4411): the latest word on record. */
export interface LienSupplierWord {
  /** The house's own figure for what it is still owed on the job; null when it gave none. */
  balance: number | null
  /** The day the house says its own notice goes out; null when it gave none. */
  noticeYmd: string | null
  /** Who at the house said it; '' when not written. */
  saidBy: string
  note: string
  notedByName: string
  /** The day it was written down. */
  notedYmd: string
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
  word: LienSupplierWord | null
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
  /** What each house told us, per job (v2.4411). */
  wordsByJob?: ReadonlyMap<string, ReadonlyArray<LienSupplierWord & { houseId: string }>>
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
        word: wordOf(input.wordsByJob?.get(alloc.job_id), inv.supply_house_id),
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

function wordOf(words: ReadonlyArray<LienSupplierWord & { houseId: string }> | undefined, houseId: string): LienSupplierWord | null {
  const w = words?.find((x) => x.houseId === houseId)
  if (!w) return null
  return { balance: w.balance, noticeYmd: w.noticeYmd, saidBy: w.saidBy, note: w.note, notedByName: w.notedByName, notedYmd: w.notedYmd }
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
  /** The day the house itself told us its notice goes out (v2.4411). `daysLeft` is negative once that day has passed. */
  | { kind: 'said'; ymd: string; daysLeft: number; soon: boolean }
  /** The house's next open window, by our estimate. */
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
  /** What the house told us; null when nothing is on record. */
  word: LienSupplierWord | null
  /** "Reece says $8,950.00" when the house's own balance is on record and is not ours; else ''. */
  theirBalanceWords: string
  /** "Dana said so · noted Oct 2 by Grace" under a date the house gave; else ''. */
  saidWords: string
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

/** The house's notice as the card shows it: the day the house gave, else our estimate. */
export function lienSupplierHouseNotice(h: Pick<LienSupplierHouse, 'unpaidMonths' | 'word'>, propertyKind: string, todayYmd: string): LienSupplierNotice {
  const said = h.word?.noticeYmd
  if (said && /^\d{4}-\d{2}-\d{2}$/.test(said)) {
    const daysLeft = daysBetweenYmd(todayYmd, said) ?? 0
    return { kind: 'said', ymd: said, daysLeft, soon: daysLeft >= 0 && daysLeft <= LIEN_DESK_LEAD_DAYS }
  }
  return lienSupplierNotice(h.unpaidMonths, propertyKind, todayYmd)
}

/** "Dana said so · noted Oct 2 by Grace": whose word a date or a balance is, and who wrote it down. */
export function lienSupplierSaidWords(houseName: string, w: LienSupplierWord): string {
  const who = w.saidBy.trim() || houseName
  const noted = w.notedYmd ? `noted ${formatYmdMonthDay(w.notedYmd)}${w.notedByName.trim() ? ` by ${w.notedByName.trim()}` : ''}` : ''
  return [`${who} said so`, noted].filter(Boolean).join(' · ')
}

/** The typed balance: '' is no balance, "$8,950.00" is 8950, anything else is refused. */
export function parseSupplierWordBalance(text: string): { ok: true; value: number | null } | { ok: false } {
  const t = text.trim()
  if (!t) return { ok: true, value: null }
  const n = Number(t.replace(/[$,\s]/g, ''))
  if (!/^\$?\s*[\d,]*\.?\d*$/.test(t) || !Number.isFinite(n) || n < 0 || n >= 1e10) return { ok: false }
  return { ok: true, value: Math.round(n * 100) / 100 }
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
    notice: h.owed > EPSILON ? lienSupplierHouseNotice(h, ctx.propertyKind, ctx.todayYmd) : { kind: 'none' },
    paid: h.paid,
    owed: h.owed,
    owedOnJobAccount: h.owedOnJobAccount,
    word: h.word,
    theirBalanceWords: h.word?.balance != null && Math.abs(h.word.balance - h.owed) > EPSILON ? `${h.name} says ${usd(h.word.balance)}` : '',
    saidWords: h.word ? lienSupplierSaidWords(h.name, h.word) : '',
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
    // The house's own words beat our books and our estimate, and are said as the house's.
    if (r.theirBalanceWords && r.word?.balance != null) s.push(`${r.name} says its balance is ${usd(r.word.balance)}.`)
    if (r.notice.kind === 'said') {
      s.push(`${r.name} says its own notice ${r.notice.daysLeft < 0 ? 'went' : 'goes'} out on ${longDay(r.notice.ymd)}.`)
    } else if (r.notice.kind === 'open') {
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

// ---------- the paragraph for the owner's cover letter (v2.4725) ----------

/** Counsel has not read the owner's-letter paragraph about the houses yet: the desk draws an amber line beside the tick until this flips. */
export const LIEN_HOUSES_PARAGRAPH_READ_BY_COUNSEL = false

/** The figure the letter names for a house: the balance the house gave when it gave one (the notice is the house's claim), else our books. */
function houseFigure(r: LienSupplierCardRow): number {
  return r.word?.balance != null && r.word.balance > EPSILON ? r.word.balance : r.owed
}

/**
 * The owner's cover letter paragraph (v2.4725, Taunya's ask): the house, its money, the day its
 * own notice goes out, that it is a separate claim our release does not cover, and what clears
 * it. Four shapes of the middle sentence — the day the house gave, our estimate, "may send" when
 * there is nothing to count from, nothing at all when its window has closed (its lien right is
 * ours to know). The last sentence is said only when our claim covers what the houses are owed.
 * `claim` is the letter's own figure, so the two never disagree. '' when no house is owed.
 */
export function lienSupplierLetterParagraph(card: LienSupplierCard, ctx: { claim: number }): string {
  const rows = card.rows.filter((r) => r.owed > EPSILON)
  if (!rows.length) return ''
  const one = rows.length === 1
  const total = rows.reduce((s, r) => s + houseFigure(r), 0)
  const S: string[] = []
  if (one) {
    const r = rows[0]!
    S.push(`You should also know that ${r.name} sold materials for this job and is still owed ${usd(houseFigure(r))}.`)
  } else {
    const n = (NUMBER_WORDS[rows.length] ?? String(rows.length)).toLowerCase()
    S.push(`You should also know that ${n} supply houses sold materials for this job and are still owed ${usd(total)} between them: ${rows.map((r) => `${r.name} ${usd(houseFigure(r))}`).join(', ')}.`)
  }
  for (const r of rows) {
    if (r.notice.kind === 'said') S.push(`${r.name} told us its own notice ${r.notice.daysLeft < 0 ? 'went' : 'goes'} out on ${longDay(r.notice.ymd)} unless ${one ? 'that balance' : 'it'} is paid.`)
    else if (r.notice.kind === 'open') S.push(`We expect ${r.name}’s own notice by ${longDay(r.notice.ymd)}.`)
    else if (r.notice.kind === 'none') S.push(one ? `${r.name} may send its own notice for that balance.` : `${r.name} may send its own notice.`)
    // closed: the money is named above and no notice is mentioned.
  }
  const firm = rows.some((r) => r.notice.kind === 'said' || r.notice.kind === 'open')
  const maybe = rows.some((r) => r.notice.kind === 'none')
  if (one) {
    const name = rows[0]!.name
    S.push(firm ? `That notice is ${name}’s own claim for materials.` : maybe ? `That notice would be ${name}’s own claim for materials.` : `That balance is ${name}’s own claim for materials.`)
    S.push(ctx.claim > EPSILON ? `It is not covered by our release, and it is not included in the ${usd(ctx.claim)}.` : 'It is not covered by our release.')
  } else {
    S.push(firm ? 'Those notices are the houses’ own claims for materials.' : maybe ? 'Those notices would be the houses’ own claims for materials.' : 'Those balances are the houses’ own claims for materials.')
    S.push(ctx.claim > EPSILON ? `They are not covered by our release, and they are not included in the ${usd(ctx.claim)}.` : 'They are not covered by our release.')
  }
  if (ctx.claim > EPSILON && ctx.claim + EPSILON >= total) S.push(`Paying us the ${usd(ctx.claim)} is what lets us clear ${one ? 'that account' : 'those accounts'}.`)
  return S.join(' ')
}

/** The paragraph for one job as the desk and the run build it: the card from the job's houses, then the words. '' when the job bought nothing or owes no house. */
export function lienSupplierLetterParagraphFor(job: LienSupplierJob | null | undefined, ctx: { propertyKind: string; todayYmd: string; payerName: string; claim: number }): string {
  if (!job || job.owed <= EPSILON) return ''
  return lienSupplierLetterParagraph(buildLienSupplierCard(job, { propertyKind: ctx.propertyKind, todayYmd: ctx.todayYmd, openBalance: ctx.claim, payerName: ctx.payerName }), { claim: ctx.claim })
}
