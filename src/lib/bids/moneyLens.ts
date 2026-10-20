/**
 * Money on my bids (punch list #129, v2.5651): the Bid Board's Money lens and the Dashboard's card. Every job born of
 * a won bid with money open, as the estimator's chase list: past their word first, then no word, then they say they
 * paid with nothing landed, then waiting on a day, then they say they paid. *Only my bids* keeps the bids the person
 * estimated or account-manages, as the Job accounts lens does. Pure: the rows are `bidMoneyLine.ts`'s lines over the
 * page's one read (`useBidBoardMoneyStrips`) or the person's own (`list_my_money_strip`).
 */
import type { BidMoneyLine } from './bidMoneyLine'
import { bidMoneyWords } from './bidMoneyLine'

/** What the lens needs from a bid row, beside its line. */
export interface MoneyLensBid {
  id: string
  label: string
  estimatorName: string | null
  estimatorUserId: string | null
  accountManagerUserId: string | null
}

export type MoneyLensStanding = 'past' | 'noWord' | 'stale' | 'waiting' | 'claimed' | 'paid'

export interface MoneyLensRow {
  line: BidMoneyLine
  bidLabel: string
  estimatorName: string | null
  isMine: boolean
  standing: MoneyLensStanding
  /** "4 days past", "no word · 19 d", "waiting · Nov 2", "they say paid · nothing landed in 9 days", "they say paid", "paid". */
  standingWords: string
}

export interface MoneyLens {
  rows: MoneyLensRow[]
  /** Jobs with money open among the rows. */
  open: number
  /** What is open across them. */
  openTotal: number
  /** Past their word. */
  pastWord: number
  /** They say they paid with nothing landed in a week. */
  stale: number
}

const ORDER: Record<MoneyLensStanding, number> = { past: 0, noWord: 1, stale: 2, waiting: 3, claimed: 4, paid: 5 }

/** Where a line stands, for the lens's order and its first column. */
export function moneyStanding(line: BidMoneyLine, today: string): { standing: MoneyLensStanding; words: string } {
  const open = line.open != null && line.open > 0
  if (!open) return { standing: 'paid', words: line.open == null ? 'not billed' : 'paid' }
  const p = line.promise
  if (!p) {
    const billed = newestBilledYmd(line)
    const days = billed ? daysBetween(billed, today) : null
    return { standing: 'noWord', words: days != null ? `no word · ${days} d` : 'no word' }
  }
  if (p.kind === 'paid_claim') {
    if (line.staleDays) return { standing: 'stale', words: `they say paid · nothing landed in ${line.staleDays === 1 ? '1 day' : `${line.staleDays} days`}` }
    return { standing: 'claimed', words: 'they say paid' }
  }
  if (line.pastDays) return { standing: 'past', words: `${line.pastDays === 1 ? '1 day' : `${line.pastDays} days`} past` }
  return { standing: 'waiting', words: `waiting · ${shortDay(p.promisedYmd)}` }
}

function newestBilledYmd(line: BidMoneyLine): string | null {
  const days = line.bills.map((b) => b.billedYmd).filter((d): d is string => !!d).sort()
  return days.length ? days[days.length - 1]! : null
}

const DAY_MS = 86_400_000
function daysBetween(from: string, to: string): number {
  const at = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)))
  return Math.round((at(to) - at(from)) / DAY_MS)
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
function shortDay(ymd: string): string {
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`
}

/** The lens: the rows with money open (and the paid ones with a live word, so a kept word reads as kept), in chase order. */
export function buildMoneyLens(input: { lines: readonly BidMoneyLine[]; bids: readonly MoneyLensBid[]; authUserId: string | null; today: string; onlyMine: boolean }): MoneyLens {
  const bidById = new Map(input.bids.map((b) => [b.id, b]))
  const rows: MoneyLensRow[] = []
  for (const line of input.lines) {
    const bid = line.bidId ? bidById.get(line.bidId) : undefined
    const isMine = !!input.authUserId && !!bid && (bid.estimatorUserId === input.authUserId || bid.accountManagerUserId === input.authUserId)
    if (input.onlyMine && !isMine) continue
    const { standing, words } = moneyStanding(line, input.today)
    if (standing === 'paid' && !(line.promise && line.open != null)) continue
    rows.push({ line, bidLabel: bid?.label ?? '', estimatorName: bid?.estimatorName ?? null, isMine, standing, standingWords: words })
  }
  rows.sort((a, b) => ORDER[a.standing] - ORDER[b.standing] || (b.line.pastDays ?? 0) - (a.line.pastDays ?? 0) || (b.line.open ?? 0) - (a.line.open ?? 0))
  const openRows = rows.filter((r) => r.line.open != null && r.line.open > 0)
  return {
    rows,
    open: openRows.length,
    openTotal: openRows.reduce((sum, r) => sum + (r.line.open ?? 0), 0),
    pastWord: rows.filter((r) => r.standing === 'past').length,
    stale: rows.filter((r) => r.standing === 'stale').length,
  }
}

/** "3 open · $11,900 · 1 past their word", the lens's rollup and the card's line. */
export function moneyLensRollup(lens: Pick<MoneyLens, 'open' | 'openTotal' | 'pastWord' | 'stale'>): string {
  if (lens.open === 0) return 'nothing open'
  const parts = [`${lens.open} open`, moneyWords(lens.openTotal)]
  if (lens.pastWord > 0) parts.push(`${lens.pastWord} past their word`)
  if (lens.stale > 0) parts.push(`${lens.stale} to ask about`)
  return parts.join(' · ')
}

function moneyWords(n: number): string {
  const cents = Math.round(n * 100)
  if (cents % 100 === 0) return `$${(cents / 100).toLocaleString('en-US')}`
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** The row's word column: the line's word and who said it. */
export function moneyRowWord(line: BidMoneyLine): { word: string | null; by: string | null } {
  const w = bidMoneyWords(line)
  return { word: w.word, by: w.by }
}

export const MONEY_LENS_EMPTY_MINE = 'Nothing is open on the jobs of your bids.'
export const MONEY_LENS_EMPTY_ALL = 'Nothing is open on any won job.'
