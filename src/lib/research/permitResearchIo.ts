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
import { leadFromPermit, ymdPlusDays, type ContactHistory, type LeadFacts, type PermitLeadRole, type PermitVerdict, type ResearchPermitRow } from './permitResearch'
import type { CompanyFacts, ParcelFacts } from '../../../supabase/functions/_shared/permitLookup'
import { BUILDER_PERMIT_DAYS, type SitePermit } from './permitPublic'

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
export async function approachFromPermit(row: ResearchPermitRow, role: PermitLeadRole, userId: string, facts: LeadFacts = {}): Promise<{ prospectId: string; companyName: string; reused: boolean }> {
  const masterUserId = await resolveCompanyOwnerUserId(supabase, userId)
  const { prospect, job, companyName } = leadFromPermit(row, role, { userId, masterUserId }, facts)
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

/** The bid history behind the hint, by normalized name key, in one read. */
export async function loadContactHistory(keys: readonly string[]): Promise<Map<string, ContactHistory>> {
  const out = new Map<string, ContactHistory>()
  if (keys.length === 0) return out
  const { data, error } = await supabase.rpc('research_contact_history' as never, { p_keys: [...new Set(keys)] } as never)
  if (error) failed(error, 'read our history with these names')
  for (const r of (data ?? []) as ContactHistory[]) out.set(r.key, r)
  return out
}

export type LookupAnswer<F> = { found: boolean; facts: F | null; error: string | null; cached: boolean; lookedUpAt: string | null }

async function lookup<F>(body: Record<string, unknown>): Promise<LookupAnswer<F>> {
  const { data, error } = await supabase.functions.invoke('permit-lookup', { body })
  if (error) failed(error, 'look it up')
  const a = (data ?? {}) as { found?: boolean; facts?: F; error?: string | null; cached?: boolean; looked_up_at?: string | null }
  return { found: a.found === true, facts: a.found === true ? (a.facts ?? null) : null, error: a.error ?? null, cached: a.cached === true, lookedUpAt: a.looked_up_at ?? null }
}

/** The company on the permit, on Google Places: phone, website, address, what kind of business. Cached a month. */
export function lookupCompany(contact: string, city: string, refresh = false): Promise<LookupAnswer<CompanyFacts>> {
  return lookup<CompanyFacts>({ kind: 'company', contact, city, refresh })
}

/** The parcel at the permit's address, at the county: the owner of record, their mailing address, the DBA, the values. Cached a month. */
export function lookupParcel(address: string, city: string, refresh = false): Promise<LookupAnswer<ParcelFacts>> {
  return lookup<ParcelFacts>({ kind: 'parcel', address, city, refresh })
}

/** One permit's own feed row: every column the city sent, where it came from and when. */
export type PermitFeedRow = { raw: unknown; source: string; pulledAt: string; firstSeenAt: string; addressKey: string | null }

/** The feed's full row for one permit (punch list #302): `permits.raw` keeps it whole and the ledger shows a part. */
export async function loadPermitFeedRow(permitId: string): Promise<PermitFeedRow | null> {
  const { data, error } = await supabase.from('permits').select('raw, source, pulled_at, first_seen_at, address_key').eq('id', permitId).maybeSingle()
  if (error) failed(error, "read the city's row")
  if (!data) return null
  return { raw: data.raw, source: data.source, pulledAt: data.pulled_at, firstSeenAt: data.first_seen_at, addressKey: data.address_key }
}

const SITE_PERMIT_COLUMNS = 'id, permit_number, permit_type, kind, stage, work_type, submitted_on, issued_on, contact, address, declared_value'

/** Every permit the feed holds on one address or under one number: two reads, since a name with a comma breaks an or-filter. */
export async function loadSitePermits(city: string, permitNumber: string, addressKey: string | null): Promise<SitePermit[]> {
  const byNumber = supabase.from('permits').select(SITE_PERMIT_COLUMNS).eq('city', city).eq('permit_number', permitNumber).limit(100)
  const byAddress = addressKey ? supabase.from('permits').select(SITE_PERMIT_COLUMNS).eq('city', city).eq('address_key', addressKey).limit(100) : null
  const [a, b] = await Promise.all([byNumber, byAddress])
  if (a.error) failed(a.error, 'read the permits on this address')
  if (b?.error) failed(b.error, 'read the permits on this address')
  return [...(a.data ?? []), ...(b?.data ?? [])]
}

/**
 * The building permits whose contact line holds one word of a name, in the last year, newest
 * first. Candidates only: `builderPermitLines` holds them to the whole name.
 */
export async function loadBuilderPermits(city: string, word: string, todayYmd: string): Promise<SitePermit[]> {
  const since = ymdPlusDays(todayYmd, -BUILDER_PERMIT_DAYS)
  const { data, error } = await supabase
    .from('permits')
    .select(SITE_PERMIT_COLUMNS)
    .eq('city', city)
    .eq('kind', 'building')
    .ilike('contact', `%${word}%`)
    .or(`issued_on.gte.${since},submitted_on.gte.${since}`)
    .order('submitted_on', { ascending: false, nullsFirst: false })
    .limit(300)
  if (error) failed(error, "read this name's other permits")
  return data ?? []
}
