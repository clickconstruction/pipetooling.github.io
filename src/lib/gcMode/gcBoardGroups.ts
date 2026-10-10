/**
 * GC mode — design spike: the Project Board grouped by customer (open question 9; the owner,
 * 2026-10-04: a switch between By stage and By customer, By stage selected every time the board
 * opens). The rows are the same; only the sections change. Each customer's section carries the
 * company window's money, and its closed and lost jobs fold into one quiet line.
 */
// What moved to main (the real build) is re-exported from there, so there is one copy.
export { boardSectionCounts, customerGroups } from '../gc/boardGroups'

export type { BoardGroupBy, BoardSection, BoardSectionCount, CustomerGroup } from '../gc/boardGroups'
export { BOARD_SECTION_ORDER, boardCustomerElementId, boardSectionElementId, boardSectionOf, boardSectionWorthWords, customerMoneyWords } from '../gc/boardGroups'
