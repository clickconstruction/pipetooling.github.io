/**
 * What the Sub Labor pay ledger says when it lists nothing (punch list #184, sweep C). Checked in
 * order: no sheet at all (New Sub Labor, the toolbar's own button), the search hid every sheet
 * (Clear the search), then the chip in force, which hid the sheets the search left. *All due*
 * empty is the good state, *No agreement* empty too; any other chip names itself and offers
 * *All due* when sheets have money open.
 */
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from '../emptyWords'
import { PAY_RUN_FILTER_LABEL, type PayRunFilter } from './subLaborPayRun'

export const SUB_LABOR_DUE_EMPTY = 'Nothing is due. Every sheet with a price is paid up.'
export const SUB_LABOR_GAP_EMPTY = 'Every sub sheet with money open has an agreement behind it.'

export function subLaborPayRunEmptyWords(
  state: {
    /** Every sheet on the ledger, before the search and the chip. */
    total: number
    search: string
    /** Sheets the search left, before the chip. */
    matched: number
    filter: PayRunFilter
    /** Sheets under All due. */
    dueCount: number
  },
  press: { newSheet: () => void; clearSearch: () => void; showDue: () => void },
): EmptyStateWords {
  if (state.total === 0) return emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'sub sheets', control: 'New Sub Labor' }), { onPress: press.newSheet })
  if (state.search.trim() && state.matched === 0) return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'sub sheets', query: state.search }), { onPress: press.clearSearch })
  if (state.filter === 'due') return { main: SUB_LABOR_DUE_EMPTY }
  if (state.filter === 'gap') return { main: SUB_LABOR_GAP_EMPTY }
  const main = state.filter === 'ready' ? 'Nothing is ready to pay right now.' : `Nothing under ${PAY_RUN_FILTER_LABEL[state.filter]}.`
  return state.dueCount > 0 ? { main, next: { label: PAY_RUN_FILTER_LABEL.due, onPress: press.showDue }, tail: 'shows every sheet with money open.' } : { main }
}
