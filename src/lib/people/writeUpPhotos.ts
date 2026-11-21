/**
 * Write someone up, the photos (punch list #410, PR 5): the rules and the words. A writer takes up to four photos in
 * the sheet. Each is shrunk on the phone and rides with the write-up: sent to the private `person-report-photos`
 * bucket when Send is pressed, or kept on the phone with no signal and sent before the write-up lands. A photo is
 * keyed to the write-up's press, the id the phone mints for it, which the report carries once it lands. The office
 * sees the photos on Pending reports, and filing the report makes them a numbered evidence record on the person's
 * file. Pure: the sends and the reads are `writeUpPhotosIo.ts`.
 */

export const WRITE_UP_PHOTOS_BUCKET = 'person-report-photos'

/** The most photos a write-up carries. */
export const WRITE_UP_MAX_PHOTOS = 4

/** A photo in the draft: its bytes stay in the page until Send. */
export interface WriteUpDraftPhoto {
  id: string
  blob: Blob
  /** An object URL for the tile. Empty where the page cannot make one. */
  url: string
  takenAt: string
  originalBytes: number
  width: number
  height: number
}

/** The object's name in the bucket: the writer's folder, then the write-up's press, then the photo. */
export function writeUpPhotoPath(authorUserId: string, pressId: string, photoId: string): string {
  return `${authorUserId}/${pressId}/${photoId}.jpg`
}

export const WRITE_UP_PHOTO_WORDS = {
  field: 'Photos',
  take: 'Take a photo',
  add: 'Add a photo',
  remove: 'Take this photo off',
  full: 'Four photos is the most a write-up carries.',
  failed: 'That photo could not be read. Try it again.',
  notKept: 'The photo could not be kept on this phone. Send the write-up when the signal is back.',
} as const

/** "1 photo", "3 photos", or '' for none. */
export function photoCountWords(count: number): string {
  if (count <= 0) return ''
  return count === 1 ? '1 photo' : `${count} photos`
}

/** "1 photo kept" for a write-up waiting on the phone with photos beside it. */
export function photosKeptWords(count: number): string {
  const words = photoCountWords(count)
  return words ? `${words} kept` : ''
}

/** Whether another photo may be taken. */
export function canAddPhoto(count: number): boolean {
  return count < WRITE_UP_MAX_PHOTOS
}

/** The evidence record a filed write-up's photos become: its day, its title and its memo. */
export function writeUpEvidenceDraft(report: { occurred_date: string; author_name: string; kind?: string | null }, kindLabel: string, count: number): { datedOn: string; title: string; memo: string } {
  const who = report.author_name.trim() || 'the writer'
  return {
    datedOn: report.occurred_date,
    title: `Field write-up, ${kindLabel.toLowerCase()}: ${photoCountWords(count)}`,
    memo: `Taken on a phone by ${who} and sent with the write-up of that day.`,
  }
}
