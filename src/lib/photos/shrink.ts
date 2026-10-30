/**
 * Phone first, the camera-first report (punch list #189, PR 5b; the owner's word of 2026-10-26: *we'll need to
 * convert the photos from their full size to a more compact format*). The phone draws the shot on a canvas at the
 * long edge the office picked and reads it back as a JPEG at quality 0.8: a 12 MP shot of 3 to 5 MB becomes about
 * 300 KB at 1600 px. A web worker does it (`shrink.worker.ts`), so the form never freezes; a browser without
 * `OffscreenCanvas` draws on the page's own canvas instead (`materials/photoShrink.ts`, the box photos' shrink). The
 * camera input hands iOS photos over as JPEG, so HEIC never reaches us, and `createImageBitmap`'s `from-image`
 * honours the orientation tag, so a sideways shot comes out upright. Re-encoding drops the camera's metadata, so no
 * position travels with the picture. The sizes, the plan and the words are pure; `shrinkReportPhoto` is browser io.
 */
import { formatErrorMessage } from '../../utils/errorHandling'
import { bytesWords, fitWithin, shrinkPhoto, type ShrunkPhoto } from '../materials/photoShrink'

export type { ShrunkPhoto }
export { bytesWords }

/** The office's three sizes: the long edge the phone shrinks a report photo to. */
export type ReportPhotoSize = 'small' | 'medium' | 'large'

export const REPORT_PHOTO_SIZES: Readonly<Record<ReportPhotoSize, { edge: number; words: string; about: string }>> = {
  small: { edge: 1200, words: 'Small', about: 'about 150 KB' },
  medium: { edge: 1600, words: 'Medium', about: 'about 300 KB' },
  large: { edge: 2400, words: 'Large', about: 'about 700 KB' },
}

/** Medium: reads fine on a desktop and goes up on one bar of signal. */
export const REPORT_PHOTO_SIZE_DEFAULT: ReportPhotoSize = 'medium'

/** JPEG quality on the way out. */
export const REPORT_PHOTO_QUALITY = 0.8

/** The bucket refuses a file over this (the migration's cap), so nothing full size slips through. */
export const REPORT_PHOTO_MAX_BYTES = 2_097_152

/**
 * `app_settings.key` for the office's size (`value_text`: small · medium · large). Kept here, not in
 * `appSettingsKeys.ts`, since that file is copied into fourteen edge bundles (`gen:edge-kernels`) and a client-only
 * key would send every one of them out for a redeploy.
 */
export const REPORT_PHOTO_SIZE_SETTING_KEY = 'report_photo_size' as const

/** The size a setting's text names, Medium for anything else. */
export function photoSizeFromSetting(value: string | null | undefined): ReportPhotoSize {
  const v = (value ?? '').trim().toLowerCase()
  return v === 'small' || v === 'medium' || v === 'large' ? v : REPORT_PHOTO_SIZE_DEFAULT
}

/** The long edge for a size. */
export function edgeFor(size: ReportPhotoSize): number {
  return REPORT_PHOTO_SIZES[size].edge
}

/**
 * The frame the shot is drawn at: inside `edge` on its long side, its orientation kept (a portrait shot stays
 * portrait), never scaled up.
 */
export function shrinkPlan(width: number, height: number, edge: number): { width: number; height: number } {
  return fitWithin(width, height, edge)
}

/** True when the shot may enter the bucket. */
export function withinCap(bytes: number): boolean {
  return bytes <= REPORT_PHOTO_MAX_BYTES
}

/** The tile's words: *4.2 MB → 310 KB · 1600 px*; *310 KB* alone when the shot went as it came. */
export function shrinkWords(input: { before: number; after: number; longEdge: number; shrunk: boolean }): string {
  if (!input.shrunk) return bytesWords(input.after)
  return `${bytesWords(input.before)} → ${bytesWords(input.after)} · ${input.longEdge} px`
}

export type WorkerShrinkRequest = { file: File; maxEdge: number; quality: number }
export type WorkerShrinkAnswer = { ok: true; blob: Blob; width: number; height: number } | { ok: false; error: string }

/** The worker exists and can draw: a browser with `Worker` and `OffscreenCanvas` on the page. */
export function canShrinkInWorker(): boolean {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof URL !== 'undefined'
}

function shrinkInWorker(file: File, maxEdge: number, quality: number): Promise<ShrunkPhoto> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./shrink.worker.ts', import.meta.url), { type: 'module' })
    } catch (e) {
      reject(new Error(formatErrorMessage(e, 'The phone could not start the shrink.')))
      return
    }
    const done = () => worker.terminate()
    worker.onmessage = (ev: MessageEvent<WorkerShrinkAnswer>) => {
      done()
      const a = ev.data
      if (a.ok) resolve({ blob: a.blob, width: a.width, height: a.height, shrunk: true })
      else reject(new Error(a.error))
    }
    worker.onerror = (ev) => {
      done()
      reject(new Error(ev.message || 'The phone could not shrink the picture.'))
    }
    const req: WorkerShrinkRequest = { file, maxEdge, quality }
    worker.postMessage(req)
  })
}

/**
 * The shot, shrunk to the office's size as a JPEG: in the worker when the browser has one, else on the page. A shot
 * the browser cannot decode goes as it came (`shrunk: false`), and the cap decides whether it may be sent.
 */
export async function shrinkReportPhoto(file: File, size: ReportPhotoSize): Promise<ShrunkPhoto> {
  const edge = edgeFor(size)
  if (canShrinkInWorker()) {
    try {
      return await shrinkInWorker(file, edge, REPORT_PHOTO_QUALITY)
    } catch {
      // The page's canvas, below.
    }
  }
  return shrinkPhoto(file, edge, REPORT_PHOTO_QUALITY)
}
