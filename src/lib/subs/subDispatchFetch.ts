/**
 * Loads for the dispatch hub's Subs lanes (v2.2929): live sub work orders with
 * their dates, the stage they fulfil, and the crew assigned to each job.
 * Degrades to empty + an error string like the hub's other fetches.
 */
import { supabase } from '../supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { subOrderTouchesRange, type SubDispatchOrder } from './subDispatch'

type OrderRow = {
  id: string
  person_id: string
  display_name: string
  job_id: string | null
  status: string
  record_id: string | null
  picked_start: string | null
  picked_end: string | null
  proposed_start: string | null
  proposed_end: string | null
  stage_window_id: string | null
  job: { hcp_number: string | null; job_name: string | null; job_address: string | null } | { hcp_number: string | null; job_name: string | null; job_address: string | null }[] | null
}

const jobLabel = (j: OrderRow['job']): string => {
  const job = Array.isArray(j) ? j[0] ?? null : j
  if (!job) return 'Sub work order'
  const num = (job.hcp_number ?? '').trim()
  const where = (job.job_address ?? '').trim() || (job.job_name ?? '').trim()
  return num && where ? `#${num} · ${where}` : num ? `#${num}` : where || 'Sub work order'
}

/** Live orders (offered / accepted / approved) whose pick or window touches the range. */
export async function fetchSubOrdersForRange(startYmd: string, endYmd: string): Promise<{ data: SubDispatchOrder[]; error: string | null }> {
  try {
    const rows = await withSupabaseRetry(
      async () =>
        await supabase
          .from('step_commitments')
          .select('id, person_id, display_name, job_id, status, record_id, picked_start, picked_end, proposed_start, proposed_end, stage_window_id, job:job_id(hcp_number, job_name, job_address)')
          .in('status', ['offered', 'accepted', 'approved'])
          .limit(1000),
      'fetchSubOrdersForRange',
    )
    const list = (rows ?? []) as unknown as OrderRow[]
    const windowIds = [...new Set(list.map((r) => r.stage_window_id).filter((id): id is string => !!id))]
    const windows = new Map<string, { start: string | null; end: string | null; fixture_id: string }>()
    const fixtureNames = new Map<string, string>()
    if (windowIds.length > 0) {
      const win = await withSupabaseRetry(async () => await supabase.from('job_stage_windows').select('id, fixture_id, window_start, window_end').in('id', windowIds), 'fetchSubOrdersForRange.windows')
      for (const w of (win ?? []) as Array<{ id: string; fixture_id: string; window_start: string | null; window_end: string | null }>) windows.set(w.id, { start: w.window_start, end: w.window_end, fixture_id: w.fixture_id })
      const fixtureIds = [...new Set([...windows.values()].map((w) => w.fixture_id))]
      if (fixtureIds.length > 0) {
        const fx = await withSupabaseRetry(async () => await supabase.from('jobs_ledger_fixtures').select('id, name').in('id', fixtureIds), 'fetchSubOrdersForRange.fixtures')
        for (const f of (fx ?? []) as Array<{ id: string; name: string | null }>) fixtureNames.set(f.id, (f.name ?? '').trim())
      }
    }
    const orders: SubDispatchOrder[] = list.map((r) => {
      const w = r.stage_window_id ? windows.get(r.stage_window_id) : undefined
      return {
        id: r.id,
        personId: r.person_id,
        personName: (r.display_name ?? '').trim() || 'Sub',
        jobId: r.job_id,
        jobLabel: jobLabel(r.job),
        status: r.status,
        pickedStart: r.picked_start,
        pickedEnd: r.picked_end,
        proposedStart: r.proposed_start,
        proposedEnd: r.proposed_end,
        windowStart: w?.start ?? null,
        windowEnd: w?.end ?? null,
        stageName: w ? fixtureNames.get(w.fixture_id) || null : null,
        recordId: r.record_id,
      }
    })
    return { data: orders.filter((o) => subOrderTouchesRange(o, startYmd, endYmd)), error: null }
  } catch (e) {
    return { data: [], error: formatErrorMessage(e) }
  }
}

/** jobs_ledger_team_members grouped by job — who is assigned to each job (for the "sub" badges). */
export async function fetchTeamMembersByJobId(jobIds: string[]): Promise<{ data: Map<string, string[]>; error: string | null }> {
  const unique = [...new Set(jobIds)].filter(Boolean)
  const out = new Map<string, string[]>()
  if (unique.length === 0) return { data: out, error: null }
  try {
    for (let i = 0; i < unique.length; i += 150) {
      const slice = unique.slice(i, i + 150)
      const rows = await withSupabaseRetry(async () => await supabase.from('jobs_ledger_team_members').select('job_id, user_id').in('job_id', slice), 'fetchTeamMembersByJobId')
      for (const r of (rows ?? []) as Array<{ job_id: string; user_id: string }>) {
        if (!r.job_id || !r.user_id) continue
        const list = out.get(r.job_id) ?? []
        if (!list.includes(r.user_id)) list.push(r.user_id)
        out.set(r.job_id, list)
      }
    }
    return { data: out, error: null }
  } catch (e) {
    return { data: out, error: formatErrorMessage(e) }
  }
}

/** person_availability (kind off) inside the range, grouped by person (v2.2930). */
export async function fetchSubOffDaysForRange(startYmd: string, endYmd: string): Promise<{ data: Map<string, string[]>; error: string | null }> {
  const out = new Map<string, string[]>()
  try {
    const rows = await withSupabaseRetry(async () => await supabase.from('person_availability').select('person_id, day').eq('kind', 'off').gte('day', startYmd).lte('day', endYmd).limit(2000), 'fetchSubOffDaysForRange')
    for (const r of (rows ?? []) as Array<{ person_id: string; day: string }>) out.set(r.person_id, [...(out.get(r.person_id) ?? []), r.day])
    return { data: out, error: null }
  } catch (e) {
    return { data: out, error: formatErrorMessage(e) }
  }
}
