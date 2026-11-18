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

/** One day's row as the grid reads it for the person whose history this is: open, done by them, or done by someone else. */
export function historyCellStatus(
  inst: Pick<HistorySplitInstance, 'completed_at' | 'completed_by_user_id'>,
  selectedUserId: string,
): HistoryCellStatus {
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
        ? historyCellStatus(inst, selectedUserId) === 'completed_by_other'
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
    row.dates[inst.scheduled_date] = historyCellStatus(inst, selectedUserId)
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

/**
 * The wide screen's line where the grid would be, when the window holds one-off tasks and no repeating one. The tab
 * wrote it inline until its move (v2.7754); the words are the same.
 */
export const HISTORY_NO_REPEATING_WORDS = 'No repeating tasks in this range.'

/** The key of one cell of the grid: a task on a day. */
export function historyCellKey(itemId: string, date: string): string {
  return `${itemId}-${date}`
}

/** How many days the grid draws: the newest ones, so a long range stays one screen wide. */
export const HISTORY_GRID_MAX_DAYS = 60

/**
 * The grid's columns, oldest first: every day a repeating task had a row, the newest
 * `HISTORY_GRID_MAX_DAYS` of them. A one-off's lone day mints no column.
 */
export function historyGridDates(repeating: ReadonlyArray<Pick<HistoryRepeatingRow, 'dates'>>): string[] {
  const all = new Set<string>()
  for (const row of repeating) for (const d of Object.keys(row.dates)) all.add(d)
  return Array.from(all).sort().slice(-HISTORY_GRID_MAX_DAYS)
}

/**
 * A row's rate over the days the grid draws: a done day (by anyone) is due and done, a missed day is due,
 * a day with no row is neither. `isDeleted` names a day whose row edit mode just took away, which counts as no row.
 */
export function historyRowRate(
  dates: Readonly<Record<string, HistoryCellStatus>>,
  visibleDates: readonly string[],
  isDeleted: (date: string) => boolean = () => false,
): { due: number; done: number } {
  let due = 0
  let done = 0
  for (const d of visibleDates) {
    const st = isDeleted(d) ? undefined : dates[d]
    if (st === 'completed' || st === 'completed_by_other') {
      due++
      done++
    } else if (st === 'incomplete') due++
  }
  return { due, done }
}

/** The rate as the grid's last column says it: a whole percent, or a dash when nothing was due. */
export function historyRateLabel(rate: { due: number; done: number }): string {
  return rate.due > 0 ? `${Math.round((rate.done / rate.due) * 100)}%` : '—'
}

/** The loaded rows by cell, for edit mode to find the row behind a cell. A later row for the same cell wins. */
export function historyInstanceIndex<T extends { id: string; checklist_item_id: string; scheduled_date: string }>(
  instances: readonly T[],
): Map<string, { id: string; checklist_item_id: string; scheduled_date: string }> {
  const byKey = new Map<string, { id: string; checklist_item_id: string; scheduled_date: string }>()
  for (const inst of instances) {
    byKey.set(historyCellKey(inst.checklist_item_id, inst.scheduled_date), {
      id: inst.id,
      checklist_item_id: inst.checklist_item_id,
      scheduled_date: inst.scheduled_date,
    })
  }
  return byKey
}
