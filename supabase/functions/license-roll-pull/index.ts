import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import {
  fileLooksCutShort,
  planRollPull,
  pullErrorWords,
  tsbpeFile,
  tsbpeRows,
  TSBPE_WEEKLY_FILES,
  type KeptRow,
  type LeftOff,
  type TsbpeFile,
} from '../_shared/licenseRoll.ts'
import { unzipFirst } from '../_shared/zipFirst.ts'

/**
 * State roll (punch list #411): read one of the plumbing board's free licensee files and bring the kept roll up to
 * date. One file a call, so a call stays well inside the edge's CPU limit; the weekly job posts once per file.
 *
 * The board's files say what is true today and keep no history. This keeps the rows of our counties
 * (`license_roll_counties`), never one of a person left off (`license_roll_left_off`), and writes what changed
 * since the last pull (`license_roll_changes`). The rule is `planRollPull` in `_shared/licenseRoll.ts`.
 *
 * No phone, street address or email is kept: the board gives none for a person, and a responsible master's
 * business address and phone are read past.
 *
 * Auth: `X-Cron-Secret` = CRON_SECRET, or a bearer JWT whose user passes `user_can_read_license_roll()`.
 * Body: `{ file: 'RMP' | 'MP' | 'JP' | 'TP', dry_run?: boolean }`.
 * Answer: `{ ok, dryRun, file, seen, kept, added, changed, gone, skipped, ms }`, or `{ ok: false, error }` with the
 * reason, which the ledger row keeps too.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const FETCH_TIMEOUT_MS = 40_000
const READ_PAGE = 1000
const WRITE_BATCH = 500
const ID_BATCH = 200
/** A file with fewer lines than this is not the board's roll, whatever it says. */
const FEWEST_ROWS = 200

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// deno-lint-ignore no-explicit-any
type Admin = any

async function fetchFileText(file: TsbpeFile): Promise<string> {
  const res = await fetch(file.url, { headers: { 'User-Agent': 'license-roll-pull/1.0' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`The board answered ${res.status} for its ${file.file} file.`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const csv = file.zipped ? await unzipFirst(bytes) : bytes
  return new TextDecoder('utf-8').decode(csv)
}

const KEPT_COLUMNS =
  'id,source,trade,license_class,license_number,status,licensed_on,expires_on,last_name,first_name,middle_name,suffix,name_key,zip,county,endorsements,company,insurance_ends_on,ours,gone_on'

async function readKept(admin: Admin, file: TsbpeFile): Promise<KeptRow[]> {
  const kept: KeptRow[] = []
  for (let from = 0; ; from += READ_PAGE) {
    const { data, error } = await admin
      .from('license_roll')
      .select(KEPT_COLUMNS)
      .eq('source', 'tsbpe')
      .eq('license_class', file.license_class)
      .order('id')
      .range(from, from + READ_PAGE - 1)
    if (error) throw new Error(`The kept roll could not be read: ${error.message}`)
    kept.push(...((data ?? []) as KeptRow[]))
    if (!data || data.length < READ_PAGE) return kept
  }
}

async function readCounties(admin: Admin): Promise<Set<string>> {
  const { data, error } = await admin.from('license_roll_counties').select('county')
  if (error) throw new Error(`The counties could not be read: ${error.message}`)
  return new Set(((data ?? []) as { county: string }[]).map((r) => r.county))
}

async function readLeftOff(admin: Admin): Promise<LeftOff> {
  const numbers = new Set<string>()
  const nameKeys = new Set<string>()
  for (let from = 0; ; from += READ_PAGE) {
    const { data, error } = await admin.from('license_roll_left_off').select('source,license_number,name_key').order('id').range(from, from + READ_PAGE - 1)
    if (error) throw new Error(`The left-off list could not be read: ${error.message}`)
    for (const r of (data ?? []) as { source: string | null; license_number: string | null; name_key: string | null }[]) {
      if (r.source === 'tsbpe' && r.license_number) numbers.add(r.license_number)
      if (r.name_key) nameKeys.add(r.name_key)
    }
    if (!data || data.length < READ_PAGE) return { numbers, nameKeys }
  }
}

function batches<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET')

  let body: { file?: unknown; dry_run?: unknown } = {}
  try {
    body = (await req.json()) ?? {}
  } catch {
    body = {}
  }

  const given = req.headers.get('x-cron-secret')
  let allowed = Boolean(cronSecret && given === cronSecret)
  let pulledBy: string | null = null
  if (!allowed) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth.toLowerCase().startsWith('bearer ') && anonKey) {
      const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } })
      const { data: ok } = await asUser.rpc('user_can_read_license_roll')
      allowed = ok === true
      if (allowed) pulledBy = (await asUser.auth.getUser()).data.user?.id ?? null
    }
  }
  if (!allowed) return jsonResponse({ error: 'Unauthorized' }, 401)

  const file = typeof body.file === 'string' ? tsbpeFile(body.file) : null
  if (!file || !TSBPE_WEEKLY_FILES.includes(file.file)) {
    return jsonResponse({ error: `Name the file to pull. The files are ${TSBPE_WEEKLY_FILES.join(', ')}.` }, 400)
  }
  const dryRun = body.dry_run === true
  const admin: Admin = createClient(supabaseUrl, serviceKey)
  const today = todayYmdInAppTz()
  const started = Date.now()

  // The ledger row first, so a pull that fails is on the page with its reason.
  let pullId: string | null = null
  if (!dryRun) {
    const { data, error } = await admin.from('license_roll_pulls').insert({ source: 'tsbpe', file: file.file, trade: 'plumbing', pulled_by: pulledBy }).select('id').single()
    if (error) return jsonResponse({ ok: false, error: `The pull could not be logged: ${error.message}` }, 500)
    pullId = (data as { id: string }).id
  }
  const finish = async (fields: Record<string, unknown>) => {
    if (pullId) await admin.from('license_roll_pulls').update({ finished_at: new Date().toISOString(), ...fields }).eq('id', pullId)
  }

  try {
    const read = tsbpeRows(file, await fetchFileText(file))
    if (read.rows.length < FEWEST_ROWS) throw new Error(`The board's ${file.file} file has ${read.rows.length} rows. That is too few to be the roll.`)
    const [kept, counties, leftOff] = await Promise.all([readKept(admin, file), readCounties(admin), readLeftOff(admin)])
    // Our own people's numbers arrive with step two. Until then no row is kept for being ours.
    const plan = planRollPull({ rows: read.rows, kept, counties, ours: new Set<string>(), leftOff, today, newId: () => crypto.randomUUID() })
    const keptThere = kept.filter((k) => !k.gone_on).length
    if (fileLooksCutShort(keptThere, plan.markedGone)) {
      throw new Error(`The board's ${file.file} file lacks ${plan.markedGone} of the ${keptThere} rows kept. It looks cut short, so nothing was changed.`)
    }
    const answer = { file: file.file, ...plan.counts, skipped: read.skipped }
    if (dryRun) return jsonResponse({ ok: true, dryRun: true, ...answer, ms: Date.now() - started })

    for (const part of batches(plan.inserts, WRITE_BATCH)) {
      const { error } = await admin.from('license_roll').insert(part)
      if (error) throw new Error(`New rows could not be kept: ${error.message}`)
    }
    for (const part of batches(plan.seenIds, ID_BATCH)) {
      const { error } = await admin.from('license_roll').update({ last_seen_on: today }).in('id', part)
      if (error) throw new Error(`Rows could not be stamped as seen: ${error.message}`)
    }
    for (const p of plan.patches) {
      const { error } = await admin.from('license_roll').update({ ...p.patch, updated_at: new Date().toISOString() }).eq('id', p.id)
      if (error) throw new Error(`A row could not be updated: ${error.message}`)
    }
    // A row being taken off takes its history with it, so its changes are not written.
    const leaving = new Set(plan.deletes)
    const changes = plan.changes.filter((c) => !leaving.has(c.roll_id)).map((c) => ({ ...c, pull_id: pullId, seen_on: today }))
    for (const part of batches(changes, WRITE_BATCH)) {
      const { error } = await admin.from('license_roll_changes').insert(part)
      if (error) throw new Error(`What changed could not be kept: ${error.message}`)
    }
    for (const part of batches(plan.deletes, ID_BATCH)) {
      const { error } = await admin.from('license_roll').delete().in('id', part)
      if (error) throw new Error(`Rows could not be taken off: ${error.message}`)
    }
    await finish({ rows_seen: plan.counts.seen, rows_kept: plan.counts.kept, added: plan.counts.added, changed: plan.counts.changed, gone: plan.counts.gone })
    return jsonResponse({ ok: true, dryRun: false, ...answer, ms: Date.now() - started })
  } catch (e) {
    const error = pullErrorWords(e)
    await finish({ error })
    return jsonResponse({ ok: false, error, file: file.file, ms: Date.now() - started }, 502)
  }
})
