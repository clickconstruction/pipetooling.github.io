import type { LienDeskEntry, LienDeskItemRow, LienDeskMonth, LienNoticeMonthRow } from './lienDesk'
import { monthFromCreation } from './lienDesk'
import type { LienAffidavitEntry } from './lienDeskAffidavits'
import { buildLienMonthHistory } from './lienMonthHistory'
import { buildLienTimeline, lienThirtyDayClock, type LienTimeline, type LienTimelineInput, type LienTimelineMonth, type LienTimelineNoticeState } from './lienTimeline'
import type { JobLienFilingRow } from './lienDeadlines'
import { daysBetweenYmd } from './billedExpectedPay'
import type { JobWorkMonths } from './forecastWorkMonths'
import { noticeDeadlineForMonth } from './lienDeadlines'

/**
 * The Lien desk's view of a job, folded into the timeline kernel's input
 * (v2.3761). Pure — the desk hands it what it already loaded: the RPC's
 * months, the stored items, the queue entry, the affidavit entry when the
 * job is inside that window, the job's filings, and — once #33 lands them
 * on the job — the retainage clock and the contract-end date. Anything not
 * loaded is null and the kernel draws the gap.
 */

/** The slice of the desk's data the builder reads; structural so the tab (PR 2) and the Lien window (PR 3) can hand it the same shape. */
export interface LienTimelineDeskSource {
  rows: ReadonlyArray<LienNoticeMonthRow>
  items: ReadonlyArray<LienDeskItemRow>
  /** Every non-voided filing on the job — affidavits and releases of record; notices are read from the items and months. */
  filings: ReadonlyArray<JobLienFilingRow>
  entry: LienDeskEntry | null
  affidavit: LienAffidavitEntry | null
  /** The § 53.057 facts (#33 §1, v2.3753) when the desk carries them. */
  retainage?: { contractEndedOn: string | null; deadline: string | null; noticed: boolean } | null
  originalContractCompletedOn?: string | null
  isSub: boolean
  propertyKind: string
  /** 'YYYY-MM-DD' from jobs_ledger, when known. */
  lastWorkDate?: string | null
  openBalance: number
  todayYmd: string
}

const GATE_SHORT: Record<string, string> = { owner: 'owner of record', legal: 'legal description', notice: 'the notice', homestead: 'homestead' }

function noticeStateOf(entry: LienDeskEntry | null): LienTimelineNoticeState {
  if (!entry) return ''
  switch (entry.pile) {
    case 'needs_owner':
    case 'to_draft':
    case 'awaiting':
    case 'ready':
    case 'held':
    case 'sent':
      return entry.pile
    default:
      return ''
  }
}

export function lienTimelineMonthsFromDesk(jobId: string, rows: ReadonlyArray<LienNoticeMonthRow>, items: ReadonlyArray<LienDeskItemRow>, todayYmd: string): LienTimelineMonth[] {
  const deskMonths: LienDeskMonth[] = rows
    .filter((r) => r.job_id === jobId)
    .map((r) => ({ key: r.work_month, approvedHours: Number(r.approved_hours) || 0, deadline: r.deadline, daysLeft: daysBetweenYmd(todayYmd, r.deadline) ?? 0, noticed: r.noticed, fromCreation: monthFromCreation(r) }))
  const history = buildLienMonthHistory(jobId, items, deskMonths)
  const byKey = new Map<string, LienTimelineMonth>()
  for (const m of deskMonths) byKey.set(m.key, { key: m.key, deadline: m.deadline, fromCreation: m.fromCreation, outcome: 'open', at: '' })
  for (const h of history) {
    const prev = byKey.get(h.month)
    byKey.set(h.month, { key: h.month, deadline: prev?.deadline || h.deadline, fromCreation: prev?.fromCreation ?? false, outcome: h.outcome, at: h.at })
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export function buildLienTimelineFromDesk(jobId: string, src: LienTimelineDeskSource): LienTimeline {
  const months = lienTimelineMonthsFromDesk(jobId, src.rows, src.items, src.todayYmd)
  const fromRows = months.length ? months[months.length - 1] : null
  const fromLedger = (src.lastWorkDate ?? '').slice(0, 7)
  const lastMonth = src.affidavit?.lastMonth || (fromRows && fromLedger ? (fromRows.key > fromLedger ? fromRows.key : fromLedger) : fromRows?.key || fromLedger || '')
  const lastMonthFromCreation = src.affidavit ? src.affidavit.lastMonthFromCreation : Boolean(fromRows && fromRows.key === lastMonth && fromRows.fromCreation) || Boolean(src.entry?.datedFromCreation && (!fromRows || fromRows.key === lastMonth))

  const live = src.filings.filter((f) => f.job_id === jobId && f.voided_at == null)
  const affidavitFiling = live.filter((f) => f.kind === 'affidavit' && f.filed_at).sort((a, b) => (b.filed_at ?? '').localeCompare(a.filed_at ?? ''))[0] ?? null
  const releaseFiling = live.filter((f) => f.kind === 'release_of_record').sort((a, b) => (b.filed_at ?? b.created_at).localeCompare(a.filed_at ?? a.created_at))[0] ?? null

  const affidavit: LienTimelineInput['affidavit'] =
    src.affidavit || affidavitFiling
      ? {
          deadline: src.affidavit?.deadline ?? '',
          filedAt: affidavitFiling?.filed_at ?? null,
          recordingNumber: affidavitFiling?.recording_number ?? '',
          county: affidavitFiling?.county ?? '',
          servedAt: affidavitFiling?.served_at ?? null,
          serveDue: affidavitFiling?.serve_due ?? null,
          missingGates: (src.affidavit?.gates ?? []).filter((g) => !g.ok).map((g) => GATE_SHORT[g.key] ?? g.key),
        }
      : null

  return buildLienTimeline({
    todayYmd: src.todayYmd,
    isSub: src.isSub,
    propertyKind: src.propertyKind,
    lastMonth,
    lastMonthFromCreation,
    months,
    noticeState: noticeStateOf(src.entry),
    holdUntil: src.entry?.item?.hold_until ?? null,
    retainage: src.retainage ?? null,
    affidavit,
    originalContractCompletedOn: src.originalContractCompletedOn ?? null,
    releasedAt: releaseFiling ? (releaseFiling.filed_at ?? releaseFiling.created_at) : null,
    paid: src.openBalance <= 0,
  })
}

/**
 * The § 53.057 clock as the desk carries it, read structurally so the strip
 * lights up the day the retainage kind (v2.3753) lands: a retainage queue
 * entry when there is one, else the job's own contract-end date, else null
 * (the step is drawn undated with its door).
 */
export function lienRetainageClockFromDesk(data: unknown, jobId: string): NonNullable<LienTimelineDeskSource['retainage']> | null {
  const d = data as {
    retainage?: { entries?: ReadonlyArray<{ jobId: string; contractEndedOn: string | null; deadline: string | null; noticed: boolean }> } | null
    jobsById?: Record<string, { lien_contract_ended_on?: string | null } | undefined>
  } | null
  const e = d?.retainage?.entries?.find((x) => x.jobId === jobId)
  if (e) return { contractEndedOn: e.contractEndedOn, deadline: e.deadline, noticed: e.noticed }
  const ended = d?.jobsById?.[jobId]?.lien_contract_ended_on ?? null
  if (ended) return { contractEndedOn: ended, deadline: lienThirtyDayClock(ended), noticed: false }
  return null
}

/**
 * The Lien window's view of a job (v2.3781): it has no desk rows or items —
 * only the forecast's work months (approved sessions), the job's filings, the
 * job row and the property kind. Sent months come from the notice filings'
 * `months_covered`; a closed month with none reads *window closed* and
 * nothing about noting, because the window cannot see the desk's record. A
 * job with no sessions is dated from its creation month (v2.3747).
 */
export function buildLienTimelineFromWindow(src: {
  workMonths: JobWorkMonths | null
  filings: ReadonlyArray<JobLienFilingRow>
  job: { id: string; created_at: string | null; last_work_date: string | null; lien_contract_ended_on?: string | null }
  isSub: boolean
  propertyKind: string
  openBalance: number
  todayYmd: string
}): LienTimeline {
  const live = src.filings.filter((f) => f.job_id === src.job.id && f.voided_at == null)
  const sentMonths = new Map<string, string>()
  for (const f of live) if (f.kind === 'notice_53_056') for (const m of f.months_covered ?? []) if (!sentMonths.has(m)) sentMonths.set(m, f.filed_at ?? f.created_at)
  let months: LienTimelineMonth[] = []
  let lastMonth = ''
  let lastMonthFromCreation = false
  const wm = src.workMonths
  if (wm && wm.months.length) {
    months = wm.months.map((m) => {
      const deadline = m.notice?.due || noticeDeadlineForMonth(`${m.key}-01`, src.propertyKind)
      const sentAt = sentMonths.get(m.key)
      const outcome: LienTimelineMonth['outcome'] = sentAt != null ? 'sent' : deadline < src.todayYmd ? 'missed' : 'open'
      return { key: m.key, deadline, fromCreation: false, outcome, at: sentAt ?? '', noteUnknown: outcome === 'missed' }
    })
    lastMonth = wm.lastMonthKey || (src.job.last_work_date ?? '').slice(0, 7)
  } else {
    const created = (src.job.created_at ?? '').slice(0, 7)
    const fromLedger = (src.job.last_work_date ?? '').slice(0, 7)
    lastMonth = fromLedger || created
    lastMonthFromCreation = !fromLedger && Boolean(created)
    if (lastMonth && src.isSub) {
      const deadline = noticeDeadlineForMonth(`${lastMonth}-01`, src.propertyKind)
      const sentAt = sentMonths.get(lastMonth)
      const outcome: LienTimelineMonth['outcome'] = sentAt != null ? 'sent' : deadline < src.todayYmd ? 'missed' : 'open'
      months = [{ key: lastMonth, deadline, fromCreation: lastMonthFromCreation, outcome, at: sentAt ?? '', noteUnknown: outcome === 'missed' }]
    }
  }
  const affidavitFiling = live.filter((f) => f.kind === 'affidavit' && f.filed_at).sort((a, b) => (b.filed_at ?? '').localeCompare(a.filed_at ?? ''))[0] ?? null
  const releaseFiling = live.filter((f) => f.kind === 'release_of_record').sort((a, b) => (b.filed_at ?? b.created_at).localeCompare(a.filed_at ?? a.created_at))[0] ?? null
  return buildLienTimeline({
    todayYmd: src.todayYmd,
    isSub: src.isSub,
    propertyKind: src.propertyKind,
    lastMonth,
    lastMonthFromCreation,
    months,
    noticeState: '',
    retainage: src.job.lien_contract_ended_on ? { contractEndedOn: src.job.lien_contract_ended_on, deadline: lienThirtyDayClock(src.job.lien_contract_ended_on), noticed: false } : null,
    affidavit: affidavitFiling
      ? { deadline: '', filedAt: affidavitFiling.filed_at, recordingNumber: affidavitFiling.recording_number, county: affidavitFiling.county, servedAt: affidavitFiling.served_at, serveDue: affidavitFiling.serve_due, missingGates: [] }
      : null,
    originalContractCompletedOn: null,
    releasedAt: releaseFiling ? (releaseFiling.filed_at ?? releaseFiling.created_at) : null,
    paid: src.openBalance <= 0,
  })
}
