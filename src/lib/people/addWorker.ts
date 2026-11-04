/**
 * Add a person (punch list #260, PR 2, v2.6514): one call behind every "add someone" in the app — People → Users →
 * Add to roster, Hire with no email, the Hiring board's Add to roster, the workflow step form, the sub-sheet form,
 * the work-order assembler, Banking's attribute-to-a-new-person. Until this PR each inserted a People record alone,
 * with no account behind it: a person who could hold no clock session and no Charged as. `add_worker`
 * (`20261104200000_add_worker.sql`) makes the users row — role from the kind, `login_attached_at` NULL — and the
 * People record linked to it in one transaction, so every person is a user from the day they are added and a login
 * attaches to the same id later.
 *
 * The RPC is typed by name until the post-push types PR regenerates `database.ts`.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { formatErrorMessage } from '../../utils/errorHandling'

export type AddWorkerKind = 'assistant' | 'master_technician' | 'sub' | 'helper' | 'estimator' | 'primary' | 'superintendent' | 'controller'

export type AddWorkerInput = {
  name: string
  kind: AddWorkerKind
  email?: string | null
  phone?: string | null
  notes?: string | null
  /** YYYY-MM-DD; the People record's start date. */
  startDate?: string | null
}

export type AddedWorker = { userId: string; personId: string }

type RpcClient = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }

/** The RPC's arguments from the form's fields: trimmed, blanks as NULL (the function trims and lower-cases the address again). */
export function addWorkerArgs(input: AddWorkerInput): Record<string, string | null> {
  const blankToNull = (s: string | null | undefined) => {
    const t = (s ?? '').trim()
    return t === '' ? null : t
  }
  return {
    p_name: input.name.trim(),
    p_kind: input.kind,
    p_email: blankToNull(input.email),
    p_phone: blankToNull(input.phone),
    p_notes: blankToNull(input.notes),
    p_start_date: blankToNull(input.startDate),
  }
}

/** The ids the function answers with, or a thrown error carrying its reason. */
export function readAddedWorker(data: unknown): AddedWorker {
  const d = data as { user_id?: unknown; person_id?: unknown } | null
  if (!d || typeof d.user_id !== 'string' || typeof d.person_id !== 'string') throw new Error('The person was not added: the answer had no ids.')
  return { userId: d.user_id, personId: d.person_id }
}

/** Adds the person: the users row with no login and the People record linked to it. Throws with the refusal's words. */
export async function addWorker(client: SupabaseClient<never> | SupabaseClient, input: AddWorkerInput): Promise<AddedWorker> {
  const db = client as unknown as RpcClient
  const { data, error } = await db.rpc('add_worker', addWorkerArgs(input))
  if (error) throw new Error(formatErrorMessage(error, 'The person was not added.'))
  return readAddedWorker(data)
}
