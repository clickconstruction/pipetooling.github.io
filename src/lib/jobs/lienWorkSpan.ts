/**
 * The span of the work on a job, for the § 53.054 affidavit's paragraph 5 (v2.6061): the day the
 * work began through the day it ended, as the sworn paper states it. Until v2.6061 the draft swore
 * one day, the 28th of the last month worked, as both ends. Pure. The days come from the job in the
 * order the Lien desk trusts them: the approved clock sessions (`jobs_ledger.first_work_date` and
 * `last_work_date`, trigger-kept), the last day set by hand (`lien_last_work_on`, v2.4676) when it
 * is the later, and only then the months the desk knows, the first to the last day of them, never
 * one day. A month still running ends today on the paper, never on a day that has not come.
 */

export type LienWorkSpanJob = {
  /** 'YYYY-MM-DD' — the first approved clock day, as the ledger keeps it (`jobs_ledger.first_work_date`, migration 20261029190000). */
  first_work_date?: string | null
  /** 'YYYY-MM-DD' — the last approved clock day (`jobs_ledger.last_work_date`). */
  last_work_date?: string | null
  /** The last day of work set by hand (v2.4676); the later of it and the clock hours ends the span. */
  lien_last_work_on?: string | null
}

export type LienWorkSpanMonths = {
  /** 'YYYY-MM' — the last month worked, as the desk's RPC names it (the creation month when there are no hours); the end's fallback. */
  lastMonth?: string | null
  /** 'YYYY-MM' — the first month worked when known (the Lien window's months); the start's fallback while the job has no first day. */
  firstMonth?: string | null
  /** Today, 'YYYY-MM-DD': a month still running ends today. */
  todayYmd?: string | null
}

export type LienWorkSpanEndSource = 'hours' | 'hand' | 'month' | 'none'
export type LienWorkSpanStartSource = 'hours' | 'month' | 'none'

export type LienWorkSpan = {
  /** 'YYYY-MM-DD', or '' when the job has no day and no month. */
  workStart: string
  workEnd: string
  /** Where the start came from: the first approved session, the first of a month, or nothing. */
  startSource: LienWorkSpanStartSource
  /** Where the end came from: the last approved session, the day set by hand, the month's last day (today while it runs), or nothing. */
  endSource: LienWorkSpanEndSource
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/

function dayOf(v: string | null | undefined): string {
  const d = (v ?? '').slice(0, 10)
  return DAY.test(d) ? d : ''
}

function monthOf(v: string | null | undefined): string {
  const m = (v ?? '').slice(0, 7)
  return MONTH.test(m) ? m : ''
}

/** 'YYYY-MM' → its last day, 'YYYY-MM-DD' (February's 28 or 29 included); '' for anything that is not a month. */
export function lastDayOfMonth(ym: string): string {
  if (!MONTH.test(ym)) return ''
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7))
  if (m < 1 || m > 12) return ''
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${ym}-${String(n).padStart(2, '0')}`
}

export const EMPTY_LIEN_WORK_SPAN: LienWorkSpan = { workStart: '', workEnd: '', startSource: 'none', endSource: 'none' }

export function lienWorkSpan(job: LienWorkSpanJob | null | undefined, months: LienWorkSpanMonths = {}): LienWorkSpan {
  const first = dayOf(job?.first_work_date)
  const hours = dayOf(job?.last_work_date)
  const hand = dayOf(job?.lien_last_work_on)

  // The end: the later of the day set by hand and the clock hours' last day (the desk's rule — the RPC takes the
  // later month, and a typed day may never be earlier than the hours), else the last day of the last month known.
  let workEnd = ''
  let endSource: LienWorkSpanEndSource = 'none'
  if (hand && (!hours || hand >= hours)) {
    workEnd = hand
    endSource = 'hand'
  } else if (hours) {
    workEnd = hours
    endSource = 'hours'
  } else {
    const lastMonth = monthOf(months.lastMonth)
    if (lastMonth) {
      const monthEnd = lastDayOfMonth(lastMonth)
      const today = dayOf(months.todayYmd)
      workEnd = today && today.slice(0, 7) === lastMonth && today < monthEnd ? today : monthEnd
      endSource = 'month'
    }
  }

  // The start: the first approved session, else the first of the first month known, else the first of the end's month.
  let workStart = ''
  let startSource: LienWorkSpanStartSource = 'none'
  if (first) {
    workStart = first
    startSource = 'hours'
  } else {
    const firstMonth = monthOf(months.firstMonth) || monthOf(workEnd)
    if (firstMonth) {
      workStart = `${firstMonth}-01`
      startSource = 'month'
    }
  }
  // A start after the end (a stale month beside a day set by hand) folds to the end's own month.
  if (workStart && workEnd && workStart > workEnd) {
    workStart = `${workEnd.slice(0, 7)}-01`
    startSource = 'month'
  }
  return { workStart, workEnd, startSource, endSource }
}
