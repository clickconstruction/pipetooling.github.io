import { LIEN_RUN_SCAN_FORMATS, trackingFromScan } from './lienRunScan'

/**
 * The certified mail number read off a photo of the receipt (v2.7557): the help sheet's recording step says to take a
 * photo of each receipt, and the number comes from it where the device can read the barcode.
 *
 * The browser's own `BarcodeDetector` reads the still where it exists (Chrome, Android). Elsewhere `@zxing/browser` is
 * fetched on the first photo, never before, as the run's Scan press does. Anything that cannot read answers '' and the
 * box stays for typing: a photo is saved whether or not its number was read.
 */
type Detector = { detect: (source: ImageBitmap) => Promise<Array<{ rawValue: string }>> }
type DetectorCtor = new (opts: { formats: ReadonlyArray<string> }) => Detector

export async function readTrackingFromPhoto(photo: Blob): Promise<string> {
  const w = (typeof window === 'undefined' ? {} : window) as unknown as { BarcodeDetector?: DetectorCtor; createImageBitmap?: (b: Blob) => Promise<ImageBitmap> }
  if (typeof w.BarcodeDetector === 'function' && typeof w.createImageBitmap === 'function') {
    try {
      const bitmap = await w.createImageBitmap(photo)
      const found = await new w.BarcodeDetector({ formats: LIEN_RUN_SCAN_FORMATS }).detect(bitmap)
      const hit = found.find((f) => (f.rawValue ?? '').trim())
      if (hit) return trackingFromScan(hit.rawValue)
    } catch {
      // a format the browser cannot decode; ZXing gets its turn
    }
  }
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return ''
  const url = URL.createObjectURL(photo)
  try {
    const zxing = await import('@zxing/browser')
    const result = await new zxing.BrowserMultiFormatReader().decodeFromImageUrl(url)
    const text = result?.getText?.() ?? ''
    return text.trim() ? trackingFromScan(text) : ''
  } catch {
    return ''
  } finally {
    URL.revokeObjectURL(url)
  }
}
