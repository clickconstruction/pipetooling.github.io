import { buildLienTimelineBook, type LienBookLens } from '../jobs/lienTimelineBook'
import { assembleLienBookInput, type LienBookRaw } from '../jobs/lienTimelineBookAssemble'
import { formatUsdNoCents } from '../jobs/jobFormatting'
import { JUSTICE_COURT_LIMIT } from '../jobsDocuments/demandLetter'

/**
 * Start here and the tour on the firm's portal (v2.4820, the owner's ask of 2026-10-07: *an intake
 * flow that includes the above information curated for a law firm looking at their portal, followed
 * by a guide of how the portal works where we signal where they are in the process, and use short,
 * curt, to the point language*). Pure: every line the firm reads, and every figure, which comes from
 * the same book the Lien grid draws, so it is never typed and never stale. Every sentence passes the
 * app's plain-words rule (`plainWords.ts`), which the tests hold.
 */

/** The steps of Start here, in order. */
export const START_STOPS = ['company', 'matter', 'work', 'portal'] as const
export type StartStop = (typeof START_STOPS)[number]

/** `Click Plumbing and Electrical` → `Click`; the office's own short name in every sentence. */
export function companyShortName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? ''
  return first && !/^(the|a|an)$/i.test(first) ? first : 'The office'
}

/** The rail's label for each step. */
export function startStopLabel(stop: StartStop, short: string): string {
  switch (stop) {
    case 'company':
      return short
    case 'matter':
      return 'Each matter'
    case 'work':
      return 'How we work'
    default:
      return 'The portal'
  }
}

/** `Step 2 of 4` */
export function startStepWords(index: number, count: number): string {
  return `Step ${index + 1} of ${count}`
}

/** The slice of a book row the figures read. */
export type StartBookRow = { lens: LienBookLens; job: { gcId: string | null; county?: string; openBalance: number } }

/** The book behind the Lien grid, as rows; [] when the portal holds none. */
export function startBookRows(raw: LienBookRaw | null | undefined, todayYmd: string): StartBookRow[] {
  if (!raw) return []
  try {
    return buildLienTimelineBook(assembleLienBookInput(raw, todayYmd)).rows
  } catch {
    return []
  }
}

const jobs = (n: number) => `${n} ${n === 1 ? 'job' : 'jobs'}`

/** `A, B and C` */
function andList(names: ReadonlyArray<string>): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** The counties with the most jobs first, ties by name; the rest counted. */
export function startCounties(rows: ReadonlyArray<StartBookRow>, max = 5): { names: string[]; more: number } {
  const tally = new Map<string, number>()
  for (const r of rows) {
    const c = (r.job.county ?? '').trim()
    if (c) tally.set(c, (tally.get(c) ?? 0) + 1)
  }
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c)
  return { names: sorted.slice(0, max), more: Math.max(0, sorted.length - max) }
}

/**
 * Step 1, who the firm is working with, from the book and the firm's matters. A line with no
 * figure behind it is left out, so a portal with no book says only what it knows.
 */
export function companyLines(input: { rows: ReadonlyArray<StartBookRow>; matterCount: number; matterBalance: number }): string[] {
  const { rows } = input
  const n = rows.length
  const lines: string[] = []
  if (n > 0) {
    const gc = rows.filter((r) => r.job.gcId).length
    lines.push(gc * 2 >= n ? `Most of the work is for general contractors. ${gc} of ${n} jobs on the lien grid have one.` : `${gc} of ${n} jobs on the lien grid are for a general contractor.`)
    const { names, more } = startCounties(rows)
    if (names.length) lines.push(more ? `Counties: ${names.join(', ')} and ${more} more.` : `Counties: ${andList(names)}.`)
    const small = rows.filter((r) => r.job.openBalance <= JUSTICE_COURT_LIMIT).length
    if (small > 0) lines.push(`${small} of ${n} jobs owe ${formatUsdNoCents(JUSTICE_COURT_LIMIT)} or less, the justice court limit.`)
    const open = rows.reduce((s, r) => s + r.job.openBalance, 0)
    lines.push(`On the lien grid now: ${jobs(n)}, ${formatUsdNoCents(open)} open.`)
    const due = rows.filter((r) => r.lens === 'due')
    if (due.length) lines.push(`Due in the next 30 days: ${jobs(due.length)}, ${formatUsdNoCents(due.reduce((s, r) => s + r.job.openBalance, 0))}.`)
  }
  lines.push(input.matterCount > 0 ? `With your firm now: ${input.matterCount} ${input.matterCount === 1 ? 'matter' : 'matters'}, ${formatUsdNoCents(input.matterBalance)} in balance.` : 'No matters with your firm yet.')
  return lines
}

/** Step 2, what comes with each matter. */
export function matterLines(short: string): string[] {
  return [
    "Lien rights are kept. Each job's notice months and affidavit deadline run from the last day on site.",
    'Notices go out on time. Each one is on file with the day it went.',
    'The evidence is gathered. The agreement, bills, payments, crew time on site with GPS, notices and the demand.',
    'Every call, promise and note is on the record, with its date.',
    `${short} keeps the office work. Payments, job changes and calls to the customer stay with ${short}.`,
  ]
}

/** The firm row's contingency as a whole percent; the row holds 33, an older caller 0.33. */
export function contingencyPercent(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n <= 1 ? n * 100 : n)
}

/** Step 3, how the office works with the firm. The fee line only when the firm's terms are on file. */
export function workLines(input: { short: string; contingencyPct: unknown; filingCost: unknown }): string[] {
  const pct = contingencyPercent(input.contingencyPct)
  const cost = Number(input.filingCost)
  const fee = [pct > 0 ? `Your fee is ${pct}% contingency.` : '', Number.isFinite(cost) && cost > 0 ? `Filing cost is ${formatUsdNoCents(cost)}.` : ''].filter(Boolean).join(' ')
  return [
    ...(fee ? [fee] : []),
    `Up to ${formatUsdNoCents(JUSTICE_COURT_LIMIT)}, file in justice court. Over it, county or district court.`,
    "A lien foreclosure goes to district court in the property's county.",
    `Each matter says what you may settle for. Below that, ask ${input.short} first.`,
    `You record fees, costs, steps and payments here. ${input.short} sees them the same day.`,
    'Emails go to the people you name, as things happen or in a weekly digest.',
  ]
}

/** The link under step 3. */
export function rulesLinkWords(short: string): string {
  return `Read the Texas lien rules ${short} follows`
}

// ---------- the tour ----------

export type TourPanel = 'matters' | 'grid' | 'notifications'

export type TourStop = {
  key: string
  title: string
  text: string
  /** The portal panel the stop opens. */
  panel: TourPanel
  /** The matter tab it opens, on a matter stop. */
  tab?: string
  /** What it rings: a `data-legal-tour` value on the page. */
  target: 'matters' | 'matter' | 'grid' | 'notifications'
}

/** What each matter tab is, by its key; a tab with no words here is left out of the tour. */
function tabText(key: string, short: string): string {
  switch (key) {
    case 'narrative':
      return "The office's account of the matter, in its own words."
    case 'account':
      return 'The statement of account, with the balance owed. Print packet makes the whole matter one PDF.'
    case 'paper':
      return "Agreements, notices, liens and the demand. Each job's lien clock is here."
    case 'their_word':
      return 'Every call, promise and note, with its date and who said it.'
    case 'evidence':
      return "Crew time on site with GPS, field reports and the office's documents."
    case 'fees_steps':
      return `Record fees, costs, steps and payments. Ask ${short} a question here.`
    default:
      return ''
  }
}

/**
 * The tour, stop by stop: Matters, each tab the open matter shows, the Lien grid when the portal
 * has one, Notifications. With no matter yet there are no tab stops, and Matters says why.
 */
export function portalTourStops(input: { short: string; hasMatters: boolean; hasGrid: boolean; matterTabs: ReadonlyArray<{ key: string; label: string }> }): TourStop[] {
  const stops: TourStop[] = [
    {
      key: 'matters',
      title: 'Matters',
      text: input.hasMatters ? `Each account ${input.short} sends you, largest balance first. Click one to open it.` : `No matters yet. Each account ${input.short} refers appears here.`,
      panel: 'matters',
      target: 'matters',
    },
  ]
  if (input.hasMatters) {
    for (const t of input.matterTabs) {
      const text = tabText(t.key, input.short)
      if (text) stops.push({ key: t.key, title: t.label, text, panel: 'matters', tab: t.key, target: 'matter' })
    }
  }
  if (input.hasGrid) stops.push({ key: 'grid', title: 'Lien grid', text: 'Every job with a lien month. Deadlines, court and amount due.', panel: 'grid', target: 'grid' })
  stops.push({ key: 'notifications', title: 'Notifications', text: 'Who at your firm gets emails. Add your people here.', panel: 'notifications', target: 'notifications' })
  return stops
}

/** Step 4's words: the tour's size, then what it does. */
export function portalStepLines(stopCount: number): string[] {
  return [`The tour has ${stopCount} short stops. Each one opens the real page and rings the part it means.`]
}

/** `Tour · stop 3 of 8` — the strip's eyebrow. */
export function tourStepWords(index: number, count: number): string {
  return `Tour · stop ${index + 1} of ${count}`
}

/** Start here opens first on a browser's first visit (localStorage), then Matters does. */
export const START_SEEN_KEY = 'legalPortal.startSeen'

export function readStartSeen(): boolean {
  try {
    return window.localStorage.getItem(START_SEEN_KEY) === 'yes'
  } catch {
    return true
  }
}

export function markStartSeen(): void {
  try {
    window.localStorage.setItem(START_SEEN_KEY, 'yes')
  } catch {
    /* a private window: Start here opens first again next time */
  }
}
