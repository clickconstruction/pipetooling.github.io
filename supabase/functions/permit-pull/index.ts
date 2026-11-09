import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { feedPageSql, permitRowFromSanAntonio, pullSinceDay, SAN_ANTONIO_CKAN, SAN_ANTONIO_FEEDS, type PermitFeed, type PermitRow } from '../_shared/permitFeed.ts'

/**
 * Research (punch list #292, v2.6782): pull a city's permits into `permits`. San Antonio first:
 * two CKAN datastores (issued permits, submitted applications) read through the SQL door, the
 * kept building types and every plumbing type since ten days before the newest row held (75
 * days back on the first run), paged oldest first, upserted on (city, source, number, type) so
 * a re-read changes nothing. Each feed's run lands in `permit_pulls`, error and all. Runs
 * nightly from pg_cron (migration 20261109070000, 11:30 UTC) and on demand from the ledger's
 * Pull now, as a signed-in researcher.
 *
 * Auth: `X-Cron-Secret` = CRON_SECRET, or a bearer JWT whose user passes
 * `user_can_research_permits()`. Body: `{ since?: 'YYYY-MM-DD', dry_run?: boolean }`.
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type FeedOutcome = { source: string; since: string; seen: number; kept: number; pages: number; error: string | null }

async function readPage(feed: PermitFeed, since: string, offset: number): Promise<Record<string, unknown>[]> {
  const url = `${SAN_ANTONIO_CKAN}?sql=${encodeURIComponent(feedPageSql(feed, since, PAGE, offset))}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`the feed answered ${res.status}`)
  const body = (await res.json()) as { success?: boolean; result?: { records?: Record<string, unknown>[] }; error?: unknown }
  if (!body.success) throw new Error(`the feed refused the read: ${JSON.stringify(body.error ?? {}).slice(0, 300)}`)
  return body.result?.records ?? []
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET')

  let body: { since?: unknown; dry_run?: unknown } = {}
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

  const admin = createClient(supabaseUrl, serviceKey)
  const dryRun = body.dry_run === true
  const sinceOverride = typeof body.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.since) ? body.since : null
  const today = new Date().toISOString().slice(0, 10)
  const started = Date.now()
  const outcomes: FeedOutcome[] = []

  for (const feed of SAN_ANTONIO_FEEDS) {
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
      for (let page = 0; page < MAX_PAGES_PER_FEED; page++) {
        if (Date.now() - started > BUDGET_MS) {
          outcome.error = 'stopped on the time budget; the next run carries on'
          break
        }
        const records = await readPage(feed, since, offset)
        outcome.pages++
        outcome.seen += records.length
        const rows: PermitRow[] = []
        for (const r of records) {
          const row = permitRowFromSanAntonio(r, feed)
          if (row) rows.push(row)
        }
        // One row per key inside the page too: the door can hand the same permit and type twice.
        const byKey = new Map<string, PermitRow>()
        for (const row of rows) byKey.set(`${row.permit_number}\u0000${row.permit_type}`, row)
        const unique = [...byKey.values()]
        if (!dryRun) {
          for (let i = 0; i < unique.length; i += UPSERT_BATCH) {
            const slice = unique.slice(i, i + UPSERT_BATCH).map((row) => ({ ...row, pulled_at: new Date().toISOString() }))
            const { error } = await admin.from('permits').upsert(slice, { onConflict: 'city,source,permit_number,permit_type', ignoreDuplicates: false })
            if (error) throw new Error(`the upsert failed: ${error.message}`)
          }
        }
        outcome.kept += unique.length
        if (records.length < PAGE) break
        offset += PAGE
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

  const failed = outcomes.filter((o) => o.error)
  return jsonResponse({ ok: failed.length === 0, dryRun, feeds: outcomes, ms: Date.now() - started })
})
