/**
 * The Schedule Dispatch hub's "Add job to schedule" picker: which jobs and
 * bids a search shows, in what order, and the muted line under each title.
 *
 * Two inputs drive both lists. The number box wins whenever it holds a digit;
 * the search box is read only when the number box has none.
 */
import { compareJobsByCreatedAtDesc } from '../assignJobPickerOrder'
import { stripTrailingZip } from '../displayAddress'
import { findJobsByNumber } from '../jobs/stagesJobNumberJump'
import type { JobScheduleBlockRow } from '../jobScheduleBlocks'
import { scheduleBidAnchorId } from '../scheduleBlockTitle'
import {
  formatScheduleDispatchHubBidTitle,
  sortJobPickerRowsFinishedLast,
  type ScheduleDispatchHubBidRow,
  type ScheduleDispatchHubMergedRow,
} from '../scheduleDispatchHub'
import { denverCalendarDaysBetweenInstantAndNow, formatDenverCalendarDayShort } from '../../utils/dateUtils'

/**
 * Picker subline: "<N>d Mon D | address" (N calendar days since the job was
 * added, app calendar TZ; the address without its zip). Either part optional;
 * undefined when there is neither.
 */
export function hubJobPickerSubline(
  r: { created_at?: string | null; job_address?: string | null },
  nowMs?: number,
): string | undefined {
  const dt = (r.created_at ?? '').trim()
  let dateLabel = ''
  if (dt) {
    const d = new Date(dt)
    if (!Number.isNaN(d.getTime())) {
      const daysAgo = denverCalendarDaysBetweenInstantAndNow(d.getTime(), nowMs)
      dateLabel = `${daysAgo}d ${formatDenverCalendarDayShort(d.getTime())}`
    }
  }
  const address = stripTrailingZip(r.job_address)
  if (dateLabel && address) return `${dateLabel} | ${address}`
  return dateLabel || address || undefined
}

/**
 * The picker's job rows. With a number: the jobs that number finds (exact
 * match first, then the ones that start with it), in the list's own order.
 * Otherwise: the jobs whose number, name, identity line, address or customer
 * contains the search, newest first. Billed and paid jobs go last either way.
 */
export function filterHubJobPickerRows(
  mergedRows: ScheduleDispatchHubMergedRow[],
  search: string,
  numberQuery: string,
): ScheduleDispatchHubMergedRow[] {
  const digits = numberQuery.replace(/\D/g, '')
  if (digits !== '') return sortJobPickerRowsFinishedLast(findJobsByNumber(mergedRows, digits))
  const q = search.trim().toLowerCase()
  let list = mergedRows
  if (q) {
    list = list.filter(
      (r) =>
        (r.hcp_number ?? '').toLowerCase().includes(q) ||
        (r.job_name ?? '').toLowerCase().includes(q) ||
        r.displayTitle.toLowerCase().includes(q) ||
        (r.job_address ?? '').toLowerCase().includes(q) ||
        (r.customer_name ?? '').toLowerCase().includes(q),
    )
  }
  return sortJobPickerRowsFinishedLast([...list].sort(compareJobsByCreatedAtDesc))
}

export type HubBidPickerRow = {
  /** The bid's `bid:<uuid>` anchor. */
  id: string
  displayTitle: string
  serviceTypeName: string | null
  subline: string | undefined
  status: string
  blocksThisWeek: number
  evidence: null
}

/**
 * The picker's bid rows, in the list's own order. With a number: the bids
 * whose number contains those digits. Otherwise: the bids whose number,
 * project, address or identity line contains the search. Each row counts the
 * bid's blocks this week.
 */
export function buildHubBidPickerRows(
  bids: readonly ScheduleDispatchHubBidRow[],
  weekBlocks: readonly Pick<JobScheduleBlockRow, 'bid_id'>[],
  search: string,
  numberQuery: string,
  nowMs?: number,
): HubBidPickerRow[] {
  const digits = numberQuery.replace(/\D/g, '')
  const q = search.trim().toLowerCase()
  let list = bids
  if (digits !== '') {
    list = list.filter((b) => (b.bid_number ?? '').replace(/\D/g, '').includes(digits))
  } else if (q) {
    list = list.filter(
      (b) =>
        (b.bid_number ?? '').toLowerCase().includes(q) ||
        (b.project_name ?? '').toLowerCase().includes(q) ||
        (b.address ?? '').toLowerCase().includes(q) ||
        formatScheduleDispatchHubBidTitle(b.bid_number, b.project_name).toLowerCase().includes(q),
    )
  }
  const blocksThisWeekByBid = new Map<string, number>()
  for (const blk of weekBlocks) {
    if (blk.bid_id != null) {
      blocksThisWeekByBid.set(blk.bid_id, (blocksThisWeekByBid.get(blk.bid_id) ?? 0) + 1)
    }
  }
  return list.map((b) => ({
    id: scheduleBidAnchorId(b.id),
    displayTitle: formatScheduleDispatchHubBidTitle(b.bid_number, b.project_name),
    serviceTypeName: b.service_type?.name ?? null,
    subline: hubJobPickerSubline({ created_at: b.created_at, job_address: b.address }, nowMs),
    status: 'bid',
    blocksThisWeek: blocksThisWeekByBid.get(b.id) ?? 0,
    evidence: null,
  }))
}
