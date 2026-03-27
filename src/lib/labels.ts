import { supabase } from './supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'

export type LabelRow = Database['public']['Tables']['labels']['Row']
export type LabelInsert = Database['public']['Tables']['labels']['Insert']

/** Normalize a display name to a stable slug (unique per master in `labels.slug`). */
export function slugifyLabelName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 128)
  return s.length > 0 ? s : 'label'
}

export async function fetchLabelsForMaster(masterUserId: string): Promise<LabelRow[]> {
  return withSupabaseRetry(
    async () =>
      supabase.from('labels').select('*').eq('master_user_id', masterUserId).order('name', { ascending: true }),
    'fetch labels for master'
  )
}

/** All label catalog rows for any of the given masters (deduped). */
export async function fetchLabelsForMasterIds(masterUserIds: string[]): Promise<LabelRow[]> {
  const uniq = [...new Set(masterUserIds.filter(Boolean))]
  if (uniq.length === 0) return []
  return withSupabaseRetry(
    async () => supabase.from('labels').select('*').in('master_user_id', uniq).order('name', { ascending: true }),
    'fetch labels for master ids'
  )
}

/** Label ids per person_id for batch loading (empty arrays for ids with no rows). */
export async function fetchPeopleLabelsForPersonIds(personIds: string[]): Promise<Record<string, string[]>> {
  if (personIds.length === 0) return {}
  const rows = await withSupabaseRetry(
    async () => supabase.from('people_labels').select('person_id, label_id').in('person_id', personIds),
    'fetch people_labels for person ids'
  )
  const out: Record<string, string[]> = {}
  for (const id of personIds) {
    out[id] = []
  }
  for (const r of rows as { person_id: string; label_id: string }[]) {
    const pid = r.person_id
    const bucket = out[pid] ?? (out[pid] = [])
    bucket.push(r.label_id)
  }
  return out
}

/** Label ids per user_id for batch loading (empty arrays for ids with no rows). */
export async function fetchUserLabelsForUserIds(userIds: string[]): Promise<Record<string, string[]>> {
  if (userIds.length === 0) return {}
  const rows = await withSupabaseRetry(
    async () => supabase.from('user_labels').select('user_id, label_id').in('user_id', userIds),
    'fetch user_labels for user ids'
  )
  const out: Record<string, string[]> = {}
  for (const id of userIds) {
    out[id] = []
  }
  for (const r of rows as { user_id: string; label_id: string }[]) {
    const uid = r.user_id
    const bucket = out[uid] ?? (out[uid] = [])
    bucket.push(r.label_id)
  }
  return out
}

export async function insertLabel(row: LabelInsert): Promise<LabelRow> {
  return withSupabaseRetry(
    async () => supabase.from('labels').insert(row).select().single(),
    'insert label'
  )
}

export async function updateLabel(
  id: string,
  patch: Pick<LabelRow, 'name' | 'slug'>
): Promise<LabelRow> {
  return withSupabaseRetry(
    async () => supabase.from('labels').update(patch).eq('id', id).select().single(),
    'update label'
  )
}

export async function deleteLabel(id: string): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.from('labels').delete().eq('id', id),
    'delete label'
  )
}

export type LabelUsageCounts = { people: number; users: number }

/** Count people_labels and user_labels rows per label_id (for catalog maintenance). */
export async function fetchLabelUsageCounts(labelIds: string[]): Promise<Record<string, LabelUsageCounts>> {
  const uniq = [...new Set(labelIds.filter(Boolean))]
  const empty = (): LabelUsageCounts => ({ people: 0, users: 0 })
  const out: Record<string, LabelUsageCounts> = {}
  for (const id of uniq) {
    out[id] = empty()
  }
  if (uniq.length === 0) return out

  const [plRows, ulRows] = await Promise.all([
    withSupabaseRetry(
      async () => supabase.from('people_labels').select('label_id').in('label_id', uniq),
      'fetch people_labels counts by label'
    ),
    withSupabaseRetry(
      async () => supabase.from('user_labels').select('label_id').in('label_id', uniq),
      'fetch user_labels counts by label'
    ),
  ])

  const plList = (plRows ?? []) as { label_id: string }[]
  const ulList = (ulRows ?? []) as { label_id: string }[]
  for (const r of plList) {
    const lid = r.label_id
    if (!out[lid]) out[lid] = empty()
    out[lid].people++
  }
  for (const r of ulList) {
    const lid = r.label_id
    if (!out[lid]) out[lid] = empty()
    out[lid].users++
  }
  return out
}

export async function fetchPersonLabelIds(personId: string): Promise<string[]> {
  const rows = await withSupabaseRetry(
    async () => supabase.from('people_labels').select('label_id').eq('person_id', personId),
    'fetch person label ids'
  )
  return rows.map((r) => r.label_id)
}

/** Replaces all labels for a person with the given label ids (same master; enforced by RLS + trigger). */
export async function setPersonLabels(personId: string, labelIds: string[]): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.from('people_labels').delete().eq('person_id', personId),
    'clear people_labels for person'
  )
  if (labelIds.length === 0) return
  const rows: Database['public']['Tables']['people_labels']['Insert'][] = labelIds.map((label_id) => ({
    person_id: personId,
    label_id,
  }))
  await withSupabaseRetry(
    async () => supabase.from('people_labels').insert(rows),
    'insert people_labels'
  )
}

/** Replaces all labels for a user with the given label ids (same master; enforced by RLS + trigger). */
export async function setUserLabels(userId: string, labelIds: string[]): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.from('user_labels').delete().eq('user_id', userId),
    'clear user_labels for user'
  )
  if (labelIds.length === 0) return
  const rows: Database['public']['Tables']['user_labels']['Insert'][] = labelIds.map((label_id) => ({
    user_id: userId,
    label_id,
  }))
  await withSupabaseRetry(
    async () => supabase.from('user_labels').insert(rows),
    'insert user_labels'
  )
}
