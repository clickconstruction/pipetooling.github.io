import { describe, expect, it, vi } from 'vitest'
import {
  ADD_THE_PLANS,
  BID_GROUP_EMPTY,
  SHOW_EVERY_BID,
  WAITING_TO_HEAR_EMPTY,
  WHY_WE_LOST_EMPTY,
  bidBoardEmptyWords,
  bidCostsTableEmptyWords,
  bidGroupEmptyWords,
  builderReviewEmptyWords,
  learnPanelEmptyWords,
  pursuitFilterNarrowed,
  pursuitWindowEmptyWords,
  robotReadyEmptyWords,
  robotScoreboardEmptyWords,
  whyWeLostEstimatorEmptyWords,
  widerPursuitWindow,
  workingBoardEmptyWords,
} from './bidsEmptyWords'
import { DEFAULT_PURSUIT_FILTER, PURSUIT_OUTCOMES, type PursuitFilter, type PursuitOutcome } from './bidPursuit'
import type { EmptyStateWords } from '../emptyWords'
import { plainWordsFailures } from '../plainWords'

/** The sentence a person reads: the words, the press's label, the words after it. */
const read = (w: EmptyStateWords) => [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')
const press = (w: EmptyStateWords) => {
  if (!w.next || !('onPress' in w.next)) throw new Error(`no press on: ${read(w)}`)
  w.next.onPress()
}

describe('bidBoardEmptyWords: the whole Bid Board', () => {
  it('no bids at all: New Bid adds the first, or the words alone for a role with no New Bid', () => {
    const newBid = vi.fn()
    const words = bidBoardEmptyWords({ total: 0, query: '', clearQuery: vi.fn(), newBid })
    expect(read(words)).toBe('No bids yet. New Bid adds the first.')
    press(words)
    expect(newBid).toHaveBeenCalledTimes(1)
    expect(bidBoardEmptyWords({ total: 0, query: '', clearQuery: vi.fn(), newBid: null })).toEqual({ main: 'No bids yet.' })
  })

  it('a search quotes itself and clears; the Marked switch offers Show every bid; both clear at once', () => {
    const clearQuery = vi.fn()
    const showEveryBid = vi.fn()
    const searched = bidBoardEmptyWords({ total: 9, query: ' Ridgeway ', clearQuery, showEveryBid })
    expect(read(searched)).toBe('No bids match ‘Ridgeway’. Clear the search')
    press(searched)
    expect(clearQuery).toHaveBeenCalledTimes(1)

    const marked = bidBoardEmptyWords({ total: 9, query: '', clearQuery, onlyMarked: true, showEveryBid })
    expect(read(marked)).toBe(`None of the bids are marked. ${SHOW_EVERY_BID}`)
    press(marked)
    expect(showEveryBid).toHaveBeenCalledTimes(1)

    const both = bidBoardEmptyWords({ total: 9, query: 'Ridgeway', clearQuery, onlyMarked: true, showEveryBid })
    expect(read(both)).toBe('No bids match the filters. Clear the filters')
    press(both)
    expect(clearQuery).toHaveBeenCalledTimes(2)
    expect(showEveryBid).toHaveBeenCalledTimes(2)
  })
})

describe('bidGroupEmptyWords: the five piles of the Bid Board and Submission follow-up', () => {
  it('each pile says its own good state when nothing hides its rows', () => {
    const groups = ['unsent', 'pending', 'won', 'startedOrComplete', 'lost'] as const
    expect(groups.map((group) => bidGroupEmptyWords({ group, query: '', clearQuery: vi.fn() }).main)).toEqual([
      'Nothing waiting to go out.',
      'Nothing waiting on a GC.',
      'No won bid is waiting for its job.',
      'No won bid has a job yet.',
      'No bid has been lost.',
    ])
    for (const group of groups) expect(bidGroupEmptyWords({ group, query: '', clearQuery: vi.fn() }).next).toBeUndefined()
  })

  it('an empty Unsent pile offers New Bid where the surface can open it, and only Unsent does', () => {
    const newBid = vi.fn()
    const unsent = bidGroupEmptyWords({ group: 'unsent', query: '', clearQuery: vi.fn(), newBid })
    expect(read(unsent)).toBe('Nothing waiting to go out. New Bid starts the next one.')
    press(unsent)
    expect(newBid).toHaveBeenCalledTimes(1)
    expect(bidGroupEmptyWords({ group: 'lost', query: '', clearQuery: vi.fn(), newBid }).next).toBeUndefined()
  })

  it('a search or the Marked switch names the pile', () => {
    expect(read(bidGroupEmptyWords({ group: 'pending', query: 'Ridgeway', clearQuery: vi.fn() }))).toBe('No pending bids match ‘Ridgeway’. Clear the search')
    expect(read(bidGroupEmptyWords({ group: 'won', query: '', clearQuery: vi.fn(), onlyMarked: true, showEveryBid: vi.fn() }))).toBe('None of the won bids are marked. Show every bid')
    // The Marked switch with no way to turn it off from here is not offered.
    expect(bidGroupEmptyWords({ group: 'won', query: '', clearQuery: vi.fn(), onlyMarked: true }).main).toBe(BID_GROUP_EMPTY.won)
  })
})

describe('Bid costs: the window and the filters', () => {
  it('widens one step at a time, and All is the widest', () => {
    expect([widerPursuitWindow('90d'), widerPursuitWindow('year'), widerPursuitWindow('all')]).toEqual(['year', 'all', null])
  })

  it('names the window it searched and the one Widen the window opens', () => {
    const widen = vi.fn()
    const ninety = pursuitWindowEmptyWords('No clocked time', '90d', widen)
    expect(read(ninety)).toBe('No clocked time in the last 90 days. Widen the window looks at the last 12 months.')
    press(ninety)
    expect(widen).toHaveBeenCalledWith('year')
    expect(read(pursuitWindowEmptyWords('No bids', 'year', widen))).toBe('No bids in the last 12 months. Widen the window looks at all time.')
    expect(pursuitWindowEmptyWords('No bids', 'all', widen)).toEqual({ main: 'No bids yet.' })
  })

  it('the table: the chips first, then the search, then the window', () => {
    const presses = { clearSearch: vi.fn(), clearFilters: vi.fn(), widen: vi.fn() }
    const lostOnly: PursuitFilter = { ...DEFAULT_PURSUIT_FILTER, outcomes: new Set<PursuitOutcome>(['lost']), query: 'ridge' }
    expect(pursuitFilterNarrowed(lostOnly)).toBe(true)
    expect(pursuitFilterNarrowed({ ...DEFAULT_PURSUIT_FILTER, estimator: 'Wendi' })).toBe(true)
    expect(pursuitFilterNarrowed(DEFAULT_PURSUIT_FILTER)).toBe(false)
    const chips = bidCostsTableEmptyWords(lostOnly, presses)
    expect(read(chips)).toBe('No bids match the filters. Clear the filters')
    press(chips)
    expect(presses.clearFilters).toHaveBeenCalledTimes(1)
    expect(read(bidCostsTableEmptyWords({ ...DEFAULT_PURSUIT_FILTER, query: 'ridge' }, presses))).toBe('No bids match ‘ridge’. Clear the search')
    expect(read(bidCostsTableEmptyWords(DEFAULT_PURSUIT_FILTER, presses))).toBe('No bids with time in the last 12 months. Widen the window looks at all time.')
    expect(read(bidCostsTableEmptyWords({ ...DEFAULT_PURSUIT_FILTER, window: 'all', showEmpty: true }, presses))).toBe('No bids yet.')
    expect(PURSUIT_OUTCOMES.every((o) => DEFAULT_PURSUIT_FILTER.outcomes.has(o))).toBe(true)
  })
})

describe('the Working board, Builder review, the robots and the lenses', () => {
  it('Working board: nothing assigned on the trade, and the Bid Board lists every bid', () => {
    const openBidBoard = vi.fn()
    const words = workingBoardEmptyWords({ trade: 'Plumbing', openBidBoard })
    expect(read(words)).toBe('Nothing is assigned to you on Plumbing. Bid Board lists every bid.')
    press(words)
    expect(openBidBoard).toHaveBeenCalledTimes(1)
    expect(workingBoardEmptyWords({ trade: ' ', openBidBoard: null })).toEqual({ main: 'Nothing is assigned to you.' })
  })

  it('Builder review: the search, the builders Oldest first set aside, or no builder with a bid', () => {
    const clearQuery = vi.fn()
    expect(read(builderReviewEmptyWords({ query: 'Hartline', clearQuery, setAside: true }))).toBe('No builders match ‘Hartline’. Clear the search')
    expect(read(builderReviewEmptyWords({ query: '', clearQuery, setAside: true }))).toBe('Nothing waiting on you. Every builder with bids is snoozed or marked PIA.')
    const newBid = vi.fn()
    const none = builderReviewEmptyWords({ query: '', clearQuery, setAside: false, newBid })
    expect(read(none)).toBe('No builder has a bid yet. New Bid starts one for a builder.')
    press(none)
    expect(newBid).toHaveBeenCalledTimes(1)
  })

  it('the Ready lane and the Scoreboard send the person to Add the plans', () => {
    const addPlans = vi.fn()
    const ready = robotReadyEmptyWords(addPlans)
    expect(read(ready)).toBe(`Nothing ready. A bid is ready once its plans are on it. ${ADD_THE_PLANS}`)
    press(ready)
    expect(read(robotScoreboardEmptyWords(addPlans))).toBe('No scored runs yet. Add the plans lets a robot bid the next one.')
    expect(robotScoreboardEmptyWords(null)).toEqual({ main: 'No scored runs yet.' })
    expect(robotReadyEmptyWords()).toEqual({ main: 'Nothing ready. A bid is ready once its plans are on it.' })
  })

  it('Why we lost’s bid tabs panel: All time in a shorter range, else where a tab is recorded', () => {
    const showAllTime = vi.fn()
    const range = learnPanelEmptyWords('12', showAllTime)
    expect(read(range)).toBe('No bid tabs recorded in this range. All time shows every tab.')
    press(range)
    expect(showAllTime).toHaveBeenCalledTimes(1)
    const none = learnPanelEmptyWords('all', showAllTime)
    expect(read(none)).toBe('No bid tabs recorded yet. When a GC shares one, press record the bid tab on a lost bid. Waiting to hear saves one too, with Bid tab received.')
    expect(none.next).toEqual({ label: 'Waiting to hear', to: '/bids?tab=waiting-to-hear' })
  })

  it('Why we lost: All estimators puts the queue back', () => {
    const showAll = vi.fn()
    const words = whyWeLostEstimatorEmptyWords('Wendi', showAll)
    expect(read(words)).toBe('No lost bids by Wendi in this trade. All estimators shows every lost bid.')
    press(words)
    expect(showAll).toHaveBeenCalledTimes(1)
  })
})

describe('every sentence reads in plain words', () => {
  it('none over 20 words, no dash, semicolon or parenthesis', () => {
    const fn = vi.fn()
    const all: EmptyStateWords[] = [
      bidBoardEmptyWords({ total: 0, query: '', clearQuery: fn, newBid: fn }),
      bidBoardEmptyWords({ total: 3, query: '', clearQuery: fn, onlyMarked: true, showEveryBid: fn }),
      ...(['unsent', 'pending', 'won', 'startedOrComplete', 'lost'] as const).map((group) => bidGroupEmptyWords({ group, query: '', clearQuery: fn, newBid: fn })),
      bidGroupEmptyWords({ group: 'startedOrComplete', query: '', clearQuery: fn, onlyMarked: true, showEveryBid: fn }),
      pursuitWindowEmptyWords('No clocked time', '90d', fn),
      bidCostsTableEmptyWords(DEFAULT_PURSUIT_FILTER, { clearSearch: fn, clearFilters: fn, widen: fn }),
      workingBoardEmptyWords({ trade: 'Plumbing', openBidBoard: fn }),
      builderReviewEmptyWords({ query: '', clearQuery: fn, setAside: true }),
      builderReviewEmptyWords({ query: '', clearQuery: fn, setAside: false, newBid: fn }),
      robotReadyEmptyWords(fn),
      robotScoreboardEmptyWords(fn),
      WAITING_TO_HEAR_EMPTY,
      WHY_WE_LOST_EMPTY,
      whyWeLostEstimatorEmptyWords('Wendi', fn),
      learnPanelEmptyWords('6', fn),
      learnPanelEmptyWords('all', fn),
    ]
    for (const w of all) expect(plainWordsFailures(read(w)), read(w)).toEqual([])
  })
})
