import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'

/**
 * History-tab split (v2.2091): repeating tasks keep the compliance grid but
 * each row starts at the task's birthday; one-off tasks leave the grid for a
 * created → done ledger. Pure — the tab fetches, this shapes.
 */

export type HistorySplitInstance = {
  id: string
  checklist_item_id: string
  scheduled_date: string
  completed_at: string | null
  completed_by_user_id: string | null
  checklist_items?: {
    title?: string
    links?: string[] | null
    repeat_type?: string | null
    created_at?: string | null
  } | null
}

export type HistoryCellStatus = 'completed' | 'completed_by_other' | 'incomplete'

export type HistoryRepeatingRow = {
  itemId: string
  title: string
  links?: string[] | null
  /** The task's birthday — the row renders nothing before this day. */
  sinceYmd: string
  dates: Record<string, HistoryCellStatus>
}

export type HistoryOneOffStatus = 'done' | 'done_by_other' | 'missed' | 'open'

export type HistoryOneOffRow = {
  itemId: string
  instanceId: string
  title: string
  links?: string[] | null
  createdYmd: string | null
  scheduledYmd: string
  completedYmd: string | null
  status: HistoryOneOffStatus
}

function cellStatus(inst: HistorySplitInstance, selectedUserId: string): HistoryCellStatus {
  if (!inst.completed_at) return 'incomplete'
  return inst.completed_by_user_id && inst.completed_by_user_id !== selectedUserId
    ? 'completed_by_other'
    : 'completed'
}

function itemCreatedYmd(inst: HistorySplitInstance): string | null {
  const iso = inst.checklist_items?.created_at
  if (!iso) return null
  try {
    return calendarYmdInAppTzFromIso(iso)
  } catch {
    return null
  }
}

/**
 * Repeating rows (row birth = the earlier of item created day and its first
 * instance — backfilled instances can predate the stored created_at) and
 * one-off rows, newest first. `repeat_type` missing or 'once' = one-off.
 */
export function splitHistoryItems(
  instances: HistorySplitInstance[],
  selectedUserId: string,
  todayYmd: string,
): { repeating: HistoryRepeatingRow[]; oneOffs: HistoryOneOffRow[] } {
  const repeatingByItem = new Map<string, HistoryRepeatingRow>()
  const oneOffs: HistoryOneOffRow[] = []
  for (const inst of instances) {
    const item = inst.checklist_items
    const title = (item?.title ?? '').trim() || 'Untitled'
    const isRepeating = item?.repeat_type != null && item.repeat_type !== 'once'
    const createdYmd = itemCreatedYmd(inst)
    if (!isRepeating) {
      const status: HistoryOneOffStatus = inst.completed_at
        ? cellStatus(inst, selectedUserId) === 'completed_by_other'
          ? 'done_by_other'
          : 'done'
        : inst.scheduled_date < todayYmd
          ? 'missed'
          : 'open'
      oneOffs.push({
        itemId: inst.checklist_item_id,
        instanceId: inst.id,
        title,
        links: item?.links,
        createdYmd,
        scheduledYmd: inst.scheduled_date,
        completedYmd: inst.completed_at ? calendarYmdInAppTzFromIso(inst.completed_at) : null,
        status,
      })
      continue
    }
    let row = repeatingByItem.get(inst.checklist_item_id)
    if (!row) {
      row = {
        itemId: inst.checklist_item_id,
        title,
        links: item?.links,
        sinceYmd: inst.scheduled_date,
        dates: {},
      }
      repeatingByItem.set(inst.checklist_item_id, row)
    }
    const birthCandidates = [row.sinceYmd, inst.scheduled_date, ...(createdYmd ? [createdYmd] : [])]
    row.sinceYmd = birthCandidates.sort()[0]!
    row.dates[inst.scheduled_date] = cellStatus(inst, selectedUserId)
  }
  oneOffs.sort((a, b) => (b.createdYmd ?? b.scheduledYmd).localeCompare(a.createdYmd ?? a.scheduledYmd))
  return { repeating: [...repeatingByItem.values()], oneOffs }
}

/** "6/14" from "2026-06-14" for the since/created/done labels. */
export function historyShortDate(ymd: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${Number(m[1])}/${Number(m[2])}`
}
