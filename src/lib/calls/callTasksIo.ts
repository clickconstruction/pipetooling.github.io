/**
 * Calls (v2.5596, punch list #115): the reads and the writes behind a call task (`callTasks.ts` is the kernel). The open
 * rows as `call_tasks` keeps them (Follow up maps them with the team's names, `followUpRows.ts` → `callTasksFromRows`),
 * Add to my calls (`call_task_add`), I called and Skip (`call_task_done`), Tomorrow (`call_task_move`). A client ahead
 * of the push reads the table as empty.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { checkSupabaseError } from '../../utils/errorHandling'
import { isNotThereYetError } from '../gcWordAskIo'
import { jobRefOf } from '../messages/jobKeys'

/** A `call_tasks` row as the client reads it. */
export interface CallTaskDbRow {
  id: string
  contact_id: string
  step_key: string | null
  bid_id: string | null
  project_id: string | null
  jobs_ledger_id: string | null
  due_on: string
  what: string
  script: string | null
  made_by: string | null
  made_at: string
  done_at: string | null
}

export const CALL_TASK_COLUMNS = 'id, contact_id, step_key, bid_id, project_id, jobs_ledger_id, due_on, what, script, made_by, made_at, done_at'

export interface CallTaskAdd {
  contactId: string
  stepKey: string | null
  jobKey: string | null
  /** YYYY-MM-DD. */
  dueYmd: string
  what: string
  script: string | null
}

export interface CallTasksIo {
  /** The open calls, every person's; empty before the push. */
  loadOpen(contactId?: string): Promise<CallTaskDbRow[]>
  /** Resolves to the task's id (the open one's, when a call for the same step and job already waits). */
  add(input: CallTaskAdd): Promise<string>
  /** I called (a team note, the given words or the app's) or Skip. */
  done(id: string, how: 'called' | 'skipped', note?: string | null): Promise<void>
  move(id: string, dueYmd: string): Promise<void>
}

const jobArgs = (jobKey: string | null) => {
  const ref = jobRefOf(jobKey)
  return { p_job_kind: ref?.kind ?? null, p_job_id: ref?.id ?? null }
}

/** The open calls on a client, fail-soft: a table not there yet reads as none. */
export async function loadOpenCallTasks(db: SupabaseClient, contactId?: string): Promise<CallTaskDbRow[]> {
  // No order here: the kernel sorts (`callRows`), and Follow up's test client knows no order.
  let q = db.from('call_tasks').select(CALL_TASK_COLUMNS).is('done_at', null)
  if (contactId) q = q.eq('contact_id', contactId)
  const result = await q
  if (result.error) {
    if (isNotThereYetError(result.error)) return []
    checkSupabaseError(result, 'read the calls to make')
  }
  return (result.data ?? []) as unknown as CallTaskDbRow[]
}

export function supabaseCallTasksIo(client: unknown = supabase): CallTasksIo {
  const db = client as SupabaseClient
  return {
    loadOpen: (contactId) => loadOpenCallTasks(db, contactId),
    async add(input) {
      const result = await db.rpc('call_task_add', {
        p_contact: input.contactId,
        p_step: input.stepKey,
        ...jobArgs(input.jobKey),
        p_due: input.dueYmd,
        p_what: input.what,
        p_script: input.script,
      })
      checkSupabaseError(result, 'add the call')
      return String(result.data)
    },
    async done(id, how, note = null) {
      const result = await db.rpc('call_task_done', { p_id: id, p_how: how, p_note: note })
      checkSupabaseError(result, how === 'called' ? 'close the call' : 'skip the call')
    },
    async move(id, dueYmd) {
      const result = await db.rpc('call_task_move', { p_id: id, p_due: dueYmd })
      checkSupabaseError(result, 'move the call')
    },
  }
}
