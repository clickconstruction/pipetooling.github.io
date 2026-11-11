import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { pullSinceDay, type PermitRow } from '../_shared/permitFeed.ts'
import { feedsToPull, permitCity, PERMIT_CITY_NAMES, type FeedReader } from '../_shared/permitCities.ts'
import { todayYmdInAppTz } from '../_shared/appTimeZone.ts'
import { builderKeyOf } from '../_shared/permitLookup.ts'

/**
 * Research (punch list #292, v2.6782): pull a city's permits into `permits`. Each city's feeds
 * are readers in `_shared/permitCities.ts` (San Antonio's two CKAN datastores, Austin's Socrata
 * dataset, a map layer each for New Braunfels, San Marcos and Seguin): the kept building kinds and the plumbing permits since ten days before the newest row
 * held (75 days back on a feed's first run), paged oldest first, upserted on (city, source,
 * number, type) so a re-read changes nothing. Each feed's run lands in `permit_pulls`, error and
 * all. Runs nightly from pg_cron (migration 20261109070000, 11:30 UTC) over every city, and on
 * demand from Pull now for the city on screen, as a signed-in researcher.
 *
 * Auth: `X-Cron-Secret` = CRON_SECRET, or a bearer JWT whose user passes
 * `user_can_research_permits()`. Body: `{ city?: string, since?: 'YYYY-MM-DD', until?: 'YYYY-MM-DD', dry_run?: boolean }`.
 * With no city every city is pulled in the list's order; a feed the time budget cuts short says so
 * and the next run carries on.
 *
 * With `city`, `since` and `until` together the run is a read back as history (punch list #307):
 * only the days from `since` up to, not including, `until`; every row lands flagged `backfilled`,
 * so it counts for a builder and a bid's site and never sits on the skim; and a row already held
 * is left exactly as it is. It needs migration *_permit_history and refuses to run without it,
 * and it runs only for a city whose feeds can be read up to a day (`pageUrlBefore`).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PAGE = 2000
const MAX_PAGES_PER_FEED = 12
const UPSERT_BATCH = 500
const BUDGET_MS = 110_000
// The builder-key pass over rows already held: this many rows a round, this many rounds a run.
const KEY_BATCH = 500
const KEY_ROUNDS = 12

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type FeedOutcome = { source: string; since: string; seen: number; kept: number; pages: number; error: string | null }

async function readPage(feed: FeedReader, since: string, size: number, offset: number, until: string | null): Promise<Record<string, unknown>[]> {
  const url = until && feed.pageUrlBefore ? feed.pageUrlBefore(since, until, size, offset) : feed.pageUrl(since, size, offset)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const body = await res.json().catch(() => null)
  // A door that refuses a read says why in its body; its words beat the bare status.
  if (!res.ok && body == null) throw new Error(`the feed answered ${res.status}`)
  return feed.recordsOf(body)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET')

  let body: { city?: unknown; since?: unknown; until?: unknown; dry_run?: unknown } = {}
  try {
    body = (await req.json()) ?? {}
  } catch {
    body = {}
  }

  const given = req.headers.get('x-cron-secret')
  let allowed = Boolean(cronSecret && given === cronSecret)
  if (!allowed) {
    const auth = req.headers.get('authorization') ?? ''
    if (auth.toLowerCase().startsWith('bearer ') && anonKey) {
      const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } })
      const { data: ok } = await asUser.rpc('user_can_research_permits')
      allowed = ok === true
    }
  }
  if (!allowed) return jsonResponse({ error: 'Unauthorized' }, 401)

  const askedCity = typeof body.city === 'string' && body.city.trim() ? body.city.trim() : null
  if (askedCity && !permitCity(askedCity)) return jsonResponse({ error: `No feed is set up for ${askedCity}. The cities are ${PERMIT_CITY_NAMES.join(', ')}.` }, 400)

  const admin = createClient(supabaseUrl, serviceKey)
  const dryRun = body.dry_run === true
  const sinceOverride = typeof body.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.since) ? body.since : null
  // A read back as history: one city, a window with both ends, each row flagged, nothing already held touched.
  const until = typeof body.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.until) ? body.until : null
  const history = until != null
  if (history) {
    if (!sinceOverride || sinceOverride >= until) return jsonResponse({ error: 'A read back needs since before until.' }, 400)
    if (!askedCity) return jsonResponse({ error: 'A read back needs its city.' }, 400)
    if (feedsToPull(askedCity).some((f) => !f.pageUrlBefore)) return jsonResponse({ error: `No read back is set up for ${askedCity} yet.` }, 400)
  }
  const today = todayYmdInAppTz()
  const started = Date.now()
  const outcomes: FeedOutcome[] = []

  for (const feed of feedsToPull(askedCity)) {
    const outcome: FeedOutcome = { source: feed.source, since: '', seen: 0, kept: 0, pages: 0, error: null }
    outcomes.push(outcome)
    try {
      let since = sinceOverride
      if (!since) {
        const col = feed.stage === 'issued' ? 'issued_on' : 'submitted_on'
        const { data: newest } = await admin
          .from('permits')
          .select(col)
          .eq('source', feed.source)
          .not(col, 'is', null)
          .order(col, { ascending: false })
          .limit(1)
          .maybeSingle()
        const newestDay = (newest as Record<string, string | null> | null)?.[col] ?? null
        since = pullSinceDay(newestDay, today)
      }
      outcome.since = since
      let offset = 0
      // A door that hands over fewer rows a page than the pull asks for sets the page.
      const size = Math.min(PAGE, feed.pageSize ?? PAGE)
      for (let page = 0; page < MAX_PAGES_PER_FEED; page++) {
        if (Date.now() - started > BUDGET_MS) {
          outcome.error = 'stopped on the time budget; the next run carries on'
          break
        }
        const records = await readPage(feed, since, size, offset, until)
        outcome.pages++
        outcome.seen += records.length
        const rows: PermitRow[] = []
        for (const r of records) {
          const row = feed.rowOf(r)
          if (row) rows.push(row)
        }
        // One row per key inside the page too: the door can hand the same permit and type twice.
        const byKey = new Map<string, PermitRow>()
        for (const row of rows) {
          const key = `${row.permit_number}\u0000${row.permit_type}`
          const held = byKey.get(key)
          // A door that writes a permit once per person on it says which row to keep; otherwise the later one.
          byKey.set(key, held && feed.prefer ? feed.prefer(held, row) : row)
        }
        const unique = [...byKey.values()]
        if (!dryRun) {
          for (let i = 0; i < unique.length; i += UPSERT_BATCH) {
            const slice = unique.slice(i, i + UPSERT_BATCH).map((row) => ({ ...row, pulled_at: new Date().toISOString(), ...(history ? { backfilled: true } : {}) }))
            // History never rewrites a row already held: it would flip a permit on the skim to backfilled.
            let { error } = await admin.from('permits').upsert(slice, { onConflict: 'city,source,permit_number,permit_type', ignoreDuplicates: history })
            // A read back without its column would land old permits on the skim: it stops instead.
            if (error && history && /backfilled/.test(error.message)) throw new Error('the database change for history is not in yet; nothing was read back')
            // Deployed ahead of migration *_permit_skim, the column is not there yet: the rows still land, without their key.
            if (error && /builder_key/.test(error.message)) {
              const bare = slice.map(({ builder_key: _dropped, ...rest }) => rest)
              ;({ error } = await admin.from('permits').upsert(bare, { onConflict: 'city,source,permit_number,permit_type', ignoreDuplicates: false }))
            }
            if (error) throw new Error(`the upsert failed: ${error.message}`)
          }
        }
        outcome.kept += unique.length
        if (records.length < size) break
        offset += size
      }
    } catch (e) {
      outcome.error = e instanceof Error ? e.message : String(e)
    }
    if (!dryRun) {
      await admin.from('permit_pulls').insert({
        source: feed.source,
        city: feed.city,
        since: outcome.since || null,
        rows_seen: outcome.seen,
        rows_kept: outcome.kept,
        error: outcome.error,
      })
    }
    console.log(JSON.stringify({ fn: 'permit-pull', ...outcome }))
  }

  // The builder's key on the rows the table already held (punch list #302, and since #307 the plumbing
  // permits too): a contact and no key yet, read by id so a row whose name keys to nothing is passed once, not forever.
  const keys = { looked: 0, set: 0, error: null as string | null }
  if (!dryRun) {
    try {
      let after = '00000000-0000-0000-0000-000000000000'
      for (let round = 0; round < KEY_ROUNDS && Date.now() - started < BUDGET_MS; round++) {
        const { data, error } = await admin.from('permits').select('id, contact').is('builder_key', null).not('contact', 'is', null).gt('id', after).order('id').limit(KEY_BATCH)
        if (error) throw new Error(error.message)
        const batch = (data ?? []) as Array<{ id: string; contact: string | null }>
        if (batch.length === 0) break
        after = batch[batch.length - 1]!.id
        keys.looked += batch.length
        const pairs = batch.map((r) => ({ id: r.id, key: builderKeyOf(r.contact) })).filter((p) => p.key)
        if (pairs.length > 0) {
          const { data: n, error: setError } = await admin.rpc('permit_set_builder_keys', { p_pairs: pairs })
          if (setError) throw new Error(setError.message)
          keys.set += typeof n === 'number' ? n : 0
        }
        if (batch.length < KEY_BATCH) break
      }
    } catch (e) {
      // Before the migration is pushed there is no column to fill; the pull itself stands.
      keys.error = e instanceof Error ? e.message : String(e)
    }
    console.log(JSON.stringify({ fn: 'permit-pull', builder_keys: keys }))
  }

  const failed = outcomes.filter((o) => o.error)
  return jsonResponse({ ok: failed.length === 0, dryRun, history, city: askedCity, feeds: outcomes, builderKeys: keys, ms: Date.now() - started })
})
