import type { LienDeskData } from '../../hooks/useLienDeskData'
import type { LienCalendarJob } from './lienCalendar'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitPile } from './lienDeskAffidavits'
import type { LienRetainagePile } from './lienDeskRetainage'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { formatUsdNoCents } from './jobFormatting'
import type { LienStatusJob, LienStatusLien, LienStatusNeed, LienStatusPayload, LienStatusWhere } from '../../../supabase/functions/_shared/lienDeskStatus'

/**
 * Share where the liens stand (v2.4311): the Lien desk's data folded into the payload the
 * shared renderers (`supabase/functions/_shared/lienDeskStatus.ts`) turn into the text and the
 * team email. The notices are the desk's own piles, so the count and the dollars are the ones
 * the Dashboard's lien card and the Pipeline's money card read, never a second opinion; the
 * Calendar's rows add only what the notice desk does not hold (a property kind not set, a lien
 * window already gone). Pure.
 */

/** 'all' = the whole desk; else the GC's customer id. */
export type LienShareScope = 'all' | string

/** The notice piles a notice sits in before it is mailed, and how the message names each. */
const WHERE_BY_PILE: Partial<Record<LienDeskPile, LienStatusWhere>> = {
  needs_owner: 'owner',
  to_draft: 'draft',
  awaiting: 'approval',
  ready: 'ready',
  held: 'held',
}

/** Affidavits still to file inside their window. */
const LIEN_PILES_TO_FILE: ReadonlySet<LienAffidavitPile> = new Set<LienAffidavitPile>(['needs_property', 'to_draft', 'awaiting', 'ready', 'held'])

/** Retainage notices whose clock runs and that have not gone out. */
const RETAINAGE_TO_SEND: ReadonlySet<LienRetainagePile> = new Set<LienRetainagePile>(['needs_owner', 'to_draft', 'awaiting', 'ready', 'held'])

function jobWords(data: LienDeskData, jobId: string): { number: string; name: string } {
  const j = data.jobsById[jobId]
  if (!j) return { number: jobId.slice(0, 8), name: '' }
  return { number: effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—', name: (j.job_name ?? '').trim() }
}

function gcName(data: LienDeskData, gcId: string | null): string {
  return gcId ? (data.gcsById[gcId]?.name ?? '').trim() || 'GC' : ''
}

/** A notice's job as the message says it: the months it names, its next date, where it waits. */
export function lienStatusJobFor(data: LienDeskData, e: LienDeskEntry): LienStatusJob | null {
  const where = WHERE_BY_PILE[e.pile]
  if (!where) return null
  const item = e.item
  // An item past the draft names its months on the paper (the desk prints them); a job still to draft names what a new notice would.
  const named = item && (where === 'approval' || where === 'ready' || where === 'held') && item.months.length > 0 ? item.months : e.dueMonths
  // The job's next date is its earliest open, unnoticed month, whatever an old draft names.
  const byYmd = e.months.filter((m) => !m.noticed && m.daysLeft >= 0).map((m) => m.deadline).sort()[0] ?? ''
  const { number, name } = jobWords(data, e.jobId)
  return {
    jobId: e.jobId,
    number,
    name,
    gc: gcName(data, e.gcCustomerId),
    months: [...new Set(named)].sort(),
    owed: Math.round(e.openBalance * 100) / 100,
    where,
    byYmd,
    sinceYmd: where === 'approval' && item?.submitted_at ? item.submitted_at.slice(0, 10) : '',
  }
}

export type LienShareScopeOption = {
  key: LienShareScope
  name: string
  jobs: number
  owed: number
  /** The earliest mail-by date, 'YYYY-MM-DD'; '' when none is open. */
  firstYmd: string
  waiting: number
  needOwner: number
}

function optionFor(key: LienShareScope, name: string, jobs: ReadonlyArray<LienStatusJob>): LienShareScopeOption {
  return {
    key,
    name,
    jobs: jobs.length,
    owed: jobs.reduce((s, j) => s + j.owed, 0),
    firstYmd: jobs.map((j) => j.byYmd).filter(Boolean).sort()[0] ?? '',
    waiting: jobs.filter((j) => j.where === 'approval').length,
    needOwner: jobs.filter((j) => j.where === 'owner').length,
  }
}

/** The What to send menu: the whole desk first, then every GC with a notice to send, most money first. */
export function lienShareScopeOptions(data: LienDeskData | null): LienShareScopeOption[] {
  if (!data) return [optionFor('all', 'Everything on the desk', [])]
  const byGc = new Map<string, LienStatusJob[]>()
  const all: LienStatusJob[] = []
  for (const e of data.queue.entries) {
    const j = lienStatusJobFor(data, e)
    if (!j) continue
    all.push(j)
    if (!e.gcCustomerId) continue
    const list = byGc.get(e.gcCustomerId)
    if (list) list.push(j)
    else byGc.set(e.gcCustomerId, [j])
  }
  const gcs = [...byGc.entries()].map(([id, jobs]) => optionFor(id, gcName(data, id), jobs)).sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name))
  return [optionFor('all', 'Everything on the desk', all), ...gcs]
}

const NEED_BY_GATE: Record<string, LienStatusNeed> = { owner: 'owner', legal: 'legal', notice: 'notice', homestead: 'homestead' }

/** Everything the text and the email say, for the whole desk or one GC. */
export function buildLienStatusPayload(input: {
  data: LienDeskData
  calendarRows?: ReadonlyArray<LienCalendarJob> | null
  todayYmd: string
  nowIso: string
  scope: LienShareScope
}): LienStatusPayload {
  const { data, todayYmd, nowIso } = input
  const gcId = input.scope === 'all' ? null : input.scope
  const inScope = (id: string | null) => gcId == null || id === gcId

  const jobs: LienStatusJob[] = []
  let trackingOwed = 0
  for (const e of data.queue.entries) {
    if (!inScope(e.gcCustomerId)) continue
    if (e.pile === 'printed') trackingOwed += 1
    const j = lienStatusJobFor(data, e)
    if (j) jobs.push(j)
  }

  const liens: LienStatusLien[] = data.affidavits.entries
    .filter((e) => LIEN_PILES_TO_FILE.has(e.pile) && inScope(e.gcCustomerId))
    .map((e) => {
      const { number, name } = jobWords(data, e.jobId)
      return {
        number,
        name,
        gc: gcName(data, e.gcCustomerId),
        owed: Math.round(e.openBalance * 100) / 100,
        byYmd: e.daysLeft >= 0 ? e.deadline : '',
        needs: e.gates.filter((g) => !g.ok).map((g) => NEED_BY_GATE[g.key]).filter((n): n is LienStatusNeed => Boolean(n)),
      }
    })

  const ret = data.retainage.entries.filter((e) => RETAINAGE_TO_SEND.has(e.pile) && inScope(e.gcCustomerId))
  const rows = (input.calendarRows ?? []).filter((r) => inScope(r.gcId))
  const gone = rows.filter((r) => r.runway.state === 'closed')

  return {
    v: 1,
    asOf: nowIso,
    todayYmd,
    gc: gcId ? gcName(data, gcId) : null,
    jobs,
    liens,
    kindsUnset: rows.filter((r) => r.runway.kindAssumed && r.runway.state !== 'closed' && r.runway.state !== 'filed' && r.runway.state !== 'none').length,
    trackingOwed,
    pastWindow: { jobs: gone.length, owed: Math.round(gone.reduce((s, r) => s + r.openBalance, 0) * 100) / 100 },
    retainage: {
      jobs: ret.length,
      held: Math.round(ret.reduce((s, e) => s + e.retainageHeld, 0) * 100) / 100,
      firstYmd: ret.map((e) => (e.deadline && (e.daysLeft ?? -1) >= 0 ? e.deadline : '')).filter(Boolean).sort()[0] ?? '',
    },
  }
}

/** "23 jobs · $173,597": what a What to send choice holds. */
export function lienShareScopeFacts(o: Pick<LienShareScopeOption, 'jobs' | 'owed'>): string {
  return `${o.jobs} ${o.jobs === 1 ? 'job' : 'jobs'} · ${formatUsdNoCents(o.owed)}`
}

/** The most people one email goes to (`send-lien-desk-summary` refuses more). */
export const LIEN_SHARE_MAX_RECIPIENTS = 5

/** "Send to Malachi" · "Send to Malachi and Robert" · "Send to 3 people". */
export function lienShareSendLabel(names: readonly string[]): string {
  if (names.length === 0) return 'Send'
  if (names.length === 1) return `Send to ${names[0]}`
  if (names.length === 2) return `Send to ${names[0]} and ${names[1]}`
  return `Send to ${names.length} people`
}
