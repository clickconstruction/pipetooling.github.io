/**
 * Research (punch list #292): the ledger's reads and writes. `research_permits` for the rows,
 * `permit_pulls` for the Pulled line, `permit_verdicts` for a call, `prospects` + `prospect_jobs`
 * for the GC lead Approach them makes, and the `permit-pull` function for Pull now. The tables
 * and the RPC are newer than the generated types, so the calls use the house `as never` pattern
 * until the next chore(types) regen.
 */
import { supabase } from '../supabase'
import { resolveCompanyOwnerUserId } from '../companyOwner'
import { formatErrorMessage } from '../../utils/errorHandling'
import { leadFromPermit, type PermitLeadRole, type PermitVerdict, type ResearchPermitRow } from './permitResearch'

function failed(error: unknown, doing: string): never {
  throw new Error(`Could not ${doing}: ${formatErrorMessage(error)}`)
}

export async function loadResearchPermits(city: string, sinceYmd: string, residential: boolean): Promise<ResearchPermitRow[]> {
  const { data, error } = await supabase.rpc('research_permits' as never, { p_city: city, p_since: sinceYmd, p_residential: residential } as never)
  if (error) failed(error, 'read the permits')
  return (data ?? []) as ResearchPermitRow[]
}

export type LatestPull = { ranAt: string | null; error: string | null }

/** The newest run per feed, folded to one line: the newest time and the first error among them. */
export async function loadLatestPull(city: string): Promise<LatestPull> {
  const { data, error } = await supabase
    .from('permit_pulls' as never)
    .select('source, ran_at, error')
    .eq('city', city)
    .order('ran_at', { ascending: false })
    .limit(6)
  if (error) failed(error, 'read the last pull')
  const rows = (data ?? []) as Array<{ source: string; ran_at: string; error: string | null }>
  const seen = new Set<string>()
  let ranAt: string | null = null
  let firstError: string | null = null
  for (const r of rows) {
    if (seen.has(r.source)) continue
    seen.add(r.source)
    if (!ranAt) ranAt = r.ran_at
    if (r.error && !firstError) firstError = r.error
  }
  return { ranAt, error: firstError }
}

export async function recordVerdict(input: {
  permitId: string
  verdict: PermitVerdict
  reason: string
  lookAgainOn: string | null
  prospectId: string | null
  userId: string
}): Promise<void> {
  const { error } = await supabase.from('permit_verdicts' as never).insert({
    permit_id: input.permitId,
    verdict: input.verdict,
    reason: input.reason.trim(),
    look_again_on: input.verdict === 'look' ? input.lookAgainOn : null,
    prospect_id: input.prospectId,
    decided_by: input.userId,
  } as never)
  if (error) failed(error, 'keep the verdict')
}

/**
 * Approach them: the company on the permit as a GC lead on the GCs deck (an open lead of the same
 * name is reused), with the permit as a job on it. Returns the lead to tie the verdict to.
 */
export async function approachFromPermit(row: ResearchPermitRow, role: PermitLeadRole, userId: string): Promise<{ prospectId: string; companyName: string; reused: boolean }> {
  const masterUserId = await resolveCompanyOwnerUserId(supabase, userId)
  const { prospect, job, companyName } = leadFromPermit(row, role, { userId, masterUserId })
  const { data: live, error: liveError } = await supabase
    .from('prospects')
    .select('id')
    .eq('kind', 'gc_lead')
    .ilike('company_name', companyName)
    .is('prospect_fit_status', null)
    .limit(1)
  if (liveError) failed(liveError, 'look for the company on Prospects')
  let prospectId = live?.[0]?.id ?? null
  let reused = true
  if (!prospectId) {
    const { data: made, error } = await supabase.from('prospects').insert(prospect as never).select('id').single()
    if (error || !made) failed(error, 'make the GC lead')
    prospectId = made.id
    reused = false
  }
  const { error: jobError } = await supabase.from('prospect_jobs').insert({ prospect_id: prospectId, created_by: userId, ...job } as never)
  if (jobError) failed(jobError, 'put the permit on the lead')
  return { prospectId, companyName, reused }
}

export type PullNowOutcome = { ok: boolean; feeds: Array<{ source: string; seen: number; kept: number; error: string | null }> }

/** Pull now: the same run the night makes, as the signed-in researcher. */
export async function pullPermitsNow(): Promise<PullNowOutcome> {
  const { data, error } = await supabase.functions.invoke('permit-pull', { body: {} })
  if (error) failed(error, 'run the pull')
  const body = (data ?? {}) as Partial<PullNowOutcome>
  return { ok: body.ok === true, feeds: body.feeds ?? [] }
}
