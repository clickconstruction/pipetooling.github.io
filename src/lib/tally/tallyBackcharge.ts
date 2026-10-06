// Backcharge from the office: a personal charge on a company card goes to the Office job, and a
// pending person offset (type backcharge) records what the holder owes. Shared by Dashboard /
// Quickfill → Team purchases follow-up and Job Parts Tally → Transactions → Team, so both write
// the same way. The offset itself is saved by `PersonOffsetFormModal`; this writes the split and
// builds the form's first draft.

import type { Json } from '../../types/database'
import type { PersonOffsetInitialDraft } from '../../components/pay/PersonOffsetFormModal'
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { calendarYmdInAppTzFromIso, todayYmdInAppTz } from '../../utils/dateUtils'

/**
 * Put the whole charge on the Office job (HCP 000, or a job named Office), as the holder's staff.
 * Throws with a readable message when there is no Office job or the write is refused.
 */
export async function assignChargeToOfficeAsStaff(args: {
  forUserId: string
  transactionId: string
  amount: number
}): Promise<void> {
  const officeRows = await withSupabaseRetry(() => supabase.rpc('get_jobs_ledger_office'), 'get jobs ledger office')
  const officeId = Array.isArray(officeRows) && officeRows.length > 0 ? officeRows[0]?.id : null
  if (!officeId) throw new Error('Office job not found (HCP 000 or name containing Office).')
  const p_rows = [{ job_id: officeId, amount: args.amount }] as unknown as Json
  await withSupabaseRetry(
    async () =>
      supabase.rpc('replace_mercury_job_splits_for_linked_card_as_staff', {
        p_for_user_id: args.forUserId,
        p_mercury_transaction_id: args.transactionId,
        p_rows,
      }),
    'replace mercury job splits office backcharge',
  )
}

/** The person offset form's first draft for a backcharged charge. */
export function backchargeDraftForCharge(args: {
  personName: string
  counterparty: string | null
  amount: number
  postedAt: string | null
}): PersonOffsetInitialDraft {
  const cp = (args.counterparty ?? '').trim() || 'Unknown'
  return {
    personName: args.personName,
    type: 'backcharge',
    amount: String(Math.abs(Number(args.amount))),
    description: `Personal charge on company card: ${cp}`,
    occurredDate: (args.postedAt && calendarYmdInAppTzFromIso(args.postedAt)) || todayYmdInAppTz(),
  }
}
