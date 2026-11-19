/**
 * Materials on site: one shot of a box, from the camera's file to its row (punch list #209; shared since Take from a
 * box, v2.7824). The **Photo** chip and a take's two photos go the same way: the time is the camera's own when the
 * file carries one, the shot is shrunk on the phone, named as the sweep names it, kept on the phone, sent to the
 * bucket, and its row is written through the store. With no signal the shot waits on the phone and its row says so.
 * Browser io, not pure.
 */
import { readTakenAt } from '../photos/photoTakenAt'
import { formatErrorMessage } from '../../utils/errorHandling'
import { addPhoto, newId } from './onSiteStore'
import { photoFileNameOf, photoWords, type PhotoNote } from './photo'
import { shrinkPhoto } from './photoShrink'
import { BoxPhotoNotKeptError, sendBoxPhoto } from './photoUpload'

export type BoxShotInput = {
  jobId: string
  containerId: string
  containerLabel: string
  /** What just happened to the box, for the chip's photo: "Put in", "Count". Null otherwise. */
  after: string | null
  /** What the shot is of, said whole, for a take's photo: "G12 as found". Wins over `after`. */
  words?: string
  kind?: 'before' | 'after' | null
  takeId?: string | null
  byUserId: string | null
  byName: string
  onStage?: (stage: 'shrinking' | 'sending') => void
}

/**
 * How the shot ended: on its way to the job's folder, kept on this phone for want of signal, or lost because the
 * phone could keep it nowhere. `why` is the reason a send failed, in words.
 */
export type BoxShotOutcome = { kind: 'sent' | 'kept'; note: PhotoNote; why: string } | { kind: 'lost'; why: string }

/** Throws only when the shot could not be read or shrunk at all. */
export async function shootBoxPhoto(file: File, input: BoxShotInput): Promise<BoxShotOutcome> {
  input.onStage?.('shrinking')
  const at = await readTakenAt(file)
  const shot = await shrinkPhoto(file)
  const type = shot.shrunk ? 'image/jpeg' : file.type || 'image/jpeg'
  const words = input.words?.trim() || photoWords(input.containerLabel, input.after)
  const fileName = photoFileNameOf({ at, byName: input.byName, words, mime: type })
  const id = newId()
  const note: PhotoNote = { id, jobId: input.jobId, containerId: input.containerId, fileName, byUserId: input.byUserId, byName: input.byName, at, bytes: shot.blob.size, width: shot.width, height: shot.height, status: 'sending', driveFileId: null, storagePath: null, words, kind: input.kind ?? null, takeId: input.takeId ?? null }
  input.onStage?.('sending')
  try {
    const sent = await sendBoxPhoto({ id, jobId: input.jobId, containerId: input.containerId, blob: shot.blob, fileName })
    return { kind: 'sent', note: addPhoto({ ...note, storagePath: sent.storagePath }), why: '' }
  } catch (err) {
    // Nothing holds the shot: no note is made for a photo that is nowhere.
    if (err instanceof BoxPhotoNotKeptError) return { kind: 'lost', why: formatErrorMessage(err) }
    return { kind: 'kept', note: addPhoto({ ...note, status: 'on-phone' }), why: formatErrorMessage(err) }
  }
}
