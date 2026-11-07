/**
 * Add a file to one of a job's Drive folders from the Documents tab (v2.6303, the owner's ask after punch list #236
 * put every job's files in one folder): the words and the rules, pure. The file goes through `drive-link`'s `put` as
 * the service account, and which folder it lands in is the row's own — the job's folder itself, its Plans folder or
 * Customer Pictures — so the person never picks a half. Until now a file on someone's computer reached a job's folder
 * only by hand in Drive, or through Messages' Save to Drive once it had been emailed.
 */

/** Where a `put` from the Documents tab lands, by the Job folders row pressed; `sent` is Team only → Sent by us, where the Hours statements section puts a signed PDF (v2.6634). */
export type AddFileWhere = 'top' | 'plans' | 'pictures' | 'sent'

/** The destination a Job folders row stands for, by the label `jobDocumentFolderLinks` gives it; null for a row the press does not serve. */
export function addFileWhereFor(label: string): AddFileWhere | null {
  if (label === 'Job folder') return 'top'
  if (label === 'Plans') return 'plans'
  if (label === 'Pictures') return 'pictures'
  return null
}

/** The function's cap: a file from this computer comes in as base64, up to 10 MB. */
export const ADD_FILE_MAX_BYTES = 10 * 1024 * 1024

export function addFileTooBig(bytes: number): boolean {
  return bytes > ADD_FILE_MAX_BYTES
}

/** A file's size as a person reads it: 12 B, 410 KB, 2.1 MB. */
export function addFileSizeWords(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`
}

/** The press's words. Each sentence is one idea, as a first-timer reads it. */
export const ADD_FILE_WORDS = {
  button: 'Add a file',
  title: (folder: string) => `Add a file to ${folder}`,
  choose: 'Choose a different file',
  where: {
    top: 'It goes into the job’s folder itself, beside Plans, Customer Pictures and Team only.',
    plans: 'It goes into Plans. Anyone with the folder’s link reads it, so trades see it with the plans.',
    pictures: 'It goes into Customer Pictures with the job’s photos.',
    sent: 'It goes into Team only → Sent by us, where the office keeps what it sent.',
  } satisfies Record<AddFileWhere, string>,
  tooBig: 'Over 10 MB. Put it in the folder in Drive instead.',
  notNow: 'Not now',
  adding: 'Adding…',
  failed: 'The file was not added.',
  openInDrive: 'Open in Drive',
  another: 'Add another',
} as const

/** The confirm press names the act and the folder: never OK. */
export function addFileConfirmLabel(folder: string): string {
  return `Add it to ${folder}`
}

/** The line once the file is in Drive. */
export function addedWords(name: string, folder: string): string {
  return `${name} is in ${folder}.`
}
