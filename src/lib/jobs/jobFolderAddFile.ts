/**
 * Add a file to one of a job's Drive folders from the Documents tab (v2.6303, the owner's ask after punch list #236
 * put every job's files in one folder): the words and the rules, pure. The file goes through `drive-link`'s `put` as
 * the service account, and which folder it lands in is the row's own — the job's folder itself, its Plans folder or
 * Customer Pictures — so the person never picks a half. Until now a file on someone's computer reached a job's folder
 * only by hand in Drive, or through Messages' Save to Drive once it had been emailed.
 */
import { photoDriveName } from '../photos/photoName'

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
  /** No answer came back at all (v2.7635): the file never reached the app. */
  lost: 'The file did not reach the app. Check the signal, then try again.',
  /** The press beside a failure a second try can get past. */
  tryAgain: 'Try again',
  openInDrive: 'Open in Drive',
  another: 'Add another',
} as const

/**
 * A file that did not go up, with whether sending the same file again can help (v2.7635). `retry` is the function's
 * own answer when it gives one (`drive-link` says so since that version), true when no answer came back, and
 * otherwise read from the status: a busy or broken server may take a second try, a refusal will not.
 */
export class AddFileFailure extends Error {
  readonly retry: boolean
  constructor(message: string, retry: boolean) {
    super(message)
    this.name = 'AddFileFailure'
    this.retry = retry
  }
}

/** What came back from the function, as the io read it: the body's fields, the status, or neither when nothing answered. */
export type AddFileAnswer = { error?: unknown; retry?: unknown; status?: number | null }

/**
 * The failure for one answer, or for no answer (`null`). A bare `failed` is the function's old catch-all: it names
 * nothing, so the screen says the file was not added and offers the second try.
 */
export function addFileFailureOf(answer: AddFileAnswer | null, fallback: string = ADD_FILE_WORDS.failed): AddFileFailure {
  if (!answer) return new AddFileFailure(ADD_FILE_WORDS.lost, true)
  const said = typeof answer.error === 'string' ? answer.error.trim() : ''
  const status = typeof answer.status === 'number' ? answer.status : null
  if (!said || said === 'failed') return new AddFileFailure(fallback, true)
  if (typeof answer.retry === 'boolean') return new AddFileFailure(said, answer.retry)
  return new AddFileFailure(said, status != null && (status === 408 || status === 429 || status >= 500))
}

/** Whether a thrown upload failure is one a second try can get past. Anything else is a refusal. */
export function addFileCanRetry(e: unknown): boolean {
  return e instanceof AddFileFailure && e.retry
}

/** The confirm press names the act and the folder: never OK. */
/**
 * The phone's Add ▾ sheet (punch list #355 H, v2.7282): a folder row ends in Add ▾, which opens three rows. Take a photo
 * opens the camera and the shot goes straight into the folder, named as the photo sweep names one; Choose a file is the
 * picker and the panel; Open in Google Drive is the folder in a tab.
 */
export const ADD_SHEET_WORDS = {
  button: 'Add ▾',
  title: (folder: string) => `Add to ${folder}`,
  photo: 'Take a photo',
  photoSub: 'The camera. The shot goes into the folder by itself.',
  file: 'Choose a file',
  fileSub: 'A file on this phone, up to 10 MB.',
  drive: 'Open in Google Drive',
  shrinking: 'Shrinking the photo…',
  sending: 'Adding the photo…',
} as const

/** *2026-11-14 Robert · Plans.jpg*: the day, who, and the folder, as the photo sweep names a shot. */
export function folderPhotoFileName(input: { at: string; byName: string; folder: string; mime: string | null }): string {
  return photoDriveName({ at: input.at, sender: input.byName, fileName: 'photo', mime: input.mime || 'image/jpeg', words: input.folder, place: 1 })
}

export function addFileConfirmLabel(folder: string): string {
  return `Add it to ${folder}`
}

/** The line once the file is in Drive. */
export function addedWords(name: string, folder: string): string {
  return `${name} is in ${folder}.`
}
