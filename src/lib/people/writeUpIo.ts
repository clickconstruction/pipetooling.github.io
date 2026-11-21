/**
 * Write someone up (punch list #410): the reads and the writes behind the sheet. The list comes from
 * `write_up_people()`, a send goes through the outbox and lands through `land_person_report`, the writer's own rows are read from `person_reports`
 * under its row rule (an author reads their own), and a take-back goes through `withdraw_person_report`. The columns
 * and the functions are younger than the generated types, hence the cast. The rules are `writeUp.ts`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { keptWriteUps, parseWriteUpList, type KeptWriteUp, type MyWriteUpRow, type WriteUpList } from './writeUp'
import { pressThroughOutbox } from '../offline/pressThroughOutbox'
import { outbox } from '../offline/outboxState'

const db = supabase as unknown as SupabaseClient

/** How many of the writer's own write-ups the sheet lists. */
export const MY_WRITE_UPS_CAP = 30

/** How a send ended: landed, kept on the phone for the signal, refused with the server's reason, or failed. */
export type WriteUpSent = { kind: 'landed' } | { kind: 'queued' } | { kind: 'refused'; message: string } | { kind: 'failed'; error: unknown }

export interface WriteUpIo {
  list: () => Promise<WriteUpList>
  mine: (userId: string) => Promise<MyWriteUpRow[]>
  /** Sends through the outbox (punch list #410, PR 4): with no signal the write-up is kept on the phone and sent later. */
  send: (userId: string, fields: Record<string, unknown>, pressedAt: number) => Promise<WriteUpSent>
  /** The writer's write-ups still on the phone. */
  kept: (userId: string) => KeptWriteUp[]
  /** Called when the phone's kept presses change: one landed, one was refused. */
  onKeptChange: (cb: () => void) => () => void
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

export async function takeBackWriteUp(reportId: string, reason: string): Promise<void> {
  const { error } = await db.rpc('withdraw_person_report', { p_report_id: reportId, p_reason: reason })
  if (error) throw error
}

/** One send through the outbox. The outbox mints the press id and keeps it on every try, so a send lands once. */
export async function sendWriteUp(userId: string, fields: Record<string, unknown>, pressedAt: number): Promise<WriteUpSent> {
  const outcome = await pressThroughOutbox({ kind: 'person-report', userId, pressedAt, payload: { fields }, about: '', door: '/dashboard' })
  if (outcome.kind === 'landed') return { kind: 'landed' }
  if (outcome.kind === 'queued') return { kind: 'queued' }
  if (outcome.kind === 'refused') return { kind: 'refused', message: outcome.message }
  return { kind: 'failed', error: outcome.error }
}

export const writeUpIo: WriteUpIo = {
  list: loadWriteUpList,
  mine: loadMyWriteUps,
  send: sendWriteUp,
  kept: (userId) => keptWriteUps(outbox.presses(), userId),
  onKeptChange: (cb) => outbox.subscribe(cb),
  takeBack: takeBackWriteUp,
}
