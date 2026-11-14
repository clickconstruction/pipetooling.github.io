import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { LienDeskEntry, LienDeskItemRow, LienDeskMonth, LienNoticeMonthRow } from './lienDesk'
import { monthFromCreation } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitGateKey } from './lienDeskAffidavits'
import { buildLienMonthHistory } from './lienMonthHistory'
import { buildLienTimeline, lienThirtyDayClock, type LienTimeline, type LienTimelineAffidavitState, type LienTimelineCourtesy, type LienTimelineDemandLetter, type LienTimelineInput, type LienTimelineMonth, type LienTimelineNoticeState } from './lienTimeline'
import { parseCourtesyRecords } from './lienCourtesyNotice'
import { liveDemandLetters, type JobDemandLetterRow } from './demandLetterTracking'
import type { JobLienFilingRow } from './lienDeadlines'
import { daysBetweenYmd } from './billedExpectedPay'
import { lienClockMonths, lienHoursAfterHandDay } from './lienLastWorkDay'
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
  /** The job's demand letters (v2.3877), when the caller loaded them; the strip draws none otherwise. */
  demandLetters?: ReadonlyArray<JobDemandLetterRow> | null
}

/**
 * The job's demand letters as the timeline reads them (v2.3877): live (unvoided) and sent, each
 * owing whatever the job still owes — the callers that draw the strip know the job's open balance
 * and not each letter's covered lines, so a paid job reads the letter as paid and an open one as
 * open for the letter's own amount, capped at the balance.
 */
export function lienDemandLettersFromRows(rows: ReadonlyArray<JobDemandLetterRow> | null | undefined, openBalance: number): LienTimelineDemandLetter[] {
  return liveDemandLetters([...(rows ?? [])])
    .filter((r) => r.sent_at)
    .map((r) => ({ sentAt: r.sent_at!, deadlineDate: r.deadline_date, amount: Number(r.amount ?? 0), openRemaining: Math.min(Number(r.amount ?? 0), Math.max(0, openBalance)), debtorParty: r.debtor_party ?? '' }))
}

const GATE_SHORT: Record<string, string> = { owner: 'owner of record', public_owner: 'a private owner', legal: 'legal description', contractor: "the general contractor's address", notice: 'the notice', homestead: 'homestead', homestead_answer: 'the homestead answer' }

function noticeStateOf(entry: Pick<LienDeskEntry, 'pile'> | null): LienTimelineNoticeState {
  if (!entry) return ''
  switch (entry.pile) {
    case 'needs_owner':
    case 'to_draft':
    case 'awaiting':
    case 'ready':
    case 'printed':
    case 'held':
    case 'sent':
      return entry.pile
    default:
      return ''
  }
}

/** Where a job's notice stands on the desk, as the Lien window's opener hands it over (v2.7077). */
export type LienWindowDeskNotice = { state: LienTimelineNoticeState; holdUntil: string | null }

/**
 * The desk's word on a job's notice for the Lien window (v2.7077, punch list #325, PR 6). The window
 * builds its path from the job's filings and cannot see a notice that is drafted, approved or printed,
 * so its header read *Draft the Sep notice* over a row that read *Find the owner* or *Record the
 * mailing*. An opener that holds the desk's queue hands this over; null when the job has no entry.
 */
export function lienWindowDeskNotice(entry: Pick<LienDeskEntry, 'pile' | 'item'> | null | undefined): LienWindowDeskNotice | null {
  if (!entry) return null
  const state = noticeStateOf(entry)
  return state ? { state, holdUntil: entry.item?.hold_until ?? null } : null
}

/** Where a job's affidavit stands on the desk, as the Lien window's opener hands it over (v2.7187, punch list #335, row 2). */
export type LienWindowDeskAffidavit = {
  state: LienTimelineAffidavitState
  /** The gates still closed, by key, sorted: the header names the one fact that holds the paper. */
  missing: LienAffidavitGateKey[]
  holdUntil: string | null
}

function affidavitStateOf(entry: Pick<LienAffidavitEntry, 'pile'> | null | undefined): LienTimelineAffidavitState {
  switch (entry?.pile) {
    case 'needs_property':
    case 'to_draft':
    case 'awaiting':
    case 'ready':
    case 'held':
      return entry.pile
    default:
      return ''
  }
}

/**
 * The desk's word on a job's affidavit for the Lien window (v2.7187, punch list #335, row 2), as `lienWindowDeskNotice` is
 * for its notice. The window builds its path from the job's filings and cannot see an affidavit that is not drafted,
 * waits on approval or is held by a fact, so its header read *File the affidavit* over a row that read *Draft the
 * affidavit* or *Answer the homestead question*. Null when the job has no entry, or one that is filed or missed,
 * which is no step. The closed gates go over only for a paper its facts hold.
 */
export function lienWindowDeskAffidavit(entry: Pick<LienAffidavitEntry, 'pile' | 'gates' | 'item'> | null | undefined): LienWindowDeskAffidavit | null {
  const state = affidavitStateOf(entry)
  if (!entry || !state) return null
  const missing = state === 'needs_property' ? entry.gates.filter((g) => !g.ok).map((g) => g.key).sort() : []
  return { state, missing, holdUntil: entry.item?.hold_until ?? null }
}

export function lienTimelineMonthsFromDesk(jobId: string, rows: ReadonlyArray<LienNoticeMonthRow>, items: ReadonlyArray<LienDeskItemRow>, todayYmd: string, propertyKind = ''): LienTimelineMonth[] {
  const deskMonths: LienDeskMonth[] = rows
    .filter((r) => r.job_id === jobId)
    .map((r) => ({ key: r.work_month, approvedHours: Number(r.approved_hours) || 0, deadline: r.deadline, daysLeft: daysBetweenYmd(todayYmd, r.deadline) ?? 0, noticed: r.noticed, fromCreation: monthFromCreation(r) }))
  const history = buildLienMonthHistory(jobId, items, deskMonths)
  const byKey = new Map<string, LienTimelineMonth>()
  for (const m of deskMonths) byKey.set(m.key, { key: m.key, deadline: m.deadline, fromCreation: m.fromCreation, outcome: 'open', at: '' })
  for (const h of history) {
    const prev = byKey.get(h.month)
    // A closed month the RPC no longer returns carries no deadline in its history row; the statute still knows it (v2.4111 — the fold's tray prints it).
    byKey.set(h.month, { key: h.month, deadline: prev?.deadline || h.deadline || noticeDeadlineForMonth(`${h.month}-01`, propertyKind), fromCreation: prev?.fromCreation ?? false, outcome: h.outcome, at: calendarYmdInAppTzFromIso(h.at) })
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export function buildLienTimelineFromDesk(jobId: string, src: LienTimelineDeskSource): LienTimeline {
  const months = lienTimelineMonthsFromDesk(jobId, src.rows, src.items, src.todayYmd, src.propertyKind)
  const fromRows = months.length ? months[months.length - 1] : null
  const fromLedger = (src.lastWorkDate ?? '').slice(0, 7)
  // The day set by hand counts (v2.7193, punch list #335, row 1): the desk's RPC marks its month, and the ledger's later hours do not move it.
  const handMonth = src.rows.find((r) => r.job_id === jobId && r.month_source === 'hand')?.work_month ?? ''
  const lastMonth = src.affidavit?.lastMonth || handMonth || (fromRows && fromLedger ? (fromRows.key > fromLedger ? fromRows.key : fromLedger) : fromRows?.key || fromLedger || '')
  const lastMonthFromCreation = src.affidavit ? src.affidavit.lastMonthFromCreation : Boolean(fromRows && fromRows.key === lastMonth && fromRows.fromCreation) || Boolean(src.entry?.datedFromCreation && (!fromRows || fromRows.key === lastMonth))
  // The last day of work set by hand (v2.4676): the affidavit entry says so, else the desk row for the last month.
  const lastMonthByHand = src.affidavit ? src.affidavit.lastMonthByHand : src.rows.some((r) => r.job_id === jobId && r.work_month === lastMonth && r.month_source === 'hand')

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
          // Where the paper stands on the desk (v2.7187, punch list #335, row 2), so the desk's own timeline names the step too.
          state: affidavitFiling ? '' : affidavitStateOf(src.affidavit),
          missingKeys: (src.affidavit?.gates ?? []).filter((g) => !g.ok).map((g) => g.key),
          holdUntil: src.affidavit?.item?.hold_until ?? null,
        }
      : null

  return buildLienTimeline({
    todayYmd: src.todayYmd,
    isSub: src.isSub,
    propertyKind: src.propertyKind,
    lastMonth,
    lastMonthFromCreation,
    lastMonthByHand,
    laterHoursDay: lastMonthByHand && fromLedger > lastMonth ? (src.lastWorkDate ?? '').slice(0, 10) : '',
    months,
    noticeState: noticeStateOf(src.entry),
    holdUntil: src.entry?.item?.hold_until ?? null,
    retainage: src.retainage ?? null,
    affidavit,
    originalContractCompletedOn: src.originalContractCompletedOn ?? null,
    releasedAt: releaseFiling ? (releaseFiling.filed_at ?? calendarYmdInAppTzFromIso(releaseFiling.created_at)) : null,
    paid: src.openBalance <= 0,
    demandLetters: lienDemandLettersFromRows(src.demandLetters, src.openBalance),
    courtesy: lienCourtesyFromItems(src.items.filter((i) => i.job_id === jobId)),
  })
}

/**
 * The courtesy notices sent on a job (punch list #231), read off its sent § 53.056 desk items'
 * `fields.courtesy` records: when each went, the channels that went, who pressed, the lien's day it named.
 */
export function lienCourtesyFromItems(items: ReadonlyArray<Pick<LienDeskItemRow, 'kind' | 'status' | 'fields' | 'voided_at'>>): LienTimelineCourtesy[] {
  const out: LienTimelineCourtesy[] = []
  for (const it of items) {
    if (it.kind !== 'notice_53_056' || it.status !== 'sent' || it.voided_at) continue
    for (const r of parseCourtesyRecords((it.fields as { courtesy?: unknown } | null)?.courtesy)) {
      const went = r.to.filter((t) => t.ok)
      const emails = went.some((t) => t.channel === 'email')
      const texts = went.some((t) => t.channel === 'text')
      if (!emails && !texts) continue
      out.push({ at: r.at, how: emails && texts ? 'by email and text' : emails ? 'by email' : 'by text', by: r.by, lienDay: r.lienDay })
    }
  }
  return out
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
 * The last month worked as the Lien window knows it (v2.6809), with what named it: the month of a day set by hand
 * when there is one, else the forecast's last month with a session, and for a job with no sessions the ledger's last
 * day, else its creation month (v2.3747). One read for the window's strip and for the period its affidavit swears:
 * the strip said *Last work Aug 2026* while paragraph 5 printed blanks, because the paper read the session months alone.
 *
 * Until v2.7193 (punch list #335, row 1) a hand day counted only when it was later than the sessions (v2.4676), so hours
 * approved after it moved the window's clock while the billed row's stayed on the hand day. The owner's reading of
 * 2026-11-13 is the row's: the day set by hand counts (`lienClockMonths`). `laterHoursDay` is the last approved clock
 * day when it follows the hand day, so the window can say those hours are there and do not move it.
 */
export function lienWindowLastMonth(src: {
  workMonths: Pick<JobWorkMonths, 'months' | 'lastMonthKey'> | null | undefined
  job: { created_at?: string | null; last_work_date?: string | null; lien_last_work_on?: string | null }
}): { lastMonth: string; fromCreation: boolean; byHand: boolean; laterHoursDay: string } {
  const fromLedger = (src.job.last_work_date ?? '').slice(0, 7)
  const wm = src.workMonths
  const clock = lienClockMonths(wm?.months.length ? wm.months.map((m) => m.key) : fromLedger ? [fromLedger] : [], src.job.lien_last_work_on)
  if (clock.byHand) return { lastMonth: clock.lastMonth, fromCreation: false, byHand: true, laterHoursDay: lienHoursAfterHandDay(src.job) }
  if (wm && wm.months.length) return { lastMonth: wm.lastMonthKey || fromLedger, fromCreation: false, byHand: false, laterHoursDay: '' }
  const created = calendarYmdInAppTzFromIso(src.job.created_at ?? '').slice(0, 7)
  return { lastMonth: fromLedger || created, fromCreation: !fromLedger && Boolean(created), byHand: false, laterHoursDay: '' }
}

/**
 * The Lien window's view of a job (v2.3781): it has no desk rows or items —
 * only the forecast's work months (approved sessions), the job's filings, the
 * job row and the property kind. Sent months come from the notice filings'
 * `months_covered`; a closed month with none reads *window closed* and
 * nothing about noting, because the window cannot see the desk's record. A
 * job with no sessions is dated from its creation month (v2.3747). An opener
 * that holds the desk's queue hands over where the notice stands (`deskNotice`,
 * v2.7077), so the header names the step the desk names.
 */
export function buildLienTimelineFromWindow(src: {
  workMonths: JobWorkMonths | null
  filings: ReadonlyArray<JobLienFilingRow>
  job: { id: string; created_at: string | null; last_work_date: string | null; lien_contract_ended_on?: string | null; lien_last_work_on?: string | null }
  isSub: boolean
  propertyKind: string
  openBalance: number
  todayYmd: string
  /** The job's demand letters (v2.3877) — the Lien window already loads them for its history. */
  demandLetters?: ReadonlyArray<JobDemandLetterRow> | null
  /** The courtesy notices sent on the job (punch list #231), from its sent notice's record; absent when the caller has not loaded them. */
  courtesy?: ReadonlyArray<LienTimelineCourtesy> | null
  /** Where the job's notice stands on the desk (v2.7077), when the opener holds the desk's queue; absent, the open months read *to draft*. */
  deskNotice?: LienWindowDeskNotice | null
  /** Where the job's affidavit stands on the desk (v2.7187, punch list #335, row 2), from the same opener; absent, the header reads *File the affidavit*. */
  deskAffidavit?: LienWindowDeskAffidavit | null
}): LienTimeline {
  const live = src.filings.filter((f) => f.job_id === src.job.id && f.voided_at == null)
  const sentMonths = new Map<string, string>()
  for (const f of live) if (f.kind === 'notice_53_056') for (const m of f.months_covered ?? []) if (!sentMonths.has(m)) sentMonths.set(m, f.filed_at ?? calendarYmdInAppTzFromIso(f.created_at))
  let months: LienTimelineMonth[] = []
  // The last month and what named it: one rule with the affidavit's period (v2.6809).
  const { lastMonth, fromCreation: lastMonthFromCreation, byHand: lastMonthByHand, laterHoursDay } = lienWindowLastMonth(src)
  const wm = src.workMonths
  if (wm && wm.months.length) {
    // The months on the clock (v2.7193, punch list #335, row 1): with a day set by hand, the worked months before its month and
    // its own month, which owes a notice like any other; months of hours after it are off the clock.
    const dueByKey = new Map(wm.months.map((m) => [m.key, m.notice?.due ?? ''] as const))
    months = lienClockMonths(wm.months.map((m) => m.key), src.job.lien_last_work_on).months.map((key) => {
      const deadline = dueByKey.get(key) || noticeDeadlineForMonth(`${key}-01`, src.propertyKind)
      const sentAt = sentMonths.get(key)
      const outcome: LienTimelineMonth['outcome'] = sentAt != null ? 'sent' : deadline < src.todayYmd ? 'missed' : 'open'
      return { key, deadline, fromCreation: false, outcome, at: sentAt ?? '', noteUnknown: outcome === 'missed' }
    })
  } else if (lastMonth && src.isSub) {
    const deadline = noticeDeadlineForMonth(`${lastMonth}-01`, src.propertyKind)
    const sentAt = sentMonths.get(lastMonth)
    const outcome: LienTimelineMonth['outcome'] = sentAt != null ? 'sent' : deadline < src.todayYmd ? 'missed' : 'open'
    months = [{ key: lastMonth, deadline, fromCreation: lastMonthFromCreation, outcome, at: sentAt ?? '', noteUnknown: outcome === 'missed' }]
  }
  const affidavitFiling = live.filter((f) => f.kind === 'affidavit' && f.filed_at).sort((a, b) => (b.filed_at ?? '').localeCompare(a.filed_at ?? ''))[0] ?? null
  const releaseFiling = live.filter((f) => f.kind === 'release_of_record').sort((a, b) => (b.filed_at ?? b.created_at).localeCompare(a.filed_at ?? a.created_at))[0] ?? null
  return buildLienTimeline({
    todayYmd: src.todayYmd,
    isSub: src.isSub,
    propertyKind: src.propertyKind,
    lastMonth,
    lastMonthFromCreation,
    lastMonthByHand,
    laterHoursDay,
    months,
    noticeState: src.deskNotice?.state ?? '',
    holdUntil: src.deskNotice?.holdUntil ?? null,
    retainage: src.job.lien_contract_ended_on ? { contractEndedOn: src.job.lien_contract_ended_on, deadline: lienThirtyDayClock(src.job.lien_contract_ended_on), noticed: false } : null,
    affidavit: affidavitFiling
      ? { deadline: '', filedAt: affidavitFiling.filed_at, recordingNumber: affidavitFiling.recording_number, county: affidavitFiling.county, servedAt: affidavitFiling.served_at, serveDue: affidavitFiling.serve_due, missingGates: [] }
      : src.deskAffidavit?.state
        ? // No filing yet: the desk's word alone. The last day stays the window's own (`deadline: ''` reads the last month's).
          { deadline: '', filedAt: null, recordingNumber: '', county: '', servedAt: null, serveDue: null, missingGates: src.deskAffidavit.missing.map((k) => GATE_SHORT[k] ?? k), state: src.deskAffidavit.state, missingKeys: src.deskAffidavit.missing, holdUntil: src.deskAffidavit.holdUntil }
        : null,
    originalContractCompletedOn: null,
    releasedAt: releaseFiling ? (releaseFiling.filed_at ?? calendarYmdInAppTzFromIso(releaseFiling.created_at)) : null,
    paid: src.openBalance <= 0,
    demandLetters: lienDemandLettersFromRows(src.demandLetters, src.openBalance),
    courtesy: src.courtesy ?? undefined,
  })
}
