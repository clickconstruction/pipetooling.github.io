/**
 * GC mode, the real build, the Building lane's U6d: where the Closeout window talks to the database. Each press goes to
 * its function in migration 20261010041000 (the Building lane's U6c), which checks whose move it is and works the money
 * out itself: accept a trade's work, record a final pay application that came by email or on paper, approve the
 * retainage release, record a change the trade signed on paper, and close the job. Paying the release and taking its
 * final waiver are U6a's presses (`payDraw`, `drawWaiverIn` in ./drawsIo.ts). The plan:
 * to-dos/gc-mode/mockups/building-u6.md on branch spike/gc-mode.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { finalCameInPayload, signedFileArgs, type FinalCameIn, type SignedFile } from './closeoutRows'

/** The answer of a press, or its problem thrown in plain words. */
function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data as T
}

/** Accept a trade's work: every line billed and its punch list done. Returns the day. */
export async function acceptWork(packageId: string): Promise<string> {
  return taken(await supabase.rpc('gc_accept_work', { p_package_id: packageId }), 'accept the work')
}

/** A final pay application that came by email or on paper. Returns the draw's id. */
export async function finalPayAppCameIn(d: FinalCameIn): Promise<string> {
  return taken(await supabase.rpc('gc_final_pay_app_came_in', { p_package_id: d.packageId, p: finalCameInPayload(d) }), 'record the final pay application')
}

/** Approve the retainage release, 10 days after the customer paid us ours. Returns the day. */
export async function approveRetainage(drawId: string): Promise<string> {
  return taken(await supabase.rpc('gc_approve_retainage', { p_draw_id: drawId }), 'approve the release')
}

/** A change the trade signed on paper or by email: its line on their statement of work. Returns the line's id. */
export async function changeSignedIn(changeOrderId: string, file: SignedFile): Promise<string> {
  return taken(await supabase.rpc('gc_trade_change_signed_in', { p_change_order_id: changeOrderId, ...signedFileArgs(file) }), 'record their signature')
}

/** Close the job once every trade is closed out. Returns the day. */
export async function closeJob(projectId: string): Promise<string> {
  return taken(await supabase.rpc('gc_close_job', { p_project_id: projectId }), 'close the job')
}
