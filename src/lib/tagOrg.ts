import { supabase } from './supabase'
import type { Database } from '../types/database'
import { withSupabaseRetry } from '../utils/errorHandling'
import { resolveManagerUserIdForFeedback } from './teamFeedback'

export type UserTagOrgRow = Database['public']['Tables']['user_tag_org']['Row']

/** Per-user hints for auditing tag org (non-authoritative). */
export type UserTagOrgSignals = {
  assistantMasters: string[]
  superintendentMasters: string[]
  primaryMasters: string[]
  jobMasters: Array<{ masterId: string; jobCount: number }>
  /** Roster people row matching user email, if any. */
  peopleEmailMaster: string | null
}

const emptySignals = (): UserTagOrgSignals => ({
  assistantMasters: [],
  superintendentMasters: [],
  primaryMasters: [],
  jobMasters: [],
  peopleEmailMaster: null,
})

export async function fetchTagOrgOverridesForUserIds(userIds: string[]): Promise<Record<string, string>> {
  if (userIds.length === 0) return {}
  const rows = await withSupabaseRetry(
    async () =>
      supabase.from('user_tag_org').select('user_id, master_user_id').in('user_id', userIds),
    'fetch user_tag_org overrides'
  )
  const out: Record<string, string> = {}
  for (const r of rows as { user_id: string; master_user_id: string }[]) {
    out[r.user_id] = r.master_user_id
  }
  return out
}

export async function resolveTagOrgMasterUserId(userId: string): Promise<string | null> {
  const row = await withSupabaseRetry(
    async () => supabase.from('user_tag_org').select('master_user_id').eq('user_id', userId).maybeSingle(),
    'resolveTagOrg override'
  )
  const mid = (row as { master_user_id: string } | null)?.master_user_id
  if (mid) return mid
  return resolveManagerUserIdForFeedback(userId)
}

export async function upsertUserTagOrg(userId: string, masterUserId: string, setBy: string | null): Promise<void> {
  await withSupabaseRetry(
    async () =>
      supabase.from('user_tag_org').upsert(
        {
          user_id: userId,
          master_user_id: masterUserId,
          set_by: setBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      ),
    'upsert user_tag_org'
  )
}

export async function deleteUserTagOrg(userId: string): Promise<void> {
  await withSupabaseRetry(
    async () => supabase.from('user_tag_org').delete().eq('user_id', userId),
    'delete user_tag_org'
  )
}

/**
 * Batch load adoption + job-derived masters + people-email hint for tag-org cleanup UI.
 */
export async function fetchUserTagOrgSignals(userIds: string[]): Promise<Record<string, UserTagOrgSignals>> {
  const out: Record<string, UserTagOrgSignals> = {}
  for (const id of userIds) {
    out[id] = emptySignals()
  }
  if (userIds.length === 0) return out

  const [assistRows, superRows, primaryRows, jtmRows, usersEmail] = await Promise.all([
    withSupabaseRetry(
      async () =>
        supabase.from('master_assistants').select('assistant_id, master_id').in('assistant_id', userIds),
      'tag org signals assistants'
    ),
    withSupabaseRetry(
      async () =>
        supabase
          .from('master_superintendents')
          .select('superintendent_id, master_id')
          .in('superintendent_id', userIds),
      'tag org signals superintendents'
    ),
    withSupabaseRetry(
      async () =>
        supabase.from('master_primaries').select('primary_id, master_id').in('primary_id', userIds),
      'tag org signals primaries'
    ),
    withSupabaseRetry(
      async () =>
        supabase.from('jobs_ledger_team_members').select('user_id, job_id').in('user_id', userIds),
      'tag org signals jtm'
    ),
    withSupabaseRetry(
      async () => supabase.from('users').select('id, email').in('id', userIds),
      'tag org signals users email'
    ),
  ])

  for (const r of assistRows as { assistant_id: string; master_id: string }[]) {
    const b = out[r.assistant_id] ?? emptySignals()
    if (!b.assistantMasters.includes(r.master_id)) b.assistantMasters.push(r.master_id)
    out[r.assistant_id] = b
  }
  for (const r of superRows as { superintendent_id: string; master_id: string }[]) {
    const b = out[r.superintendent_id] ?? emptySignals()
    if (!b.superintendentMasters.includes(r.master_id)) b.superintendentMasters.push(r.master_id)
    out[r.superintendent_id] = b
  }
  for (const r of primaryRows as { primary_id: string; master_id: string }[]) {
    const b = out[r.primary_id] ?? emptySignals()
    if (!b.primaryMasters.includes(r.master_id)) b.primaryMasters.push(r.master_id)
    out[r.primary_id] = b
  }

  const emailByUser = new Map<string, string | null>()
  for (const u of usersEmail as { id: string; email: string | null }[]) {
    emailByUser.set(u.id, u.email)
  }

  const distinctEmails = [
    ...new Set(
      (usersEmail as { id: string; email: string | null }[])
        .map((u) => u.email?.trim())
        .filter((e): e is string => !!e),
    ),
  ]

  const peopleByEmailLower = new Map<string, string>()
  if (distinctEmails.length > 0) {
    const peopleRows = await Promise.all(
      distinctEmails.map((email) =>
        withSupabaseRetry(
          async () =>
            supabase
              .from('people')
              .select('master_user_id, email')
              .is('archived_at', null)
              .ilike('email', email)
              .limit(1),
          'tag org people by email'
        )
      ),
    )
    distinctEmails.forEach((email, i) => {
      const rows = peopleRows[i] as { master_user_id: string; email: string | null }[] | null
      const row = rows?.[0]
      if (row) peopleByEmailLower.set(email.trim().toLowerCase(), row.master_user_id)
    })
  }

  for (const uid of userIds) {
    const b = out[uid] ?? emptySignals()
    const em = emailByUser.get(uid)?.trim().toLowerCase()
    if (em && peopleByEmailLower.has(em)) {
      b.peopleEmailMaster = peopleByEmailLower.get(em) ?? null
    }
    out[uid] = b
  }

  const jobIdSet = new Set((jtmRows as { job_id: string }[]).map((r) => r.job_id))
  const jobIdToMaster = new Map<string, string>()
  if (jobIdSet.size > 0) {
    const jlRows = await withSupabaseRetry(
      async () =>
        supabase.from('jobs_ledger').select('id, master_user_id').in('id', [...jobIdSet]),
      'tag org jobs masters'
    )
    for (const jl of jlRows as { id: string; master_user_id: string }[]) {
      jobIdToMaster.set(jl.id, jl.master_user_id)
    }
  }

  const jobAgg = new Map<string, Map<string, number>>()
  for (const raw of jtmRows as { user_id: string; job_id: string }[]) {
    const masterId = jobIdToMaster.get(raw.job_id)
    if (!masterId) continue
    if (!jobAgg.has(raw.user_id)) jobAgg.set(raw.user_id, new Map())
    const m = jobAgg.get(raw.user_id)!
    m.set(masterId, (m.get(masterId) ?? 0) + 1)
  }
  for (const uid of userIds) {
    const b = out[uid] ?? emptySignals()
    const counts = jobAgg.get(uid)
    if (counts) {
      b.jobMasters = [...counts.entries()]
        .map(([masterId, jobCount]) => ({ masterId, jobCount }))
        .sort((a, b) => a.masterId.localeCompare(b.masterId))
    }
    out[uid] = b
  }

  return out
}
