/**
 * Materials on site: where a box photo's picture can be read from (Take from a box, step 1). Until v2.7819 a box's
 * photo drew only on the phone that took it, from that phone's own store (`photoBlobs.ts`); every other phone and the
 * office read a dashed square beside *in the job's folder*. The picture now comes from the place that holds it: the
 * job's Drive folder once the sweep has filed it (through the job gallery's own function, `lib/photos/jobPhotosIo.ts`),
 * this phone while the shot waits, or the bucket in the minutes before the sweep. A filed shot is read from the folder
 * on the phone that took it too, and that phone's copy goes (`phoneCopiesToDrop`): a phone that kept every shot it took
 * and drew each whole ran out of memory on a job of ninety boxes. Pure; the reads are `boxPhotoBytesIo.ts`.
 */
import type { PhotoNote } from './photo'

export type BoxPhotoSource = 'phone' | 'drive' | 'bucket' | 'none'

/** The sweep filed the shot and wrote its Drive id: the job's folder holds the picture, so no phone has the only copy. */
export function boxPhotoIsFiled(p: Pick<PhotoNote, 'driveFileId' | 'status'>): boolean {
  return p.status === 'filed' && Boolean(p.driveFileId)
}

/**
 * The place the picture is read from. A filed shot reads the job's folder even where this phone still holds its bytes.
 * A shot that waits (`on-phone`, `sending`, `shared`) reads this phone first: its bytes may be the only copy. A row
 * keeps its `storagePath` after the sweep files it and deletes the bucket's copy, so the bucket is asked only while the
 * row still waits for the sweep (`sending`, no Drive id).
 */
export function boxPhotoSource(p: Pick<PhotoNote, 'driveFileId' | 'storagePath' | 'status'>, onThisPhone: boolean): BoxPhotoSource {
  if (boxPhotoIsFiled(p)) return 'drive'
  if (onThisPhone) return 'phone'
  if (p.driveFileId) return 'drive'
  if (p.storagePath && p.status === 'sending') return 'bucket'
  return 'none'
}

/**
 * Of the ids this phone holds, the ones whose copy may go: only an id matched to a filed row with a Drive id. An id no
 * row here names is left alone (its row may belong to a job not read yet), and so is a shot that still waits.
 */
export function phoneCopiesToDrop(held: ReadonlyArray<string>, photos: ReadonlyArray<Pick<PhotoNote, 'id' | 'driveFileId' | 'status'>>): string[] {
  if (held.length === 0) return []
  const filed = new Set<string>()
  for (const p of photos) if (boxPhotoIsFiled(p)) filed.add(p.id)
  return held.filter((id) => filed.has(id))
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
