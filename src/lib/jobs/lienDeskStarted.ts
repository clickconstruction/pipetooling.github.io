import { daysBetweenYmd } from './billedExpectedPay'
import { LIEN_DESK_LEAD_DAYS, type LienDeskItemRow } from './lienDesk'

/**
 * A started paper stays on the desk, whatever its day (v2.7261, punch list #354).
 *
 * The desk lists what is due within thirty days (`LIEN_DESK_LEAD_DAYS`) and builds every list from the readers' rows
 * alone, so a paper someone had already drafted, sent for approval, approved or held dropped off every list while its
 * day was further out: three affidavits drafted on 2026-11-14 for a Dec 15 day showed in their jobs' Lien windows and
 * nowhere on the desk. The owner chose this over widening the window for every job, which would roughly double the
 * To do count and move the lien calendar's draft band, the supplier dates and the timeline book with it.
 *
 * So the desk's read asks the three readers further ahead (`LIEN_DESK_STARTED_READ_DAYS`) and keeps a row when its
 * day is inside the lead, or when its job holds a started desk item of the same kind. A started item is one that is
 * not voided, not sent and not missed: the rule `itemIsLive` already uses for the notice queue. A notice row further
 * out stays only when the started notice names its month, so a draft for September never brings October's window
 * onto To send for Master approval with it. A row with no day (a retainage clock not started) is the reader's own to keep. Pure.
 */

/** How far ahead the desk's read asks each reader, so a started paper further out than the lead is in the rows. */
export const LIEN_DESK_STARTED_READ_DAYS = 180

export type LienDeskStartedKind = 'notice_53_056' | 'affidavit' | 'retainage_53_057'

type StartedItem = Pick<LienDeskItemRow, 'job_id' | 'kind' | 'status' | 'voided_at' | 'months'>

/** A paper someone started and nobody finished: not voided, not sent, not missed. */
export function lienDeskItemStarted(item: Pick<LienDeskItemRow, 'status' | 'voided_at'>): boolean {
  return item.voided_at == null && item.status !== 'sent' && item.status !== 'missed'
}

/** The jobs holding a started item of one kind. */
export function lienDeskStartedJobIds(items: ReadonlyArray<StartedItem>, kind: LienDeskStartedKind): Set<string> {
  const ids = new Set<string>()
  for (const it of items) if (it.kind === kind && lienDeskItemStarted(it)) ids.add(it.job_id)
  return ids
}

/** The months every started notice on a job names, by job. */
export function lienDeskStartedNoticeMonths(items: ReadonlyArray<StartedItem>): Map<string, Set<string>> {
  const byJob = new Map<string, Set<string>>()
  for (const it of items) {
    if (it.kind !== 'notice_53_056' || !lienDeskItemStarted(it)) continue
    const set = byJob.get(it.job_id) ?? new Set<string>()
    for (const m of it.months ?? []) set.add(m)
    byJob.set(it.job_id, set)
  }
  return byJob
}

/** A day inside the desk's lead, or no day at all: the reader's own window kept it, so the desk keeps it too. */
export function lienDeskDayInsideLead(deadline: string | null | undefined, todayYmd: string, leadDays: number = LIEN_DESK_LEAD_DAYS): boolean {
  const d = (deadline ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return true
  const days = daysBetweenYmd(todayYmd, d)
  return days == null || days <= leadDays
}

/**
 * The affidavit or retainage rows the desk keeps from a further read: a row inside the lead, or on a job with a
 * started item of that kind. Order unchanged.
 */
export function lienDeskKeepRows<R extends { job_id: string; deadline: string | null }>(
  rows: ReadonlyArray<R>,
  items: ReadonlyArray<StartedItem>,
  kind: 'affidavit' | 'retainage_53_057',
  todayYmd: string,
): R[] {
  const started = lienDeskStartedJobIds(items, kind)
  return rows.filter((r) => lienDeskDayInsideLead(r.deadline, todayYmd) || started.has(r.job_id))
}

/**
 * The notice month rows the desk keeps from a further read: a month inside the lead, or a month a started notice on
 * the job names. A started notice brings only its own months, never the job's later windows. Order unchanged.
 */
export function lienDeskKeepNoticeRows<R extends { job_id: string; work_month: string; deadline: string | null }>(
  rows: ReadonlyArray<R>,
  items: ReadonlyArray<StartedItem>,
  todayYmd: string,
): R[] {
  const named = lienDeskStartedNoticeMonths(items)
  return rows.filter((r) => lienDeskDayInsideLead(r.deadline, todayYmd) || named.get(r.job_id)?.has(r.work_month) === true)
}
