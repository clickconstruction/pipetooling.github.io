import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { findOrCreateFolder, googleAccessToken, uploadBytes } from '../_shared/driveUpload.ts'
import { freeName } from '../_shared/driveJobFolder.ts'
import { readDriveSettings } from '../_shared/driveSettings.ts'
import { NO_PEOPLE_FOLDER_WORDS, driveSafeName } from '../_shared/whereFilesGo.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

/**
 * The person file's evidence, into Drive (the People → Paperwork spike, 2026-11-02). A piece of evidence is a record on
 * `person_file_evidence` with its files staged in the private `hr-files` bucket as `person_file_attachments` rows. This
 * function moves the bytes into Drive under the People folder the office set on Documents → Where files go:
 *
 *   <People folder> › <Person's name> › <YYYY-MM-DD · title> › the files, each under its own name
 *
 * and stamps `drive_file_id` / `drive_url` / `filed_at` on each file and `drive_folder_id` / `drive_folder_url` /
 * `filed_at` on the record once every file is in. The bucket copy stays: it is the app's own copy, opened through the HR
 * tables' RLS; Drive is where the office finds it. A refusal (no People folder set, Drive refusing, a file that did not
 * read) is written on the record as `fail_why` for the panel to show, and the same record can be asked for again.
 *
 *   POST { evidence_id } with a dev's session  → { filed: n, remaining: n, fail_why: string | null, folder_url }
 *   POST {} with X-Cron-Secret                  → every record with a file not yet filed, oldest first, twenty a run
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, CRON_SECRET, GOOGLE_SERVICE_ACCOUNT_JSON,
 * DRIVE_IMPERSONATE_USER (optional). The folder setting: `drive_people_folder_id`.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const HR_FILES_BUCKET = 'hr-files'
const SWEEP_BATCH = 20

type EvidenceRow = { id: string; person_id: string; dated_on: string; title: string; drive_folder_id: string | null; drive_folder_url: string | null; filed_at: string | null; fail_why: string | null; counsel_only?: boolean | null }
type FileRow = { id: string; evidence_id: string; filename: string; mime_type: string | null; storage_path: string | null; drive_file_id: string | null; drive_url: string | null }

const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`
const fileUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`

/** `2026-10-29 · Left a mess at the site`, as the app's kernel names it (src/lib/people/personEvidence.ts). */
function recordFolderName(r: Pick<EvidenceRow, 'dated_on' | 'title'>): string {
  return `${r.dated_on} · ${driveSafeName(r.title)}`.slice(0, 120).trim()
}

async function fileRecord(admin: SupabaseClient, google: string, peopleRoot: string, record: EvidenceRow, personName: string): Promise<{ filed: number; remaining: number; failWhy: string | null; folderUrl: string | null }> {
  // v2.6554: a counsel-only record is kept here only — never filed, never touched; the bucket copy is the only copy in the app.
  if (record.counsel_only) return { filed: 0, remaining: 0, failWhy: null, folderUrl: null }
  const { data: files } = await admin.from('person_file_attachments').select('id, evidence_id, filename, mime_type, storage_path, drive_file_id, drive_url').eq('evidence_id', record.id)
  const rows = (files ?? []) as FileRow[]
  let folderId = record.drive_folder_id
  let filed = 0
  let failWhy: string | null = null
  // A linked file (v2.6541) is already in Drive and was never staged: it counts as filed and the function never touches it.
  const linked = rows.filter((f) => !f.storage_path && f.drive_url)
  const toFile = rows.filter((f) => !(!f.storage_path && f.drive_url))
  if (toFile.length === 0) {
    const remaining = rows.length - linked.length
    await admin.from('person_file_evidence').update({ fail_why: null, ...(rows.length > 0 ? { filed_at: new Date().toISOString() } : {}) }).eq('id', record.id)
    return { filed: linked.length, remaining, failWhy: null, folderUrl: folderId ? folderUrl(folderId) : null }
  }
  try {
    if (!folderId) {
      const person = await findOrCreateFolder(google, peopleRoot, driveSafeName(personName) || `Person ${record.person_id.slice(0, 8)}`)
      const own = await findOrCreateFolder(google, person.id, recordFolderName(record))
      folderId = own.id
      await admin.from('person_file_evidence').update({ drive_folder_id: folderId, drive_folder_url: folderUrl(folderId), fail_why: null }).eq('id', record.id)
    }
    filed += linked.length
    for (const f of toFile) {
      if (f.drive_file_id) {
        filed += 1
        continue
      }
      if (!f.storage_path) {
        await admin.from('person_file_attachments').update({ fail_why: 'No staged copy to file.' }).eq('id', f.id)
        continue
      }
      const dl = await admin.storage.from(HR_FILES_BUCKET).download(f.storage_path)
      if (dl.error || !dl.data) {
        await admin.from('person_file_attachments').update({ fail_why: `The staged copy did not read: ${dl.error?.message ?? 'empty'}` }).eq('id', f.id)
        continue
      }
      const bytes = new Uint8Array(await dl.data.arrayBuffer())
      const base = driveSafeName(f.filename) || 'file'
      const name = await freeName(google, folderId, (taken) => {
        if (!taken.has(base)) return base
        const dot = base.lastIndexOf('.')
        const stem = dot > 0 ? base.slice(0, dot) : base
        const ext = dot > 0 ? base.slice(dot) : ''
        return `${stem} (${taken.size + 1})${ext}`
      })
      const up = await uploadBytes(google, folderId, bytes, name, f.mime_type || 'application/octet-stream')
      await admin.from('person_file_attachments').update({ drive_file_id: up.id, drive_url: fileUrl(up.id), filed_at: new Date().toISOString(), fail_why: null }).eq('id', f.id)
      filed += 1
    }
  } catch (e) {
    failWhy = e instanceof Error ? e.message : String(e)
  }
  const remaining = rows.length - filed
  await admin
    .from('person_file_evidence')
    .update({ fail_why: failWhy, ...(remaining === 0 && rows.length > 0 ? { filed_at: new Date().toISOString() } : {}) })
    .eq('id', record.id)
  return { filed, remaining, failWhy, folderUrl: folderId ? folderUrl(folderId) : null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!url || !serviceKey || !anonKey) return json({ error: 'Function is not configured.' }, 500)
  const admin = createClient(url, serviceKey)

  let body: { evidence_id?: string } = {}
  try {
    body = (await req.json()) as { evidence_id?: string }
  } catch {
    body = {}
  }

  // Who is asking: the cron with its secret, or a dev with their session.
  const cronSecret = Deno.env.get('CRON_SECRET')
  const isCron = Boolean(cronSecret) && req.headers.get('x-cron-secret') === cronSecret
  if (!isCron) {
    const auth = req.headers.get('Authorization') ?? ''
    const asUser = createClient(url, anonKey, { global: { headers: { Authorization: auth } } })
    const { data: me } = await asUser.auth.getUser()
    const archivedRefusal = await refuseArchivedCaller(admin, me?.user?.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal
    if (!me?.user) return json({ error: 'Sign in first.' }, 401)
    const { data: isDev } = await asUser.rpc('is_dev')
    if (isDev !== true) return json({ error: 'Only a dev files evidence.' }, 403)
    if (!body.evidence_id) return json({ error: 'evidence_id is required.' }, 400)
  }

  const settings = await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID'))
  const peopleRoot = settings.peopleFolderId
  const records: EvidenceRow[] = []
  if (body.evidence_id) {
    const { data } = await admin.from('person_file_evidence').select('id, person_id, dated_on, title, drive_folder_id, drive_folder_url, filed_at, fail_why, counsel_only').eq('id', body.evidence_id).maybeSingle()
    if (!data) return json({ error: 'No such record.' }, 404)
    records.push(data as EvidenceRow)
  } else {
    const { data } = await admin.from('person_file_evidence').select('id, person_id, dated_on, title, drive_folder_id, drive_folder_url, filed_at, fail_why, counsel_only').is('filed_at', null).eq('counsel_only', false).order('created_at', { ascending: true }).limit(SWEEP_BATCH)
    records.push(...((data ?? []) as EvidenceRow[]))
  }

  if (!peopleRoot) {
    for (const r of records) await admin.from('person_file_evidence').update({ fail_why: NO_PEOPLE_FOLDER_WORDS }).eq('id', r.id)
    return json({ filed: 0, remaining: records.length, fail_why: NO_PEOPLE_FOLDER_WORDS, folder_url: null })
  }
  if (!saJson) return json({ error: 'Drive is not set up on this function (GOOGLE_SERVICE_ACCOUNT_JSON).' }, 500)
  const google = await googleAccessToken(saJson, Deno.env.get('DRIVE_IMPERSONATE_USER') || undefined)

  const personIds = [...new Set(records.map((r) => r.person_id))]
  const { data: people } = personIds.length > 0 ? await admin.from('people').select('id, name').in('id', personIds) : { data: [] }
  const nameById = new Map(((people ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]))

  let filed = 0
  let remaining = 0
  let failWhy: string | null = null
  let folder: string | null = null
  for (const r of records) {
    const out = await fileRecord(admin, google, peopleRoot, r, nameById.get(r.person_id) ?? '')
    filed += out.filed
    remaining += out.remaining
    failWhy = out.failWhy ?? failWhy
    folder = out.folderUrl ?? folder
  }
  return json({ filed, remaining, fail_why: failWhy, folder_url: folder, records: records.length })
})
