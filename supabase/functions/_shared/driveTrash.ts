/**
 * A wrong file taken off a lien paper goes to Drive's trash, and can be put back (v2.7699). Until then **Take off**
 * forgot the link and left the file in the job's folder, so a wrong receipt and its retake sat side by side under one
 * name. The rules here are pure; `drive-link` holds the calls.
 *
 * Three fences, in this order:
 * - Only a Pipeline job's file, and only one that sits in the job's **Team only → Sent by us** folder, where the app
 *   puts a receipt, a mailed copy and a stamped scan. Nothing else in the job's folder can be trashed from here.
 * - Never a file a lien record of that job still names (`lienRowsUse`): the caller takes the link off first, and a
 *   file that is also a filing's saved copy stays where it is.
 * - Trash, never delete. The app's service account is a Content manager on the jobs Shared Drive, which may move a
 *   file to the trash and may not delete it; Drive keeps a trashed file for thirty days.
 */

/** The ask, as `drive-link` reads it off the body. */
export type TrashAsk = { action: 'trash' | 'untrash'; job: { jobs_ledger_id: string }; driveFileId: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DRIVE_ID = /^[A-Za-z0-9_-]{10,120}$/

/** Whether the body asks for this door at all, whatever else it holds. */
export function isTrashAction(body: unknown): boolean {
  const action = (body as { action?: unknown } | null)?.action
  return action === 'trash' || action === 'untrash'
}

/** The ask, or null when it is not one this door takes: a bid's or a GC project's folder is not served. */
export function parseTrashAsk(body: unknown): TrashAsk | null {
  const b = (body ?? {}) as { action?: unknown; job?: unknown; driveFileId?: unknown }
  if (b.action !== 'trash' && b.action !== 'untrash') return null
  const jobId = (b.job as { jobs_ledger_id?: unknown } | null)?.jobs_ledger_id
  if (typeof jobId !== 'string' || !UUID.test(jobId)) return null
  if (typeof b.driveFileId !== 'string' || !DRIVE_ID.test(b.driveFileId)) return null
  return { action: b.action, job: { jobs_ledger_id: jobId }, driveFileId: b.driveFileId }
}

/** The door's own sentences. Each is one idea, as a first-timer reads it. */
export const DRIVE_TRASH_WORDS = {
  notAnAsk: 'That is not a file this door can move. It takes a Pipeline job and one of its files.',
  notSent: 'That file is not in the job’s Sent by us folder, so the app leaves it alone.',
  inUse: 'A lien record still uses it.',
  recordsUnread: 'The lien records did not read, so the file stays where it is.',
} as const

/**
 * Whether any of the job's lien rows still names the file. The rows are read whole and searched as text, so a link
 * kept in a column nobody listed here (a filing's saved copy, a copy's receipt, a notice's mailed copies, a paper's
 * fields) is still found. A Drive id is long and random, so a match is the file.
 */
export function lienRowsUse(rows: ReadonlyArray<unknown>, driveFileId: string): boolean {
  if (!driveFileId) return false
  return rows.some((row) => JSON.stringify(row ?? null).includes(driveFileId))
}

/** The note Drive keeps on a trashed file, so whoever opens the trash sees why it is there. */
export function trashNote(name: string | null | undefined, ymd: string): string {
  const who = (name ?? '').trim()
  return `Taken off in the app${who ? ` by ${who}` : ''} on ${ymd}.`
}
