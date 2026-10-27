/**
 * Empty words for Duplicates (punch list #184, sweep C): the page finds parts to merge. With only
 * exact names checked, no group offers the page's own Show near-matches; with near-matches on, no
 * group is the good state. `duplicatePartsEmptyWords.test.ts` holds both to plain words.
 */
import type { EmptyStateWords } from '../emptyWords'

export function duplicatePartsEmptyWords(nearMatchesOn: boolean, showNearMatches: () => void): EmptyStateWords {
  if (nearMatchesOn) return { main: 'Nothing to merge.', tail: 'No two parts share a name or a near spelling.' }
  return { main: 'No parts share a name.', next: { label: 'Show near-matches', onPress: showNearMatches }, tail: 'looks for spelling variants.' }
}
