/**
 * Saving a stored file to the device (v2.4610). A file handed to the browser straight from the
 * storage address made Safari ask, every time and naming two sites, whether to allow downloads
 * from clicktooling.com *and* the storage host, and sometimes a popup blocker held the new tab.
 * Here the file is read into the page first and saved from the app's own address, so the
 * browser sees one site and asks once at most. A file the browser can show (a PDF, a picture)
 * still opens in its own tab to be looked at; one it cannot (a workbook, a forwarded email) is
 * saved.
 */
import { openInExternalBrowser } from './openInExternalBrowser'
import { supabase } from './supabase'

const VIEWABLE = /\.(pdf|png|jpe?g|gif|webp|svg|txt|html?)$/i

/** Whether a browser shows the file itself, by its name; anything else is saved to the device. */
export function browserCanShow(name: string): boolean {
  return VIEWABLE.test(name.trim())
}

/** The last part of a bucket path, for a file saved under its own name. */
export function fileNameOf(path: string, fallback = 'file'): string {
  return path.split('/').filter(Boolean).pop() || fallback
}

/** Hand the browser a file from the app's own address: a hidden link, clicked, let go after half a minute. */
export function saveBlobAs(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** Read a stored file and save it under `name`. False when it could not be read. */
export async function saveFromStorage(bucket: string, path: string, name: string): Promise<boolean> {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) return false
  saveBlobAs(data, name)
  return true
}

/**
 * Open a stored file the browser can show in its own tab (a short signed link, inside the click
 * so no popup blocker holds it); save one it cannot. False when neither could be done.
 */
export async function openOrSaveFromStorage(bucket: string, path: string, name: string, seconds = 300): Promise<boolean> {
  if (!browserCanShow(name)) return saveFromStorage(bucket, path, name)
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds)
  if (error || !data?.signedUrl) return false
  openInExternalBrowser(data.signedUrl)
  return true
}
