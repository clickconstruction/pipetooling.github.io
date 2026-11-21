/**
 * Write someone up (punch list #410): the reads and the writes behind the sheet. The list comes from
 * `write_up_people()`, a send lands through `land_person_report`, the writer's own rows are read from `person_reports`
 * under its row rule (an author reads their own), and a take-back goes through `withdraw_person_report`. The columns
 * and the functions are younger than the generated types, hence the cast. The rules are `writeUp.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { parseWriteUpList, type MyWriteUpRow, type WriteUpList } from './writeUp'

const db = supabase as unknown as SupabaseClient

/** How many of the writer's own write-ups the sheet lists. */
export const MY_WRITE_UPS_CAP = 30

export interface WriteUpLanded {
  /** True when this press had already landed: the answer is the first landing's. */
  already: boolean
  id: string | null
  status: string | null
}

export interface WriteUpIo {
  list: () => Promise<WriteUpList>
  mine: (userId: string) => Promise<MyWriteUpRow[]>
  land: (payload: Record<string, unknown>) => Promise<WriteUpLanded>
  takeBack: (reportId: string, reason: string) => Promise<void>
}

export async function loadWriteUpList(): Promise<WriteUpList> {
  const { data, error } = await db.rpc('write_up_people')
  if (error) throw error
  return parseWriteUpList(data)
}

export async function loadMyWriteUps(userId: string): Promise<MyWriteUpRow[]> {
  const { data, error } = await db
    .from('person_reports')
    .select('id, subject_person_id, content, status, kind, occurred_date, occurred_time, job_label, created_at, resolution_note, adds_to')
    .eq('author_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MY_WRITE_UPS_CAP)
  if (error) throw error
  return (data ?? []) as MyWriteUpRow[]
}

export async function landWriteUp(payload: Record<string, unknown>): Promise<WriteUpLanded> {
  const { data, error } = await db.rpc('land_person_report', { p: payload })
  if (error) throw error
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  return { already: o.already === true, id: typeof o.id === 'string' ? o.id : null, status: typeof o.status === 'string' ? o.status : null }
}

export async function takeBackWriteUp(reportId: string, reason: string): Promise<void> {
  const { error } = await db.rpc('withdraw_person_report', { p_report_id: reportId, p_reason: reason })
  if (error) throw error
}

export const writeUpIo: WriteUpIo = { list: loadWriteUpList, mine: loadMyWriteUps, land: landWriteUp, takeBack: takeBackWriteUp }
