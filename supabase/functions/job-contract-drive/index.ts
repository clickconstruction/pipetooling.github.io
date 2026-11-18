import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl, findExistingFile, findOrCreateFolder, googleAccessToken, uploadBytes } from '../_shared/driveUpload.ts'
import { driveFolderMeta, FOLDER_MIME, readDriveSettings } from '../_shared/driveSettings.ts'
import { driveFileState } from '../_shared/driveJobFolder.ts'
import { FolderTree, JOB_FOLDER_COLUMNS, renameFolder, type JobFolderRow } from '../_shared/jobFolders.ts'
import { fileMeta, indexContext, indexFiles, type IndexContext } from '../_shared/fileIndex.ts'
import { JOB_CONTRACT_BUCKET, jobNumberLabel } from '../_shared/jobContract.ts'
import { signerNamesLine } from '../_shared/jobContractSigners.ts'
import { CONTRACT_FILE_MARK, contractDriveDue, isSignedLive, keptJobFolderWhy, type ContractDriveHoldKind, type ContractDriveRow, type LinkedFileFacts } from '../_shared/jobContractDrive.ts'
import { fileContract, holdContract, markVoidedCopy, type FileOutcome, type FilerDrive, type FilerStore } from '../_shared/jobContractDriveFiler.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'

/**
 * job-contract-drive — Signed contracts in Google Drive (punch list #377, PR 2; the owner's seven calls of 2026-11-17).
 * A signed job contract lived in the app's storage and nowhere in Drive or the file index, so Find a file could not find
 * it. This files each signed paper in its job's own Drive folder, under Team only › Contracts, and hands it to the index
 * in the same call. The rules are `_shared/jobContractDrive.ts`; one paper's path is `_shared/jobContractDriveFiler.ts`.
 *
 *   POST { contract_id }                                    — the press (the Contract window's File it in Drive now and
 *     Try again, and the office's own paper filings right after their write). Files that one paper now, whatever its
 *     last try, or renames a voided paper's filed copy to start with VOIDED. Answers `{ ok, outcome, drive }`, where
 *     `drive` is the row's Drive columns as they now stand.
 *
 *   POST { sweep: { limit? } }   (X-Cron-Secret, or the office) — the same over the queue: signed papers in force with no
 *     Drive copy, never tried first and a held one an hour on, then voided papers whose filed copy is not yet marked.
 *     `limit` (10, at most 25) a call, inside the request's budget. The backfill is this call: it takes every due paper
 *     whatever its job's state. Answers `{ ok, by, counts: { looked, filed, adopted, found, held, marked }, held: [{
 *     contract_id, job_id, kind, words }], left }`.
 *
 * What a filing does: the stored file (the office's scan when the record has one, else the signed PDF) is uploaded under
 * the job's folder, which is made through the tree's own rule when the job has none (`FolderTree.placeJob`), named by
 * day, kind, job number and signer, and marked with the contract's id (`appProperties.pt_job_contract`) so a run that
 * died after the upload finds its file. A record with no stored file whose typed link names a file inside the jobs
 * Shared Drive is adopted: the row records that file and nothing in Drive changes. `signed_document_url` is never
 * written (call 7).
 *
 * What stops a filing is written on the row (`drive_file_hold`, `drive_file_hold_words`) and tried again an hour on:
 * Drive not connected, no jobs root, the job's folder held (with the job's own reason), a folder open to anyone with its
 * link (a signed contract is never filed there), a link the app cannot adopt, no file at all, a file past 25 MB, Drive's
 * own refusal. Nothing here touches the signing: `sign-job-contract` does not call this function, and a failure here
 * changes neither the record nor the customer's emailed copy.
 *
 * Who can read a filed paper (call 1, said plainly on the card): the members of the jobs Shared Drive, and the office
 * and estimators through Find a file. `job_contracts` itself stays the four office roles'.
 *
 * Auth: the cron's secret for the sweep, else a staff JWT with one of the four office roles that read `job_contracts`
 * (dev, master_technician, assistant, controller); never a training account or a digital twin (the service role writes
 * here, so the read-only blocks and the twin fence never see it). verify_jwt = false and validated here. Google auth is
 * the service account (GOOGLE_SERVICE_ACCOUNT_JSON); setup in docs/DRIVE_INTAKE_SETUP.md.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** The four roles that read `job_contracts`: the estimator is not among them. */
const OFFICE_ROLES = ['dev', 'master_technician', 'assistant', 'controller']
const SWEEP_DEFAULT = 10
const SWEEP_MAX = 25
/** A sweep stops taking papers once it has run this long, so the request ends inside the function's time. */
const SWEEP_BUDGET_MS = 90_000

/** The contract as the rules and the name read it: the Drive columns, the files, the signers. */
const CONTRACT_COLUMNS =
  'id, job_id, kind, status, voided_at, signed_at, paper_signed_on, our_signed_on, signed_pdf_path, paper_upload_path, signed_document_url, covers_group_id, paper_title, recipient_name, signer_printed_name, signer_mode, signer_consented_at, co_signer_name, co_signer_email, co_signed_at, co_signer_printed_name, co_signer_mode, co_signer_consented_at, drive_file_id, drive_filed_at, drive_file_origin, drive_file_hold, drive_file_hold_words, drive_file_tried_at, drive_void_marked_at'
const DRIVE_COLUMNS = 'id, drive_file_id, drive_filed_at, drive_file_origin, drive_file_hold, drive_file_hold_words, drive_file_tried_at, drive_void_marked_at'

type ContractRow = ContractDriveRow & Record<string, unknown>

/** The app's side: the stored file, what the name is made of, and the row's Drive columns. */
function storeFor(admin: SupabaseClient): FilerStore {
  return {
    async bytes(path, maxBytes) {
      const slash = path.lastIndexOf('/')
      const dir = slash > 0 ? path.slice(0, slash) : ''
      const file = slash > 0 ? path.slice(slash + 1) : path
      // The size first, from the bucket's own listing, so a file past the cap is never read into memory.
      const { data: listed } = await admin.storage.from(JOB_CONTRACT_BUCKET).list(dir, { search: file, limit: 100 })
      const item = ((listed ?? []) as { name: string; metadata?: { size?: number } | null }[]).find((f) => f.name === file)
      if (!item) return null
      if (Number(item.metadata?.size ?? 0) > maxBytes) return 'tooBig'
      const { data, error } = await admin.storage.from(JOB_CONTRACT_BUCKET).download(path)
      if (error || !data) return null
      const bytes = new Uint8Array(await data.arrayBuffer())
      if (bytes.length > maxBytes) return 'tooBig'
      return { bytes, mime: data.type || null }
    },
    async nameFacts(row) {
      const { data: job } = await admin.from('jobs_ledger').select('hcp_number, click_number, customer_name').eq('id', row.job_id).maybeSingle()
      const j = (job ?? {}) as { hcp_number?: string | null; click_number?: string | null; customer_name?: string | null }
      const numberOf = (x: { hcp_number?: string | null; click_number?: string | null }) => {
        const label = jobNumberLabel({ hcp_number: x.hcp_number ?? null, click_number: x.click_number ?? null })
        return label === '—' ? '' : label
      }
      let covers: string[] = []
      if (row.covers_group_id) {
        // Every job the paper covers: the rows filed together share the group, and a job taken off it is voided.
        const { data: group } = await admin.from('job_contracts').select('job_id, status, voided_at').eq('covers_group_id', row.covers_group_id).limit(200)
        const jobIds = [...new Set(((group ?? []) as { job_id: string; status: string; voided_at: string | null }[]).filter(isSignedLive).map((g) => g.job_id))]
        if (jobIds.length > 1) {
          const { data: jobs } = await admin.from('jobs_ledger').select('hcp_number, click_number').in('id', jobIds)
          covers = ((jobs ?? []) as { hcp_number: string | null; click_number: string | null }[]).map(numberOf).filter(Boolean)
        }
      }
      return { jobNumber: numberOf(j) || null, signer: signerNamesLine(row as ContractRow) || null, coversJobNumbers: covers, customerName: j.customer_name ?? null }
    },
    async save(contractId, patch) {
      const { error } = await admin.from('job_contracts').update(patch).eq('id', contractId)
      if (error) throw new Error(`The contract’s Drive columns were not saved: ${error.message}`)
    },
  }
}

/** Drive, as the service account, for one request: the tree and the index context are made once. */
function driveFor(admin: SupabaseClient, google: string, saJson: string, rootId: string, companyDriveId: string | null): FilerDrive {
  const appEmail = String((JSON.parse(saJson) as { client_email?: string }).client_email ?? '')
  let tree: FolderTree | null = null
  let index: Promise<IndexContext | { noRoot: true }> | null = null
  const get = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${google}` } })
  return {
    async jobFolder(jobId) {
      const { data } = await admin.from('jobs_ledger').select(`${JOB_FOLDER_COLUMNS}, drive_folder_hold`).eq('id', jobId).maybeSingle()
      const job = data as (JobFolderRow & { drive_folder_hold: string | null }) | null
      if (!job) return { why: 'That job is gone.' }
      const kept = driveFolderIdFromUrl(job.google_drive_link)
      if (kept && !job.drive_folder_hold) {
        // The link may name a folder Drive no longer has, or one in its trash: held in plain words with the job's door.
        const why = keptJobFolderWhy(await driveFileState(google, kept))
        return why ? { why } : { folderId: kept }
      }
      // No folder yet, or one held: the tree places it, or says again why it cannot, as the photo sweep's first photo does.
      if (!tree) tree = new FolderTree(admin, google, await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID')), rootId, appEmail)
      const placed = await tree.placeJob(job)
      if (placed.hold) return { why: placed.hold.why }
      const placedId = driveFolderIdFromUrl(placed.folder.url)
      return placedId ? { folderId: placedId } : { why: 'The job’s Drive folder was not made.' }
    },
    async folder(parentId, name) {
      return (await findOrCreateFolder(google, parentId, name)).id
    },
    async openToAnyone(folderId) {
      // Every permission on the folder, its own and what it inherits from the folders above it.
      let page = ''
      for (let i = 0; i < 10; i += 1) {
        const res = await get(`${DRIVE}/files/${encodeURIComponent(folderId)}/permissions?supportsAllDrives=true&pageSize=100&fields=nextPageToken,permissions(type)${page}`)
        if (!res.ok) throw new Error(`Drive answered ${res.status} when the app read who can open the folder.`)
        const body = (await res.json()) as { permissions?: { type?: string }[]; nextPageToken?: string }
        if ((body.permissions ?? []).some((p) => p.type === 'anyone')) return true
        if (!body.nextPageToken) return false
        page = `&pageToken=${encodeURIComponent(body.nextPageToken)}`
      }
      return false
    },
    async marked(folderId, contractId) {
      const q = encodeURIComponent(`'${folderId}' in parents and appProperties has { key='${CONTRACT_FILE_MARK}' and value='${contractId}' } and trashed = false`)
      const res = await get(`${DRIVE}/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`)
      if (!res.ok) throw new Error(`Drive answered ${res.status} when the app looked for the contract’s file.`)
      const body = (await res.json()) as { files?: { id: string; name: string }[] }
      return body.files?.[0] ?? null
    },
    async nameTaken(folderId, name) {
      return Boolean(await findExistingFile(google, folderId, name))
    },
    async upload(folderId, bytes, name, mime, mark) {
      return (await uploadBytes(google, folderId, bytes, name, mime, mark)).id
    },
    async linked(fileId): Promise<LinkedFileFacts> {
      const res = await get(`${DRIVE}/files/${encodeURIComponent(fileId)}?fields=id,mimeType,trashed,driveId&supportsAllDrives=true`)
      if (res.status === 403 || res.status === 404) return { seen: false, isFolder: false, trashed: false, inCompanyDrive: false }
      if (!res.ok) throw new Error(`Drive answered ${res.status} when the app looked at the linked file.`)
      const body = (await res.json()) as { mimeType?: string; trashed?: boolean; driveId?: string }
      return { seen: true, isFolder: body.mimeType === FOLDER_MIME, trashed: body.trashed === true, inCompanyDrive: Boolean(companyDriveId) && body.driveId === companyDriveId }
    },
    async fileName(fileId) {
      return (await driveFileState(google, fileId))?.name ?? null
    },
    async rename(fileId, name) {
      await renameFolder(google, fileId, name)
    },
    async index(fileId) {
      if (!index) index = indexContext(admin, google, saJson)
      const ctx = await index
      if ('noRoot' in ctx) return
      const meta = await fileMeta(google, fileId)
      if (meta) await indexFiles(ctx, [meta], { retry: true, max: 1 })
    },
  }
}

/** Drive for this request, or the hold every paper in it shares. */
async function connect(admin: SupabaseClient): Promise<{ drive: FilerDrive } | { hold: ContractDriveHoldKind; reason?: string }> {
  const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
  if (!saJson) return { hold: 'no_drive' }
  let google: string
  try {
    google = await googleAccessToken(saJson)
  } catch {
    return { hold: 'no_drive' }
  }
  const settings = await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID'))
  if (!settings.rootFolderId) return { hold: 'no_root' }
  const root = await driveFolderMeta(google, settings.rootFolderId)
  if (root.status < 200 || root.status >= 300) return { hold: 'no_root', reason: 'The app cannot open the jobs root. Check it on Documents → Where files go.' }
  return { drive: driveFor(admin, google, saJson, settings.rootFolderId, root.body.driveId ?? null) }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set' }, 500)
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const body = (await req.json().catch(() => ({}))) as { contract_id?: unknown; sweep?: { limit?: unknown } }

    // --- the caller: the cron's secret for the sweep, else the office, never a training account or a twin ---
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const byCron = Boolean(body.sweep) && Boolean(cronSecret) && headerSecret === cronSecret
    if (!byCron) {
      const auth = req.headers.get('Authorization') ?? ''
      const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
      const { data: u } = await anon.auth.getUser()
      const archivedRefusal = await refuseArchivedCaller(admin, u?.user?.id, corsHeaders)
      if (archivedRefusal) return archivedRefusal
      if (!u?.user) return json({ error: 'Sign in first.' }, 401)
      const { data: who } = await admin.from('users').select('role, read_only, is_digital_twin').eq('id', u.user.id).maybeSingle()
      const w = who as { role: string | null; read_only: boolean | null; is_digital_twin: boolean | null } | null
      if (!w || !OFFICE_ROLES.includes(String(w.role))) return json({ error: 'Office only.' }, 403)
      if (w.read_only) return json({ error: 'A training account cannot file a contract in Drive.' }, 403)
      if (w.is_digital_twin) return json({ error: 'A digital twin cannot file a contract in Drive.' }, 403)
    }

    const store = storeFor(admin)
    const now = new Date()
    /** One row through the rules: a filing, the VOIDED mark, or nothing. A hold the whole run shares is written as is. */
    const take = async (row: ContractRow, link: Awaited<ReturnType<typeof connect>>): Promise<FileOutcome> => {
      if (!isSignedLive(row)) return 'drive' in link ? markVoidedCopy(row, link.drive, store, now) : { id: row.id, did: 'nothing' }
      if ((row.drive_file_id ?? '').trim()) return { id: row.id, did: 'nothing' }
      if ('hold' in link) return holdContract(row, link.hold, store, now.toISOString(), link.reason)
      return fileContract(row, link.drive, store, now)
    }

    // --- the press: one paper, now ---
    if (body.contract_id !== undefined) {
      const id = String(body.contract_id ?? '').trim()
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'contract_id is required' }, 400)
      const { data, error } = await admin.from('job_contracts').select(CONTRACT_COLUMNS).eq('id', id).maybeSingle()
      if (error) return json({ error: `The contract did not read: ${error.message}` }, 500)
      const row = data as ContractRow | null
      if (!row) return json({ error: 'No contract with that id.' }, 404)
      const outcome = await take(row, await connect(admin))
      const { data: after } = await admin.from('job_contracts').select(DRIVE_COLUMNS).eq('id', id).maybeSingle()
      return json({ ok: true, outcome, drive: after ?? null })
    }

    // --- the sweep: the queue through the same rules, counted ---
    if (body.sweep) {
      const limit = Math.min(SWEEP_MAX, Math.max(1, Number(body.sweep.limit ?? SWEEP_DEFAULT) || SWEEP_DEFAULT))
      const [toFile, toMark] = await Promise.all([
        admin.from('job_contracts').select(CONTRACT_COLUMNS).eq('status', 'signed').is('voided_at', null).is('drive_file_id', null).order('drive_file_tried_at', { ascending: true, nullsFirst: true }).order('signed_at', { ascending: true }).limit(200),
        admin.from('job_contracts').select(CONTRACT_COLUMNS).not('voided_at', 'is', null).not('drive_file_id', 'is', null).eq('drive_file_origin', 'filed').is('drive_void_marked_at', null).limit(50),
      ])
      if (toFile.error) return json({ error: `The contracts did not read: ${toFile.error.message}` }, 500)
      const due = [...((toFile.data ?? []) as ContractRow[]), ...((toMark.data ?? []) as ContractRow[])].filter((r) => contractDriveDue(r, now.getTime()) != null)
      const counts = { looked: 0, filed: 0, adopted: 0, found: 0, held: 0, marked: 0 }
      const held: { contract_id: string; job_id: string; kind: string; words: string }[] = []
      const started = Date.now()
      const link = due.length > 0 ? await connect(admin) : null
      let taken = 0
      for (const row of due) {
        if (taken >= limit || Date.now() - started > SWEEP_BUDGET_MS) break
        taken += 1
        counts.looked += 1
        try {
          const out = await take(row, link!)
          if (out.did === 'held') {
            counts.held += 1
            held.push({ contract_id: row.id, job_id: row.job_id, kind: out.hold.kind, words: out.hold.words })
          } else if (out.did !== 'nothing') counts[out.did] += 1
        } catch (e) {
          // The row write itself refused: named here, and the paper is taken again on the next run.
          counts.held += 1
          held.push({ contract_id: row.id, job_id: row.job_id, kind: 'drive_refused', words: e instanceof Error ? e.message : String(e) })
        }
      }
      return json({ ok: true, by: byCron ? 'cron' : 'office', counts, held, left: Math.max(0, due.length - taken) })
    }

    return json({ error: 'Send a contract_id, or sweep.' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
