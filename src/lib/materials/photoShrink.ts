/**
 * Materials on site (punch list #209): the phone shrinks a shot before it leaves. A 12-megapixel JPEG of
 * three to five megabytes becomes a 1,600-pixel JPEG of two to four hundred kilobytes: enough to read a
 * stencil and count fittings, and it uploads in a second on one bar. Re-encoding drops the camera's
 * metadata, so no position travels with the picture. The arithmetic is pure; `shrinkPhoto` is browser io.
 */

/** The long edge of a shrunk photo, and the second pass for a shot that is still heavy after the first. */
export const PHOTO_MAX_EDGE = 1600
export const PHOTO_SECOND_PASS_EDGE = 1280
export const PHOTO_QUALITY = 0.8
/** Over this many bytes after the first pass, the shot takes the second. */
export const PHOTO_HEAVY_BYTES = 800_000

/** The size that fits inside `maxEdge` on the long side, never scaled up. */
export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const long = Math.max(width, height)
  if (long <= maxEdge || long === 0) return { width, height }
  const k = maxEdge / long
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) }
}

/** After a pass that left `bytes`: the edge of the next pass, or null when the shot is small enough. */
export function nextPassEdge(bytes: number, edgeUsed: number): number | null {
  return bytes > PHOTO_HEAVY_BYTES && edgeUsed > PHOTO_SECOND_PASS_EDGE ? PHOTO_SECOND_PASS_EDGE : null
}

/** "312 KB", "2.4 MB". */
export function bytesWords(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} KB`
}

export type ShrunkPhoto = { blob: Blob; width: number; height: number; /** False when the browser could not decode the shot and it goes as it came. */ shrunk: boolean }

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // An older browser without the orientation option: decode plainly, and the drawing keeps what it can.
    return await createImageBitmap(file)
  }
}

function encode(bitmap: ImageBitmap, width: number, height: number, quality: number): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('The phone could not draw the picture.'))
  ctx.drawImage(bitmap, 0, 0, width, height)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The phone could not encode the picture.'))), 'image/jpeg', quality))
}

/** The shot, shrunk to `maxEdge` on its long side as a JPEG, with a second pass when it stays heavy. The original when it cannot be decoded. */
export async function shrinkPhoto(file: File, maxEdge = PHOTO_MAX_EDGE, quality = PHOTO_QUALITY): Promise<ShrunkPhoto> {
  let bitmap: ImageBitmap
  try {
    bitmap = await decode(file)
  } catch {
    return { blob: file, width: 0, height: 0, shrunk: false }
  }
  try {
    let edge = maxEdge
    let size = fitWithin(bitmap.width, bitmap.height, edge)
    let blob = await encode(bitmap, size.width, size.height, quality)
    const again = nextPassEdge(blob.size, edge)
    if (again) {
      edge = again
      size = fitWithin(bitmap.width, bitmap.height, edge)
      blob = await encode(bitmap, size.width, size.height, quality)
    }
    return { blob, width: size.width, height: size.height, shrunk: true }
  } finally {
    bitmap.close()
  }
}
