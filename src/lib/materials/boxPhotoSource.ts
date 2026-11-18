/**
 * Materials on site: where a box photo's picture can be read from (Take from a box, step 1). Until v2.7819 a box's
 * photo drew only on the phone that took it, from that phone's own store (`photoBlobs.ts`); every other phone and the
 * office read a dashed square beside *in the job's folder*. The picture now comes from the first place that holds it:
 * this phone, the job's Drive folder once the sweep has filed it (through the job gallery's own function,
 * `lib/photos/jobPhotosIo.ts`), or the bucket in the minutes before that. Pure; the reads are `boxPhotoBytesIo.ts`.
 */
import type { PhotoNote } from './photo'

export type BoxPhotoSource = 'phone' | 'drive' | 'bucket' | 'none'

/**
 * The first place that holds the picture. A row keeps its `storagePath` after the sweep files it and deletes the
 * bucket's copy, so the bucket is asked only while the row still waits for the sweep (`sending`, no Drive id).
 */
export function boxPhotoSource(p: Pick<PhotoNote, 'driveFileId' | 'storagePath' | 'status'>, onThisPhone: boolean): BoxPhotoSource {
  if (onThisPhone) return 'phone'
  if (p.driveFileId) return 'drive'
  if (p.storagePath && p.status === 'sending') return 'bucket'
  return 'none'
}

/** Why the square is empty, for its title: said only when no place holds the picture or the read came back empty. */
export function boxPhotoMissingWords(p: Pick<PhotoNote, 'status' | 'driveFileId'>): string {
  if (p.status === 'on-phone') return 'The picture is still on the phone that took it.'
  if (p.status === 'shared') return 'The picture was shared from a phone. The app has no copy.'
  if (p.driveFileId) return 'The picture did not open from the job’s folder.'
  return 'The picture is not here yet.'
}

/** What the press on a thumbnail says: "Open the photo of A1 after Count". */
export function boxPhotoOpenLabel(p: Pick<PhotoNote, 'words' | 'fileName'>): string {
  return `Open the photo of ${p.words?.trim() || p.fileName}`
}
