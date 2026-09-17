import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { driveFolderIdFromUrl, findOrCreateFolder, googleAccessToken, uploadFromUrl } from '../_shared/driveUpload.ts'
import { driveFileLink, isFileable, jobFolderName, packageFileName, SUBMITTALS_FOLDER } from '../_shared/submittalDriveNames.ts'
import { APP_CALENDAR_TZ } from '../_shared/appTimeZone.ts'

// file-submittal-package — Submittals stage 6c (v2.3551). Files a SHARED revision's package
// PDF in the bid's job folder on Drive, under Submittals/, as "Rev N · <date>.pdf": the
// folder drive-intake made for the plans (bids.drive_link), or the same-named folder under
// DRIVE_JOBS_FOLDER_ID. Called by Share (fire-and-forget) and by the tab's "File in Drive".
// Auth: a staff JWT (pricing sharer on the bid, via can_access_bid_for_pricing). Idempotent:
// a same-name file is reused; the revision remembers drive_file_id / drive_file_url.
// Drafts are never filed. Google auth is the service account (docs/DRIVE_INTAKE_SETUP.md).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const jobsFolderId = Deno.env.get('DRIVE_JOBS_FOLDER_ID')
    if (!serviceRoleKey) return json({ error: 'Server not configured' }, 500)
    if (!saJson || !jobsFolderId) return json({ ok: false, error: 'Drive filing is not configured (GOOGLE_SERVICE_ACCOUNT_JSON / DRIVE_JOBS_FOLDER_ID — docs/DRIVE_INTAKE_SETUP.md).', code: 'not_configured' }, 503)

    const auth = req.headers.get('Authorization') ?? ''
    const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await asUser.auth.getUser()
    if (!u?.user) return json({ error: 'Sign in first.' }, 401)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const body = (await req.json().catch(() => ({}))) as { submittal_id?: string }
    const submittalId = String(body.submittal_id ?? '').trim()
    if (!submittalId) return json({ error: 'submittal_id required' }, 400)
    const { data: s } = await admin.from('bid_submittals').select('id, bid_id, rev_number, status, package_path, shared_at, drive_file_id, drive_file_url').eq('id', submittalId).maybeSingle()
    const sub = s as { id: string; bid_id: string; rev_number: number; status: string; package_path: string | null; shared_at: string | null; drive_file_id: string | null; drive_file_url: string | null } | null
    if (!sub) return json({ error: 'No such revision.' }, 404)
    // The caller must be a pricing sharer on the bid (the same gate the tab's writes pass).
    const { data: allowed } = await asUser.rpc('can_access_bid_for_pricing', { p_bid_id: sub.bid_id })
    if (allowed !== true) {
      const { data: row } = await admin.from('users').select('role').eq('id', u.user.id).maybeSingle()
      if (!row || !['dev', 'master_technician', 'assistant', 'controller', 'estimator'].includes(String((row as { role?: string }).role))) return json({ error: 'Not your bid.' }, 403)
    }
    if (!isFileable(sub.status, sub.package_path)) return json({ ok: false, error: 'Only a shared revision with a built package is filed.', code: 'not_fileable' }, 409)
    if (sub.drive_file_id && sub.drive_file_url) return json({ ok: true, reused: true, file_id: sub.drive_file_id, file_url: sub.drive_file_url })

    const { data: b } = await admin.from('bids').select('id, bid_number, project_name, drive_link').eq('id', sub.bid_id).maybeSingle()
    const bid = b as { id: string; bid_number: string | null; project_name: string | null; drive_link: string | null } | null
    if (!bid) return json({ error: 'No such bid.' }, 404)

    const { data: signed, error: sErr } = await admin.storage.from('bid-submittals').createSignedUrl(sub.package_path as string, 600)
    if (sErr || !signed?.signedUrl) return json({ ok: false, error: `The package could not be read: ${sErr?.message ?? 'no link'}` }, 500)

    const impersonate = Deno.env.get('DRIVE_IMPERSONATE_USER')?.trim()
    const token = await googleAccessToken(saJson)
    const known = driveFolderIdFromUrl(bid.drive_link)
    const jobFolder = known ? { id: known, created: false } : await findOrCreateFolder(token, jobsFolderId, jobFolderName(bid))
    const folder = await findOrCreateFolder(token, jobFolder.id, SUBMITTALS_FOLDER)
    const upToken = impersonate ? await googleAccessToken(saJson, impersonate) : token
    const name = packageFileName(sub.rev_number, sub.shared_at, APP_CALENDAR_TZ)
    let up: { id: string; name: string; reused: boolean }
    try {
      up = await uploadFromUrl(upToken, folder.id, signed.signedUrl, name)
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e)
      const note = /storage quota/i.test(msg) && !impersonate ? `${msg} — set DRIVE_IMPERSONATE_USER (docs/DRIVE_INTAKE_SETUP.md), or drop the PDF into the folder by hand.` : msg
      return json({ ok: false, error: note, folder_link: `https://drive.google.com/drive/folders/${folder.id}` }, 502)
    }
    const fileUrl = driveFileLink(up.id)
    await admin.from('bid_submittals').update({ drive_file_id: up.id, drive_file_url: fileUrl, drive_filed_at: new Date().toISOString() }).eq('id', sub.id)
    if (!bid.drive_link && !known) await admin.from('bids').update({ drive_link: `https://drive.google.com/drive/folders/${jobFolder.id}` }).eq('id', bid.id)
    return json({ ok: true, reused: up.reused, file_id: up.id, file_url: fileUrl, file_name: up.name, folder_link: `https://drive.google.com/drive/folders/${folder.id}` })
  } catch (e) {
    console.error('file-submittal-package', e)
    return json({ error: e instanceof Error ? e.message : 'Unexpected error' }, 500)
  }
})
