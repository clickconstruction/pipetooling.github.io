/**
 * What the Bids lists say when they are empty (punch list #184, sweep C): the Bid Board as a
 * whole, the five piles the Bid Board and Submission follow-up share (one set of words, since both
 * list the same piles), Bid costs' window, the Working board, Builder review, the Robot queue's
 * Ready lane and the Scoreboard, Waiting to hear, and Why we lost with its bid tabs panel. Each
 * says what fills the list and offers the surface's own press: New Bid, Clear the search or Clear
 * the filters, the Marked switch's Show every bid, a wider window, or the tab that fills it. Where
 * empty is the good state it says so. The words are `emptyWords`' kinds; the presses are the
 * caller's handlers.
 */
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from '../emptyWords'
import { PURSUIT_OUTCOMES, PURSUIT_WINDOW_WORDS, type PursuitFilter, type PursuitWindow } from './bidPursuit'
import type { SubmissionSectionKey } from './submissionSections'
import { BID_LOSS_LEARN_WINDOWS, type BidLossLearnWindowKey } from '../bidLossLearn'

/** The press that turns the Marked switch off, named as the picker's "only my bids" one is. */
export const SHOW_EVERY_BID = 'Show every bid'

/** The Bids page's line for a bid waiting on plans opens the Robot Board with this label. */
export const ADD_THE_PLANS = 'Add the plans'

type HiddenBy = {
  query: string
  clearQuery: () => void
  /** The Bid Board's Marked switch is on. */
  onlyMarked?: boolean
  showEveryBid?: () => void
}

/**
 * What hides a list's bids: its search, the Marked switch, or both. The search is quoted only when
 * it alone hides them; with both on, one press clears both. Null when neither is on.
 */
function hiddenBidsWords(noun: string, s: HiddenBy): EmptyStateWords | null {
  const searching = s.query.trim() !== ''
  const showEveryBid = s.onlyMarked ? s.showEveryBid : undefined
  if (searching && showEveryBid) {
    return emptyWordsWithPress(emptyWords({ kind: 'filter', noun, query: '' }), {
      onPress: () => {
        s.clearQuery()
        showEveryBid()
      },
    })
  }
  if (searching) return emptyWordsWithPress(emptyWords({ kind: 'filter', noun, query: s.query }), { onPress: s.clearQuery })
  if (showEveryBid) return { main: `None of the ${noun} are marked.`, next: { label: SHOW_EVERY_BID, onPress: showEveryBid } }
  return null
}

/** The whole Bid Board: no bids at all (New Bid, when the viewer may make one), or the search and Marked hide them. */
export function bidBoardEmptyWords(s: HiddenBy & { total: number; newBid?: (() => void) | null }): EmptyStateWords {
  if (s.total === 0) {
    const words = emptyWords({ kind: 'make', noun: 'bids', control: 'New Bid' })
    return s.newBid ? emptyWordsWithPress(words, { onPress: s.newBid }) : { main: words.main }
  }
  return hiddenBidsWords('bids', s) ?? { main: 'No bids to show.' }
}

/** One pile's noun, for the words a search or the Marked switch gives it. */
const GROUP_NOUN: Record<SubmissionSectionKey, string> = {
  unsent: 'unsent bids',
  pending: 'pending bids',
  won: 'won bids',
  startedOrComplete: 'started bids',
  lost: 'lost bids',
}

/**
 * Each pile's own words when nothing hides its rows. Unsent and Not yet won or lost are waiting
 * lists, so empty is the good state. A won bid waits for its job, and opening the job moves it
 * to Started or Complete.
 */
export const BID_GROUP_EMPTY: Record<SubmissionSectionKey, string> = {
  unsent: 'Nothing waiting to go out.',
  pending: emptyWords({ kind: 'waiting', who: 'a GC' }).main,
  won: 'No won bid is waiting for its job.',
  startedOrComplete: 'No won bid has a job yet.',
  lost: 'No bid has been lost.',
}

/**
 * One pile on the Bid Board or Submission follow-up. The search (and the board's Marked switch)
 * may hide its rows; else it says its good state, and an empty Unsent pile offers New Bid.
 */
export function bidGroupEmptyWords(s: HiddenBy & { group: SubmissionSectionKey; newBid?: (() => void) | null }): EmptyStateWords {
  const hidden = hiddenBidsWords(GROUP_NOUN[s.group], s)
  if (hidden) return hidden
  const main = BID_GROUP_EMPTY[s.group]
  return s.group === 'unsent' && s.newBid ? { main, next: { label: 'New Bid', onPress: s.newBid }, tail: 'starts the next one.' } : { main }
}

/** The next wider Bid costs window, or null at All. */
export function widerPursuitWindow(window: PursuitWindow): PursuitWindow | null {
  if (window === '90d') return 'year'
  if (window === 'year') return 'all'
  return null
}

/**
 * A Bid costs list the window empties: "No clocked time in the last 90 days. Widen the window ▸
 * looks at the last 12 months." At All there is nothing wider, so it says what is missing.
 */
export function pursuitWindowEmptyWords(what: string, window: PursuitWindow, widen: (wider: PursuitWindow) => void): EmptyStateWords {
  const wider = widerPursuitWindow(window)
  if (!wider) return { main: `${what} yet.` }
  return {
    main: `${what} in the ${PURSUIT_WINDOW_WORDS[window]}.`,
    next: { label: 'Widen the window', onPress: () => widen(wider) },
    tail: wider === 'all' ? 'looks at all time.' : `looks at the ${PURSUIT_WINDOW_WORDS[wider]}.`,
  }
}

/** An outcome chip is off, or the estimator or GC chip is on: the filters, not the window, hide rows. */
export function pursuitFilterNarrowed(f: Pick<PursuitFilter, 'outcomes' | 'estimator' | 'gc'>): boolean {
  return PURSUIT_OUTCOMES.some((o) => !f.outcomes.has(o)) || f.estimator != null || f.gc != null
}

/**
 * Bid costs' table. The chips first, since one press clears them and the search. Then the search,
 * quoted. Then the window. "Bids with time" while bids with no time stay hidden.
 */
export function bidCostsTableEmptyWords(
  f: Pick<PursuitFilter, 'window' | 'outcomes' | 'estimator' | 'gc' | 'query' | 'showEmpty'>,
  presses: { clearSearch: () => void; clearFilters: () => void; widen: (wider: PursuitWindow) => void },
): EmptyStateWords {
  if (pursuitFilterNarrowed(f)) return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'bids', query: '' }), { onPress: presses.clearFilters })
  if (f.query.trim()) return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'bids', query: f.query }), { onPress: presses.clearSearch })
  return pursuitWindowEmptyWords(f.showEmpty ? 'No bids' : 'No bids with time', f.window, presses.widen)
}

/** The Working board: no unsent bid names the viewer in this trade. The Bid Board lists every bid. */
export function workingBoardEmptyWords(s: { trade: string | null; openBidBoard?: (() => void) | null }): EmptyStateWords {
  const trade = (s.trade ?? '').trim()
  const main = trade ? `Nothing is assigned to you on ${trade}.` : 'Nothing is assigned to you.'
  return s.openBidBoard ? { main, next: { label: 'Bid Board', onPress: s.openBidBoard }, tail: 'lists every bid.' } : { main }
}

/**
 * Builder review's call queue: the search hides the builders, or Oldest first set every builder
 * with bids aside (snoozed or PIA, listed below), or no builder has a bid yet.
 */
export function builderReviewEmptyWords(s: { query: string; clearQuery: () => void; setAside: boolean; newBid?: (() => void) | null }): EmptyStateWords {
  if (s.query.trim()) return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'builders', query: s.query }), { onPress: s.clearQuery })
  if (s.setAside) return { main: emptyWords({ kind: 'waiting', who: 'you' }).main, tail: 'Every builder with bids is snoozed or marked PIA.' }
  const main = 'No builder has a bid yet.'
  return s.newBid ? { main, next: { label: 'New Bid', onPress: s.newBid }, tail: 'starts one for a builder.' } : { main }
}

/** The Robot queue's Ready lane: a bid is ready once its plans are on it. */
export function robotReadyEmptyWords(addPlans?: (() => void) | null): EmptyStateWords {
  const main = 'Nothing ready. A bid is ready once its plans are on it.'
  return addPlans ? { main, next: { label: ADD_THE_PLANS, onPress: addPlans } } : { main }
}

/** The Scoreboard's job types: no run scored yet, and plans on a bid are what let a robot take it. */
export function robotScoreboardEmptyWords(addPlans?: (() => void) | null): EmptyStateWords {
  const main = 'No scored runs yet.'
  return addPlans ? { main, next: { label: ADD_THE_PLANS, onPress: addPlans }, tail: 'lets a robot bid the next one.' } : { main }
}

/** Waiting to hear with nothing in the queue: every sent bid in the trade has its answer. */
export const WAITING_TO_HEAR_EMPTY: EmptyStateWords = { main: 'Nothing waiting on a GC in this trade.', tail: 'There is nothing to chase.' }

/** Why we lost with no lost bid in the trade. */
export const WHY_WE_LOST_EMPTY: EmptyStateWords = { main: 'No lost bids in this trade yet.', tail: 'There is nothing to explain.' }

/** Why we lost with the "bids by" select on someone who lost none: All estimators puts the queue back. */
export function whyWeLostEstimatorEmptyWords(name: string, showAll: () => void): EmptyStateWords {
  return { main: `No lost bids by ${name} in this trade.`, next: { label: 'All estimators', onPress: showAll }, tail: 'shows every lost bid.' }
}

/**
 * Why we lost's bid tabs panel with no tab recorded. In a shorter range, All time brings the older
 * tabs back. With none at all, a tab is recorded on a lost bid above, or on Waiting to hear when
 * the GC shares it before the answer.
 */
export function learnPanelEmptyWords(windowKey: BidLossLearnWindowKey, showAllTime: () => void): EmptyStateWords {
  const allTime = BID_LOSS_LEARN_WINDOWS.find((w) => w.key === 'all')
  if (windowKey !== 'all' && allTime) return { main: 'No bid tabs recorded in this range.', next: { label: allTime.label, onPress: showAllTime }, tail: 'shows every tab.' }
  return {
    main: 'No bid tabs recorded yet. When a GC shares one, press record the bid tab on a lost bid.',
    next: { label: 'Waiting to hear', to: '/bids?tab=waiting-to-hear' },
    tail: 'saves one too, with Bid tab received.',
  }
}
