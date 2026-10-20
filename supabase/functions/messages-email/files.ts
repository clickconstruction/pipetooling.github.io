/**
 * messages-email's files (Messages, cut 7e): each file the app asked to send, read from where it lives, held to the
 * limits, and written on the line as it went. The rules are pure in `_shared/messagesEmailFiles.ts`; this is the reading
 * and writing around them.
 *
 * `readFiles` runs before the line is written: it checks every file and reads the bytes of each that goes as the file,
 * so a send that cannot carry them stops before anything goes. A file from this computer is put into the job's Team only
 * then (Sent by us, or Photos), so nothing goes out that Documents does not hold. `placeFiles` runs once the line has its
 * id: it makes each link (their portal at its page, or our link to the Drive file), keeps a copy of each file that goes
 * as the file under `out/` in `message-attachments`, and writes the `message_attachments` rows. `takeBack` undoes the
 * links and the copies when the email does not go; the line's rows go with the line.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { googleAccessToken, uploadBytes } from '../_shared/driveUpload.ts'
import { driveFileBytes, driveFileMeta, halfInside, jobFolder, landingFolder, makeDriveLink, type JobFolder } from '../_shared/driveJobFolder.ts'
import { bytesOfBase64, landingPath, type JobRef } from '../_shared/driveLink.ts'
import { gcJobsPortalUrl } from '../_shared/gcCustomerEmails.ts'
import { PORTAL_RETURN_SHORT_ORIGIN } from '../_shared/customerPortalReturnUrl.ts'
import { tradePortalLinkUrl } from '../_shared/gcTradeEmail.ts'
import {
  EMAIL_FILE_LIMIT_BYTES,
  base64OfBytes,
  carryRefusal,
  carryWords,
  outCopyPath,
  paperRef,
  portalHasPage,
  portalPageUrl,
  type EmailFileAsk,
  type PortalPageKey,
  type SentLink,
} from '../_shared/messagesEmailFiles.ts'

const ATTACHMENTS_BUCKET = 'message-attachments'

/** A refusal in words, as the send window shows it. */
export interface FileRefusal {
  ok: false
  error: string
  words: string
  status: number
}

const refusal = (error: string, words: string, status = 409): FileRefusal => ({ ok: false, error, words, status })

/** A file, checked and read. */
export interface ReadFile {
  ask: EmailFileAsk
  name: string
  mime: string
  /** The bytes of a file that goes as the file or the picture. */
  bytes: Uint8Array | null
  /** The Drive file it is, when it lives in Drive (a file from this computer once it is put there). */
  driveFileId: string | null
}

/** Who the email goes to, as their portal knows them. */
export interface Recipient {
  kind: string
  customerId: string | null
  customerPersonId: string | null
  companyId: string | null
  companyPersonId: string | null
}

export interface FilesContext {
  admin: SupabaseClient
  job: JobRef | null
  google: string | null
  folder: JobFolder | null
}

const carries = (a: EmailFileAsk) => a.way !== 'link'

/** The bytes of a file in one of our buckets, or null when it is not there. */
async function bucketBytes(admin: SupabaseClient, bucket: string, path: string): Promise<Uint8Array | null> {
  const { data, error } = await admin.storage.from(bucket).download(path)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

/**
 * Every file checked, and the bytes read of each that goes as the file. A file from Drive or this computer needs the
 * job's Drive folder. A file of the job's Drive outside its folder, one too big, one not where its row says, or a paper
 * of another job refuses the send in words.
 */
export async function readFiles(
  admin: SupabaseClient,
  asks: readonly EmailFileAsk[],
  job: JobRef | null,
): Promise<{ ok: true; files: ReadFile[]; ctx: FilesContext } | FileRefusal> {
  const ctx: FilesContext = { admin, job, google: null, folder: null }
  if (asks.length === 0) return { ok: true, files: [], ctx }

  const needsDrive = asks.some((a) => a.source === 'drive' || a.source === 'device' || (a.source === 'arrived' && a.way === 'link' && !a.page))
  if (needsDrive) {
    if (!job) return refusal('noJob', 'Tie the email to a job first, so its files have a folder.')
    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!saJson) return refusal('noDrive', 'Drive is not set up here yet, so the files cannot go.', 503)
    ctx.google = await googleAccessToken(saJson)
    ctx.folder = await jobFolder(admin, ctx.google, job)
    if (!ctx.folder) return refusal('noFolder', 'That job has no Drive folder yet, so its files cannot go.')
  }

  const files: ReadFile[] = []
  for (const a of asks) {
    let name = a.name
    let mime = a.mime || 'application/octet-stream'
    let bytes: Uint8Array | null = null
    let driveFileId: string | null = null

    if (a.source === 'drive') {
      if (!(await halfInside(ctx.google!, ctx.folder!, a.ref))) return refusal('notInFolder', `${a.name} is not in the job’s Drive folder.`, 403)
      driveFileId = a.ref
      if (carries(a)) {
        const meta = await driveFileMeta(ctx.google!, a.ref)
        mime = meta.mimeType || mime
        const read = await driveFileBytes(ctx.google!, a.ref, EMAIL_FILE_LIMIT_BYTES)
        if (read === 'tooBig') return refusal('overFile', carryWords({ why: 'overFile', name: a.name }), 413)
        if (!read) return refusal('noBytes', `${a.name} has no file to carry, so it can only go as our link.`, 422)
        bytes = read
      }
    } else if (a.source === 'arrived') {
      const { data } = await admin.from('message_attachments').select('kind, name, mime, bucket_path, drive_file_id').eq('id', a.ref).maybeSingle()
      const row = data as { kind: string; name: string; mime: string | null; bucket_path: string | null; drive_file_id: string | null } | null
      if (!row || row.kind !== 'file') return refusal('notFound', `${a.name} is not a file we kept.`, 404)
      name = row.name
      mime = row.mime || mime
      driveFileId = row.drive_file_id
      if (carries(a)) {
        if (!row.bucket_path) return refusal('notFound', `${a.name} is not a file we kept.`, 404)
        bytes = await bucketBytes(admin, ATTACHMENTS_BUCKET, row.bucket_path)
        if (!bytes) return refusal('notFound', `Our copy of ${a.name} did not read.`, 500)
      } else if (!a.page && !driveFileId) {
        return refusal('notInDrive', `${a.name} is not in Drive yet. Send it as the file, or save it to Drive first.`)
      }
    } else if (a.source === 'sent') {
      const { data } = await admin.from('sent_documents').select('attachments').eq('id', a.ref).maybeSingle()
      const kept = (Array.isArray((data as { attachments?: unknown } | null)?.attachments) ? (data as { attachments: unknown[] }).attachments : []) as { path?: unknown; type?: unknown }[]
      const file = kept.find((k) => k.path === a.path)
      if (!file) return refusal('notFound', `${a.name} is not on that copy.`, 404)
      if (typeof file.type === 'string' && file.type) mime = file.type
      if (!carries(a) && !a.page) return refusal('notInDrive', `${a.name} can only go as the file.`)
      if (carries(a)) {
        bytes = await bucketBytes(admin, 'sent-documents', a.path!)
        if (!bytes) return refusal('notFound', `Our copy of ${a.name} did not read.`, 500)
      }
    } else if (a.source === 'paper') {
      const paper = paperRef(a.ref)!
      if (paper.paper === 'contract') {
        const { data } = await admin.from('gc_owner_contract_sends').select('project_id, file_path, file_name').eq('id', paper.id).maybeSingle()
        const send = data as { project_id: string; file_path: string; file_name: string } | null
        if (!send || !job || !('project_id' in job) || send.project_id !== job.project_id) return refusal('notFound', `${a.name} is not this job’s contract.`, 404)
        if (carries(a)) {
          bytes = await bucketBytes(admin, 'gc-owner-contracts', send.file_path)
          if (!bytes) return refusal('notFound', `Our copy of ${a.name} did not read.`, 500)
          mime = 'application/pdf'
        }
      }
      // A paper the app draws on demand goes as its page in their portal (the parser holds it to a link).
      if (!carries(a) && !a.page) return refusal('noPage', `${a.name} goes as their portal page. Pick the page to send it.`)
    } else if (a.source === 'portal') {
      // No file: their portal at its page (a W-9 or an MSA is a form there). The link is made once the line has its id.
      mime = ''
    } else {
      // From this computer: into the job's Team only first, so Documents holds what goes out.
      const read = a.base64 ? bytesOfBase64(a.base64) : null
      if (!read || read.length === 0) return refusal('badFile', `${a.name} did not come through. Add it again.`, 400)
      if (read.length > EMAIL_FILE_LIMIT_BYTES) return refusal('overFile', carryWords({ why: 'overFile', name: a.name }), 413)
      bytes = carries(a) ? read : null
      files.push({ ask: a, name, mime, bytes, driveFileId: null })
      continue
    }
    files.push({ ask: a, name, mime, bytes, driveFileId })
  }

  const tooMuch = carryRefusal(files.filter((f) => carries(f.ask)).map((f) => ({ name: f.name, bytes: f.bytes?.length ?? null })))
  if (tooMuch) return refusal(tooMuch.why, carryWords(tooMuch), 413)

  // Every check passed: the files from this computer go into the job's Team only now, before the line is written.
  for (const f of files) {
    if (f.ask.source !== 'device') continue
    const read = bytesOfBase64(f.ask.base64!)!
    try {
      const into = await landingFolder(ctx.google!, ctx.folder!, landingPath(f.ask.landing === 'photos' ? 'photos' : 'sent'))
      f.driveFileId = (await uploadBytes(ctx.google!, into, read, f.name, f.mime)).id
    } catch (e) {
      console.error('[messages-email] put', e instanceof Error ? e.message : String(e))
      return refusal('putFailed', `${f.name} did not go into the job’s Team only, so nothing went. Try again.`, 502)
    }
  }
  return { ok: true, files, ctx }
}

/** The person's portal, as their audience: a trade partner's `/t/<token>`, a customer's portal where their GC jobs show. */
async function portalOf(admin: SupabaseClient, who: Recipient, origin: string): Promise<{ audience: 'trade' | 'customer'; url: string } | null> {
  if (who.kind === 'trade') {
    let companyId = who.companyId
    if (!companyId && who.companyPersonId) {
      const { data } = await admin.from('gc_company_people').select('company_id').eq('id', who.companyPersonId).maybeSingle()
      companyId = (data as { company_id?: string } | null)?.company_id ?? null
    }
    if (!companyId) return null
    const { data } = await admin.from('gc_trade_portal_links').select('token').eq('company_id', companyId).is('revoked_at', null).not('token', 'is', null).maybeSingle()
    const token = (data as { token?: string } | null)?.token
    return token ? { audience: 'trade', url: tradePortalLinkUrl(origin, token) } : null
  }
  if (who.kind === 'customer') {
    let customerId = who.customerId
    if (!customerId && who.customerPersonId) {
      const { data } = await admin.from('customer_contact_persons').select('customer_id').eq('id', who.customerPersonId).maybeSingle()
      customerId = (data as { customer_id?: string } | null)?.customer_id ?? null
    }
    if (!customerId) return null
    const [{ data: links }, { data: slugRow }] = await Promise.all([
      admin.from('customer_portal_links').select('audience, token, revoked_at').eq('customer_id', customerId).is('revoked_at', null),
      admin.from('customer_portal_slugs').select('slug').eq('customer_id', customerId).maybeSingle(),
    ])
    const url = gcJobsPortalUrl((links ?? []) as { audience: string; token: string | null }[], (slugRow as { slug?: string } | null)?.slug ?? null, origin, PORTAL_RETURN_SHORT_ORIGIN)
    return url ? { audience: 'customer', url } : null
  }
  return null
}

/** What `placeFiles` made, so `takeBack` can undo it if the email does not go. */
export interface Placed {
  links: SentLink[]
  attachments: { filename: string; content: string }[]
  linkIds: string[]
  copyPaths: string[]
}

/**
 * Once the line has its id: each link made, each file that goes as the file copied under `out/`, and every file written
 * on the line with how it went (`sent_as`, cut 7a). Our own links name the line, so the window can show their opens.
 */
export async function placeFiles(
  ctx: FilesContext,
  files: readonly ReadFile[],
  input: { lineId: string; madeBy: string; origin: string; recipient: Recipient },
): Promise<{ ok: true; placed: Placed } | (FileRefusal & { placed: Placed })> {
  const placed: Placed = { links: [], attachments: [], linkIds: [], copyPaths: [] }
  const fail = (r: FileRefusal) => ({ ...r, placed })
  if (files.length === 0) return { ok: true, placed }
  const { admin } = ctx
  let portal: Awaited<ReturnType<typeof portalOf>> | undefined
  const rows: Record<string, unknown>[] = []

  for (const [i, f] of files.entries()) {
    const a = f.ask
    if (a.way === 'link') {
      let url: string | null = null
      let page: PortalPageKey | null = null
      let driveLinkId: string | null = null
      if (a.page) {
        if (portal === undefined) portal = await portalOf(admin, input.recipient, input.origin)
        if (portal && portalHasPage(portal.audience, a.page)) {
          url = portalPageUrl(portal.url, a.page)
          page = a.page
        }
      }
      if (!url && f.driveFileId && ctx.job && ctx.folder && ctx.google) {
        const made = await makeDriveLink(admin, ctx.google, { job: ctx.job, folder: ctx.folder, driveFileId: f.driveFileId, messageId: input.lineId, madeBy: input.madeBy, origin: input.origin })
        if (!made.ok) {
          const words = made.why === 'teamOnlyFolder' ? `${f.name} is a folder in Team only, so it cannot go as our link.` : made.why === 'notInFolder' ? `${f.name} is not in the job’s Drive folder.` : `Our link to ${f.name} was not made. Try again.`
          return fail(refusal(made.why, words, made.why === 'failed' ? 500 : 409))
        }
        url = made.url
        driveLinkId = made.linkId
        placed.linkIds.push(made.linkId)
      }
      if (!url) return fail(refusal('noPortal', `${f.name} goes as their portal page, and they have no portal link on.`))
      placed.links.push({ name: f.name, url, page })
      rows.push({ message_id: input.lineId, sort_order: i, kind: 'link', name: f.name, mime: f.mime || null, url, sent_as: 'link', drive_link_id: driveLinkId, drive_file_id: f.driveFileId })
      continue
    }
    const bytes = f.bytes!
    const path = outCopyPath(input.lineId, i, f.name)
    const { error } = await admin.storage.from(ATTACHMENTS_BUCKET).upload(path, bytes, { contentType: f.mime, upsert: false })
    if (error) {
      console.error('[messages-email] copy', error.message)
      return fail(refusal('copyFailed', `Our copy of ${f.name} could not be kept, so nothing went. Try again.`, 500))
    }
    placed.copyPaths.push(path)
    placed.attachments.push({ filename: f.name, content: base64OfBytes(bytes) })
    rows.push({ message_id: input.lineId, sort_order: i, kind: 'file', name: f.name, mime: f.mime, size_bytes: bytes.length, bucket_path: path, sent_as: a.way, drive_file_id: f.driveFileId })
  }

  const { error } = await admin.from('message_attachments').insert(rows)
  if (error) {
    console.error('[messages-email] rows', error.message)
    return fail(refusal('rowsFailed', 'The files could not be kept with the line, so nothing went. Try again.', 500))
  }
  return { ok: true, placed }
}

/** The email did not go: our links are taken back and the copies removed. The line's rows go with the line. */
export async function takeBack(admin: SupabaseClient, placed: Placed): Promise<void> {
  if (placed.linkIds.length) await admin.from('drive_links').delete().in('id', placed.linkIds)
  if (placed.copyPaths.length) await admin.storage.from(ATTACHMENTS_BUCKET).remove(placed.copyPaths)
}
