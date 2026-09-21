import type { LienDeskItemRow, LienDeskMonth } from './lienDesk'
import { parseLienDeskDraftFields } from './lienNoticeDraft'

/**
 * A job's closed work months on the Lien desk (v2.3661): what happened to each
 * month whose § 53.056 question is settled — a notice went out, the office
 * skipped it on purpose, or the window closed with nothing on record.
 *
 * A skip gives up a lien right and used to leave no trace on the desk once the
 * row dropped off; this is the trace. Open months are not here — they are the
 * tickable cards beside it, and a month is only ever shown once.
 *
 * Two sources, because neither is complete: the desk's items (every sent or
 * skipped item for the job, however old) and the RPC's months (hours and
 * deadlines, but only a recent window). An item wins over the RPC's flags.
 */
export type LienMonthOutcome = 'sent' | 'skipped' | 'missed'

export interface LienMonthHistoryEntry {
  /** "2026-05" */
  month: string
  outcome: LienMonthOutcome
  /** ISO date-time of the send or the skip; '' for a plain miss or when unknown. */
  at: string
  /** The skip's reason, as the office typed it. */
  reason: string
  /** Who skipped it — '' on skips recorded before the name was kept. */
  byName: string
  /** The month's deadline and approved hours when the RPC still returns the month; otherwise ''/null. */
  deadline: string
  approvedHours: number | null
  /** How the send was approved: 'leader' | 'rule' | 'word' | ''. */
  approvalMode: string
}

export function buildLienMonthHistory(jobId: string, items: ReadonlyArray<LienDeskItemRow>, months: ReadonlyArray<LienDeskMonth>): LienMonthHistoryEntry[] {
  const byMonth = new Map<string, LienMonthHistoryEntry>()
  const rpc = new Map(months.map((m) => [m.key, m]))
  const base = (month: string): Pick<LienMonthHistoryEntry, 'month' | 'deadline' | 'approvedHours'> => {
    const m = rpc.get(month)
    return { month, deadline: m?.deadline ?? '', approvedHours: m ? m.approvedHours : null }
  }

  // Oldest item first, so a later record for the same month (a skip after a pull-back) is the one kept — except that a send is final.
  const mine = items.filter((i) => i.job_id === jobId && i.kind === 'notice_53_056' && !i.voided_at && (i.status === 'sent' || i.status === 'missed'))
  mine.sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const i of mine) {
    const fields = parseLienDeskDraftFields(i.fields)
    for (const month of i.months) {
      if (byMonth.get(month)?.outcome === 'sent') continue
      if (i.status === 'sent') {
        byMonth.set(month, { ...base(month), outcome: 'sent', at: i.sent_at ?? '', reason: '', byName: '', approvalMode: i.approval_mode ?? '' })
      } else {
        const reason = (fields?.skipReason ?? '').trim()
        // A `missed` item with no reason is a closed window someone noted (v2.3679: who and when), not a person's decision.
        const noted = fields?.windowClosed
        byMonth.set(month, {
          ...base(month),
          outcome: reason ? 'skipped' : 'missed',
          at: reason ? fields?.skippedBy?.at || i.updated_at : noted?.at || '',
          reason,
          byName: reason ? (fields?.skippedBy?.name ?? '') : noted?.name ?? '',
          approvalMode: '',
        })
      }
    }
  }

  for (const m of months) {
    if (byMonth.has(m.key)) continue
    if (m.noticed) byMonth.set(m.key, { ...base(m.key), outcome: 'sent', at: '', reason: '', byName: '', approvalMode: '' })
    else if (m.daysLeft < 0) byMonth.set(m.key, { ...base(m.key), outcome: 'missed', at: '', reason: '', byName: '', approvalMode: '' })
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
}

export const LIEN_MONTH_OUTCOME_LABEL: Record<LienMonthOutcome, string> = { sent: 'Sent', skipped: 'Skipped', missed: 'Missed' }

/** One line on what the outcome means for the lien right — the dialog's closing sentence. */
export function lienMonthOutcomeMeaning(e: Pick<LienMonthHistoryEntry, 'outcome'>, monthLabel: string): string {
  if (e.outcome === 'sent') return `The lien right on ${monthLabel} work is preserved.`
  if (e.outcome === 'skipped') return `The lien right on ${monthLabel} work was given up on purpose.`
  return `The window closed with no notice and no skip on record — the lien right on ${monthLabel} work is gone.`
}

/** True while nobody has written the closed window down — the Dashboard keeps naming it until then (v2.3679). */
export function lienMonthMissUnnoted(e: Pick<LienMonthHistoryEntry, 'outcome' | 'at' | 'byName'>): boolean {
  return e.outcome === 'missed' && !e.at && !e.byName
}
