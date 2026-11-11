/**
 * Research (punch list #292): the ledger's reads and writes. `research_permits` for the rows,
 * `permit_pulls` for the Pulled line, `permit_verdicts` for a call, `prospects` + `prospect_jobs`
 * for the GC lead Approach them makes, and the `permit-pull` function for Pull now. The tables
 * and the RPC are newer than the generated types, so the calls use the house `as never` pattern
 * until the next chore(types) regen.
 */
import { cityReadsParcels } from './permitCityDoors'
import { supabase } from '../supabase'
import { resolveCompanyOwnerUserId } from '../companyOwner'
import { formatErrorMessage } from '../../utils/errorHandling'
import { leadFromPermit, ymdPlusDays, type BuilderMarkValue, type ContactHistory, type LeadFacts, type PermitLeadRole, type PermitVerdict, type PursueFor, type ResearchPermitRow } from './permitResearch'
import type { BuilderKind, BuilderRow, PermitFunnel } from './permitBuilders'
import type { CompanyFacts, ParcelFacts } from '../../../supabase/functions/_shared/permitLookup'
import { BUILDER_PERMIT_DAYS, type SitePermit } from './permitPublic'
import { recordsStartOf } from './permitReach'

function failed(error: unknown, doing: string): never {
  throw new Error(`Could not ${doing}: ${formatErrorMessage(error)}`)
}

/** PostgREST's "function not found": the window after the client deploys and before migration *_permit_skim is pushed. */
function missingFunction(error: { message?: string; code?: string } | null): boolean {
  return error != null && (error.code === 'PGRST202' || /could not find the function/i.test(error.message ?? ''))
}

export async function loadResearchPermits(city: string, sinceYmd: string, residential: boolean): Promise<ResearchPermitRow[]> {
  const args = { p_city: city, p_since: sinceYmd, p_residential: residential }
  // The builder and the rest of the verdict ride on v2; the older read stands in until the migration is pushed.
  const v2 = await supabase.rpc('research_permits_v2' as never, args as never)
  if (!v2.error) return (v2.data ?? []) as ResearchPermitRow[]
  if (!missingFunction(v2.error)) failed(v2.error, 'read the permits')
  const { data, error } = await supabase.rpc('research_permits' as never, args as never)
  if (error) failed(error, 'read the permits')
  return (data ?? []) as ResearchPermitRow[]
}

/**
 * The day a city's records start: the earliest day every one of its feeds was read back to by a
 * pull that ran clean. The counts on Permits say it (punch list #307), so nothing reads as a
 * year on ten weeks of rows. One feed read further back than another does not move the day.
 * Null when no pull is on record.
 */
export async function loadRecordsStart(city: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('permit_pulls' as never)
    .select('source, since')
    .eq('city', city)
    .is('error', null)
    .not('since', 'is', null)
    .order('since', { ascending: true })
    .limit(1000)
  if (error) failed(error, 'read where the records start')
  return recordsStartOf((data ?? []) as Array<{ source: string; since: string | null }>)
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
  /** The one-tap reason as a code, the person a keep or a pursue is handed to, and what a pursue is for (punch list #302). */
  reasonCode?: string | null
  forUserId?: string | null
  pursueFor?: PursueFor | null
}): Promise<void> {
  const row: Record<string, unknown> = {
    permit_id: input.permitId,
    verdict: input.verdict,
    reason: input.reason.trim(),
    look_again_on: input.verdict === 'look' ? input.lookAgainOn : null,
    prospect_id: input.prospectId,
    decided_by: input.userId,
  }
  // The three newer columns are named only when they carry something, so a write still lands before the migration does.
  if (input.reasonCode) row.reason_code = input.reasonCode
  if (input.forUserId) row.for_user_id = input.forUserId
  if (input.pursueFor) row.pursue_for = input.pursueFor
  const { error } = await supabase.from('permit_verdicts' as never).insert(row as never)
  if (error) failed(error, 'keep the verdict')
}

/** Put back: the permit waits on the skim again. A fifth verdict, since the table only ever grows. */
export async function putBackPermit(permitId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('permit_verdicts' as never).insert({ permit_id: permitId, verdict: 'back', reason: 'Put back on the skim.', decided_by: userId } as never)
  if (error) failed(error, 'put the permit back')
}

/** One line of what was done on a permit, oldest first as stored; the screen turns it newest first. */
export type PermitVerdictEvent = { id: string; verdict: string; reason: string; reason_code: string | null; decided_at: string; by_name: string | null; for_name: string | null; pursue_for: string | null }

export async function loadPermitHistory(permitId: string): Promise<PermitVerdictEvent[]> {
  const { data, error } = await supabase.from('permit_verdicts' as never).select('*').eq('permit_id', permitId).order('decided_at', { ascending: false }).limit(50)
  if (error) failed(error, 'read what was done on this permit')
  const rows = (data ?? []) as Array<{ id: string; verdict: string; reason: string; reason_code?: string | null; decided_at: string; decided_by: string; for_user_id?: string | null; pursue_for?: string | null }>
  const ids = [...new Set(rows.flatMap((r) => [r.decided_by, r.for_user_id ?? null]).filter((v): v is string => Boolean(v)))]
  const names = new Map<string, string>()
  if (ids.length > 0) {
    const { data: users } = await supabase.from('users').select('id, name').in('id', ids)
    for (const u of users ?? []) names.set(u.id, u.name ?? '')
  }
  return rows.map((r) => ({ id: r.id, verdict: r.verdict, reason: r.reason, reason_code: r.reason_code ?? null, decided_at: r.decided_at, by_name: names.get(r.decided_by) || null, for_name: r.for_user_id ? names.get(r.for_user_id) || null : null, pursue_for: r.pursue_for ?? null }))
}

/** The people a keep can be handed to: the office and the estimators, by name. Empty when the list cannot be read. */
export async function loadResearchers(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase.from('users').select('id, name, role, archived_at').in('role', ['dev', 'master_technician', 'assistant', 'controller', 'estimator']).is('archived_at', null).order('name')
  if (error) return []
  return (data ?? []).filter((u) => (u.name ?? '').trim() !== '').map((u) => ({ id: u.id, name: u.name as string }))
}

/** Builders: every name that pulled a commercial building permit in the city in the last year. Null before the migration is pushed. */
export async function loadBuilders(city: string): Promise<BuilderRow[] | null> {
  const { data, error } = await supabase.rpc('research_builders' as never, { p_city: city } as never)
  if (error) {
    if (missingFunction(error)) return null
    failed(error, 'read the builders')
  }
  return (data ?? []) as BuilderRow[]
}

/** Our mark on a builder: good or avoid with its reason, or none to clear it. Append-only; the newest wins. */
export async function markBuilder(builderKey: string, mark: BuilderMarkValue | 'none', reason: string, userId: string): Promise<void> {
  const { error } = await supabase.from('builder_marks' as never).insert({ builder_key: builderKey, mark, reason: reason.trim(), marked_by: userId } as never)
  if (error) failed(error, 'keep the mark')
}

/** What the office says about a name: what to call it and what kind of company it is. */
export async function saveBuilder(builderKey: string, name: string, kind: BuilderKind | null, userId: string): Promise<void> {
  const { error } = await supabase.from('builders' as never).upsert({ key: builderKey, name: name.trim(), kind, updated_by: userId, updated_at: new Date().toISOString() } as never, { onConflict: 'key' })
  if (error) failed(error, 'keep the builder')
}

/** A builder's building permits by its key, the last year, newest first. */
export async function loadPermitsOfBuilder(city: string, builderKey: string, todayYmd: string): Promise<SitePermit[]> {
  const since = ymdPlusDays(todayYmd, -BUILDER_PERMIT_DAYS)
  const { data, error } = await supabase
    .from('permits' as never)
    .select(SITE_PERMIT_COLUMNS)
    .eq('city', city)
    .eq('kind', 'building')
    .eq('builder_key', builderKey)
    .or(`issued_on.gte.${since},submitted_on.gte.${since}`)
    .order('submitted_on', { ascending: false, nullsFirst: false })
    .limit(200)
  if (error) failed(error, "read this builder's permits")
  return (data ?? []) as SitePermit[]
}

/** The count since a day. Null before the migration is pushed. */
export async function loadPermitFunnel(city: string, sinceYmd: string): Promise<PermitFunnel | null> {
  const { data, error } = await supabase.rpc('permit_funnel' as never, { p_city: city, p_since: sinceYmd } as never)
  if (error) {
    if (missingFunction(error)) return null
    failed(error, 'read the count')
  }
  return (data ?? null) as PermitFunnel | null
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

/** Pull now: the same run the night makes, for the city on screen, as the signed-in researcher. */
export async function pullPermitsNow(city: string): Promise<PullNowOutcome> {
  const { data, error } = await supabase.functions.invoke('permit-pull', { body: { city } })
  if (error) failed(error, 'run the pull')
  const body = (data ?? {}) as Partial<PullNowOutcome>
  return { ok: body.ok === true, feeds: body.feeds ?? [] }
}

/**
 * A read back as history (punch list #307): the days from `since` up to `until`, flagged so they
 * count for a builder and a bid's site and never sit on the skim. Returns how many permits it
 * kept. A feed that stopped short is a failure, with its reason: the records' start must not move.
 */
export async function pullPermitsBack(city: string, sinceYmd: string, untilYmd: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke('permit-pull', { body: { city, since: sinceYmd, until: untilYmd } })
  if (error) failed(error, 'read the permits back')
  const body = (data ?? {}) as Partial<PullNowOutcome> & { error?: string }
  if (body.error) throw new Error(body.error)
  const stopped = (body.feeds ?? []).find((f) => f.error)
  if (stopped) throw new Error(`The read back stopped: ${stopped.error}`)
  return (body.feeds ?? []).reduce((n, f) => n + (f.kept ?? 0), 0)
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
export function lookupParcel(address: string, city: string, refresh = false, point: { lat: number | null; lng: number | null } | null = null): Promise<LookupAnswer<ParcelFacts>> {
  // A city whose county's parcel record is not read says so on its card and opens the appraisal district.
  if (!cityReadsParcels(city)) return Promise.resolve({ found: false, facts: null, error: null, cached: true, lookedUpAt: null })
  // The permit's point rides along: outside Bexar it is asked when the street address has no parcel, as on new construction.
  const at = point && point.lat != null && point.lng != null ? { lat: point.lat, lng: point.lng } : {}
  return lookup<ParcelFacts>({ kind: 'parcel', address, city, refresh, ...at })
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
