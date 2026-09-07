/**
 * Non-component helpers for the row forms (v2.2963): the headless send behind
 * "Send the rest as drafted" and the words a sent row reads. Kept apart from
 * the components so fast refresh stays clean.
 */
import type { JobWithDetails } from '../../../types/jobWithDetails'
import type { StepCommitmentRow } from '../../../lib/workflow/stepCommitments'
import type { WorkOrderBoardRow } from '../../../lib/subWorkOrders/workOrderBoardRows'
import { quickOfferDefaults } from '../../../lib/subs/subsTileQueues'
import { quickSendJobOf, quickSendWorkOrder } from '../../../lib/subWorkOrders/quickSendWorkOrder'
import type { RosterContact } from './subsTileActions'
import { shortDay } from './subsTileStyles'

export type RowFormSent = { order: StepCommitmentRow; emailed: boolean; subName: string }

/** Send a handshake sheet's order at its pre-read defaults, no form — the queue's "Send the rest as drafted". */
export async function sendSheetOfferWithDefaults(input: { row: WorkOrderBoardRow; workingSince: string | null; job: JobWithDetails; contacts: ReadonlyMap<string, RosterContact>; authUserId: string | undefined; todayYmd: string }) {
  const { row, workingSince, job, contacts, authUserId, todayYmd } = input
  if (!row.personId || !row.sheetId) return { ok: false as const, error: 'This sheet needs one named sub' }
  const d = quickOfferDefaults({ sheetDate: workingSince, todayYmd, agreed: row.agreed, unpriced: row.unpriced })
  if (!d.amount) return { ok: false as const, error: 'This sheet has no price yet' }
  return quickSendWorkOrder({
    job: quickSendJobOf(job),
    person: { id: row.personId, name: row.subName, email: contacts.get(row.personId)?.email ?? null },
    laborJobId: row.sheetId,
    stageWindowId: null,
    amount: Number(d.amount),
    proposedStart: d.start,
    proposedEnd: d.end,
    workDays: d.workDays,
    expires: d.expires,
    authUserId: authUserId ?? null,
  })
}

/** Shared by the queues' handled marks: the words a sent row reads. */
export const sentLabel = (sent: RowFormSent, verb: 'out' | 'to' | 'Re-sent'): string => {
  const rec = sent.order.record_id ?? 'Work order'
  const through = shortDay(sent.order.offer_expires_at)
  if (verb === 'Re-sent') return `Re-sent · good through ${through}`
  if (verb === 'to') return `${rec} to ${sent.subName} · good through ${through}`
  return `${rec} out · good through ${through}`
}

