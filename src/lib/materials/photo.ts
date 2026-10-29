/**
 * Materials on site (punch list #209): a photo of a box. The phone shoots it, names it the way the
 * photo sweep names a photo in the job's Drive folder (day, who, what: *2026-10-28 Jordan · A1 after
 * Put in.jpg*), shrinks it and sends it; the sweep files it in the folder, so Drive gets a file the office
 * can find and the app keeps no lasting copy. The ledger keeps a note with where the shot is. Pure.
 */
import { photoDriveName } from '../photos/photoName'
import { daysSince } from './onSite'

/** Where the shot is: on its way to the folder, kept on the phone for want of signal, filed by the sweep, or shared by hand. */
export type PhotoStatus = 'sending' | 'on-phone' | 'filed' | 'shared'

export type PhotoNote = {
  id: string
  jobId: string
  containerId: string
  /** The name the photo takes in the job's Drive folder. */
  fileName: string
  byUserId: string | null
  byName: string
  at: string
  /** After the phone shrank it. */
  bytes: number
  width: number
  height: number
  status: PhotoStatus
  /** Written by the sweep once the file is in Drive. */
  driveFileId: string | null
  /** Where the shot waits in the bucket until the sweep files it; null when it never left the phone. */
  storagePath: string | null
  /** Why the sweep could not file it yet (the job has no Drive folder); null otherwise. */
  failWhy?: string | null
  /** What the shot is of, as the file is named: "A1 after Count". */
  words?: string
}

export function photoStatusWords(status: PhotoStatus): string {
  switch (status) {
    case 'sending': return 'on its way to the folder'
    case 'on-phone': return 'kept on this phone until there is signal'
    case 'filed': return "in the job's folder"
    case 'shared': return 'shared from the phone'
  }
}

/** For this long after a press, the Photo button reads "Photo after Put in" and the file says so. */
export const FRESH_ACT_MS = 10 * 60_000

export function actIsFresh(at: number, now: number): boolean {
  return now - at <= FRESH_ACT_MS
}

/** "A1 after Put in", or just "A1" when nothing just happened to it. */
export function photoWords(containerLabel: string, after: string | null): string {
  return after ? `${containerLabel} after ${after}` : containerLabel
}

/** The file's name in the job's Drive folder, as the sweep would name it: day, who, what. */
export function photoFileName(input: { at: string; byName: string; containerLabel: string; after: string | null; mime: string | null }): string {
  return photoDriveName({ at: input.at, sender: input.byName, fileName: 'photo', mime: input.mime || 'image/jpeg', words: photoWords(input.containerLabel, input.after), place: 1 })
}

/** The mark on a box: "1 photo today by Jordan", "3 photos, last 2 days ago by Jordan"; nothing when none. */
export function photoMarkWords(notes: ReadonlyArray<PhotoNote>, now: Date): string {
  if (notes.length === 0) return ''
  const last = notes.reduce((a, b) => (a.at > b.at ? a : b))
  const d = daysSince(last.at, now)
  const when = d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
  return notes.length === 1 ? `1 photo ${when} by ${last.byName}` : `${notes.length} photos, last ${when} by ${last.byName}`
}
