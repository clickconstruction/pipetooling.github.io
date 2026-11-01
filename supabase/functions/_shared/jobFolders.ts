/**
 * One Drive folder per job, under its customer (the owner's rule of 2026-11-01, v2.6284): the tree is
 * root › <customer> › <job pattern> › the five, and the folder follows the job. This file does what `whereFilesGo.ts`
 * decides (`placeFolder`): it finds or makes the customer's folder under the root, finds, makes, moves or renames the
 * job's folder under it, fills the five inside as the office's choice says, and records the links and the stamps on the
 * rows. The press on the job window, the folder sweep (`job-drive-folders` → `sweep`) and the photo sweep's first photo
 * on a job with no folder (`driveJobFolder.ts` → `photoFolderOrWhy`) all place a job through `FolderTree.placeJob`, so
 * one rule holds everywhere.
 *
 * Drive keeps a folder's id through a move or a rename, so a link on a job, a bookmark or a share keeps working. A folder
 * outside a Shared Drive is never moved and never takes a file (the service account cannot own bytes in a My Drive); the
 * job is held with the reason on `jobs_ledger.drive_folder_hold`, and the office's door is to move the folder into the
 * Shared Drive by hand or clear the link.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DRIVE, driveFolderIdFromUrl, findOrCreateFolder } from './driveUpload.ts'
import { driveFolderMeta, FOLDER_MIME, metaOwner } from './driveSettings.ts'
import { todayYmdInAppTz } from './appTimeZone.ts'
import {
  customerFolderName,
  customerFolderNameApart,
  folderName,
  folderPathWords,
  JOB_FOLDER_TREE,
  NO_CUSTOMER_FOLDER_NAME,
  placeFolder,
  type DriveSettings,
  type SeenFolder,
} from './whereFilesGo.ts'

export const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`

/** The customer's kept folder sits in a My Drive: the job's folder cannot go under it, and no file could land there. */
export function customerOutsideDriveWords(owner: string | null): string {
  const whose = owner ? `${owner}’s My Drive` : 'a My Drive'
  return `The customer’s folder is in ${whose}, where the app can make folders but cannot save a file. Move it into the app’s Shared Drive, or clear the link on the customer and the folder is made under Jobs.`
}

/** A customer as the tree reads it. */
export interface CustomerFolderRow {
  id: string
  name: string | null
  google_drive_link: string | null
}

/** A job as the tree reads it. */
export interface JobFolderRow {
  id: string
  hcp_number: string | null
  job_name: string | null
  customer_name: string | null
  customer_id: string | null
  job_address: string | null
  created_at: string | null
  bid_id: string | null
  google_drive_link: string | null
  job_pictures_link: string | null
  job_plans_link: string | null
}

export const JOB_FOLDER_COLUMNS = 'id, hcp_number, job_name, customer_name, customer_id, job_address, created_at, bid_id, google_drive_link, job_pictures_link, job_plans_link'

/** Why a job's folder was not placed, in words, and which rule held it. */
export interface FolderHold {
  why: string
  kind: 'outside_drive' | 'not_a_folder' | 'cannot_open' | 'customer_outside_drive' | 'customer_not_a_folder' | 'customer_cannot_open'
}

/** Where a folder came from, as the press has always answered; `later` is a folder inside left for the sweeps (as-needed). */
export type Source = 'kept' | 'bid' | 'found' | 'made' | 'later'

export interface FolderOut {
  url: string
  source: Source
  /** Whether the app can put a file there: false for a kept link it cannot open, write in or that sits in a My Drive; null for a link that is not a folder. */
  writable: boolean | null
}

/** What the tree did with a job's folder this time. */
export type PlaceAct = 'made' | 'moved' | 'renamed' | 'move_rename' | 'in_place'

export interface PlacedJob {
  folder: { url: string; source: Source }
  act: PlaceAct
  /** *Jobs › Oak Hollow LLC › 972 · Oak Hollow Bldg C*, the folder's place in the tree. */
  path: string
  customerFolder: { name: string; url: string } | null
  pictures: FolderOut
  plans: FolderOut
  teamUrl: string
  photosUrl: string
  sentUrl: string
  /** The `jobs_ledger` columns written. */
  stamped: string[]
  hold: FolderHold | null
}

/** A folder as Drive showed it, or that it did not show. */
type Seen = { ok: true; folder: SeenFolder; canAddChildren: boolean } | { ok: false; status: number; reason: string | null; notFolder?: boolean }

async function seeFolder(token: string, id: string): Promise<Seen> {
  const { status, body } = await driveFolderMeta(token, id)
  if (status === 403 || status === 404) return { ok: false, status, reason: body.error?.message ?? null }
  if (status < 200 || status >= 300) throw new Error(`Drive answered ${status} when the app looked at a folder.`)
  if (body.mimeType !== FOLDER_MIME) return { ok: false, status, reason: null, notFolder: true }
  return {
    ok: true,
    folder: { id, name: body.name ?? '', parentId: body.parents?.[0] ?? null, inDrive: Boolean(body.driveId), owner: metaOwner(body) },
    canAddChildren: body.capabilities?.canAddChildren === true,
  }
}

async function drivePatch(token: string, id: string, query: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${DRIVE}/files/${encodeURIComponent(id)}?supportsAllDrives=true&fields=id${query}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(`Drive answered ${res.status} when the app placed a folder: ${b.error?.message ?? 'unknown'}`)
  }
}

/** A folder under a new parent, inside one Shared Drive; its id and every link to it stay. */
export async function moveFolder(token: string, id: string, fromParent: string | null, toParent: string): Promise<void> {
  await drivePatch(token, id, `&addParents=${encodeURIComponent(toParent)}${fromParent ? `&removeParents=${encodeURIComponent(fromParent)}` : ''}`, {})
}

/** A folder under a new name; its id and every link to it stay. */
export async function renameFolder(token: string, id: string, name: string): Promise<void> {
  await drivePatch(token, id, '', { name })
}

/** A folder by its name under a parent, never made; null when there is none. */
async function findFolder(token: string, parentId: string, name: string): Promise<string | null> {
  const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`)
  const found = (await fetch(`${DRIVE}/files?q=${q}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())) as { files?: { id: string }[] }
  return found.files?.[0]?.id ?? null
}

type CustomerFolder = { ok: true; id: string; name: string; url: string; source: 'kept' | 'found' | 'made'; renamed: boolean } | { ok: false; hold: FolderHold }

/** The pieces a job's folder name is built from, as the office's pattern picks them. */
export function jobFacts(job: JobFolderRow) {
  return {
    id: job.id,
    number: job.hcp_number,
    name: job.job_name,
    customer: job.customer_name,
    address: job.job_address,
    year: job.created_at ? todayYmdInAppTz(new Date(job.created_at)).slice(0, 4) : null,
  }
}

/**
 * One run's view of the tree: the root, the settings, and the customer folders already found this run, so a sweep over
 * forty jobs of one customer looks their folder up once.
 */
export class FolderTree {
  private readonly customers = new Map<string, CustomerFolder>()
  private noCustomerId: string | null = null

  constructor(
    private readonly admin: SupabaseClient,
    private readonly token: string,
    private readonly settings: DriveSettings,
    private readonly rootId: string,
    private readonly appEmail: string,
    private readonly rootName = 'Jobs',
  ) {}

  /** The folder for jobs with no customer yet, found or made under the root. */
  private async noCustomerFolder(): Promise<string> {
    if (!this.noCustomerId) this.noCustomerId = (await findOrCreateFolder(this.token, this.rootId, NO_CUSTOMER_FOLDER_NAME)).id
    return this.noCustomerId
  }

  /** A customer's folder: the link it keeps when that is a folder in the Shared Drive, else found or made under the root and written on the customer. */
  async customerFolder(customer: CustomerFolderRow): Promise<CustomerFolder> {
    const cached = this.customers.get(customer.id)
    if (cached) return cached
    const out = await this.placeCustomer(customer)
    this.customers.set(customer.id, out)
    return out
  }

  private async placeCustomer(customer: CustomerFolderRow): Promise<CustomerFolder> {
    const wanted = customerFolderName(customer)
    const keptId = driveFolderIdFromUrl(customer.google_drive_link)
    const keptLink = String(customer.google_drive_link ?? '').trim()
    if (keptLink && !keptId) {
      return { ok: false, hold: { kind: 'customer_not_a_folder', why: 'The customer’s Drive link is not a folder. Fix or clear it on the customer, then the job’s folder is placed.' } }
    }
    if (keptId) {
      if (keptId === this.rootId) return { ok: false, hold: { kind: 'customer_not_a_folder', why: 'The customer’s Drive link points at the jobs root. Clear it on the customer, then the folder is made under Jobs.' } }
      const seen = await seeFolder(this.token, keptId)
      if (!seen.ok) {
        if (seen.notFolder) return { ok: false, hold: { kind: 'customer_not_a_folder', why: 'The customer’s Drive link is not a folder. Fix or clear it on the customer, then the job’s folder is placed.' } }
        return { ok: false, hold: { kind: 'customer_cannot_open', why: `The app cannot open the customer’s folder. Share it with ${this.appEmail} as an editor, or clear the link on the customer.` } }
      }
      if (!seen.folder.inDrive) return { ok: false, hold: { kind: 'customer_outside_drive', why: customerOutsideDriveWords(seen.folder.owner) } }
      // A kept folder under the root follows the customer's name; one the office placed elsewhere in the drive is used as it is.
      let renamed = false
      if (seen.folder.parentId === this.rootId && seen.folder.name !== wanted) {
        await renameFolder(this.token, keptId, wanted)
        renamed = true
      }
      return { ok: true, id: keptId, name: renamed ? wanted : seen.folder.name, url: folderUrl(keptId), source: 'kept', renamed }
    }
    // No link: a folder of the customer's name under the root, unless another customer already holds that one.
    let name = wanted
    let found = await findFolder(this.token, this.rootId, name)
    if (found) {
      const { data } = await this.admin.from('customers').select('id').neq('id', customer.id).ilike('google_drive_link', `%${found}%`).limit(1)
      if ((data ?? []).length > 0) {
        name = customerFolderNameApart(customer)
        found = await findFolder(this.token, this.rootId, name)
      }
    }
    const made = found ? { id: found, created: false } : await findOrCreateFolder(this.token, this.rootId, name)
    const url = folderUrl(made.id)
    await this.admin.from('customers').update({ google_drive_link: url }).eq('id', customer.id).or('google_drive_link.is.null,google_drive_link.eq.')
    return { ok: true, id: made.id, name, url, source: made.created ? 'made' : 'found', renamed: false }
  }

  /** The customer a job names, read once per run. */
  private readonly customerRows = new Map<string, CustomerFolderRow | null>()
  private async customerOf(job: JobFolderRow): Promise<CustomerFolderRow | null> {
    if (!job.customer_id) return null
    if (this.customerRows.has(job.customer_id)) return this.customerRows.get(job.customer_id) ?? null
    const { data } = await this.admin.from('customers').select('id, name, google_drive_link').eq('id', job.customer_id).maybeSingle()
    const row = (data as CustomerFolderRow | null) ?? null
    this.customerRows.set(job.customer_id, row)
    return row
  }

  /** A link the job keeps, with whether the app can put a file there. */
  private async keptLink(url: string): Promise<FolderOut> {
    const id = driveFolderIdFromUrl(url)
    if (!id) return { url, source: 'kept', writable: null }
    const seen = await seeFolder(this.token, id)
    return { url, source: 'kept', writable: seen.ok ? seen.canAddChildren && seen.folder.inDrive : false }
  }

  /**
   * One job through the rule: its customer's folder, then its own folder kept, found, made, moved or renamed under it,
   * then the five inside as the office chose; the links and the stamps written on the row. A hold is written on the row
   * too (`drive_folder_hold`), so the office reads why without running anything.
   */
  async placeJob(job: JobFolderRow): Promise<PlacedJob> {
    const pattern = this.settings.jobPattern
    const wantedName = folderName(pattern, jobFacts(job))
    const customer = await this.customerOf(job)
    const cf = customer ? await this.customerFolder(customer) : null
    const parentId = cf ? (cf.ok ? cf.id : null) : await this.noCustomerFolder()
    const parentName = cf ? (cf.ok ? cf.name : null) : NO_CUSTOMER_FOLDER_NAME
    const customerFolder = cf && cf.ok ? { name: cf.name, url: cf.url } : null
    const hold = async (h: FolderHold, folder: { url: string; source: Source } | null): Promise<PlacedJob> => {
      await this.admin.from('jobs_ledger').update({ drive_folder_hold: h.why, drive_folder_tidied_at: new Date().toISOString() }).eq('id', job.id)
      const none: FolderOut = { url: '', source: 'later', writable: null }
      return { folder: folder ?? { url: '', source: 'kept' }, act: 'in_place', path: '', customerFolder, pictures: none, plans: none, teamUrl: '', photosUrl: '', sentUrl: '', stamped: ['drive_folder_hold'], hold: h }
    }
    if (cf && !cf.ok) return hold(cf.hold, null)

    // --- the job's own folder: kept, its bid's, found under its customer or the root, or made ---
    let folderId: string | null = null
    let source: Source = 'made'
    let act: PlaceAct = 'in_place'
    const ownLink = String(job.google_drive_link ?? '').trim()
    let keptId = driveFolderIdFromUrl(ownLink)
    if (ownLink && !keptId) {
      return hold({ kind: 'not_a_folder', why: 'This job’s Drive link is not a folder. Fix the link on the Edit tab, then the folder is placed.' }, { url: ownLink, source: 'kept' })
    }
    if (!keptId && job.bid_id) {
      const { data: bid } = await this.admin.from('bids').select('drive_link').eq('id', job.bid_id).maybeSingle()
      keptId = driveFolderIdFromUrl((bid as { drive_link?: string | null } | null)?.drive_link ?? null)
      if (keptId) source = 'bid'
    }
    if (keptId) {
      // A link at the root or at the customer's folder is not a job folder: never move or rename those.
      if (keptId === this.rootId || keptId === parentId) {
        return hold({ kind: 'not_a_folder', why: 'This job’s Drive link points at the jobs root or the customer’s folder, not a job folder. Clear it on the Edit tab, then the folder is placed.' }, { url: folderUrl(keptId), source: 'kept' })
      }
      const seen = await seeFolder(this.token, keptId)
      if (!seen.ok) {
        if (seen.notFolder) return hold({ kind: 'not_a_folder', why: 'This job’s Drive link is not a folder. Fix the link on the Edit tab, then the folder is placed.' }, { url: folderUrl(keptId), source: 'kept' })
        return hold({ kind: 'cannot_open', why: `The app cannot open this job’s folder. Share it with ${this.appEmail} as an editor, or clear the link on the Edit tab.` }, { url: folderUrl(keptId), source: 'kept' })
      }
      const place = placeFolder(seen.folder, { parentId: parentId!, name: wantedName })
      if (place.act === 'hold') return hold({ kind: 'outside_drive', why: place.why }, { url: folderUrl(keptId), source: source === 'bid' ? 'bid' : 'kept' })
      if (place.act === 'move' || place.act === 'move_rename') await moveFolder(this.token, keptId, seen.folder.parentId, parentId!)
      if (place.act === 'rename' || place.act === 'move_rename') await renameFolder(this.token, keptId, wantedName)
      act = place.act === 'in_place' ? 'in_place' : place.act === 'move' ? 'moved' : place.act === 'rename' ? 'renamed' : 'move_rename'
      folderId = keptId
      if (source !== 'bid') source = 'kept'
    } else {
      // A folder of the job's name already under its customer, or a flat one under the root from before the tree.
      const underCustomer = await findFolder(this.token, parentId!, wantedName)
      if (underCustomer) {
        folderId = underCustomer
        source = 'found'
      } else {
        const flat = await findFolder(this.token, this.rootId, wantedName)
        if (flat) {
          await moveFolder(this.token, flat, this.rootId, parentId!)
          folderId = flat
          source = 'found'
          act = 'moved'
        } else {
          folderId = (await findOrCreateFolder(this.token, parentId!, wantedName)).id
          source = 'made'
          act = 'made'
        }
      }
    }
    const path = folderPathWords([this.rootName, parentName, wantedName])

    // --- the folders inside: all five, or the job's folder alone until something lands (as-needed) ---
    const picturesLink = String(job.job_pictures_link ?? '').trim()
    const plansLink = String(job.job_plans_link ?? '').trim()
    const now = new Date().toISOString()
    const patch: Record<string, string | null> = { drive_folder_hold: null, drive_folder_tidied_at: now }
    if (folderUrl(folderId) !== ownLink) patch.google_drive_link = folderUrl(folderId)
    const stampedOf = () => Object.keys(patch).filter((k) => k !== 'drive_folder_hold' && k !== 'drive_folder_tidied_at')
    if (this.settings.foldersMade === 'as-needed' && source !== 'kept') {
      const { error } = await this.admin.from('jobs_ledger').update(patch).eq('id', job.id)
      if (error) throw new Error(`The folder was placed but not recorded on the job: ${error.message}`)
      const later: FolderOut = { url: '', source: 'later', writable: null }
      return {
        folder: { url: folderUrl(folderId), source },
        act,
        path,
        customerFolder,
        pictures: picturesLink ? await this.keptLink(picturesLink) : later,
        plans: plansLink ? await this.keptLink(plansLink) : later,
        teamUrl: '',
        photosUrl: '',
        sentUrl: '',
        stamped: stampedOf(),
        hold: null,
      }
    }
    const pictures = await findOrCreateFolder(this.token, folderId, JOB_FOLDER_TREE.pictures)
    const plans = await findOrCreateFolder(this.token, folderId, JOB_FOLDER_TREE.plans)
    const team = await findOrCreateFolder(this.token, folderId, JOB_FOLDER_TREE.teamOnly)
    const photos = await findOrCreateFolder(this.token, team.id, JOB_FOLDER_TREE.photos)
    const sent = await findOrCreateFolder(this.token, team.id, JOB_FOLDER_TREE.sentByUs)
    const madeOrFound = (f: { id: string; created: boolean }): FolderOut => ({ url: folderUrl(f.id), source: f.created ? 'made' : 'found', writable: true })
    const picturesOut = picturesLink ? await this.keptLink(picturesLink) : madeOrFound(pictures)
    const plansOut = plansLink ? await this.keptLink(plansLink) : madeOrFound(plans)
    if (!picturesLink) patch.job_pictures_link = picturesOut.url
    if (!plansLink) patch.job_plans_link = plansOut.url
    const { error } = await this.admin.from('jobs_ledger').update(patch).eq('id', job.id)
    if (error) throw new Error(`The folders were placed but not recorded on the job: ${error.message}`)
    return {
      folder: { url: folderUrl(folderId), source },
      act,
      path,
      customerFolder,
      pictures: picturesOut,
      plans: plansOut,
      teamUrl: folderUrl(team.id),
      photosUrl: folderUrl(photos.id),
      sentUrl: folderUrl(sent.id),
      stamped: stampedOf(),
      hold: null,
    }
  }
}
