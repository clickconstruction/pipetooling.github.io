/**
 * A report's photos on its email and its push (punch list #229, PR 5). The email goes at Save, minutes before the
 * photo-save sweep files anything in Drive, so a photo still in the bucket rides as an attachment (the shrunk copy,
 * about 300 KB), up to ten and under 8 MB in all; one the sweep already filed (a manual Send now days later, the
 * bucket copy gone) is a link to the Drive file; one past the cap, or with no bytes anywhere, is named and nothing
 * more. Pure: rows in, the plan and the words out. The bytes are read in `send-report-email/index.ts`. The client's
 * `src/lib/reportPhotoEmail.test.ts` holds it.
 */

/** A `report_photos` row as the email reads it, oldest first. */
export interface ReportEmailPhotoRow {
  id: string
  stage_name: string | null
  caption: string | null
  by_name: string | null
  bytes: number | null
  storage_path: string | null
  drive_file_id: string | null
  fail_why: string | null
}

/** The most photos one email attaches, and the most bytes they may add up to. */
export const REPORT_EMAIL_PHOTO_MAX_COUNT = 10
export const REPORT_EMAIL_PHOTO_MAX_BYTES = 8 * 1024 * 1024

export type ReportEmailPhotoHow = 'attached' | 'drive' | 'named'

export interface ReportEmailPhoto {
  id: string
  /** The stage, else the caption, else *Photo*, with the sender: *Rough In · Luis Ortega*. */
  label: string
  bytes: number
  /** The attachment's name, numbered so two shots of one stage stay apart: *1 Rough In · Luis Ortega.jpg*. */
  filename: string
  how: ReportEmailPhotoHow
  driveUrl: string | null
  storagePath: string | null
}

const DRIVE_FILE_URL = 'https://drive.google.com/file/d/'

/** How many bytes read, in the words the tiles use: *310 KB*, *1.2 MB*. */
export function photoBytesWords(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function photoLabel(r: ReportEmailPhotoRow): string {
  const what = (r.stage_name ?? '').trim() || (r.caption ?? '').trim() || 'Photo'
  const who = (r.by_name ?? '').trim()
  return who ? `${what} · ${who}` : what
}

/** A name a mail client and a file system both take: no slashes, quotes or control characters. */
export function reportEmailPhotoFilename(label: string, index: number): string {
  const safe = label.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Photo'
  return `${index + 1} ${safe}.jpg`
}

/** Which photos attach, which link, which are only named: the rows in order, the caps applied as they come. */
export function planReportEmailPhotos(
  rows: ReadonlyArray<ReportEmailPhotoRow>,
  caps: { maxCount?: number; maxBytes?: number } = {},
): ReportEmailPhoto[] {
  const maxCount = caps.maxCount ?? REPORT_EMAIL_PHOTO_MAX_COUNT
  const maxBytes = caps.maxBytes ?? REPORT_EMAIL_PHOTO_MAX_BYTES
  let attached = 0
  let total = 0
  return rows.map((r, i) => {
    const label = photoLabel(r)
    const bytes = Math.max(0, Number(r.bytes ?? 0) || 0)
    const base = { id: r.id, label, bytes, filename: reportEmailPhotoFilename(label, i), driveUrl: null as string | null, storagePath: null as string | null }
    if (r.drive_file_id) return { ...base, how: 'drive', driveUrl: `${DRIVE_FILE_URL}${encodeURIComponent(r.drive_file_id)}/view` }
    if (r.storage_path && attached < maxCount && total + bytes <= maxBytes) {
      attached += 1
      total += bytes
      return { ...base, how: 'attached', storagePath: r.storage_path }
    }
    return { ...base, how: 'named' }
  })
}

/** The bytes as Resend takes an attachment: base64, built in pieces so a 2 MB shot never overflows the call stack. */
export function photoBytesBase64(bytes: Uint8Array): string {
  let binary = ''
  const piece = 0x8000
  for (let i = 0; i < bytes.length; i += piece) binary += String.fromCharCode(...bytes.subarray(i, i + piece))
  return btoa(binary)
}

/** The clause on the push's body: *· 2 photos*, nothing for none. */
export function reportPhotoCountClause(count: number): string {
  if (!count || count <= 0) return ''
  return count === 1 ? ' · 1 photo' : ` · ${count} photos`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** What each photo's line says after its label and size. */
export function reportEmailPhotoWords(p: ReportEmailPhoto): string {
  if (p.how === 'attached') return 'attached'
  if (p.how === 'drive') return 'in the customer’s Drive folder'
  return 'on its way to the customer’s Drive folder, not attached'
}

/**
 * The Photos block of the email: a heading with the count, then one line a photo. Empty strings for a report with
 * none, so the email reads as it did.
 */
export function reportPhotosEmailBlock(photos: ReadonlyArray<ReportEmailPhoto>): { html: string; text: string } {
  if (photos.length === 0) return { html: '', text: '' }
  const attached = photos.filter((p) => p.how === 'attached').length
  const heading = `Photos · ${photos.length}${attached ? ` · ${attached === photos.length ? 'attached' : `${attached} attached`}` : ''}`
  const lines = photos.map((p) => {
    const size = p.bytes ? ` · ${photoBytesWords(p.bytes)}` : ''
    return { label: `${p.label}${size}`, words: reportEmailPhotoWords(p), url: p.driveUrl }
  })
  const html =
    `<div style="margin-bottom:12px"><div style="color:#6b7280;font-weight:600;font-size:13px;margin-bottom:2px">${escapeHtml(heading)}</div>` +
    lines
      .map((l) => {
        const words = l.url ? `<a href="${escapeHtml(l.url)}" style="color:#2563eb">${escapeHtml(l.words)}</a>` : escapeHtml(l.words)
        return `<div style="font-size:14px;color:#111827">${escapeHtml(l.label)} · ${words}</div>`
      })
      .join('') +
    `</div>`
  const text = `${heading}:\n${lines.map((l) => `${l.label} · ${l.words}${l.url ? ` ${l.url}` : ''}`).join('\n')}\n`
  return { html, text }
}
