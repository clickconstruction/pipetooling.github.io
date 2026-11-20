import { supabase } from '../supabase'
import { propagateReportPctToJob } from '../propagateReportPctToJob'
import { submitStatusReportFromStepper } from '../reports/submitStatusReportFromStepper'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { paceStillNote } from './paceReading'

/**
 * **Still 40%** on the Job pace card: the same percent, said again today. It is the save the **Set the %** window
 * makes with the number left alone, so it files a Status Report, and the report's day is what the pace reads as
 * the day the percent was last said. With no Status Report template it falls back to the bare percent write, as
 * the window does. That write leaves no day on the read, so the card holds its own word for the sitting.
 */
export async function sayPercentStill(args: { authUserId: string; jobId: string; pct: number }): Promise<void> {
  const note = paceStillNote(args.pct)
  const res = await submitStatusReportFromStepper({ authUserId: args.authUserId, jobId: args.jobId, pct: args.pct, note })
  if (res.ok) {
    await propagateReportPctToJob(args.jobId, res.fieldValues)
    return
  }
  if (res.reason !== 'no_template') throw new Error(res.message)
  const data = await withSupabaseRetry(async () => supabase.rpc('set_job_pct_from_field', { p_job_id: args.jobId, p_pct: Math.round(args.pct), p_note: note }), 'pace still pct')
  const r = data as { ok?: boolean; error?: string } | null
  if (!r?.ok) throw new Error(r?.error || 'Could not save the percent')
}
