/**
 * Counter tickets: where a ticket's page waits and what it is named in Drive (punch list #295, PR 1). One source for
 * the sweep (`photo-save`) and the app (`src/lib/tickets/ticket.ts` re-exports it): the bucket path, the folder under
 * the job's folder, and the file's name by the day, the person and the total.
 *
 * No imports, so the app's tests import it as the functions do (the `whereFilesGo.ts` rule). The Drive-safe rule is
 * `driveSafeName`'s, written again here: a backslash and a control character out, whitespace folded.
 */

export const COUNTER_TICKETS_BUCKET = 'counter-tickets'

/**
 * Under the job's folder: Team only › Tickets. Never Customer Pictures, where a phone photo lands: a ticket shows
 * prices, and the customer may be given that folder.
 */
export const TICKET_FOLDER_PATH: readonly string[] = ['Team only', 'Tickets']

/** Drive takes longer names; the office reads them in a list (`whereFilesGo.ts`' FOLDER_NAME_MAX). */
export const TICKET_NAME_MAX = 120
export const TICKET_NAME_SEPARATOR = ' · '

/** What a page may be: a picture the phone shrank, or a PDF the store sent. */
export const TICKET_PAGE_MIMES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

function safeName(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/\\/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The file ending a page's kind takes; a kind the bucket does not take reads as a picture. */
export function ticketFileExt(mime: string | null | undefined): string {
  const m = String(mime ?? '').toLowerCase()
  if (m === 'application/pdf') return 'pdf'
  if (m === 'image/png') return 'png'
  if (m === 'image/webp') return 'webp'
  return 'jpg'
}

/** `<uploader>/<ticket>/<page>.<ext>`: a person writes under their own id, and a page is read where its ticket is. */
export function ticketStoragePath(a: { uploaderId: string; ticketId: string; pageId: string; mime?: string | null }): string {
  return `${a.uploaderId}/${a.ticketId}/${a.pageId}.${ticketFileExt(a.mime)}`
}

export type TicketNameInput = {
  /** The day the ticket was taken, YYYY-MM-DD in the app's zone. */
  dayYmd: string
  byName: string
  /** The typed total in dollars, when the taker gave one. */
  total?: number | null
  /** The page's place on the ticket, from 1. */
  pageNo?: number | null
  mime?: string | null
}

/**
 * *2026-11-04 Jordan · Ticket.jpg*, *2026-11-04 Jordan · Ticket $228.58.jpg*, *… · Ticket $228.58 · page 2.jpg*,
 * *2026-11-04 Jordan · Ticket.pdf*; `taken` above one adds *(2)* the way `freeName` asks.
 */
export function ticketDriveName(a: TicketNameInput, taken = 1): string {
  const who = safeName(a.byName) || 'Someone'
  const total = typeof a.total === 'number' && Number.isFinite(a.total) && a.total > 0 ? ` $${a.total.toFixed(2)}` : ''
  const page = typeof a.pageNo === 'number' && a.pageNo > 1 ? `${TICKET_NAME_SEPARATOR}page ${Math.round(a.pageNo)}` : ''
  const base = `${a.dayYmd} ${who}${TICKET_NAME_SEPARATOR}Ticket${total}${page}`.slice(0, TICKET_NAME_MAX).trim()
  return `${base}${taken > 1 ? ` (${taken})` : ''}.${ticketFileExt(a.mime)}`
}
