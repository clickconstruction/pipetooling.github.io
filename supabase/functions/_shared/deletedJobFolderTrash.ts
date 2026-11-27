/**
 * A deleted ZZ test job's Drive folder to Drive's trash (punch list #443, row 18): the rule, pure.
 *
 * Making a job makes a folder tree in the company's Shared Drive (`jobFolders.ts`), and deleting the job left every
 * folder: two ZZ Test jobs a walk made and deleted on 2026-11-26 left theirs for a person to remove by hand. The
 * `job-drive-folders` function carries one more body, `{ trash: { job_id } }`, called after the delete. This file is
 * what it decides; the function reads the facts and does the one write. Pure: no Deno, no DOM, no fetch, so the
 * app's tests read it (`src/lib/jobs/deletedJobFolderTrash.test.ts`).
 *
 * The rules, each a refusal with its reason:
 *
 * - **A dev alone.** No other role, whatever the job.
 * - **A deleted job alone.** The job must be gone, and Deleted records must keep its copy: the function reads the
 *   job's name, its customer's name and its Drive link from that copy, never from the caller. A job that still
 *   stands keeps its folder.
 * - **A ZZ-named job alone**, by the app's one rule (`isZzTestJob`): its own name or its customer's starts with ZZ.
 * - **The job's own folder alone.** Never the jobs root, never a folder straight under the root (a customer's, or
 *   *No customer yet*), never a folder outside the Shared Drive, never one that sits anywhere but under a folder of
 *   the root. The customer's folder stays, empty or not: the customer may still be there, and its link names it.
 * - **Nothing still keeps it.** A job made from a bid takes the bid's own folder. A folder a live bid, another live
 *   job or a customer still names stays.
 * - **Nothing a person added.** A file last changed by anyone but the app's own account was put there by hand, or
 *   changed by hand. The folder stays and the answer counts them. A folder too large to read whole stays too.
 * - **The trash, never a delete.** The one write sets `trashed`. Drive keeps a Shared Drive's trash for 30 days and
 *   a manager of the drive can put the folder back.
 *
 * Three answers are not refusals, because nothing is left to do: the job kept no folder, the folder is already in
 * the trash, or the folder is already gone. So a second press on the same job says so and writes nothing.
 */
import { isZzTestJob } from './zzTestJob.ts'

/** The one role that may ask. */
export const JOB_FOLDER_TRASH_ROLE = 'dev'

/** How many folders deep and wide the look inside goes before it gives up: a job's tree is its folder and five more. */
export const TRASH_LOOK_MAX_FOLDERS = 60
/** How many things the look inside counts before it gives up. */
export const TRASH_LOOK_MAX_ITEMS = 2000

/** A refusal: the HTTP status, the `why` the page reads, and the words. */
export interface TrashRefusal {
  status: number
  why: string
  words: string
}

/** Nothing to do, said: the answer is a success and nothing was written. */
export interface TrashNothing {
  act: 'none' | 'already' | 'gone'
  words: string
}

const refuse = (status: number, why: string, words: string): TrashRefusal => ({ status, why, words })

/** Why this caller may not ask; null for a dev. */
export function trashCallerRefusal(role: string | null | undefined): TrashRefusal | null {
  return role === JOB_FOLDER_TRASH_ROLE ? null : refuse(403, 'dev_only', 'Only a developer moves a test job’s folder to the trash.')
}

/** The deleted job, as Deleted records kept it: the columns the rule reads. */
export interface DeletedJobFacts {
  job_name: string | null
  customer_name: string | null
  google_drive_link: string | null
}

/** The columns of a kept row the rule reads; anything else in the copy is left alone. */
export function deletedJobFacts(row: unknown): DeletedJobFacts | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const text = (v: unknown): string | null => (typeof v === 'string' ? v : null)
  return { job_name: text(r.job_name), customer_name: text(r.customer_name), google_drive_link: text(r.google_drive_link) }
}

/**
 * Whether this job's folder may be looked for at all. `stands` is true when a job with that id is still there;
 * `deleted` is the newest copy Deleted records keeps, null when it keeps none.
 */
export function trashJobRefusal(stands: boolean, deleted: DeletedJobFacts | null): TrashRefusal | null {
  if (stands) return refuse(409, 'job_stands', 'This job is still here. Delete the job first. Its Drive folder then goes to the trash.')
  if (!deleted) return refuse(404, 'no_deleted_job', 'Deleted records keeps no copy of that job, so its folder cannot be found. Nothing went to the trash.')
  if (!isZzTestJob(deleted)) return refuse(403, 'not_a_test_job', 'Only a ZZ test job’s folder goes to the trash this way. This job was not named ZZ.')
  return null
}

/** The job kept no link, or a link that is no folder's: nothing to move. Null when `folderId` is a folder's id. */
export function trashLinkNothing(link: string | null | undefined, folderId: string | null): TrashNothing | null {
  if (folderId) return null
  if (!String(link ?? '').trim()) return { act: 'none', words: 'This job had no Drive folder on record. Nothing went to the trash.' }
  return { act: 'none', words: 'This job’s Drive link was not a folder’s. Nothing went to the trash.' }
}

/** The folder as Drive showed it to the app's account. */
export type TrashFolderSeen =
  /** Drive answered 404 or 403: deleted for good, or the app can no longer open it. */
  | { kind: 'gone' }
  /** The id is a file's. */
  | { kind: 'not_a_folder' }
  | {
      kind: 'folder'
      id: string
      name: string
      /** The folder it sits in; null at the top of a drive. */
      parentId: string | null
      /** The folder its parent sits in; null when the parent is at the top of a drive or cannot be read. */
      grandparentId: string | null
      /** In a Shared Drive, where the drive owns the files. */
      inDrive: boolean
      trashed: boolean
      /** Drive's own word on whether this account may trash it. */
      canTrash: boolean
    }

/** What stands in the way of the folder itself: a refusal, an answer that nothing is left to do, or null to go on. */
export function trashFolderVerdict(seen: TrashFolderSeen, rootId: string, appEmail: string): TrashRefusal | TrashNothing | null {
  if (seen.kind === 'gone') return { act: 'gone', words: 'Its Drive folder is already gone, or the app can no longer open it. Nothing went to the trash.' }
  if (seen.kind === 'not_a_folder') return { act: 'none', words: 'This job’s Drive link was not a folder’s. Nothing went to the trash.' }
  if (seen.trashed) return { act: 'already', words: 'Its Drive folder is already in Drive’s trash.' }
  if (seen.id === rootId || seen.parentId === rootId) {
    return refuse(409, 'not_a_job_folder', 'The link pointed at the jobs root or a customer’s folder, not a job’s folder. It stays.')
  }
  if (!seen.inDrive) return refuse(409, 'outside_drive', 'The folder is in a My Drive, not the app’s Shared Drive. It stays for its owner.')
  if (!seen.parentId || seen.grandparentId !== rootId) {
    return refuse(409, 'outside_tree', 'The folder is not under a customer’s folder in the jobs root. It stays.')
  }
  if (!seen.canTrash) {
    return refuse(409, 'cannot_trash', `Drive does not let the app move this folder to the trash. Make ${appEmail || 'the app’s account'} a content manager of the Shared Drive.`)
  }
  return null
}

/** How many live records still name the folder. */
export interface TrashHolders {
  jobs: number
  bids: number
  customers: number
}

const counted = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** Why the folder stays when a live record still names it; null when none does. */
export function trashHoldersRefusal(holders: TrashHolders): TrashRefusal | null {
  const parts = [
    holders.bids > 0 ? counted(holders.bids, 'bid', 'bids') : '',
    holders.jobs > 0 ? counted(holders.jobs, 'job', 'jobs') : '',
    holders.customers > 0 ? counted(holders.customers, 'customer', 'customers') : '',
  ].filter(Boolean)
  if (parts.length === 0) return null
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  const total = holders.bids + holders.jobs + holders.customers
  return refuse(409, 'in_use', `${list} still ${total === 1 ? 'keeps' : 'keep'} this folder. It stays.`)
}

/** One thing inside the folder, as Drive lists it. */
export interface TrashInsideItem {
  isFolder: boolean
  /** Drive's `lastModifyingUser.me`: the account asking made the last change. */
  byMe: boolean | null
  /** Drive's `lastModifyingUser.emailAddress`, when Drive shows it. */
  byEmail: string | null
}

/**
 * Whether the app's own account made the last change to a thing. Drive says so itself (`me`), or names the account.
 * When Drive says neither, nobody knows, and the thing counts as a person's.
 */
export function madeByTheApp(item: Pick<TrashInsideItem, 'byMe' | 'byEmail'>, appEmail: string): boolean {
  if (item.byMe === true) return true
  const app = appEmail.trim().toLowerCase()
  return Boolean(app) && String(item.byEmail ?? '').trim().toLowerCase() === app
}

/** What the look inside found. */
export interface TrashInside {
  folders: number
  files: number
  /** Files last changed by anyone but the app's account. Folders are not counted: an empty folder holds nothing. */
  byPeople: number
  /** The look gave up before it read everything. */
  cut: boolean
}

/** The count of what a list of things holds. */
export function countInside(items: ReadonlyArray<TrashInsideItem>, appEmail: string, cut = false): TrashInside {
  let folders = 0
  let files = 0
  let byPeople = 0
  for (const item of items) {
    if (item.isFolder) folders += 1
    else {
      files += 1
      if (!madeByTheApp(item, appEmail)) byPeople += 1
    }
  }
  return { folders, files, byPeople, cut }
}

/** One thing as a listing hands it over: what it is, who changed it last, and its id for the look into a folder. */
export interface TrashListedItem extends TrashInsideItem {
  id: string
}

/** One page of what a folder holds: the function's Drive read, or a test's. `next` is '' on the last page. */
export type TrashLister = (parentId: string, pageToken: string) => Promise<{ items: TrashListedItem[]; next: string }>

/**
 * Everything the folder holds, folder by folder, counted. It gives up, and says so with `cut`, past
 * `TRASH_LOOK_MAX_FOLDERS` folders read or `TRASH_LOOK_MAX_ITEMS` things counted: a folder that large is no test
 * job's tree, and it stays. A listing that throws is thrown on, so nothing is trashed on half a look.
 */
export async function lookInsideFolder(
  list: TrashLister,
  folderId: string,
  appEmail: string,
  caps: { folders: number; items: number } = { folders: TRASH_LOOK_MAX_FOLDERS, items: TRASH_LOOK_MAX_ITEMS },
): Promise<TrashInside> {
  const items: TrashInsideItem[] = []
  const queue: string[] = [folderId]
  let read = 0
  let cut = false
  while (queue.length > 0 && !cut) {
    if (read >= caps.folders) {
      cut = true
      break
    }
    const parent = queue.shift() as string
    read += 1
    let token = ''
    do {
      const page = await list(parent, token)
      for (const item of page.items) {
        items.push(item)
        if (item.isFolder) queue.push(item.id)
      }
      token = page.next
      if (items.length > caps.items) {
        cut = true
        break
      }
    } while (token)
  }
  return countInside(items, appEmail, cut)
}

/** Why the folder stays for what it holds; null when everything inside is the app's own. */
export function trashInsideRefusal(inside: TrashInside): TrashRefusal | null {
  if (inside.byPeople > 0) {
    return refuse(409, 'holds_a_persons_files', `A person added or changed ${counted(inside.byPeople, 'file', 'files')} in this folder by hand. It stays. Move them out, or trash it in Drive.`)
  }
  if (inside.cut) return refuse(409, 'too_much_to_check', 'The folder holds more than the app reads in one go. It stays. Trash it in Drive by hand.')
  return null
}

/**
 * The note written on the folder as it goes, as `drive-link` writes one on a file it trashes: whoever finds the
 * folder in Drive's trash reads why it is there and which job it was. No person's name.
 */
export function trashNoteWords(jobId: string, ymd: string): string {
  return `Moved to the trash by PipeTooling on ${ymd}, when a developer deleted its ZZ test job. Job id ${jobId}.`
}

/** What the answer says once the folder is in the trash. */
export function trashedWords(inside: Pick<TrashInside, 'folders' | 'files'>): string {
  const held = [inside.folders > 0 ? counted(inside.folders, 'folder', 'folders') : '', inside.files > 0 ? counted(inside.files, 'file', 'files') : ''].filter(Boolean).join(' and ')
  return `Its Drive folder went to Drive’s trash${held ? `, with the ${held} inside` : ''}. A manager of the Shared Drive can restore it for 30 days.`
}
