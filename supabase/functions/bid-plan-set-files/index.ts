import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl, findOrCreateFolder, googleAccessToken, uploadBytes } from '../_shared/driveUpload.ts'
import { DRIVE_FOLDER_MIME, driveViewUrl } from '../_shared/driveLink.ts'
import { driveGet } from '../_shared/driveJobFolder.ts'
import { driveQueryTerm } from '../_shared/fileIndexKernel.ts'
import { NO_ROOT_WORDS, readDriveSettings } from '../_shared/driveSettings.ts'
import { bidFolderNameFor, readBidForFolder, seeBidFolder } from '../_shared/bidFolder.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import {
  BID_PLANS_FOLDER_NAME,
  bidSetFolderHoldWords,
  parseBidPlanSetFilesAsk,
  runBidPlanSetFiles,
  type BidMailAttachmentRow,
  type BidMailLineRow,
  type BidPlanSetFilesDrive,
  type BidSetRow,
} from '../_shared/bidPlanSetFilesRun.ts'

/**
 * A mail's files kept as a set of plans on a bid (punch list #368, PR 1). An addendum or a revised spec reaches a bid
 * by mail; the press on that mail files what it carries into the bid's own project folder, under Plans › <the set's
 * name>, and adds the set to the bid (`bid_plan_sets`), so the estimators and the robot find it where the bid's plans
 * are. The job's leg is `plan-set-files`; a bid has no part, so it has this one.
 *
 *   POST { action: 'keep', bid_id, message_id, name, memo?, plan_date? }
 *        → { set: { id, bid_id, name, link }, folderUrl, made, reused }
 *        The set's folder found or made and the set's row added, by the caller's own insert. A set of this bid that
 *        already points at the folder of that name is answered as it is (`reused`), so a second press, or a later
 *        mail of the same conversation, joins it.
 *   POST { action: 'save_attachment', set_id, attachment_id }
 *        → { driveFileId, url, folderUrl, reused? }
 *        Our copy of one of the mail's files into the set's folder, then the file's own row marked with the set
 *        (`message_attachments.bid_plan_set_id`), which is how the mail reads as kept and the set as from a mail.
 *        A second try finds the file again by its name and size.
 *
 * The rules are `_shared/bidPlanSetFilesRun.ts`, tested with a fake from `src/lib/bids/bidPlanSetFilesRun.test.ts`.
 * This file wires them to Supabase and Drive. A read that fails throws with its reason.
 *
 * Who: the roles that write a bid's sets (dev, the leaders, the assistants, the controller, the estimator), on a bid
 * and a mail they can see: both are read through the caller's client, so `bids`' and `messages`' own policies decide,
 * and the set's row is the caller's insert, so `bid_plan_sets`' policy does. A training account and a digital twin
 * change nothing. An archived caller is refused. The Drive work runs as the service account.
 *
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, GOOGLE_SERVICE_ACCOUNT_JSON; DRIVE_JOBS_FOLDER_ID
 * (the root's fallback while the setting is empty). config.toml keeps verify_jwt = false: the JWT is checked here, so
 * the refusal has words.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** A read's row, or null when there is none. A read that failed says so. */
function rowOf<T>(r: { data: unknown; error: { message: string } | null }, what: string): T | null {
  if (r.error) throw new Error(`${what} did not read: ${r.error.message}`)
  return (r.data ?? null) as T | null
}

const SET_COLUMNS = 'id, bid_id, name, link'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
    const auth = req.headers.get('Authorization') ?? ''
    const mine = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await mine.auth.getUser()
    const archivedRefusal = await refuseArchivedCaller(admin, u?.user?.id, corsHeaders)
    if (archivedRefusal) return archivedRefusal
    const callerId = u?.user?.id
    if (!callerId) return json({ error: 'Sign in first.' }, 401)

    const ask = parseBidPlanSetFilesAsk((await req.json().catch(() => null)) as Record<string, unknown> | null)
    if (!ask) return json({ error: 'That is not an ask this door takes.' }, 400)

    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const appEmail = saJson ? String((JSON.parse(saJson) as { client_email?: string }).client_email ?? '') : ''

    const driveDoor = (token: string): BidPlanSetFilesDrive => ({
      // The bid's project folder by the rule its photos use (`ensureBidPhotoFolder`, `_shared/bidFolder.ts`): the
      // folder on the bid's link, else one found or made under the jobs root by the office's bid pattern, its link
      // written on the bid where it is still empty. Then Plans inside it.
      plansFolder: async (bidId) => {
        const bid = await readBidForFolder(admin, bidId)
        if (!bid) return { why: 'That bid is gone.' }
        const link = String(bid.drive_link ?? '').trim()
        let projectId = driveFolderIdFromUrl(link)
        if (link && !projectId) return { why: `${bidSetFolderHoldWords('not_a_folder', 'This bid’s project folder link', appEmail, null)} Fix it on the bid, under Files & links.` }
        if (!projectId) {
          const settings = await readDriveSettings(admin, Deno.env.get('DRIVE_JOBS_FOLDER_ID'))
          if (!settings.rootFolderId) return { why: NO_ROOT_WORDS }
          const made = await findOrCreateFolder(token, settings.rootFolderId, await bidFolderNameFor(admin, settings, bid))
          projectId = made.id
          await admin.from('bids').update({ drive_link: `https://drive.google.com/drive/folders/${made.id}` }).eq('id', bid.id).or('drive_link.is.null,drive_link.eq.')
        }
        const project = await seeBidFolder(token, projectId)
        const hold = bidSetFolderHoldWords(project.seen, 'This bid’s project folder', appEmail, project.owner)
        if (hold) return { why: hold }
        return { id: (await findOrCreateFolder(token, projectId, BID_PLANS_FOLDER_NAME)).id }
      },
      findOrCreateFolder: (parentId, name) => findOrCreateFolder(token, parentId, name),
      seeFolder: async (folderId) => {
        const seen = await seeBidFolder(token, folderId)
        return { seen: seen.seen, owner: seen.owner }
      },
      filesNamed: async (folderId, name) => {
        const q = encodeURIComponent(`name = '${driveQueryTerm(name)}' and '${folderId}' in parents and mimeType != '${DRIVE_FOLDER_MIME}' and trashed = false`)
        const page = await driveGet<{ files?: Array<{ id: string; size?: string }> }>(token, `${DRIVE}/files?q=${q}&fields=files(id,size)&supportsAllDrives=true&includeItemsFromAllDrives=true`)
        return (page.files ?? []).map((f) => ({ id: f.id, size: f.size == null ? null : Number(f.size) }))
      },
      filesIn: async (folderId) => {
        const q = encodeURIComponent(`'${folderId}' in parents and mimeType != '${DRIVE_FOLDER_MIME}' and trashed = false`)
        const page = await driveGet<{ files?: Array<{ name: string; size?: string; mimeType?: string }> }>(token, `${DRIVE}/files?q=${q}&pageSize=200&fields=files(name,size,mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true`)
        return (page.files ?? []).map((f) => ({ name: f.name, size: f.size == null ? null : Number(f.size), mime: f.mimeType ?? null }))
      },
      upload: (folderId, bytes, name, mime) => uploadBytes(token, folderId, bytes, name, mime),
    })

    const reply = await runBidPlanSetFiles(ask, callerId, {
      readMe: async () => rowOf(await admin.from('users').select('role, read_only, is_digital_twin').eq('id', callerId).maybeSingle(), 'Your account'),
      setsOnFolder: async (folderId) => rowOf<BidSetRow[]>(await admin.from('bid_plan_sets').select(SET_COLUMNS).like('link', `%${folderId}%`).limit(20), 'The sets on that folder') ?? [],
      stampAttachment: async (attachmentId, setId) => {
        const { error } = await admin.from('message_attachments').update({ bid_plan_set_id: setId }).eq('id', attachmentId)
        if (error) throw new Error(`The file is in the set’s folder, but the mail did not take its mark: ${error.message}`)
      },
      stampFileFacts: async (setId, facts) => {
        const { error } = await admin.from('bid_plan_sets').update(facts).eq('id', setId)
        if (error) throw new Error(error.message)
      },
      download: async (bucketPath) => {
        const { data, error } = await admin.storage.from('message-attachments').download(bucketPath)
        return error || !data ? null : new Uint8Array(await data.arrayBuffer())
      },
      canSeeBid: async (bidId) => rowOf<{ id: string }>(await mine.from('bids').select('id').eq('id', bidId).maybeSingle(), 'The bid') !== null,
      readMail: async (messageId) => rowOf<BidMailLineRow>(await mine.from('messages').select('id, bid_id, channel').eq('id', messageId).maybeSingle(), 'That mail'),
      readSet: async (setId) => rowOf<BidSetRow>(await mine.from('bid_plan_sets').select(SET_COLUMNS).eq('id', setId).maybeSingle(), 'The set'),
      readAttachment: async (attachmentId) => {
        const row = rowOf<Omit<BidMailAttachmentRow, 'message_bid_id'> & { messages: { bid_id: string | null } | null }>(
          await mine.from('message_attachments').select('id, kind, name, mime, bucket_path, messages(bid_id)').eq('id', attachmentId).maybeSingle(),
          'That file',
        )
        return row && { id: row.id, kind: row.kind, name: row.name, mime: row.mime, bucket_path: row.bucket_path, message_bid_id: row.messages?.bid_id ?? null }
      },
      insertSet: async (row) => {
        const made = await mine.from('bid_plan_sets').insert(row).select(SET_COLUMNS).single()
        if (made.error || !made.data) throw new Error(`The folder is made, but the set did not save: ${made.error?.message ?? 'no row came back'}`)
        return made.data as BidSetRow
      },
      folderIdFromUrl: driveFolderIdFromUrl,
      folderUrl: (folderId) => driveViewUrl(folderId, DRIVE_FOLDER_MIME),
      fileUrl: driveViewUrl,
      appEmail: () => appEmail,
      nowIso: () => new Date().toISOString(),
      drive: async () => (saJson ? driveDoor(await googleAccessToken(saJson)) : null),
    })
    return json(reply.body, reply.status)
  } catch (e) {
    console.error('bid-plan-set-files failed', e)
    return json({ error: e instanceof Error ? e.message : 'The files did not land.' }, 500)
  }
})
