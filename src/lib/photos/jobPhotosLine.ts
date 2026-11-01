/**
 * The job window's Documents tab Photos line (punch list #232, PR 3): one sentence over the strip's own read, *15 in
 * Drive · 1 on its way · the newest Nov 1*, as the door to the folder's viewer the window already has. Pure; the read
 * is `jobPhotosIo.ts` and the screen `components/jobs/JobDocumentsPhotos.tsx`.
 */
import { newestFirst, photoDayWords, type JobPhotosRead } from './jobPhotos'

/** The line's words: the count in Drive, the count on its way, the newest day; *No photos in the folder yet* with none. */
export function photosLineWords(read: Pick<JobPhotosRead, 'photos' | 'waiting'>): string {
  const n = read.photos.length
  const parts: string[] = []
  if (n > 0) parts.push(n === 1 ? '1 in Drive' : `${n} in Drive`)
  if (read.waiting > 0) parts.push(read.waiting === 1 ? '1 on its way' : `${read.waiting} on its way`)
  if (n > 0) {
    const newest = newestFirst(read.photos)[0]
    const day = newest ? photoDayWords(newest.modified) : ''
    if (day) parts.push(`the newest ${day}`)
  }
  if (parts.length === 0) return 'No photos in the folder yet. A photo taken in the app saves there.'
  return parts.join(' · ')
}

/** Whether the line is a door: there is something in the folder to open. */
export function photosLineOpens(read: Pick<JobPhotosRead, 'photos'>): boolean {
  return read.photos.length > 0
}

/** Under the line. */
export const PHOTOS_LINE_SUB = 'The same photos as the strip under the address. Every photo across every job is on Documents → Photos.'
