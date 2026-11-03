/**
 * Plan set files (punch list #239, PR 5): the rules of the `plan-set-files` function with everything outside it passed
 * in, so a fake drives every refusal and every order of events. Who may file into a set, what is checked before
 * anything is made, which job's Plans folder holds the set, how two sets of one name keep two folders, and what a
 * second try of a mail's file does. `plan-set-files/index.ts` wires it to Supabase and Drive. No imports, so
 * `src/lib/plans/planSetFilesRun.test.ts` imports it as the function does.
 */

/** A file from the phone or this computer comes in as base64, up to this. */
export const PLAN_SET_PUT_MAX_BYTES = 10 * 1024 * 1024

const OVER_THE_CAP = 'Over 10 MB. Put it in the set’s folder in Drive instead.'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FOLDER_NAME_MAX = 120
const FILE_NAME_MAX = 200
/** Sets of one name, or files of one name in a folder, past which the run stops looking for a free one. */
const NAME_TRIES = 20

export type PlanSetFilesAsk =
  | { action: 'folder'; setId: string }
  | { action: 'put'; setId: string; name: string; mime: string; base64: string }
  | { action: 'save_attachment'; setId: string; attachmentId: string }

/** A cut that lands on a whole character: half an emoji would make Drive's query throw. */
const wholeChars = (s: string, max: number): string => Array.from(s).slice(0, max).join('')

export function parsePlanSetFilesAsk(body: Record<string, unknown> | null): PlanSetFilesAsk | null {
  if (!body) return null
  const setId = typeof body.set_id === 'string' && UUID.test(body.set_id) ? body.set_id : null
  if (!setId) return null
  if (body.action === 'folder') return { action: 'folder', setId }
  if (body.action === 'put') {
    const name = typeof body.name === 'string' ? wholeChars(body.name.trim(), FILE_NAME_MAX) : ''
    const mime = typeof body.mime === 'string' && body.mime.trim() ? body.mime.trim().slice(0, 120) : 'application/octet-stream'
    const base64 = typeof body.base64 === 'string' ? body.base64 : ''
    return name ? { action: 'put', setId, name, mime, base64 } : null
  }
  if (body.action === 'save_attachment') {
    const attachmentId = typeof body.attachment_id === 'string' && UUID.test(body.attachment_id) ? body.attachment_id : null
    return attachmentId ? { action: 'save_attachment', setId, attachmentId } : null
  }
  return null
}

/** Drive takes most characters in a name; a slash would read as a path, so it becomes a dash. */
export function planSetFolderName(name: string): string {
  const clean = name.replace(/[/\\]/g, '-').replace(/\s+/g, ' ').trim()
  return wholeChars(clean || 'Set', FOLDER_NAME_MAX).trim()
}

/** The folder a set of this name takes when the earlier ones are held: *Addendum*, *Addendum · 2*, *Addendum · 3*. */
export function planSetFolderNameAt(base: string, n: number): string {
  return n <= 1 ? base : `${base} · ${n}`
}

/** The file name when the earlier ones are taken: *plan.pdf*, *plan (2).pdf*. */
export function planSetFileNameAt(name: string, n: number): string {
  if (n <= 1) return name
  const dot = name.lastIndexOf('.')
  return dot > 0 ? `${name.slice(0, dot)} (${n})${name.slice(dot)}` : `${name} (${n})`
}

export type PlanSetFileRow = { id: string; part_id: string; name: string; kind: string; link: string; job_id: string | null; created_by: string | null }
export type MailAttachmentRow = { id: string; kind: string; name: string; mime: string | null; bucket_path: string | null; jobs_ledger_id: string | null }
export type PlanSetFilesReply = { status: number; body: Record<string, unknown> }

export type PlanSetFilesDrive = {
  /** The job's Plans folder, made as needed. */
  plansFolder(jobFolderId: string): Promise<string>
  isChildOf(folderId: string, parentId: string): Promise<boolean>
  findOrCreateFolder(parentId: string, name: string): Promise<{ id: string; created: boolean }>
  /** The files of exactly this name in the folder, with their sizes (a Google file has none). */
  filesNamed(folderId: string, name: string): Promise<Array<{ id: string; size: number | null }>>
  upload(folderId: string, bytes: Uint8Array, name: string, mime: string): Promise<{ id: string }>
}

/** Every read throws when it fails: a database blip must never read as *no Drive folder* or *not one we kept*. */
export type PlanSetFilesDeps = {
  // Through the caller's client, so RLS decides.
  readSet(setId: string): Promise<PlanSetFileRow | null>
  readAttachment(attachmentId: string): Promise<MailAttachmentRow | null>
  canWritePart(partId: string): Promise<boolean>
  // As the service role.
  readMe(): Promise<{ read_only?: boolean | null; is_digital_twin?: boolean | null } | null>
  isOnJobTeam(jobId: string): Promise<boolean>
  partOfJob(jobId: string): Promise<string | null>
  ownerJobOfPart(partId: string): Promise<string | null>
  /** Oldest first. */
  jobsOnPart(partId: string): Promise<Array<{ id: string; google_drive_link: string | null }>>
  jobFolderOf(jobId: string): Promise<{ google_drive_link: string | null; drive_folder_hold: string | null } | null>
  /** Whether another set's link points at this folder. */
  otherSetHolds(folderId: string, setId: string): Promise<boolean>
  /** Writes the link onto a set that has none; the database's own trigger mirrors it to the job. */
  stampLink(setId: string, url: string): Promise<void>
  /** Our copy of a mail's file, or null when it does not read. */
  download(bucketPath: string): Promise<Uint8Array | null>
  decodeBase64(base64: string): Uint8Array | null
  folderIdFromUrl(url: string | null): string | null
  folderUrl(folderId: string): string
  fileUrl(fileId: string, mime: string | null): string
  /** Null when Drive is not set up here. */
  drive(): Promise<PlanSetFilesDrive | null>
}

const refuse = (status: number, error: string, why?: string): PlanSetFilesReply => ({ status, body: why ? { error, why } : { error } })
const answer = (body: Record<string, unknown>): PlanSetFilesReply => ({ status: 200, body })

/** The job whose Plans folder holds the set: the job that made it, else the job that owns the part, else the oldest job on the part with a Drive folder, else the oldest. */
async function jobForSet(set: PlanSetFileRow, deps: PlanSetFilesDeps): Promise<string | null> {
  if (set.job_id) return set.job_id
  const owner = await deps.ownerJobOfPart(set.part_id)
  if (owner) return owner
  const jobs = await deps.jobsOnPart(set.part_id)
  return (jobs.find((j) => deps.folderIdFromUrl(j.google_drive_link)) ?? jobs[0])?.id ?? null
}

type SetFolder = { id: string; url: string; made: boolean }

/**
 * The set's folder, made as needed: Plans › <set name>. A set whose link already points inside that Plans folder keeps
 * it. Names are not unique, so a folder of this name another set's link points at belongs to that set, and this one
 * takes the next name. A set with no link takes the folder's link; a failed stamp is an error, and the next try finds
 * the folder by its name and stamps again.
 */
async function setFolder(set: PlanSetFileRow, jobFolderId: string, drive: PlanSetFilesDrive, deps: PlanSetFilesDeps): Promise<SetFolder> {
  const plansId = await drive.plansFolder(jobFolderId)
  const linked = deps.folderIdFromUrl(set.link || null)
  if (linked && (await drive.isChildOf(linked, plansId))) return { id: linked, url: deps.folderUrl(linked), made: false }
  const base = planSetFolderName(set.name)
  for (let n = 1; n <= NAME_TRIES; n += 1) {
    const found = await drive.findOrCreateFolder(plansId, planSetFolderNameAt(base, n))
    if (!found.created && (await deps.otherSetHolds(found.id, set.id))) continue
    const url = deps.folderUrl(found.id)
    if (!set.link) await deps.stampLink(set.id, url)
    return { id: found.id, url, made: found.created }
  }
  throw new Error('Too many sets of that name hold a folder under Plans. Rename this one and try again.')
}

/** The first name the folder does not hold yet. Drive would take a second file of one name; a person reading the folder could not tell them apart. */
async function freeFileName(drive: PlanSetFilesDrive, folderId: string, name: string): Promise<string> {
  for (let n = 1; n <= NAME_TRIES; n += 1) {
    const candidate = planSetFileNameAt(name, n)
    if ((await drive.filesNamed(folderId, candidate)).length === 0) return candidate
  }
  return name
}

export async function runPlanSetFiles(ask: PlanSetFilesAsk, callerId: string, deps: PlanSetFilesDeps): Promise<PlanSetFilesReply> {
  const set = await deps.readSet(ask.setId)
  if (!set) return refuse(404, 'That set is not one you can see.')

  const me = await deps.readMe()
  if (!me) return refuse(403, 'Your account did not read, so nothing changed.')
  if (me.is_digital_twin) return refuse(403, 'A digital twin cannot change Drive.')
  if (me.read_only) return refuse(403, 'A training account cannot change Drive.')

  if (!(await deps.canWritePart(set.part_id))) {
    if (set.created_by !== callerId) return refuse(403, 'Only the office, or whoever added the set, files into it.')
    // An author's update policy leaves the row's job open, so the row's word is not enough: they file only under a job
    // they are on, whose part is the set's, as the insert policy held them to when the row was made.
    const onTheirJob = set.job_id !== null && (await deps.partOfJob(set.job_id)) === set.part_id && (await deps.isOnJobTeam(set.job_id))
    if (!onTheirJob) return refuse(403, 'You file only into a set on a job you are on.')
  }

  const jobId = await jobForSet(set, deps)
  if (!jobId) return refuse(409, 'No job names this part yet, so there is no job folder to file into. Paste the set’s Drive link by hand, or add the set on a job.', 'no_job')

  // Everything the ask carries is checked before anything is made: a refused file leaves no empty folder behind, and
  // no set linked to one.
  let putBytes: Uint8Array | null = null
  let mail: MailAttachmentRow | null = null
  let mailPath: string | null = null
  if (ask.action === 'put') {
    if (ask.base64.length > Math.ceil((PLAN_SET_PUT_MAX_BYTES * 4) / 3) + 200) return refuse(413, OVER_THE_CAP)
    putBytes = deps.decodeBase64(ask.base64)
    if (!putBytes || putBytes.length === 0) return refuse(400, 'That file did not come through.')
    if (putBytes.length > PLAN_SET_PUT_MAX_BYTES) return refuse(413, OVER_THE_CAP)
  } else if (ask.action === 'save_attachment') {
    // Read as the caller: the mail's files are the office's, and an author of a set is not always the office.
    mail = await deps.readAttachment(ask.attachmentId)
    if (!mail || mail.kind !== 'file') return refuse(404, 'That file is not one we kept.')
    mailPath = mail.bucket_path
    if (!mailPath) return refuse(409, 'That file stayed in Gmail, so we hold no copy of it to file.')
    const onThePart = mail.jobs_ledger_id !== null && (mail.jobs_ledger_id === jobId || (await deps.partOfJob(mail.jobs_ledger_id)) === set.part_id)
    if (!onThePart) return refuse(409, 'That mail is not tagged to a job on this set’s part.')
  }

  const job = await deps.jobFolderOf(jobId)
  const jobFolderId = deps.folderIdFromUrl(job?.google_drive_link ?? null)
  if (!jobFolderId) {
    return refuse(409, job?.drive_folder_hold ? `The job’s Drive folder is held: ${job.drive_folder_hold}` : 'That job has no Drive folder yet. The Documents tab says when the sweep makes one. Then try again.', 'no_folder')
  }
  const drive = await deps.drive()
  if (!drive) return refuse(503, 'Drive is not set up here yet.')

  const mailBytes = mailPath ? await deps.download(mailPath) : null
  if (mailPath && !mailBytes) return refuse(500, 'Our copy of that file did not read.')

  const folder = await setFolder(set, jobFolderId, drive, deps)
  if (ask.action === 'folder') return answer({ folderId: folder.id, url: folder.url, made: folder.made })

  if (ask.action === 'put') {
    const name = await freeFileName(drive, folder.id, ask.name)
    const put = await drive.upload(folder.id, putBytes!, name, ask.mime)
    return answer({ driveFileId: put.id, url: deps.fileUrl(put.id, ask.mime), folderUrl: folder.url })
  }

  // A second try of a file that landed before its answer got back finds it again. A mail may carry two files of one
  // name, so the size has to match too. `drive_file_id` stays as it is: the photo sweep reads it as filed, and a photo
  // copied to a paper still belongs in the job's pictures.
  const mime = mail!.mime || 'application/octet-stream'
  const same = (await drive.filesNamed(folder.id, mail!.name)).find((f) => f.size === mailBytes!.length)
  if (same) return answer({ driveFileId: same.id, url: deps.fileUrl(same.id, mime), folderUrl: folder.url, reused: true })
  const name = await freeFileName(drive, folder.id, mail!.name)
  const put = await drive.upload(folder.id, mailBytes!, name, mime)
  return answer({ driveFileId: put.id, url: deps.fileUrl(put.id, mime), folderUrl: folder.url })
}
