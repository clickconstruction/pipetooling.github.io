import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, googleAccessToken } from '../_shared/driveUpload.ts'
import { embedPass, filesChangedSince, indexContext, indexFiles, ocrPass, retakePass, type IndexContext } from '../_shared/fileIndex.ts'
import { SWEEP_EMBED_ROWS } from '../_shared/embeddingsKernel.ts'
import { indexPassWords, sameInstant, SWEEP_MAX_FILES, SWEEP_OCR_ROWS, SWEEP_RECHECK_ROWS, SWEEP_RETAKE_ROWS, SWEEP_STAMP_KEY, sweepSince, sweepStamp, type HeldFile } from '../_shared/fileIndexKernel.ts'

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
 *     3. Stamps the setting: now when it handled everything and Drive had no more, else the modified time of the last
 *        listed file it handled (taken, or passed over as current), so the next run starts where this one stopped and a
 *        page of files the backfill already indexed never holds the stamp. A quiet drive costs one Drive list, the
 *        rechecks and no writes.
 *     4. OCR (PR 3, v2.6336): once the secret GOOGLE_DOCAI_PROCESSOR names a Document AI OCR processor, `ocr` (5)
 *        scans due for a read (never tried, or tried over a day ago; of a kind Document AI reads by the row's mime or
 *        its name, v2.6491) go through it, oldest try first, so the scans the backfill held catch up by themselves. A
 *        scan whose file is as its row says costs one download, its bytes straight to the processor (v2.6491); one
 *        whose file changed is read whole. Step 1 makes at most five OCR calls of its own (OCR_PER_PASS_MAX, as every
 *        pass does), so steps 1 and 4 spend at most ten a run; the reconcile step (v2.6417) is a pass of its own and
 *        may spend five more, and each rechecked or retaken file that changed, or is a scan, one.
 *     5. Retake (v2.6491): `retake` (5) rows held `slow` or `reading` whose last check is an hour old are taken again
 *        through the one pass with retry, oldest first, so a read that ran out of time on a spent clock is not held
 *        for good.
 *     6. Meaning (PR 4, v2.6338): once the secret GEMINI_API_KEY is set, `embed` (10) rows with text whose chunks are
 *        missing or older than the text (the RPC file_index_embed_due, v2.6491) get their vectors, so every file
 *        indexed before the key catches up, and one indexed again while its chunks were made is embedded again.
 *
 *     7. Records (punch list #285, v2.6714): `records` (10) files a person's HR file or a legal matter holds that the
 *        index has no row for — an evidence file staged in hr-files or linked from Drive, a document in the matter's
 *        bucket — through the records pass (`_shared/fileIndexRecords.ts`): the queue is `file_index_records_due`,
 *        newest first, held rows an hour on; the rows whose record is gone or voided are dropped first. Steps 2, 4, 5
 *        and the reconcile step read Drive rows alone, since a record's row is keyed on its own id.
 *
 *   → { success, since, listed, more, indexed, held: [{ id, name, why }], remaining, rechecked, dropped, ocr: { set_up,
 *     tried, read, refused, gone }, retake: { tried, read, held }, embed: { set_up, tried, embedded, chunks, refused },
 *     records: { dropped, due, tried, indexed, held, remaining }, stamp, line }
 *
 * Refusals: 401 without the secret, 405 for anything but POST, 503 without the Drive secret, 409 `{ noRoot }` when
 * the jobs root is not set anywhere (nothing to list). Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
 * GOOGLE_SERVICE_ACCOUNT_JSON (the same service account as drive-link). verify_jwt is off; the secret is the door.
 *
 * Last, after the stamp, the rechecks and the OCR scans, the reconcile step (v2.6417, `_shared/fileIndexReconcile.ts`): a file moved
 * into the drive keeps its old modified time, so step 1 never lists it. When step 1 left no files behind, the whole
 * drive is listed from the dawn (a dozen Drive lists at today's size), every row's id read, and the files with no row
 * indexed newest first, up to `limit`, whatever their date; answered as `reconcile` (counts only; null when skipped).
 * In its own catch, so a heavy PDF that stops the worker or a Drive error costs neither the stamp nor the rechecks,
 * and its result never reaches the stamp, since those old dates would move it backwards. One log line a run, counts
 * only, read through the management API's function logs (the cron gives up at five seconds and keeps no answer).
 */
// The step's imports sit under the header so PR 3's lines above (#6894, the OCR step) merge untouched.
import { reconcileStepWords, type ReconcileStep } from '../_shared/fileIndexCheckKernel.ts'
import { reconcileSweep } from '../_shared/fileIndexReconcile.ts'
// The records step (#285, v2.6714): the files a person's HR file and a matter hold, through their own queue.
import { recordsPass } from '../_shared/fileIndexRecords.ts'
import { EMPTY_RECORDS_PASS, SWEEP_RECORD_ROWS, recordsPassWords } from '../_shared/fileIndexRecordsKernel.ts'

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
  // Drive rows alone (#285): a record's row is keyed on its own id, which Drive would answer 404 for and the step would drop.
  const { data } = await ctx.admin.from('file_index').select('drive_file_id, modified_at').eq('source', 'drive').order('checked_at', { ascending: true }).limit(n)
  const rows = (data ?? []) as { drive_file_id: string; modified_at: string | null }[]
  let dropped = 0
  let changed = 0
  const held: HeldFile[] = []
  const now = new Date().toISOString()
  for (const r of rows) {
    const res = await fetch(`${DRIVE}/files/${encodeURIComponent(r.drive_file_id)}?fields=id,name,mimeType,size,modifiedTime,parents,trashed&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${ctx.google}` } })
    if (res.status === 404 || res.status === 403) {
      // A 403 is also how Drive says a rate limit: that row stays, asked again another run; gone or forbidden goes.
      const reason = await res.text().catch(() => '')
      if (res.status === 403 && /RateLimitExceeded|rateLimitExceeded|quotaExceeded/.test(reason)) continue
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
    if (!sameInstant(meta.modifiedTime, r.modified_at)) {
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
    const body = (await req.json().catch(() => ({}))) as { sweep?: { limit?: unknown; recheck?: unknown; ocr?: unknown; retake?: unknown; embed?: unknown; records?: unknown } }
    const limit = Math.min(200, Math.max(1, Number(body.sweep?.limit) || SWEEP_MAX_FILES))
    const recheck = Math.min(100, Math.max(0, Number.isFinite(Number(body.sweep?.recheck)) && body.sweep?.recheck != null ? Number(body.sweep.recheck) : SWEEP_RECHECK_ROWS))
    const ocrN = Math.min(50, Math.max(0, Number.isFinite(Number(body.sweep?.ocr)) && body.sweep?.ocr != null ? Number(body.sweep.ocr) : SWEEP_OCR_ROWS))
    const retakeN = Math.min(50, Math.max(0, Number.isFinite(Number(body.sweep?.retake)) && body.sweep?.retake != null ? Number(body.sweep.retake) : SWEEP_RETAKE_ROWS))
    const embedN = Math.min(100, Math.max(0, Number.isFinite(Number(body.sweep?.embed)) && body.sweep?.embed != null ? Number(body.sweep.embed) : SWEEP_EMBED_ROWS))
    const recordsN = Math.min(50, Math.max(0, Number.isFinite(Number(body.sweep?.records)) && body.sweep?.records != null ? Number(body.sweep.records) : SWEEP_RECORD_ROWS))
    const started = Date.now()
    const google = await googleAccessToken(saJson)
    const ctx = await indexContext(admin, google, saJson)
    if ('noRoot' in ctx) return json({ success: false, noRoot: true, line: 'The jobs root is not set yet, so there is nothing to index.' }, 409)

    const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', SWEEP_STAMP_KEY).maybeSingle()
    const stamp = (setting as { value_text?: string | null } | null)?.value_text ?? null
    const { since, inclusive } = sweepSince(stamp)
    const listed = await filesChangedSince(ctx, since, limit, inclusive)
    const pass = await indexFiles(ctx, listed.files, { max: limit, startedMs: started })
    const left = pass.remaining + (listed.more ? 1 : 0)
    const next = sweepStamp(new Date(), pass.cursorModified, left)
    if (next) await admin.from('app_settings').upsert({ key: SWEEP_STAMP_KEY, value_text: next }, { onConflict: 'key' })
    const re = recheck > 0 ? await recheckRows(ctx, recheck) : { rechecked: 0, dropped: 0, changed: 0, held: [] as HeldFile[] }
    const ocr = ctx.ocr && ocrN > 0 ? await ocrPass(ctx, ocrN, { startedMs: started }) : { tried: 0, read: 0, refused: [] as HeldFile[], gone: 0 }
    const retake = retakeN > 0 ? await retakePass(ctx, retakeN, { startedMs: started }) : { tried: 0, read: 0, held: [] as HeldFile[] }
    const embed = ctx.embed && embedN > 0 ? await embedPass(ctx, embedN, { startedMs: started }) : { tried: 0, embedded: 0, chunks: 0, refused: [] as { id: string; name: string; error: string }[] }
    const answer = { indexed: pass.indexed + re.changed, held: [...pass.held, ...re.held], remaining: pass.remaining }
    // The records step (#285): its own queue and its own catch, so a bucket read that fails costs the Drive steps nothing.
    let records = EMPTY_RECORDS_PASS
    if (recordsN > 0) {
      try {
        records = await recordsPass(admin, { n: recordsN, google: async () => google, spend: ctx.spend, startedMs: started })
        const words = recordsPassWords(records)
        if (words) console.log(words)
      } catch (e) {
        console.warn('file-index-sweep records step failed', e)
      }
    }
    let reconcile: ReconcileStep | null = null
    if (left <= 0) {
      try {
        reconcile = await reconcileSweep(ctx, { max: limit })
        console.log(reconcileStepWords(reconcile))
      } catch (e) {
        console.warn('file-index-sweep reconcile failed', e)
      }
    }
    return json({
      success: true,
      since,
      listed: listed.files.length,
      more: listed.more,
      ...answer,
      rechecked: re.rechecked,
      dropped: re.dropped,
      ocr: { set_up: Boolean(ctx.ocr), ...ocr },
      retake,
      embed: { set_up: Boolean(ctx.embed), ...embed },
      records,
      stamp: next ?? stamp,
      reconcile,
      ms: Date.now() - started,
      line: `${indexPassWords(answer)}${re.dropped ? ` Dropped ${re.dropped} gone.` : ''}${ocr.tried ? ` OCR read ${ocr.read} of ${ocr.tried} scans.` : ''}${retake.tried ? ` Retook ${retake.read} of ${retake.tried} held files.` : ''}${embed.tried ? ` Embedded ${embed.embedded} of ${embed.tried} files.` : ''}${recordsPassWords(records) ? ` ${recordsPassWords(records)}` : ''}`,
    })
  } catch (e) {
    console.error('file-index-sweep failed', e)
    return json({ error: e instanceof Error ? e.message : 'failed' }, 500)
  }
})
