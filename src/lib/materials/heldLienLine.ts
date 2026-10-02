/**
 * The way back to the Lien desk from Materials → Held for suppliers (v2.4412): on a job's
 * open statement, one line saying the job is on a lien clock — the § 53.056 notice we still
 * owe, else the § 53.052 lien date — so whoever pays the houses sees which unpaid customer
 * has a deadline. Pure; the rows are the Lien desk's own RPCs (`list_lien_notice_months`,
 * `list_lien_affidavit_windows`), so the dates are the desk's.
 */

import { formatYmdMonthDay } from '../jobs/billedExpectedPay'
import { formatUsdNoCents } from '../jobs/jobFormatting'
import { daysBetweenYmd } from '../jobs/lienPayRunway'

export interface HeldLienNoticeRow {
  job_id: string
  /** 'YYYY-MM-DD' */
  deadline: string
  noticed: boolean
  open_balance: number | null
}

export interface HeldLienAffidavitRow {
  job_id: string
  deadline: string
  filed: boolean
  open_balance: number | null
}

export interface HeldLienLine {
  /** "On the Lien desk · our notice is due by Oct 15 · $18,400 unpaid" */
  words: string
  /** The desk, open on this job (the Notices pane, or Affidavits when only the lien date is left). */
  href: string
  kind: 'notice' | 'lien'
  /** The date is a week away or less. */
  urgent: boolean
}

/** Per job, the next date on our own lien clock: the earliest open notice still owed, else the open lien window. */
export function buildHeldLienLines(notices: ReadonlyArray<HeldLienNoticeRow>, affidavits: ReadonlyArray<HeldLienAffidavitRow>, todayYmd: string): Map<string, HeldLienLine> {
  const out = new Map<string, HeldLienLine>()
  const line = (jobId: string, kind: HeldLienLine['kind'], ymd: string, balance: number): HeldLienLine => {
    const days = daysBetweenYmd(todayYmd, ymd) ?? 0
    const money = balance > 0.005 ? ` · ${formatUsdNoCents(balance)} unpaid` : ''
    return {
      words: `On the Lien desk · our ${kind} is due by ${formatYmdMonthDay(ymd)}${money}`,
      href: `/jobs?tab=stages&liendesk=1&liendeskJob=${encodeURIComponent(jobId)}${kind === 'lien' ? '&kind=affidavit' : ''}`,
      kind,
      urgent: days <= 7,
    }
  }
  const firstNotice = new Map<string, HeldLienNoticeRow>()
  for (const r of notices) {
    const ymd = (r.deadline ?? '').slice(0, 10)
    if (r.noticed || !ymd || ymd < todayYmd) continue
    const have = firstNotice.get(r.job_id)
    if (!have || ymd < have.deadline.slice(0, 10)) firstNotice.set(r.job_id, r)
  }
  for (const [jobId, r] of firstNotice) out.set(jobId, line(jobId, 'notice', r.deadline.slice(0, 10), Number(r.open_balance ?? 0)))
  for (const r of affidavits) {
    const ymd = (r.deadline ?? '').slice(0, 10)
    if (out.has(r.job_id) || r.filed || !ymd || ymd < todayYmd) continue
    out.set(r.job_id, line(r.job_id, 'lien', ymd, Number(r.open_balance ?? 0)))
  }
  return out
}
