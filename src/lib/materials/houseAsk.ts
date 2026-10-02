/**
 * Ask a house (v2.4443): the supply house's side of Materials → Held for suppliers, one house
 * at a time. A house's rep answers for every job in one call, so the asking and the writing
 * down are per house: every job with a balance there by our books, the message that asks for
 * the house's own balance and its notice date on each, and the answers typed down the list
 * and saved together (`job_supply_house_words`, the Lien desk's They told us…).
 *
 * Pure. Money and months are the Lien desk's (`LienSupplierJob`); the dates are
 * `lienSupplierHouseNotice`.
 */

import { formatCurrency } from '../format'
import { lienSupplierHouseNotice, parseSupplierWordBalance, type LienSupplierJob, type LienSupplierNotice, type LienSupplierWord } from '../jobs/lienJobSuppliers'
import { customerPaidInFull } from './heldHouseNotice'

const EPSILON = 0.005

export interface HouseAskJob {
  jobId: string
  /** "363" — the ledger number as Held for suppliers prints it. */
  number: string
  name: string
  address: string
  /** What our books say this house is still owed on the job. */
  owed: number
  unpaidCount: number
  /** "July": the oldest month with an unpaid invoice; '' when undated. */
  unpaidSince: string
  /** The unpaid invoices' numbers, as entered. */
  invoiceNumbers: string[]
  notice: LienSupplierNotice
  /** The customer has paid us in full: a notice from the house would land on someone who owes nothing. */
  customerPaidInFull: boolean
  /** What the customer still owes us on the job. */
  openToUs: number
  word: LienSupplierWord | null
}

export interface HouseAsk {
  houseId: string
  name: string
  /** Soonest date the house can act first, then the most owed. */
  jobs: HouseAskJob[]
  owed: number
  /** The soonest day this house can still act on any job, 'YYYY-MM-DD'; '' when none. */
  firstYmd: string
  paidInFullJobs: number
  /** Jobs with something on record from the house. */
  answered: number
}

function monthName(key: string): string {
  return new Date(`${key}-15T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
}

/** The day a house can still act, for sorting: an open estimate or a day the house gave that is still ahead. */
function aheadYmd(n: LienSupplierNotice): string {
  return n.kind === 'open' || (n.kind === 'said' && n.daysLeft >= 0) ? n.ymd : ''
}

/** Unpaid invoice numbers per job and house ("job:house"), in the order given. Credits and paid invoices are left out. */
export function unpaidInvoiceNumbers(
  invoices: ReadonlyArray<{ id: string; supply_house_id: string; amount: number | null; is_paid: boolean; invoice_number?: string | null }>,
  allocations: ReadonlyArray<{ invoice_id: string; job_id: string; pct: number | null }>,
): Map<string, string[]> {
  const byId = new Map(invoices.map((i) => [i.id, i]))
  const out = new Map<string, string[]>()
  for (const a of allocations) {
    const inv = byId.get(a.invoice_id)
    if (!inv || inv.is_paid || Number(inv.amount ?? 0) * Number(a.pct ?? 0) <= 0) continue
    const n = (inv.invoice_number ?? '').trim()
    if (!n) continue
    const key = `${a.job_id}:${inv.supply_house_id}`
    const list = out.get(key) ?? []
    if (!list.includes(n)) list.push(n)
    out.set(key, list)
  }
  return out
}

/** Every house that is still owed, most money first, each with its jobs. */
export function buildHouseAsks(input: {
  jobs: ReadonlyArray<{ jobId: string; jobNumber: string; jobName: string; billed: number; paidIn: number }>
  suppliers: ReadonlyMap<string, LienSupplierJob>
  kindByJob?: ReadonlyMap<string, string>
  addressByJob?: ReadonlyMap<string, string>
  invoiceNumbers?: ReadonlyMap<string, string[]>
  todayYmd: string
}): HouseAsk[] {
  const byHouse = new Map<string, HouseAsk>()
  for (const j of input.jobs) {
    const s = input.suppliers.get(j.jobId)
    if (!s) continue
    const kind = input.kindByJob?.get(j.jobId) ?? ''
    for (const h of s.houses) {
      if (h.owed <= EPSILON) continue
      let ask = byHouse.get(h.houseId)
      if (!ask) {
        ask = { houseId: h.houseId, name: h.name, jobs: [], owed: 0, firstYmd: '', paidInFullJobs: 0, answered: 0 }
        byHouse.set(h.houseId, ask)
      }
      const paid = customerPaidInFull(j)
      ask.jobs.push({
        jobId: j.jobId,
        number: j.jobNumber,
        name: j.jobName,
        address: (input.addressByJob?.get(j.jobId) ?? '').trim(),
        owed: Math.round(h.owed * 100) / 100,
        unpaidCount: h.unpaidCount,
        unpaidSince: h.unpaidMonths.length ? monthName(h.unpaidMonths[0]!) : '',
        invoiceNumbers: input.invoiceNumbers?.get(`${j.jobId}:${h.houseId}`) ?? [],
        notice: lienSupplierHouseNotice(h, kind, input.todayYmd),
        customerPaidInFull: paid,
        openToUs: Math.round(Math.max(0, j.billed - j.paidIn) * 100) / 100,
        word: h.word,
      })
      ask.owed += h.owed
      if (paid) ask.paidInFullJobs++
      if (h.word) ask.answered++
    }
  }
  const out = [...byHouse.values()]
  for (const a of out) {
    a.jobs.sort((x, y) => {
      const ax = aheadYmd(x.notice)
      const ay = aheadYmd(y.notice)
      if (ax !== ay) return !ax ? 1 : !ay ? -1 : ax < ay ? -1 : 1
      return y.owed - x.owed
    })
    a.firstYmd = a.jobs.map((j) => aheadYmd(j.notice)).filter(Boolean).sort()[0] ?? ''
    a.owed = Math.round(a.owed * 100) / 100
  }
  return out.sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name))
}

/** How many invoice numbers one line of the message names before "and N more". */
const ASK_INVOICES_MAX = 6

function jobTitle(j: HouseAskJob): string {
  return [`${j.number} ${j.name}`.trim(), j.address].filter(Boolean).join(', ').replace(/\.+$/, '')
}

/** "Balances and notice dates on 15 jobs": the email's subject. */
export function houseAskSubject(ask: HouseAsk, company: string): string {
  const n = ask.jobs.length
  const lead = company.trim() ? `${company.trim()}: ` : ''
  return `${lead}balances and notice dates on ${n} ${n === 1 ? 'job' : 'jobs'}`
}

/**
 * The message that asks: plain, short, and numbered so the rep can answer by number. Each
 * line gives the house what it files a job under (the name, the address, the invoice numbers)
 * and what our books show, so a difference is seen in the reply.
 */
export function houseAskMessage(ask: HouseAsk, ctx: { repName?: string; senderName: string; company: string }): string {
  const first = (ctx.repName ?? '').trim().split(/\s+/)[0] ?? ''
  const one = ask.jobs.length === 1
  const L: string[] = [`Hi${first ? ` ${first}` : ''},`, '']
  L.push(`Can you tell us what you show on ${one ? 'this job' : 'these jobs'}? For each one we need two things.`)
  L.push('1. What you show as still owed.')
  L.push('2. The day your lien notice goes out, if one is set.')
  L.push('')
  ask.jobs.forEach((j, i) => {
    const since = j.unpaidSince ? ` unpaid since ${j.unpaidSince}` : ' unpaid'
    const nums = j.invoiceNumbers.slice(0, ASK_INVOICES_MAX)
    const more = j.invoiceNumbers.length - nums.length
    const inv = nums.length ? ` Invoices ${nums.join(', ')}${more > 0 ? ` and ${more} more` : ''}.` : ''
    L.push(`${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}. ${jobTitle(j)}. Our books show $${formatCurrency(j.owed)}${since}.${inv}`)
  })
  L.push('', 'Thank you,', ctx.senderName.trim() || ctx.company.trim())
  if (ctx.senderName.trim() && ctx.company.trim()) L.push(ctx.company.trim())
  return L.join('\n')
}

/** What is typed beside one job on the sheet. */
export type HouseAskAnswer = { balance: string; noticeYmd: string }

/** The answer boxes as they start: what the house already told us. */
export function houseAskStartingAnswer(j: HouseAskJob): HouseAskAnswer {
  return { balance: j.word?.balance != null ? formatCurrency(j.word.balance) : '', noticeYmd: j.word?.noticeYmd ?? '' }
}

export type HouseAskSave = { jobId: string; houseId: string; balance: number | null; noticeYmd: string | null; saidBy: string; note: string; notedByName: string }

/**
 * The answers worth saving: a row whose balance or day was typed and is not what is already
 * on record. A balance that is not a number stops the save and is named; a row left blank is
 * left alone (the row's own They told us… clears a word). A word's note is kept.
 */
export function houseAskChanges(ask: HouseAsk, answers: Readonly<Record<string, HouseAskAnswer | undefined>>, who: { saidBy: string; notedByName: string }): { saves: HouseAskSave[]; badJobIds: string[] } {
  const saves: HouseAskSave[] = []
  const badJobIds: string[] = []
  for (const j of ask.jobs) {
    const a = answers[j.jobId]
    if (!a) continue
    const parsed = parseSupplierWordBalance(a.balance)
    if (!parsed.ok) {
      badJobIds.push(j.jobId)
      continue
    }
    const noticeYmd = /^\d{4}-\d{2}-\d{2}$/.test(a.noticeYmd) ? a.noticeYmd : null
    if (parsed.value == null && !noticeYmd) continue
    const sameBalance = (j.word?.balance ?? null) === parsed.value
    const sameDay = (j.word?.noticeYmd ?? null) === noticeYmd
    if (sameBalance && sameDay) continue
    saves.push({ jobId: j.jobId, houseId: ask.houseId, balance: parsed.value, noticeYmd, saidBy: who.saidBy.trim(), note: j.word?.note ?? '', notedByName: who.notedByName.trim() })
  }
  return { saves, badJobIds }
}

export type HouseAskContact = { id: string; supply_house_id: string | null; name: string | null; label: string; email: string; phone: string | null; role: string; is_default: boolean; archived_at?: string | null }
export type HouseAskRep = { name: string; email: string; phone: string; /** The house's billing contact. When false the sheet says whose desk this is. */ billing: boolean; roleWords: string }

/**
 * Who to ask at a house: its billing contact, else the one who opens job accounts, else its
 * default contact, else any — and only someone with an email or a phone. Null when the house
 * has nobody on file.
 */
export function pickAskRep(contacts: ReadonlyArray<HouseAskContact>, houseId: string): HouseAskRep | null {
  const mine = contacts.filter((c) => c.supply_house_id === houseId && !c.archived_at && ((c.email ?? '').trim() || (c.phone ?? '').trim()))
  const rank = (c: HouseAskContact) => (c.role === 'billing' ? 0 : c.role === 'job_accounts' ? 1 : c.is_default ? 2 : 3)
  const best = [...mine].sort((a, b) => rank(a) - rank(b))[0]
  if (!best) return null
  const roleWords = best.role === 'billing' ? 'billing' : best.role === 'job_accounts' ? 'job accounts' : 'price requests'
  return { name: (best.name ?? '').trim() || best.label.trim(), email: (best.email ?? '').trim(), phone: (best.phone ?? '').trim(), billing: best.role === 'billing', roleWords }
}

/** A mail link holds about this much before some mail programs cut it off. */
export const HOUSE_ASK_MAILTO_MAX = 1800

/** The mail link for the ask: the whole message when it fits, else the subject alone (the caller copies the message). */
export function houseAskMailto(email: string, subject: string, message: string): { href: string; whole: boolean } {
  const base = `mailto:${email}?subject=${encodeURIComponent(subject)}`
  const full = `${base}&body=${encodeURIComponent(message)}`
  return full.length <= HOUSE_ASK_MAILTO_MAX ? { href: full, whole: true } : { href: base, whole: false }
}
