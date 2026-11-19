/**
 * The browser's half of Send more… (`paintedPlaceSendMore.ts`): a place's photo as a file, and the
 * phone's own share sheet. Not pure.
 *
 * A phone opens its share sheet only inside the press that asked for it. So the photo is read when
 * the sheet opens, and the press hands over a file that is already in hand: `sharePlacePhoto` calls
 * the share sheet before it awaits anything.
 */
import { canSharePhoto } from '../materials/photoShare'
import { paintedPlacePhotoUrls } from './paintedMapIo'

export type PlaceSendMoreIo = {
  /** Whether this device's share sheet takes a photo. */
  canSharePhoto: () => boolean
  /** The place's photo as a file under the given name, or null when it would not load. */
  loadPhoto: (photoPath: string, fileName: string) => Promise<File | null>
  /** True when shared, false when the person backed out of the sheet. Throws when the phone refused. */
  share: (file: File, text: string) => Promise<boolean>
  copy: (text: string) => Promise<void>
}

/** A phone or a tablet whose browser can put a JPEG on its share sheet. Asked with a stand-in file, before any photo is read. */
export function canShareAPlacePhoto(): boolean {
  if (typeof File === 'undefined') return false
  try {
    return canSharePhoto(new File([''], 'place.jpg', { type: 'image/jpeg' }))
  } catch {
    return false
  }
}

/** Reads a place's photo out of the bucket through a signed address. Null when it will not sign or will not load. */
export async function loadPlacePhotoFile(photoPath: string, fileName: string): Promise<File | null> {
  try {
    const url = (await paintedPlacePhotoUrls([photoPath])).get(photoPath)
    if (!url) return null
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return new File([blob], fileName, { type: blob.type || 'image/jpeg' })
  } catch {
    return null
  }
}

/** Hands the photo and the place's words to the phone's share sheet. Nothing is awaited before the call. */
export async function sharePlacePhoto(file: File, text: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], text })
    return true
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') return false
    throw e
  }
}

export const placeSendMoreIo: PlaceSendMoreIo = {
  canSharePhoto: canShareAPlacePhoto,
  loadPhoto: loadPlacePhotoFile,
  share: sharePlacePhoto,
  copy: (text) => navigator.clipboard.writeText(text),
}
