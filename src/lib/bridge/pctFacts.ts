import { hoursPeopleWords, jobHoursLine, type JobHours } from './jobHours'
import { shortK } from './headline'
import { cleanStoredAddress } from '../displayAddress'

/**
 * What a percent is judged from, for each job on the list *Set a percent on the jobs without one* (v2.7221).
 *
 * The owner, of that list: "to be able to quickly mark these jobs' % on the Build view, I need to be able to see the
 * line items, last worked date and by who (between the clock sessions or the schedule), and the amount we're
 * charging."
 *
 * So each job carries: what we are charging (the job's total, or that it has no price), its lines with their amounts
 * and whether each is on a bill that went out, what has been billed, the last day it was worked and by whom, the next
 * day on the schedule, and the last percent anyone wrote down.
 *
 * Last worked is the newest of two readings, and says which: a day someone clocked time on the job, or a day gone by
 * that the schedule had someone on it. A day both name is a clocked day. A day still to come is never *last worked*:
 * it is the next scheduled day.
 *
 * The address came a day later (v2.7232). The owner: "I also need the address ... The address is actually the most
 * important part", and "I don't need the state and zip code in the address though." A job's number and name do not
 * say where it is, and the place is how he knows the job. So each job says its street and city (`streetAndCity`).
 *
 * The line's shape came next (v2.7245). The owner: "On last worked, instead of seeing September 22 comma clocked --
 * Malachi, I would like to see 'Sept 22, [number of days ago]' And then in soft text below it, who contributed to it".
 * So the day leads with how long ago it was, and the people sit under it. Asked whether that meant everyone who has
 * worked the job or the last day's crew: "just the last people to go out there". So the soft line names the people on
 * that last day, and a day the schedule alone names says who it was scheduled for.
 *
 * Pure: no React, no Supabase (`pctFactsIo.ts` reads). The hours are `jobHours.ts`'s, which the page has already read.
 */

/** One line of a job (`jobs_ledger_fixtures`). */
export type PctFactsLineRow = { jobId: string; id: string; name: string | null; count: number | null; unitPrice: number | null; lineKind: string | null; invoiceId: string | null; sequence: number }
/** One person on the schedule for a job on a day (`job_schedule_blocks`). */
export type PctFactsBlockRow = { jobId: string; userId: string; name: string; ymd: string }
/** One bill on a job (`jobs_ledger_invoices`). */
export type PctFactsInvoiceRow = { jobId: string; id: string; usd: number; status: string }
/** One percent written down on a job (`job_pct_events`), with the day it was written. */
export type PctFactsEventRow = { jobId: string; pct: number; at: string; ymd: string }

/** A job's address as it is stored (`jobs_ledger.job_address`). */
export type PctFactsAddressRow = { jobId: string; address: string | null }

export type PctFactsRead = { lines: PctFactsLineRow[]; blocks: PctFactsBlockRow[]; invoices: PctFactsInvoiceRow[]; events: PctFactsEventRow[]; addresses: PctFactsAddressRow[] }

export type PctFactsLine = { key: string; name: string; /** Null for a line with no price on it. */ usd: number | null; /** On a bill that has gone out. */ billed: boolean }
export type PctFactsDay = { ymd: string; source: 'clocked' | 'scheduled'; people: string[] }

export type PctJobFacts = {
  /** Where the job is: its street and city, with no state and no zip. Empty when the job has no address. */
  address: string
  /** The job's total. Null when the job has no price. */
  chargeUsd: number | null
  lines: PctFactsLine[]
  /** What has gone out on bills, sent or paid. */
  billedUsd: number
  lastWorked: PctFactsDay | null
  /** The first day from today on that the schedule has someone on the job. */
  nextScheduled: { ymd: string; people: string[] } | null
  /** The hours and the people, as the job's line says them (`jobHoursLine`). */
  hoursLine: string
  /** The newest percent anyone wrote down, when there is one. */
  lastPct: { pct: number; ymd: string } | null
}

/** A bill that has gone out: sent, or sent and paid. A bill only marked ready has not. */
const WENT_OUT = new Set(['billed', 'paid'])
const round2 = (n: number): number => Math.round(n * 100) / 100

/** A line's amount as the job's own total counts it: a count of nothing reads as one, and a discount is one line. */
export function lineUsd(line: Pick<PctFactsLineRow, 'count' | 'unitPrice' | 'lineKind'>): number | null {
  if (line.unitPrice == null || !Number.isFinite(line.unitPrice)) return null
  const c = Number(line.count)
  const qty = line.lineKind === 'discount' ? 1 : Number.isFinite(c) && c > 0 ? c : 1
  return round2(qty * line.unitPrice)
}

const STATE_CODES = new Set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' '))

/**
 * A stored address as its street and city: *230 Terrell Road, San Antonio, TX 78209* reads *230 Terrell Road, San
 * Antonio*. The country, the zip and the state come off the end, in that order. A state after a comma always goes. A
 * state after a space goes only when a zip stood behind it, so *12 Main St NE* keeps its quarter of town. An address
 * that is nothing but a state or a zip comes back as it is stored.
 */
export function streetAndCity(address: string | null | undefined): string {
  const base = cleanStoredAddress(address)
  if (base === '') return ''
  let a = base.replace(/[\s,]+(USA|U\.S\.A\.|United States(?: of America)?)\s*$/i, '')
  const noZip = a.replace(/[\s,]+\d{5}(-\d{4})?\s*$/, '')
  const hadZip = noZip !== a
  a = noZip
  const state = a.match(/([\s,]+)([A-Za-z]{2}|Texas)\s*$/)
  if (state && (state[2]!.toLowerCase() === 'texas' ? state[1]!.includes(',') : STATE_CODES.has(state[2]!.toUpperCase()) && (state[1]!.includes(',') || (hadZip && state[2] === state[2]!.toUpperCase())))) a = a.slice(0, state.index)
  a = a.replace(/[\s,]+$/, '').trim()
  return a === '' || STATE_CODES.has(a.toUpperCase()) ? base : a
}

const push = <T>(map: Map<string, T[]>, key: string, row: T): void => {
  const list = map.get(key)
  if (list) list.push(row)
  else map.set(key, [row])
}

/** The names on one day, in the order given, each once. */
const namesOn = (rows: ReadonlyArray<{ userId: string; name: string }>): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of rows) {
    if (seen.has(r.userId)) continue
    seen.add(r.userId)
    out.push(r.name)
  }
  return out
}

/** The last day worked: the newest clocked day against the newest scheduled day gone by. A tie is a clocked day. */
export function lastWorkedOf(hours: JobHours | null | undefined, blocks: ReadonlyArray<PctFactsBlockRow>, todayYmd: string): PctFactsDay | null {
  const clockYmd = hours?.lastYmd ?? null
  const past = blocks.filter((b) => b.ymd < todayYmd)
  const schedYmd = past.reduce<string | null>((m, b) => (m == null || b.ymd > m ? b.ymd : m), null)
  if (clockYmd && (!schedYmd || clockYmd >= schedYmd)) {
    // The day's rows are already the most hours first.
    return { ymd: clockYmd, source: 'clocked', people: namesOn((hours?.days ?? []).filter((d) => d.ymd === clockYmd)) }
  }
  if (schedYmd) return { ymd: schedYmd, source: 'scheduled', people: namesOn(past.filter((b) => b.ymd === schedYmd).sort((a, b) => a.name.localeCompare(b.name))) }
  return null
}

/** The first day from today on with someone on the job. */
export function nextScheduledOf(blocks: ReadonlyArray<PctFactsBlockRow>, todayYmd: string): PctJobFacts['nextScheduled'] {
  const ahead = blocks.filter((b) => b.ymd >= todayYmd)
  const ymd = ahead.reduce<string | null>((m, b) => (m == null || b.ymd < m ? b.ymd : m), null)
  return ymd ? { ymd, people: namesOn(ahead.filter((b) => b.ymd === ymd).sort((a, b) => a.name.localeCompare(b.name))) } : null
}

/** Every listed job's facts. A job with nothing read for it still has an entry: no price, no lines, not worked yet. */
export function buildPctFacts(input: {
  jobs: ReadonlyArray<{ id: string; revenueUsd: number | null }>
  hours: ReadonlyMap<string, JobHours> | null
  read: PctFactsRead
  todayYmd: string
}): Map<string, PctJobFacts> {
  const lines = new Map<string, PctFactsLineRow[]>()
  const blocks = new Map<string, PctFactsBlockRow[]>()
  const invoices = new Map<string, PctFactsInvoiceRow[]>()
  const events = new Map<string, PctFactsEventRow[]>()
  for (const l of input.read.lines) push(lines, l.jobId, l)
  for (const b of input.read.blocks) push(blocks, b.jobId, b)
  for (const i of input.read.invoices) push(invoices, i.jobId, i)
  for (const e of input.read.events) push(events, e.jobId, e)
  const addresses = new Map(input.read.addresses.map((a) => [a.jobId, a.address] as const))
  const out = new Map<string, PctJobFacts>()
  for (const job of input.jobs) {
    const jobInvoices = invoices.get(job.id) ?? []
    const out_ = new Set(jobInvoices.filter((i) => WENT_OUT.has(i.status)).map((i) => i.id))
    const jobBlocks = blocks.get(job.id) ?? []
    const jobHours = input.hours?.get(job.id) ?? null
    const newest = (events.get(job.id) ?? []).reduce<PctFactsEventRow | null>((m, e) => (m == null || e.at > m.at ? e : m), null)
    out.set(job.id, {
      address: streetAndCity(addresses.get(job.id)),
      chargeUsd: job.revenueUsd != null && Number.isFinite(job.revenueUsd) && job.revenueUsd > 0 ? job.revenueUsd : null,
      // A line with no name is not a line of the job (`revenueDollarsFromFixtures` leaves it out of the total too).
      lines: (lines.get(job.id) ?? [])
        .filter((l) => (l.name ?? '').trim() !== '')
        .sort((a, b) => a.sequence - b.sequence || (a.id < b.id ? -1 : 1))
        .map((l) => ({ key: l.id, name: (l.name ?? '').trim(), usd: lineUsd(l), billed: l.invoiceId != null && out_.has(l.invoiceId) })),
      billedUsd: round2(jobInvoices.filter((i) => WENT_OUT.has(i.status)).reduce((s, i) => s + (Number.isFinite(i.usd) ? i.usd : 0), 0)),
      lastWorked: lastWorkedOf(jobHours, jobBlocks, input.todayYmd),
      nextScheduled: nextScheduledOf(jobBlocks, input.todayYmd),
      hoursLine: jobHoursLine(jobHours),
      lastPct: newest ? { pct: newest.pct, ymd: newest.ymd } : null,
    })
  }
  return out
}

// ── the words ────────────────────────────────────────────────────────────────

/** Whole dollars with commas, for a window with room: *$12,400*. */
export const usdWords = (n: number): string => `${n < 0 ? '−' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`

const by = (people: ReadonlyArray<string>): string => hoursPeopleWords(people.map((name) => ({ name })))

/** How long ago a day was, counted in calendar days: *today*, *yesterday*, *52 days ago*. */
export function daysAgoWords(ymd: string, todayYmd: string): string {
  const n = Math.round((Date.parse(`${todayYmd}T00:00:00Z`) - Date.parse(`${ymd}T00:00:00Z`)) / 86_400_000)
  if (!Number.isFinite(n) || n <= 0) return 'today'
  return n === 1 ? 'yesterday' : `${n.toLocaleString('en-US')} days ago`
}

/**
 * The job's line on the list: the day and how long ago it was, and under it, in soft words, the last people out
 * there. A day the schedule alone names says who it was scheduled for. A job nobody has worked says what is next.
 */
export function lastWorkedCell(f: Pick<PctJobFacts, 'lastWorked' | 'nextScheduled'>, todayYmd: string, dayLabel: (ymd: string) => string): { text: string; phone: string; sub: string; muted: boolean } {
  const w = f.lastWorked
  if (w) {
    const day = `${dayLabel(w.ymd)}, ${daysAgoWords(w.ymd, todayYmd)}`
    const crew = by(w.people)
    const sub = w.source === 'clocked' ? crew : crew ? `Scheduled for ${crew}` : 'On the schedule'
    return { text: day, phone: `Last worked ${day}`, sub, muted: false }
  }
  const n = f.nextScheduled
  return { text: 'Not worked yet', phone: 'Not worked yet', sub: n ? (n.ymd === todayYmd ? 'Scheduled today' : `Next scheduled ${dayLabel(n.ymd)}`) : '', muted: true }
}

/** The Contract cell: the job's total, or that it has none. Never *$0*. */
export function chargeCell(f: Pick<PctJobFacts, 'chargeUsd'>): { text: string; phone: string; warn: boolean } {
  return f.chargeUsd != null ? { text: shortK(f.chargeUsd), phone: `${shortK(f.chargeUsd)} contract`, warn: false } : { text: 'No price', phone: 'No price yet', warn: true }
}

/** The move a job with no price is also on, as the card names it. */
export const PRICE_MOVE_WORDS = 'Price the jobs with no price'

export type PctFactsRow = { key: 'address' | 'charge' | 'billed' | 'worked' | 'next' | 'hours' | 'last-pct'; label: string; words: string; warn?: boolean }

/** The facts beside the percent control, a row a fact, in the order a percent is judged: the place, the money, then the work. */
export function pctFactsRows(f: PctJobFacts, todayYmd: string, dayLabel: (ymd: string) => string): PctFactsRow[] {
  const rows: PctFactsRow[] = []
  rows.push(f.address ? { key: 'address', label: 'Address', words: f.address } : { key: 'address', label: 'Address', words: 'The job has no address yet.', warn: true })
  rows.push(f.chargeUsd != null ? { key: 'charge', label: 'We are charging', words: usdWords(f.chargeUsd) } : { key: 'charge', label: 'We are charging', words: `No price yet. It is also on the list “${PRICE_MOVE_WORDS}”.`, warn: true })
  if (f.billedUsd > 0) rows.push({ key: 'billed', label: 'Billed so far', words: f.chargeUsd != null ? `${usdWords(f.billedUsd)} of ${usdWords(f.chargeUsd)}` : usdWords(f.billedUsd) })
  const w = f.lastWorked
  if (w) {
    const who = by(w.people)
    const day = `${dayLabel(w.ymd)}, ${daysAgoWords(w.ymd, todayYmd)}`
    rows.push({ key: 'worked', label: 'Last worked', words: w.source === 'clocked' ? `${day}. Clocked${who ? ` by ${who}` : ''}.` : `${day}. On the schedule${who ? ` for ${who}` : ''}, with no clock time since.` })
  } else rows.push({ key: 'worked', label: 'Last worked', words: 'Not worked yet.' })
  const n = f.nextScheduled
  if (n) {
    const who = by(n.people)
    rows.push({ key: 'next', label: 'Next scheduled', words: `${n.ymd === todayYmd ? 'Today' : dayLabel(n.ymd)}${who ? `, for ${who}` : ''}.` })
  }
  rows.push({ key: 'hours', label: 'Hours so far', words: `${f.hoursLine}.` })
  if (f.lastPct) rows.push({ key: 'last-pct', label: 'Last percent', words: `${Math.round(f.lastPct.pct)}%, set ${dayLabel(f.lastPct.ymd)}.` })
  return rows
}

/** How many lines the window shows before *Show all*. */
export const PCT_FACTS_LINES_SHOWN = 4

/** The first few lines, and how many are left behind the press. */
export function shownLines(lines: ReadonlyArray<PctFactsLine>, all: boolean): { shown: PctFactsLine[]; more: number } {
  if (all || lines.length <= PCT_FACTS_LINES_SHOWN) return { shown: [...lines], more: 0 }
  return { shown: lines.slice(0, PCT_FACTS_LINES_SHOWN), more: lines.length - PCT_FACTS_LINES_SHOWN }
}

// ── going down the list ──────────────────────────────────────────────────────

/** Where one job stands on the list being gone down, and the jobs either side of it. */
export function pctRunPlace<T extends { id: string }>(run: ReadonlyArray<T>, currentId: string): { index: number; count: number; prev: T | null; next: T | null } {
  const index = run.findIndex((j) => j.id === currentId)
  if (index < 0) return { index: -1, count: run.length, prev: null, next: null }
  return { index, count: run.length, prev: run[index - 1] ?? null, next: run[index + 1] ?? null }
}

/** After a save: the next job down the list that has not been set on this run, then the first one above. Null when every one is set. */
export function pctRunAfterSave<T extends { id: string }>(run: ReadonlyArray<T>, currentId: string, done: ReadonlySet<string>): T | null {
  const index = run.findIndex((j) => j.id === currentId)
  const open = (j: T): boolean => j.id !== currentId && !done.has(j.id)
  return run.slice(index + 1).find(open) ?? run.slice(0, Math.max(0, index)).find(open) ?? null
}
