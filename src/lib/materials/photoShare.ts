/**
 * Materials on site (punch list #209): handing a named photo to the phone's share sheet, where the
 * person picks Drive (the job's folder) or Photos. Browser io, not pure. The share call must run
 * inside the press that chose the file, so nothing here awaits before it.
 */

/**
 * Whether to put the file on the share sheet: a phone or tablet whose browser can share files. A desktop
 * gets the file as a download instead, even where its browser has a share sheet, since Drive is a folder
 * there, not a share target.
 */
export function canSharePhoto(file: File): boolean {
  if (typeof navigator === 'undefined' || !(navigator.maxTouchPoints > 0)) return false
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

/** True when shared, false when the person backed out of the sheet. Throws when the browser refused. */
export async function sharePhoto(file: File, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title })
    return true
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') return false
    throw e
  }
}

/** The desktop's way: the named file lands in Downloads, to be dropped in the job's Drive folder. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
