/**
 * What the shared bid picker says when it is empty (punch list #184, sweep C): one fix for the
 * nine Bids tabs that feed `BidPickerStandardList`. Three cases, in the order they are checked:
 * no bids at all (the make press, New Bid through the Bids page's `?newBid=true` deep link, since
 * the tabs cannot reach the board's opener), "only my bids" hiding every bid (Show every bid), and
 * a search with no match (Clear the search). Null when none of the three explains the empty list.
 */
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from '../emptyWords'

/** The Bids page opens New Bid on this link (`pages/Bids.tsx`, the Projects card's "+ Bid" deep link). */
export const NEW_BID_PATH = '/bids?newBid=true'

export const BID_PICKER_NONE_NAME_YOU = 'None of the bids name you.'

export function bidPickerEmptyWords(state: {
  /** Every bid the tab was given. */
  total: number
  onlyMyBids: boolean
  /** How many of them name the viewer as estimator or account manager. */
  mine: number
  query: string
  clearQuery: () => void
  showEveryBid: () => void
}): EmptyStateWords | null {
  if (state.total === 0) return emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'bids', control: 'New Bid' }), { to: NEW_BID_PATH })
  if (state.onlyMyBids && state.mine === 0) return { main: BID_PICKER_NONE_NAME_YOU, next: { label: 'Show every bid', onPress: state.showEveryBid } }
  if (state.query.trim()) return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'bids', query: state.query }), { onPress: state.clearQuery })
  return null
}
