/**
 * Box photos: the Drive files follow a job that moved (punch list #297, v2.6885). A box photo's row moves with its box
 * when a job's Materials on site are moved to another job (`dev_on_site_move_job`, v2.6808) or carried by a whole-job
 * combine (v2.6423), but the file the photo sweep already filed stays in the first job's Drive photo folder. The photo
 * still opens from its box, since a row names its file by its own Drive id; what is off is the folders. `photo-save`
 * takes one ask, `{ refile_box_photos: <job_id> }`, from a dev or the cron, and moves each filed photo of that job into
 * the folder the job's photos land in. This is the pure half: the ask, what one file needs, the name it takes, the
 * reply and its words, and what the dev seat says after `apply_materials_move`. No imports, so the app's tests read
 * it as the function does.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The engine (v2.6915): the database marks a filed photo due a move the moment its job changes
 * (`job_box_photos.refile_due_at`, trigger `job_box_photos_job_changed`), and the photo sweep, which already runs every
 * five minutes while anything waits, moves what is due. So a whole-job combine's files follow with no caller, an ask
 * that failed or was cut short is finished by the sweep, and a held file is tried again a day later.
 */

/** How many due photos one run of the sweep takes, as its other sources take twenty. */
export const REFILE_SWEEP_BATCH = 20

/** How long a held file waits before the sweep tries it again: a day, so a file restored from Drive's trash follows by itself. */
export const REFILE_RETRY_MS = 24 * 60 * 60 * 1000

/**
 * What a row keeps after a try. A file that is where it belongs (moved now, or there already) carries no mark and no
 * reason. A held one is due again a day on, with its reason, as a failed filing keeps its reason in `fail_why`.
 */
export function refileRowPatch(outcome: { settled: true } | { held: string }, now: Date): { refile_due_at: string | null; fail_why: string | null } {
  if ('settled' in outcome) return { refile_due_at: null, fail_why: null }
  return { refile_due_at: new Date(now.getTime() + REFILE_RETRY_MS).toISOString(), fail_why: outcome.held.slice(0, 300) }
}

/** Whether a row has anything for a settled try to clear: a write is made only for a row that carries a mark or a reason. */
export function refileRowNeedsClearing(row: { refile_due_at?: string | null; fail_why?: string | null }): boolean {
  return Boolean(row.refile_due_at) || Boolean(row.fail_why)
}

/** The sweep's due rows grouped by their job, in the order they came (oldest due first), so each job's folder is read once. */
export function dueRowsByJob<T extends { job_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const byJob = new Map<string, T[]>()
  for (const r of rows) {
    const list = byJob.get(r.job_id)
    if (list) list.push(r)
    else byJob.set(r.job_id, [r])
  }
  return byJob
}

/**
 * Who may make the ask (v2.6927): the roles that may combine two jobs (`migrate_job_ledger_costs_and_delete`), since the
 * app makes the ask for them right after a combine so the count moves at once. Anyone else leaves it to the sweep.
 */
export const REFILE_ASK_ROLES = ['dev', 'master_technician', 'assistant', 'controller'] as const

export const REFILE_ASK_REFUSAL = 'Moving a job’s box photos to its Drive folder is for the office roles that may combine jobs. The photo sweep moves them by itself within a few minutes.'

export function mayAskRefile(role: string | null | undefined): boolean {
  return (REFILE_ASK_ROLES as readonly string[]).includes(String(role ?? ''))
}

/** How long one ask may spend moving files before it answers what is left; the caller asks again for the rest. */
export const REFILE_BUDGET_MS = 40_000

/** A filed box photo: the row's id, the name it was filed under and its Drive file. */
export interface RefileRow {
  id: string
  file_name: string
  drive_file_id: string
}

/** What Drive says of one file: its name, the folders it sits in, whether it is in the trash. Null when Drive no longer holds it. */
export interface RefileFileState {
  name: string
  parents: readonly string[]
  trashed: boolean
}

/**
 * The ask off a request's body: null when the body asks for the sweep (no `refile_box_photos` key), the job when it
 * names one, or the refusal.
 */
export function refileAskOf(body: unknown): null | { ok: true; jobId: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !('refile_box_photos' in body)) return null
  const raw = (body as { refile_box_photos?: unknown }).refile_box_photos
  const jobId = typeof raw === 'string' ? raw.trim() : ''
  if (!UUID.test(jobId)) return { ok: false, error: 'refile_box_photos is the job whose box photos to move into its photo folder: a jobs_ledger id.' }
  return { ok: true, jobId: jobId.toLowerCase() }
}

/** The name itself, or the next free "(2)", "(3)" when the folder already holds it (any case). */
export function nextFreeName(name: string, taken: ReadonlySet<string>): string {
  const lower = new Set([...taken].map((t) => t.toLowerCase()))
  if (!lower.has(name.toLowerCase())) return name
  const m = /^(.*?)(\.[a-z0-9]{1,5})?$/i.exec(name)
  const stem = m?.[1] ?? name
  const ext = m?.[2] ?? ''
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${ext}`
    if (!lower.has(candidate.toLowerCase())) return candidate
  }
}

export const REFILE_GONE_WORDS = 'Drive no longer holds that file.'
export const REFILE_TRASHED_WORDS = 'That file is in Drive’s trash. Restore it there, then ask again.'

/** What one file needs: nothing (it is in the folder), a move (out of every folder it sits in, under a free name), or a hold with its reason. */
export type RefileStep = { kind: 'already' } | { kind: 'held'; why: string } | { kind: 'move'; removeParents: string[]; name: string; renamed: boolean }

export function refileStep(file: RefileFileState | null, folderId: string, namesInFolder: ReadonlySet<string>): RefileStep {
  if (!file) return { kind: 'held', why: REFILE_GONE_WORDS }
  if (file.trashed) return { kind: 'held', why: REFILE_TRASHED_WORDS }
  if (file.parents.includes(folderId)) return { kind: 'already' }
  const name = nextFreeName(file.name, namesInFolder)
  return { kind: 'move', removeParents: [...file.parents], name, renamed: name !== file.name }
}

export interface RefileMoved {
  id: string
  file_name: string
  drive_file_id: string
  /** The name the file took, when the folder already held its own. */
  renamed_to?: string
}

export interface RefileHeld {
  id: string
  file_name: string
  why: string
}

export interface RefileResult {
  job_id: string
  /** The folder the job's photos land in, or null when there is none to move into (every row is then held with the reason). */
  folder_id: string | null
  folder_url: string | null
  /** How many of the job's box photos are filed in Drive. */
  in_drive: number
  /** Moved into the folder. */
  moved: RefileMoved[]
  /** Already in the folder. */
  already: number
  /** Not moved, each with its reason. */
  held: RefileHeld[]
  /** Not reached before the ask's time ran out; ask again. */
  left: number
  words: string
}

const photos = (n: number): string => (n === 1 ? '1 box photo' : `${n} box photos`)

/** The reply's words: what moved, what was there already, what was held and why, what is left. */
export function refileWords(r: Pick<RefileResult, 'in_drive' | 'already' | 'left'> & { moved: readonly RefileMoved[]; held: readonly RefileHeld[] }): string {
  if (r.in_drive === 0) return 'This job has no box photo filed in Drive, so there is nothing to move. A photo still waiting is filed for this job by the sweep.'
  const moved = r.moved.length
  if (moved === 0 && r.held.length === 0 && r.left === 0) return r.already === 1 ? 'The 1 box photo in Drive is already in this job’s photo folder. Nothing moved.' : `All ${r.already} box photos in Drive are already in this job’s photo folder. Nothing moved.`
  const parts: string[] = []
  parts.push(moved > 0 ? `Moved ${photos(moved)} into this job’s photo folder.` : 'Nothing moved.')
  const renamed = r.moved.filter((m) => m.renamed_to).length
  if (renamed > 0) parts.push(`${renamed === 1 ? '1 takes' : `${renamed} take`} a numbered name, since the folder holds ${renamed === 1 ? 'its' : 'their'} own.`)
  if (r.already > 0) parts.push(`${r.already === 1 ? '1 was' : `${r.already} were`} already there.`)
  if (r.held.length > 0) parts.push(`${r.held.length === 1 ? '1 was' : `${r.held.length} were`} held: ${r.held.map((h) => `${h.file_name} (${h.why})`).join('; ')}`.replace(/[.;]*$/, '.'))
  if (r.left > 0) parts.push(`${r.left === 1 ? '1 was' : `${r.left} were`} not reached in this ask’s time. The photo sweep moves the rest by itself within a few minutes, or ask again.`)
  return parts.join(' ')
}

export function refileResult(input: { jobId: string; folderId: string | null; inDrive: number; moved: readonly RefileMoved[]; already: number; held: readonly RefileHeld[]; left: number }): RefileResult {
  const base = { in_drive: input.inDrive, already: input.already, left: input.left, moved: [...input.moved], held: [...input.held] }
  return {
    job_id: input.jobId,
    folder_id: input.folderId,
    folder_url: input.folderId ? `https://drive.google.com/drive/folders/${input.folderId}` : null,
    in_drive: input.inDrive,
    moved: base.moved,
    already: input.already,
    held: base.held,
    left: input.left,
    words: refileWords(base),
  }
}

/** What happens to a file that did not move in the ask, in words: the sweep finishes it, since the row is marked due. */
export const REFILE_SWEEP_FINISHES_WORDS = 'Each photo that did not move is marked due, and the photo sweep moves what is due by itself within a few minutes.'
export const REFILE_HELD_RETRY_WORDS = 'A held file is tried again a day later by itself, so one put right in the meantime follows without an ask.'

/**
 * What the dev seat adds to `apply_materials_move`'s reply as `photos.refiled`, from photo-save's answer to the ask. A
 * failed ask never undoes the move: the rows stand, the files stay where they were and still open from their boxes,
 * and since v2.6915 the sweep moves them anyway. The job's id is taken as before and no longer named in the words: nobody
 * has to make the ask again.
 */
export function refiledForSeat(_jobId: string, asked: { ok: boolean; status: number; body: unknown }): Record<string, unknown> {
  const body = asked.body && typeof asked.body === 'object' && !Array.isArray(asked.body) ? (asked.body as Record<string, unknown>) : {}
  if (!asked.ok || typeof body.words !== 'string') {
    const reason = typeof body.error === 'string' && body.error ? body.error : `photo-save answered ${asked.status}`
    return {
      asked: true,
      ok: false,
      why: reason,
      next: `The move stands and every photo still opens from its box. The ask to move the photos’ files did not finish: ${reason.replace(/[.\s]+$/, '')}. ${REFILE_SWEEP_FINISHES_WORDS}`,
    }
  }
  const held = Array.isArray(body.held) ? body.held : []
  const left = typeof body.left === 'number' ? body.left : 0
  const out: Record<string, unknown> = {
    asked: true,
    ok: held.length === 0 && left === 0,
    moved: Array.isArray(body.moved) ? body.moved.length : 0,
    already: typeof body.already === 'number' ? body.already : 0,
    held,
    left,
    folder_url: typeof body.folder_url === 'string' ? body.folder_url : null,
    words: body.words,
  }
  if (held.length > 0 || left > 0) out.next = ['The move stands and every photo still opens from its box.', left > 0 ? REFILE_SWEEP_FINISHES_WORDS : null, held.length > 0 ? REFILE_HELD_RETRY_WORDS : null].filter(Boolean).join(' ')
  return out
}

/**
 * The move's photo words as the dev seat hands them on. The database writes them (`dev_on_site_move_job`) and says a
 * file already in Drive stays in the first job's photo folder, which was the whole truth until the seat's apply began
 * asking photo-save to move it. The seat rewrites that one sentence, in the plan and in the apply, so the words say
 * what the apply does; a sentence it does not know is left whole with the step named after it. The plan's hash is
 * taken from the database's reply before this, so the words never move it.
 */
export function movePhotoWordsWithRefile(words: string, inDrive: number): string {
  if (inDrive <= 0) return words
  const one = inDrive === 1
  const stays = / already in Drive and stays? in (.+?)(['’])s photo folder: each row keeps its own Drive id, so a photo that showed on its box still does, but (.+?)['’]s Drive folder will not list (?:it|them)\./
  const m = stays.exec(words)
  if (!m) return `${words} The apply then asks the photo sweep to move ${one ? 'the file' : 'the files'} already in Drive into the new job’s photo folder.`
  const said = ` already in Drive in ${m[1]}${m[2]}s photo folder: the apply then moves ${one ? 'it' : 'them'} into ${m[3]}${m[2]}s photo folder, and each keeps its own Drive id, so a photo that showed on its box still does.`
  return words.slice(0, m.index) + said + words.slice(m.index + m[0].length)
}

/** The move's reply with its photo words as the seat hands them on (`photos.words`); any other reply comes back as it was. */
export function moveReplyWithRefileWords(reply: unknown): unknown {
  if (!reply || typeof reply !== 'object' || Array.isArray(reply)) return reply
  const r = reply as Record<string, unknown>
  const photos = r.photos && typeof r.photos === 'object' && !Array.isArray(r.photos) ? (r.photos as Record<string, unknown>) : null
  if (!photos || typeof photos.words !== 'string') return reply
  return { ...r, photos: { ...photos, words: movePhotoWordsWithRefile(photos.words, Number(photos.in_drive ?? 0) || 0) } }
}

/** How many of the moved photos' files are already in Drive, off the move's reply. */
export function movedPhotosInDrive(reply: unknown): number {
  const photos = reply && typeof reply === 'object' && !Array.isArray(reply) ? (reply as { photos?: unknown }).photos : null
  const n = photos && typeof photos === 'object' ? Number((photos as { in_drive?: unknown }).in_drive ?? 0) : 0
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** `photos.refiled` when no moved photo's file was in Drive: nothing to ask. */
export const NO_REFILE_NEEDED = { asked: false, ok: true, words: 'No photo of the moved boxes was filed in Drive yet, so no file had to move. A photo still waiting is filed for the new job by the sweep.' } as const
