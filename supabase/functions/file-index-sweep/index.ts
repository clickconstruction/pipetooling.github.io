import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, googleAccessToken } from '../_shared/driveUpload.ts'
import { filesChangedSince, indexContext, indexFiles, type IndexContext } from '../_shared/fileIndex.ts'
import { SWEEP_MAX_FILES, SWEEP_RECHECK_ROWS, SWEEP_STAMP_KEY, indexPassWords, sweepSince, sweepStamp, type HeldFile } from '../_shared/fileIndexKernel.ts'

/**
 * file-index-sweep — Search every file deeply (punch list #240, PR 1, v2.6319): the cron that keeps our own text index
 * (`file_index`) current as files land in the jobs Shared Drive. Every ten minutes (migration 20261102040500, three
 * minutes past the folder sweep's slot) with the cron secret:
 *
 *   POST { sweep: { limit?, recheck? } }   (X-Cron-Secret)
 *     1. Lists the files modified in the Shared Drive since the stamp (app_settings `file_index_sweep_last_at`, less a
 *        two-minute overlap; from the dawn of the drive when there is none), oldest first, up to `limit` (40), and
 *        indexes them through the one pass every indexer runs (`_shared/fileIndex.ts`: walked up to the job or bid,
 *        the text read, the row upserted, one file at a time inside the request's budget). A file a press already
 *        indexed at the same modified time is skipped as current.
 *     2. Asks Drive about `recheck` (20) rows with the oldest check, so a file trashed or moved out of the drive loses
 *        its row within days, and a file changed under the sweep's nose is indexed again.
 *     3. Stamps the setting: now when it took everything, else the last taken file's modified time, so the next run
 *        starts where this one stopped. A quiet drive costs one Drive list, the rechecks and no writes.
 *
 *   → { success, since, listed, more, indexed, held: [{ id, name, why }], remaining, rechecked, dropped, stamp, line }
 *
 * Refusals: 401 without the secret, 405 for anything but POST, 503 without the Drive secret, 409 `{ noRoot }` when
 * the jobs root is not set anywhere (nothing to list). Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
 * GOOGLE_SERVICE_ACCOUNT_JSON (the same service account as drive-link). verify_jwt is off; the secret is the door.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** The rows with the oldest check asked about in Drive: gone or trashed → the row goes; changed → indexed again. */
async function recheckRows(ctx: IndexContext, n: number): Promise<{ rechecked: number; dropped: number; changed: number; held: HeldFile[] }> {
  const { data } = await ctx.admin.from('file_index').select('drive_file_id, modified_at').order('checked_at', { ascending: true }).limit(n)
  const rows = (data ?? []) as { drive_file_id: string; modified_at: string | null }[]
  let dropped = 0
  let changed = 0
  const held: HeldFile[] = []
  const now = new Date().toISOString()
  for (const r of rows) {
    const res = await fetch(`${DRIVE}/files/${encodeURIComponent(r.drive_file_id)}?fields=id,name,mimeType,size,modifiedTime,parents,trashed&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${ctx.google}` } })
    if (res.status === 404 || res.status === 403) {
      await ctx.admin.from('file_index').delete().eq('drive_file_id', r.drive_file_id)
      dropped += 1
      continue
    }
    if (!res.ok) continue
    const meta = (await res.json()) as { id: string; name: string; mimeType: string; size?: string; modifiedTime?: string; parents?: string[]; trashed?: boolean }
    if (meta.trashed) {
      await ctx.admin.from('file_index').delete().eq('drive_file_id', r.drive_file_id)
      dropped += 1
      continue
    }
    if ((meta.modifiedTime ?? null) !== (r.modified_at ?? null)) {
      const pass = await indexFiles(ctx, [meta], { max: 1 })
      changed += pass.indexed
      held.push(...pass.held)
      continue
    }
    await ctx.admin.from('file_index').update({ checked_at: now }).eq('drive_file_id', r.drive_file_id)
  }
  return { rechecked: rows.length, dropped, changed, held }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405)
  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    if (!cronSecret || !headerSecret || headerSecret !== cronSecret) return json({ error: 'The cron secret is the door.' }, 401)
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!saJson) return json({ error: 'Drive is not set up here yet.' }, 503)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const body = (await req.json().catch(() => ({}))) as { sweep?: { limit?: unknown; recheck?: unknown } }
    const limit = Math.min(200, Math.max(1, Number(body.sweep?.limit) || SWEEP_MAX_FILES))
    const recheck = Math.min(100, Math.max(0, Number.isFinite(Number(body.sweep?.recheck)) && body.sweep?.recheck != null ? Number(body.sweep.recheck) : SWEEP_RECHECK_ROWS))
    const started = Date.now()
    const google = await googleAccessToken(saJson)
    const ctx = await indexContext(admin, google)
    if ('noRoot' in ctx) return json({ success: false, noRoot: true, line: 'The jobs root is not set yet, so there is nothing to index.' }, 409)

    const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', SWEEP_STAMP_KEY).maybeSingle()
    const stamp = (setting as { value_text?: string | null } | null)?.value_text ?? null
    const since = sweepSince(stamp)
    const listed = await filesChangedSince(ctx, since, limit)
    const pass = await indexFiles(ctx, listed.files, { max: limit, startedMs: started })
    const left = pass.remaining + (listed.more ? 1 : 0)
    const next = sweepStamp(new Date(), pass.lastTakenModified, left)
    if (next) await admin.from('app_settings').upsert({ key: SWEEP_STAMP_KEY, value_text: next }, { onConflict: 'key' })
    const re = recheck > 0 ? await recheckRows(ctx, recheck) : { rechecked: 0, dropped: 0, changed: 0, held: [] as HeldFile[] }
    const answer = { indexed: pass.indexed + re.changed, held: [...pass.held, ...re.held], remaining: pass.remaining }
    return json({
      success: true,
      since,
      listed: listed.files.length,
      more: listed.more,
      ...answer,
      rechecked: re.rechecked,
      dropped: re.dropped,
      stamp: next ?? stamp,
      ms: Date.now() - started,
      line: `${indexPassWords(answer)}${re.dropped ? ` Dropped ${re.dropped} gone.` : ''}`,
    })
  } catch (e) {
    console.error('file-index-sweep failed', e)
    return json({ error: e instanceof Error ? e.message : 'failed' }, 500)
  }
})
