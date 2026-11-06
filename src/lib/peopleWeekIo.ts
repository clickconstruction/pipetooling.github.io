/**
 * Your people's week (punch list #273, PR 5, v2.6603): the reads and writes behind the subscribe sheet. The table and
 * the function are new with `20261106233000_people_week_email.sql`, so until the types PR after the push the client is
 * widened and the rows cast.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { fnProblem, type FnResult } from './gc/gcIo'
import { formatErrorMessage } from '../utils/errorHandling'
import type { PeopleWeekInsert, PeopleWeekRequestRow } from './peopleWeek'

const db = supabase as unknown as SupabaseClient

const REQUEST_SELECT = 'id, requested_by, recipient_user_id, people_user_ids, send_at, repeat_weekly, sent_at'

/** The signed-in person's pending sends (the policy shows them their own). */
export async function listPeopleWeekRequests(): Promise<PeopleWeekRequestRow[]> {
  const { data, error } = await db.from('people_week_email_requests').select(REQUEST_SELECT).is('sent_at', null).order('send_at')
  if (error) throw new Error(formatErrorMessage(error, 'The Monday emails did not load.'))
  return (data ?? []) as PeopleWeekRequestRow[]
}

/** Rows to add and rows to stop, from `planPeopleWeekEdit`. */
export async function applyPeopleWeekPlan(plan: { inserts: PeopleWeekInsert[]; cancelIds: string[] }): Promise<void> {
  if (plan.inserts.length > 0) {
    const { error } = await db.from('people_week_email_requests').insert(plan.inserts).select('id')
    if (error) throw new Error(formatErrorMessage(error, 'The Monday email was not saved.'))
  }
  if (plan.cancelIds.length > 0) {
    const { error } = await db.from('people_week_email_requests').delete().in('id', plan.cancelIds).is('sent_at', null).select('id')
    if (error) throw new Error(formatErrorMessage(error, 'The Monday email did not stop.'))
  }
}

/** The email as it would go now, about these people, for the signed-in person. */
export async function previewPeopleWeek(peopleUserIds: string[]): Promise<{ subject: string; html: string }> {
  const r = (await supabase.functions.invoke('people-week-email', { body: { mode: 'preview', people_user_ids: peopleUserIds } })) as FnResult
  const problem = await fnProblem(r, 'The email did not load.')
  if (problem) throw new Error(problem)
  const data = r.data as { subject?: string; html?: string } | null
  if (!data?.html) throw new Error('The email did not load.')
  return { subject: data.subject ?? '', html: data.html }
}

/** A copy marked [TEST] to the signed-in person only. */
export async function sendPeopleWeekTest(peopleUserIds: string[]): Promise<void> {
  const r = (await supabase.functions.invoke('people-week-email', { body: { mode: 'test_send', people_user_ids: peopleUserIds } })) as FnResult
  const problem = await fnProblem(r, 'The test did not go.')
  if (problem) throw new Error(problem)
}

/** Everyone the office may pick: the real, live accounts by name. */
export async function loadPeopleToPick(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from('users').select('id, name').is('archived_at', null).eq('is_sample', false).eq('is_digital_twin', false).order('name', { ascending: true })
  if (error) throw new Error(formatErrorMessage(error, 'The people did not load.'))
  return (data ?? []).map((u) => ({ id: u.id, name: (u.name ?? '').trim() }))
}
