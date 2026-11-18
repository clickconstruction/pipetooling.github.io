import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import type { LienDeskEntry } from '../jobs/lienDesk'
import { lienDeskEntryInRun } from '../jobs/lienLeaderSignCard'
import { lienItemUnsigned } from '../jobs/lienNoticeSignature'
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import type { WaitingOnLeaderInput, WaitingOnLeaderPaper } from './waitingOnLeader'

/**
 * The Lien desk's two piles that wait on the leader, as the office's Waiting on card takes them (punch list #365,
 * PR 2). The rules are the desk's own: a notice waits on his approval while it sits on the awaiting pile, in a run
 * or out of one, and on his signature while it is approved and unsigned (`lienItemUnsigned`, the rule the Board's
 * *to sign* tile and the desk's Remind press count by). Pure: the desk's read in, the card's input out.
 */
export type WaitingOnLeaderDesk = {
  queue: { piles: { awaiting: ReadonlyArray<LienDeskEntry>; ready: ReadonlyArray<LienDeskEntry> } }
  jobsById: Record<string, { hcp_number: string; click_number: string | null; job_name: string | null } | undefined>
  gcsById: Record<string, { name: string } | undefined>
}

function label(desk: WaitingOnLeaderDesk, jobId: string): string {
  const j = desk.jobsById[jobId]
  if (!j) return jobId.slice(0, 8)
  const number = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
  const name = (j.job_name ?? '').trim()
  return name ? `${number} · ${name}` : number
}

function paper(desk: WaitingOnLeaderDesk, e: LienDeskEntry): WaitingOnLeaderPaper {
  const submitted = e.item?.submitted_at ? calendarYmdInAppTzFromIso(e.item.submitted_at) : ''
  return {
    itemId: e.item?.id ?? null,
    label: label(desk, e.jobId),
    dueYmd: e.earliestDeadline ?? null,
    askedYmd: /^\d{4}-\d{2}-\d{2}$/.test(submitted) ? submitted : null,
    runGc: lienDeskEntryInRun(e) ? (desk.gcsById[e.gcCustomerId as string]?.name ?? '').trim() || 'a GC' : null,
  }
}

export function waitingOnLeaderLien(desk: WaitingOnLeaderDesk | null | undefined): WaitingOnLeaderInput['lien'] {
  if (!desk) return null
  return {
    approve: desk.queue.piles.awaiting.map((e) => paper(desk, e)),
    sign: desk.queue.piles.ready.filter((e) => e.item?.id && lienItemUnsigned(e.item)).map((e) => paper(desk, e)),
  }
}
