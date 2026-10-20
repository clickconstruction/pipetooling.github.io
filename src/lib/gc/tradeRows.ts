/**
 * GC mode, a project's card (to-do #108, PR 3 of the card in shape D): one row a trade, as words. Until now a trade
 * was said three times on the card: a tile under How the stage is going, a heading with its budget and scope count,
 * then the companies asked with their stories, with nothing tying them. The row says it once: the tile's colour as a
 * stripe, the name and who has it, the scope, the money, where it stands in the stage, who is asked, and what to do
 * next. The page draws the row and keeps the scope lines, the statement of work and the asks under it, folded by a
 * press. Nothing here is JSX.
 */
import { bidsIn, carriedAmount } from './bids'
import type { CardStage } from './cardHead'
import type { GcTradeView } from './projectRows'
import type { HealthTile, TileDot, TileState } from './stageHealth'
import type { Invite, Partner, TradePackage } from './types'
import { money } from './words'

export interface TradeRowFacts {
  stage: CardStage
  /** The page's own row: the scope, the budget, whether it is ours. */
  trade: Pick<GcTradeView, 'id' | 'trade' | 'budget' | 'ours' | 'scope' | 'excludes'>
  /** The board's package, when the reader has the board. Null: the row says the scope and the budget alone. */
  pkg: TradePackage | null
  /** The strip's tile for this trade, when the stage's ring is ready. */
  tile: HealthTile | null
  partners: Pick<Partner, 'id' | 'company' | 'trades'>[]
}

export type AskedTone = 'red' | 'blue' | 'green' | 'grey'

export interface AskedChip {
  company: string
  words: string
  tone: AskedTone
}

export type Standing =
  | { kind: 'quotes'; words: string; tone: 'good' | 'warn' | 'bad' | 'plain' }
  | { kind: 'dots'; dots: TileDot[]; words: string }
  | { kind: 'pct'; pct: number; words: string }
  | { kind: 'words'; words: string; tone: 'bad' | 'plain' }

export interface TradeRow {
  id: string
  trade: string
  ours: boolean
  /** The tile's colour, or none while the ring has not read the stage. */
  stripe: TileState | 'none'
  /** Who has the trade: the company awarded, our own crew, or null while bidding. */
  who: string | null
  /** "1 line", "3 lines, leaves out 1". */
  scope: string
  money: { label: 'Budget' | 'Contract'; words: string } | null
  /** Where the trade stands in its stage: the quotes while bidding, the five dots while buying out, the share done while building. */
  standing: Standing | null
  /** Each company asked, while bidding, with where it stands. */
  asked: AskedChip[]
  /** What waits on whom once awarded, from the tile's note. Null: nothing, or still bidding. */
  waiting: string | null
  /** The one press on the row: Compare quotes once a quote is in, else Ask for quotes while a company is left to ask. */
  next: { key: 'compare' | 'ask'; words: string } | null
}

/** Each ask's state in a word or two, with the chip's tone; the asks' threads below the row say the rest. */
export const ASKED_WORDS: Record<Invite['status'], { tone: AskedTone; words: string }> = {
  invited: { tone: 'red', words: 'has not opened it' },
  opened: { tone: 'blue', words: 'looking' },
  bid: { tone: 'green', words: 'quote in' },
  declined: { tone: 'grey', words: 'passed' },
}

/** The tile colours' meaning, for the band's key. */
export const STRIPE_WORDS: { state: TileState; words: string }[] = [
  { state: 'good', words: 'done for this stage' },
  { state: 'warn', words: 'under way, or waiting on a company' },
  { state: 'bad', words: 'a hole, a problem, or waiting on us' },
  { state: 'ours', words: 'our own crew' },
]

export const BUYOUT_DOT_WORDS = 'Dots, in order: award · master agreement · insurance · W-9 · statement of work'

const lines = (n: number) => `${n} ${n === 1 ? 'line' : 'lines'}`

function companyOf(f: TradeRowFacts, inviteId: string | null | undefined): string | null {
  if (!f.pkg || !inviteId) return null
  const invite = f.pkg.invites.find((i) => i.id === inviteId)
  const partner = invite && f.partners.find((p) => p.id === invite.partnerId)
  return partner?.company ?? null
}

/** The row for one trade. */
export function tradeRow(f: TradeRowFacts): TradeRow {
  const { trade, pkg, tile, stage } = f
  const bidding = stage === 'bidding'
  const scope = `${lines(trade.scope.length)}${trade.excludes.length > 0 ? `, leaves out ${trade.excludes.length}` : ''}`
  const who = trade.ours ? 'our own crew' : bidding ? null : companyOf(f, pkg?.awardedInviteId)

  let moneyCell: TradeRow['money'] = null
  if (bidding) {
    if (trade.budget > 0) moneyCell = { label: 'Budget', words: money(trade.budget) }
  } else if (pkg && !pkg.selfPerform) {
    const contract = pkg.sow ? pkg.sow.price : carriedAmount(pkg)
    if (contract !== null) moneyCell = { label: 'Contract', words: pkg.sow ? money(contract) : `${money(contract)} carried` }
  }

  let standing: Standing | null = null
  let asked: AskedChip[] = []
  let next: TradeRow['next'] = null
  if (bidding && pkg && !pkg.selfPerform) {
    const live = pkg.invites.filter((i) => i.status !== 'declined')
    const quotes = bidsIn(pkg).length
    standing =
      live.length === 0
        ? { kind: 'quotes', words: 'no company asked yet', tone: 'bad' }
        : { kind: 'quotes', words: `${quotes} of ${live.length} in`, tone: quotes >= 2 ? 'good' : quotes === 1 ? 'warn' : 'bad' }
    asked = pkg.invites.map((i) => {
      const partner = f.partners.find((p) => p.id === i.partnerId)
      const w = ASKED_WORDS[i.status]
      return { company: partner?.company ?? 'a company', words: i.status === 'bid' && i.bid ? `${w.words} · ${money(i.bid.amount)}` : w.words, tone: w.tone }
    })
    const askedIds = new Set(pkg.invites.map((i) => i.partnerId))
    const canAsk = f.partners.some((p) => p.trades.includes(trade.trade) && !askedIds.has(p.id))
    next = quotes > 0 ? { key: 'compare', words: `Compare quotes (${quotes})` } : canAsk ? { key: 'ask', words: 'Ask for quotes' } : null
  } else if (tile?.dots) {
    standing = { kind: 'dots', dots: tile.dots, words: tile.main }
  } else if (tile && tile.pct !== undefined) {
    standing = { kind: 'pct', pct: tile.pct, words: tile.main }
  } else if (stage === 'building' && pkg && !pkg.selfPerform) {
    // A trade being built with no tile has no signed statement of work: the ring counts nothing for it yet.
    standing = { kind: 'words', words: pkg.awardedInviteId ? 'no statement of work yet' : 'not awarded', tone: 'bad' }
  }

  return {
    id: trade.id,
    trade: trade.trade,
    ours: trade.ours,
    stripe: tile?.state ?? (trade.ours ? 'ours' : 'none'),
    who,
    scope,
    money: moneyCell,
    standing,
    asked,
    waiting: !bidding && tile ? tile.note : null,
    next,
  }
}

/** The band's words beside its heading: "4, one ours". */
export function tradesWords(rows: Pick<TradeRow, 'ours'>[]): string {
  const ours = rows.filter((r) => r.ours).length
  return `${rows.length}${ours === 0 ? '' : ours === 1 ? ', one ours' : `, ${ours} ours`}`
}
