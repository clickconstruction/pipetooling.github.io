/**
 * GC mode, the real build, the Building lane's U5b: where the RFIs window talks to the database. It reads a project's
 * RFIs in one round and carries each press to its function (migration 20261010012000_gc_rfi_writes, the Building lane's
 * U5a), which checks whose move it is and refuses in words. Start a change order works its words and price out with the
 * kernels first, since the database owns only the RFI's state and the link. The plan:
 * to-dos/gc-mode/mockups/building-u5.md on branch spike/gc-mode.
 */
import { supabase } from '../supabase'
import { checkSupabaseError, type SupabaseResultError } from '../../utils/errorHandling'
import { rfiChangeOrderDescription } from './buildingRfis'
import { fnProblem, type FnResult } from './gcIo'
import { changeOrderPrice } from './ownerBilling'
import { addRfiPayload, answerRfiPayload, type RfiAnswer, type RfiDraft, type RfiTables } from './rfiRows'
import type { GcProject, Rfi } from './types'

/** The rows of a read, or the read's problem thrown in plain words. */
function taken<T>(result: { data: T | null; error: SupabaseResultError | null; status?: number }, operation: string): T {
  checkSupabaseError(result, operation)
  return result.data
}

/** Ids an `.in()` filter takes at once, so a long list never makes a request line too long. */
const IN_CHUNK = 100

/** Every RFI on these projects, with the work each holds, as their rows hold them. */
export async function loadGcRfis(projectIds: string[]): Promise<RfiTables> {
  if (projectIds.length === 0) return { rfis: [], holds: [] }
  const rfis = taken(await supabase.from('gc_rfis').select('*').in('project_id', projectIds).order('number'), 'load the RFIs')
  const ids = rfis.map((r) => r.id)
  const holds: RfiTables['holds'] = []
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    holds.push(...taken(await supabase.from('gc_rfi_holds').select('*').in('rfi_id', ids.slice(i, i + IN_CHUNK)), 'load the work the RFIs hold'))
  }
  return { rfis, holds }
}

/** A new RFI on the job, numbered by the database. Returns its id. */
export async function addRfi(draft: RfiDraft): Promise<string> {
  return taken(await supabase.rpc('gc_add_rfi', { r: addRfiPayload(draft) }), 'add the RFI')
}

/** The RFI goes to the architect by email through gc-architect-email, which records the send. */
export async function sendRfiToArchitect(rfiId: string): Promise<{ to: string }> {
  const r = (await supabase.functions.invoke('gc-architect-email', { body: { kind: 'rfi', rfi_id: rfiId } })) as FnResult
  const problem = await fnProblem(r, 'The RFI was not sent.')
  if (problem) throw new Error(problem)
  return { to: (r.data as { to: string }).to }
}

/** The RFI went to the architect some other way: the office marks it sent today. */
export async function markRfiSent(rfiId: string): Promise<void> {
  taken(await supabase.rpc('gc_send_rfi_to_architect', { p_rfi_id: rfiId }), 'mark it sent')
}

/** The answer, by the architect or by us. */
export async function answerRfi(rfiId: string, answer: RfiAnswer): Promise<void> {
  taken(await supabase.rpc('gc_answer_rfi', { p_rfi_id: rfiId, a: answerRfiPayload(answer) }), 'record the answer')
}

/**
 * A draft change order from a cost answer (the money team's): its words from the RFI and the answer, its price our cost
 * plus the job's fee, as the kernels say. Returns the change order's id.
 */
export async function startRfiChangeOrder(project: GcProject, rfi: Rfi): Promise<string> {
  const cost = rfi.answer?.cost ?? 0
  return taken(
    await supabase.rpc('gc_rfi_change_order', { p_rfi_id: rfi.id, p_description: rfiChangeOrderDescription(rfi), p_price: changeOrderPrice(project, cost) }),
    'start the change order',
  )
}
