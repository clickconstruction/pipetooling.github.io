import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { driveFolderIdFromUrl, findOrCreateFolder } from './driveUpload.ts'
import { FOLDER_MIME, NO_ROOT_WORDS, driveFolderMeta, metaOwner } from './driveSettings.ts'
import { childFolder } from './driveJobFolder.ts'
import { DRIVE_FOLDER_MIME, driveViewUrl } from './driveLink.ts'
import { bidFolderName, type DriveSettings } from './whereFilesGo.ts'
import { todayYmdInAppTz } from './appTimeZone.ts'
import { BID_PHOTO_FOLDER_PATH, bidFolderHoldWords, type BidFolderSeen, type BidPhotoFolderState } from './bidPhotos.ts'

/**
 * A bid's Drive folders (punch list #306, PR 2): the project folder (`bids.drive_link`) and the photo folder inside it,
 * Team only › Photos. `drive-intake` made a bid's folder for the robots and nothing else did; the bid photos function
 * and the photo sweep make it the same way, so the rule lives here: a bid whose link is already a folder keeps it,
 * otherwise the folder is found or made under the jobs root by the office's bid pattern, and the link is written on the
 * bid only where it is empty. The words for a folder the app cannot file into are `bidFolderHoldWords`.
 */

/** The columns the folder rule reads off a bid. */
export const BID_FOLDER_COLUMNS = 'id, bid_number, project_name, address, created_at, customer_id, drive_link'

export interface BidFolderRow {
  id: string
  bid_number: string | number | null
  project_name: string | null
  address: string | null
  created_at: string | null
  customer_id: string | null
  drive_link: string | null
}

/** The bid's row for the folder rule, or null when the bid is gone. */
export async function readBidForFolder(admin: SupabaseClient, bidId: string): Promise<BidFolderRow | null> {
  const { data } = await admin.from('bids').select(BID_FOLDER_COLUMNS).eq('id', bidId).maybeSingle()
  return (data as BidFolderRow | null) ?? null
}

/** The name a bid's folder is made under: the office's bid pattern; the customer's name is read only when the pattern asks for it. */
export async function bidFolderNameFor(admin: SupabaseClient, settings: DriveSettings, bid: BidFolderRow): Promise<string> {
  let customerName: string | null = null
  if (settings.bidPattern.includes('customer') && bid.customer_id) {
    const { data: c } = await admin.from('customers').select('name').eq('id', bid.customer_id).maybeSingle()
    customerName = (c as { name?: string | null } | null)?.name ?? null
  }
  return bidFolderName(settings.bidPattern, {
    id: bid.id,
    project: bid.project_name,
    number: bid.bid_number,
    customer: customerName,
    address: bid.address,
    year: bid.created_at ? todayYmdInAppTz(new Date(bid.created_at)).slice(0, 4) : null,
  })
}

/** A bid's project folder as Drive describes it to the app: what the app may do there, its name and its owner. */
export interface SeenBidFolder {
  seen: BidFolderSeen
  name: string
  owner: string | null
}

/** One read of the folder's own facts; the write check's kinds (`checkFolderWrite`) without its walk up the parents. */
export async function seeBidFolder(token: string, folderId: string): Promise<SeenBidFolder> {
  const { status, body } = await driveFolderMeta(token, folderId)
  if (status === 403 || status === 404) return { seen: 'cannot_open', name: '', owner: null }
  if (status < 200 || status >= 300) throw new Error(`Drive answered ${status} when the app looked at the bid’s folder.`)
  const name = body.name ?? ''
  if (body.mimeType !== FOLDER_MIME) return { seen: 'not_a_folder', name, owner: null }
  if (body.capabilities?.canAddChildren !== true) return { seen: 'cannot_write', name, owner: metaOwner(body) }
  if (!body.driveId) return { seen: 'outside_drive', name, owner: metaOwner(body) }
  return { seen: 'ok', name, owner: null }
}

export interface BidFolderContext {
  admin: SupabaseClient
  /** The service account's token. */
  token: string
  settings: DriveSettings
  /** The service account's address, for the words that say who to share a folder with. */
  appEmail: string
  /** True when the app may file as a Workspace person (`DRIVE_IMPERSONATE_USER`). */
  canActAsPerson: boolean
}

/**
 * Where a bid's photos go, read and never made: the state the window shows before the first photo. A bid with no
 * project folder answers `none` with the name the folder will be made under.
 */
export async function bidPhotoFolderState(ctx: BidFolderContext, bid: BidFolderRow): Promise<BidPhotoFolderState & { photosId: string | null; seen: BidFolderSeen | null }> {
  const link = String(bid.drive_link ?? '').trim()
  if (!link) {
    return { kind: 'none', projectName: await bidFolderNameFor(ctx.admin, ctx.settings, bid), projectUrl: null, photosUrl: null, hold: ctx.settings.rootFolderId ? null : NO_ROOT_WORDS, photosId: null, seen: null }
  }
  const folderId = driveFolderIdFromUrl(link)
  if (!folderId) {
    return { kind: 'project', projectName: '', projectUrl: link, photosUrl: null, hold: bidFolderHoldWords('not_a_folder', ctx.appEmail, null, ctx.canActAsPerson), photosId: null, seen: 'not_a_folder' }
  }
  const seen = await seeBidFolder(ctx.token, folderId)
  const hold = bidFolderHoldWords(seen.seen, ctx.appEmail, seen.owner, ctx.canActAsPerson)
  const projectUrl = driveViewUrl(folderId, DRIVE_FOLDER_MIME)
  if (seen.seen === 'cannot_open' || seen.seen === 'not_a_folder') {
    return { kind: 'project', projectName: seen.name, projectUrl, photosUrl: null, hold, photosId: null, seen: seen.seen }
  }
  let photosId: string | null = folderId
  for (const name of BID_PHOTO_FOLDER_PATH) {
    photosId = photosId ? await childFolder(ctx.token, photosId, name) : null
  }
  return {
    kind: photosId ? 'ready' : 'project',
    projectName: seen.name,
    projectUrl,
    photosUrl: photosId ? driveViewUrl(photosId, DRIVE_FOLDER_MIME) : null,
    hold,
    photosId,
    seen: seen.seen,
  }
}

/** The bid's photo folder, made as needed, with what the app saw of the project folder; or the reason it cannot be. */
export type BidPhotoFolder = { id: string; projectId: string; seen: BidFolderSeen; made: boolean } | { why: string }

/**
 * The folder a bid's photos land in, made as needed: the project folder first (kept when the bid has one, else found or
 * made under the jobs root and written on the bid where the link is empty), then Team only › Photos inside it. A folder
 * in a personal Drive takes the app's folders and not its files, so it answers with `seen: 'outside_drive'` and the
 * caller files as a person, or holds. A folder the app cannot open or add to answers the hold's words.
 */
export async function ensureBidPhotoFolder(ctx: BidFolderContext, bid: BidFolderRow): Promise<BidPhotoFolder> {
  const link = String(bid.drive_link ?? '').trim()
  let projectId = driveFolderIdFromUrl(link)
  let made = false
  if (link && !projectId) return { why: bidFolderHoldWords('not_a_folder', ctx.appEmail, null, ctx.canActAsPerson)! }
  if (!projectId) {
    if (!ctx.settings.rootFolderId) return { why: NO_ROOT_WORDS }
    const folder = await findOrCreateFolder(ctx.token, ctx.settings.rootFolderId, await bidFolderNameFor(ctx.admin, ctx.settings, bid))
    projectId = folder.id
    made = folder.created
    // Written only where the link is still empty: a link someone pasted meanwhile wins, and the next read follows it.
    await ctx.admin
      .from('bids')
      .update({ drive_link: `https://drive.google.com/drive/folders/${folder.id}` })
      .eq('id', bid.id)
      .or('drive_link.is.null,drive_link.eq.')
  }
  const seen = await seeBidFolder(ctx.token, projectId)
  if (seen.seen === 'cannot_open' || seen.seen === 'cannot_write' || seen.seen === 'not_a_folder') {
    return { why: bidFolderHoldWords(seen.seen, ctx.appEmail, seen.owner, ctx.canActAsPerson)! }
  }
  if (seen.seen === 'outside_drive' && !ctx.canActAsPerson) {
    return { why: bidFolderHoldWords('outside_drive', ctx.appEmail, seen.owner, false)! }
  }
  let into = projectId
  for (const name of BID_PHOTO_FOLDER_PATH) {
    const next = await findOrCreateFolder(ctx.token, into, name)
    into = next.id
    made = made || next.created
  }
  return { id: into, projectId, seen: seen.seen, made }
}
