import { val } from '../valuesInPlace'
import type { BoardItem } from './todoBoard'
import { cardsByNumber, tickVerdict, type PunchTick } from './punchListTicks'

/**
 * The punch list's claims: a tick other people can see, released after 12 quiet hours. Taunya's ask
 * of 2026-11-21, the day the tick went live: *"add to the punch list when a user has claimed a card
 * that they are working on, And then they should release that claim after they've not updated the
 * card in 12 hours"*. A second person was about to work from the list, and nothing on the page said
 * which cards were taken.
 *
 * One checkbox, not two: ticking a card claims it. Every row of `punch_list_ticks` is read by
 * everyone who can open the page, and each carries its claimer's name.
 *
 * The rules:
 * - A claim is **fresh** for 12 hours after the newest of three things: the tick, a **Still on it**
 *   press by the claimer (both are the row's `tickedAt`), and the card file's last change on main as
 *   this build read it (`PunchListHistory.touched`, by the card's slug).
 * - After 12 hours with none of those the claim has **gone quiet**. To everyone else the card reads
 *   as free to pick up, with who had it and how long ago it went quiet.
 * - To the claimer, their own tick is wiped once the claim has gone quiet. Their box is clear, their
 *   own page deletes the row, and for that visit the card says the tick was cleared and why. That
 *   is Taunya's answer of 2026-11-24 (*"Wipe it"*) to the question put to her on 2026-11-22. The
 *   other reading of her two asks, where the tick stays marked as gone quiet with **Still on it**
 *   beside it, is still here: `OWN_TICK_AFTER_QUIET` is the one word that picks between them.
 * - A second person may tick a card whose claim has gone quiet. That takes it over: the card reads as
 *   theirs. Where a quiet tick stays, the first person still sees their own.
 * - Two fresh claims on one card are allowed, and the card names both. Two people do work one train,
 *   and a refusal would only make the second person untick a card they are in fact on.
 * - A move to another section still ends a claim, by the rule in `punchListTicks.ts`: a row whose
 *   section is not the card's section today is no claim at all, whoever made it.
 *
 * Nothing expires a row and no job runs. Fresh or quiet is worked out here each time the page draws,
 * and a quiet row goes only when its claimer's own page next opens the board (`usePunchListTicks`).
 * Until then everyone else still reads who had the card.
 */

export const QUIET_AFTER_HOURS = 12
export const QUIET_AFTER_MS = QUIET_AFTER_HOURS * 3_600_000

/**
 * What happens to a person's own tick once their claim has gone quiet. `wiped`: it is gone for them
 * as it is for everyone else, their page deletes the row, and the card says so for that visit
 * (`CardClaims.cleared`). `stays`: they still see it, marked as gone quiet, with Still on it.
 *
 * `wiped` since v2.8441, on Taunya's answer of 2026-11-24. It was built as `stays` (v2.8226) while
 * her answer was awaited. Still on it is offered only on a quiet tick that stays, so with `wiped`
 * no card offers it: a person who is still on a card ticks it again.
 */
export type OwnTickAfterQuiet = 'stays' | 'wiped'
export const OWN_TICK_AFTER_QUIET: OwnTickAfterQuiet = 'wiped'

/** What the claims need of a card: its number, its group today, and the slug its last change is kept under. */
export type ClaimCard = Pick<BoardItem, 'number' | 'group' | 'slug'>

/** One person's claim on one card, as the page draws it. */
export interface CardClaim {
  userId: string
  /** The claimer's name, or `Someone` when the row carries none. */
  name: string
  /** The newest of the tick, a Still on it and the card's last change, in epoch milliseconds. */
  freshAt: number
  /** True once 12 hours have passed since `freshAt`. */
  quiet: boolean
}

/** Everything the page says about who is on one card. */
export interface CardClaims {
  /** The viewer's own claim, fresh or gone quiet; null when they have none (or theirs was wiped). */
  mine: CardClaim | null
  /** The viewer's own claim that went quiet and was wiped: their box is clear and the card says why. Null where a quiet tick stays. */
  cleared: CardClaim | null
  /** Other people's fresh claims, the freshest first. */
  held: CardClaim[]
  /** Other people's claims that have gone quiet, the one that went quiet last first. */
  wentQuiet: CardClaim[]
}

export const NO_CLAIMS: CardClaims = { mine: null, cleared: null, held: [], wentQuiet: [] }

/** The name a row with none reads as. */
export const UNNAMED_CLAIMER = 'Someone'

/** When a claim was last fresh: the newer of what the person said and the card's last change (epoch seconds, as the build read it). */
export function claimFreshAt(tickedAt: string, cardTouchedSec: number | undefined): number {
  const said = Date.parse(tickedAt)
  const touched = cardTouchedSec && Number.isFinite(cardTouchedSec) ? cardTouchedSec * 1000 : 0
  return Math.max(Number.isFinite(said) ? said : 0, touched)
}

/** True once 12 quiet hours have passed. A claim made a moment in the future (two clocks) is fresh. */
export function isQuiet(freshAt: number, nowMs: number): boolean {
  return nowMs - freshAt >= QUIET_AFTER_MS
}

export interface ClaimsRead {
  /** Every card with a claim to say something about, by its number. */
  byCard: Map<number, CardClaims>
  /** The numbers of the cards the viewer's own tick shows on. */
  ticked: ReadonlySet<number>
  /** The cards whose row of the viewer's own went quiet and is to be deleted; empty where a quiet tick stays. */
  wiped: number[]
}

/**
 * Every row sorted into the claims each card shows to this viewer. A row whose card moved to another
 * section or left the list is no claim (`tickVerdict`), whoever made it.
 */
export function readClaims(input: {
  ticks: readonly PunchTick[]
  cards: readonly ClaimCard[]
  boardVersion: string
  me: string | null | undefined
  /** `PunchListHistory.touched`: a card's slug to its last change on main, epoch seconds. */
  touched: Readonly<Record<string, number>> | undefined
  nowMs: number
  ownTickAfterQuiet?: OwnTickAfterQuiet
}): ClaimsRead {
  const { ticks, cards, boardVersion, me, touched, nowMs, ownTickAfterQuiet = OWN_TICK_AFTER_QUIET } = input
  const byNumber = cardsByNumber(cards)
  const byCard = new Map<number, CardClaims>()
  const ticked = new Set<number>()
  const wiped: number[] = []
  for (const tick of ticks) {
    const card = byNumber.get(tick.cardNumber)
    if (!card || tickVerdict(tick, card, boardVersion) !== 'show') continue
    const freshAt = claimFreshAt(tick.tickedAt, touched?.[card.slug])
    const claim: CardClaim = { userId: tick.userId, name: tick.claimerName.trim() || UNNAMED_CLAIMER, freshAt, quiet: isQuiet(freshAt, nowMs) }
    const mine = Boolean(me) && tick.userId === me
    const entry = byCard.get(card.number) ?? { mine: null, cleared: null, held: [], wentQuiet: [] }
    if (mine && claim.quiet && ownTickAfterQuiet === 'wiped') {
      // No tick and no claim: the card only says what became of it.
      wiped.push(card.number)
      entry.cleared = claim
    } else if (mine) {
      entry.mine = claim
      ticked.add(card.number)
    } else if (claim.quiet) entry.wentQuiet.push(claim)
    else entry.held.push(claim)
    byCard.set(card.number, entry)
  }
  for (const entry of byCard.values()) {
    entry.held.sort((a, b) => b.freshAt - a.freshAt || a.name.localeCompare(b.name))
    entry.wentQuiet.sort((a, b) => b.freshAt - a.freshAt || a.name.localeCompare(b.name))
  }
  return { byCard, ticked, wiped: wiped.sort((a, b) => a - b) }
}

/** True when somebody other than the viewer holds the card with a fresh claim. */
export function takenByOthers(claims: CardClaims | undefined): boolean {
  return Boolean(claims && claims.held.length > 0)
}

// ---------- The words ----------

/** How long ago, in the fewest words: `just now`, `25 min ago`, `3 h ago`, `2 days ago`. */
export function agoWords(thenMs: number, nowMs: number): string {
  const min = Math.floor(Math.max(0, nowMs - thenMs) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.floor(h / 24)} days ago`
}

/** `Ana`, `Ana and Ben`, `Ana, Ben and Cal`, each name marked as a value. */
function namesList(names: readonly string[]): string {
  const marked = names.map((n) => (n === 'You' ? n : val('who', n)))
  if (marked.length <= 1) return marked.join('')
  return `${marked.slice(0, -1).join(', ')} and ${marked[marked.length - 1]}`
}

export type ClaimTone = 'mine' | 'taken' | 'quiet' | 'free'

/** One line the card says about its claims. `text` is marked with `val`: the kinds are `who` and `when`. */
export interface ClaimLine {
  tone: ClaimTone
  text: string
  /** True on the viewer's own line once their claim has gone quiet and their tick stayed: the line offers Still on it. */
  stillOn: boolean
}

export const STILL_ON_LABEL = 'Still on it'

/** What a card says to a person whose own tick went quiet and was wiped: what happened, why, and the press that puts it back. */
export const TICK_CLEARED_WORDS = `Your tick was cleared after ${QUIET_AFTER_HOURS} quiet hours. Tick the card again if you are still on it.`

/**
 * What a card says about who is on it, for this viewer: at most two lines, and none for a card nobody
 * has ticked. The first line is who is working on it now, or that it is free. The second is what
 * became of the viewer's own claim once it went quiet: that their tick was cleared, or, where a quiet
 * tick stays, that the claim went quiet with Still on it.
 */
export function claimLines(claims: CardClaims | undefined, nowMs: number): ClaimLine[] {
  if (!claims) return []
  const lines: ClaimLine[] = []
  const mineFresh = claims.mine && !claims.mine.quiet ? claims.mine : null
  const mineQuiet = claims.mine && claims.mine.quiet ? claims.mine : null
  const working = [...(mineFresh ? [mineFresh] : []), ...claims.held]
  if (working.length > 0) {
    const names = [...(mineFresh ? ['You'] : []), ...claims.held.map((c) => c.name)]
    const newest = Math.max(...working.map((c) => c.freshAt))
    const verb = names.length === 1 && names[0] !== 'You' ? 'is' : 'are'
    lines.push({
      tone: claims.held.length > 0 ? 'taken' : 'mine',
      text: `${namesList(names)} ${verb} working on this. Last update ${val('when', agoWords(newest, nowMs))}.`,
      stillOn: false,
    })
  } else if (claims.wentQuiet.length > 0) {
    const last = claims.wentQuiet[0]!
    lines.push({
      tone: 'free',
      text: `Free to pick up. ${val('who', last.name)} had it and went quiet ${val('when', agoWords(last.freshAt + QUIET_AFTER_MS, nowMs))}.`,
      stillOn: false,
    })
  }
  if (mineQuiet) {
    lines.push({
      tone: 'quiet',
      // With somebody else on the card it is not free, so the line says only what became of the viewer's own claim.
      text: `Your claim went quiet ${val('when', agoWords(mineQuiet.freshAt + QUIET_AFTER_MS, nowMs))}.${claims.held.length > 0 ? '' : ' Others see this card as free to pick up.'}`,
      stillOn: true,
    })
  } else if (claims.cleared) {
    lines.push({ tone: 'quiet', text: TICK_CLEARED_WORDS, stillOn: false })
  }
  return lines
}
