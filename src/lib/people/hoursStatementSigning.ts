/**
 * The signing of a hours statement, the pure half (punch list #212, PR 3): the four channels and the press that names
 * each (the owner's call 1 of 2026-10-29: a text or an email with the link, and a phone in hand), what holds a channel
 * and why, the text's words, the paper path's rules (the scan, the date, the name, the attestation), and the words a
 * sent or signed statement reads under its presses. The window and its two sheets draw these; `hoursStatementSigningIo`
 * does the calls.
 */
import type { HoursStatementState } from './hoursStatementRecord'

export type HoursStatementChannel = 'email' | 'text' | 'link' | 'in_person'

export const HOURS_STATEMENT_CHANNELS: readonly HoursStatementChannel[] = ['email', 'text', 'link', 'in_person']

/** The press for each channel, its verb first: what it will do, in the worker's name where the phone changes hands. */
export function hoursStatementChannelLabel(channel: HoursStatementChannel, workerName: string): string {
  const name = (workerName ?? '').trim() || 'the worker'
  switch (channel) {
    case 'email':
      return 'Email the link'
    case 'text':
      return 'Text the link'
    case 'link':
      return 'Copy the link'
    default:
      return `Hand the phone to ${name}`
  }
}

/** One line under each channel's press, said once. */
export function hoursStatementChannelHint(channel: HoursStatementChannel): string {
  switch (channel) {
    case 'email':
      return 'The worker gets the signing email and signs on their own phone or computer.'
    case 'text':
      return 'Your phone’s texting app opens with the link in a text to the worker.'
    case 'link':
      return 'The link goes to your clipboard, to paste wherever you reach the worker.'
    default:
      return 'The signing page opens on this device, in person, with you present.'
  }
}

/** Why a channel cannot be pressed, or null when it can. */
export function hoursStatementChannelProblem(channel: HoursStatementChannel, contact: { email: string; phone: string }): string | null {
  if (channel === 'email') {
    const e = contact.email.trim()
    if (!e) return 'Add the worker’s email address first.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'That does not read as an email address.'
    return null
  }
  if (channel === 'text') {
    const digits = contact.phone.replace(/\D/g, '')
    if (!digits) return 'Add the worker’s cell number first.'
    if (digits.length < 10) return 'That does not read as a phone number.'
    return null
  }
  return null
}

/** `Here is your hours statement HS-1042-0007 for job 1042 · Ridgeway Lofts. Read it and sign here: <link>`. */
export function hoursStatementTextBody(args: { recordId: string; jobLabel: string; url: string }): string {
  return `Here is your hours statement ${args.recordId} for job ${args.jobLabel}. Read it and sign here: ${args.url}`
}

/** The `sms:` address the device's texting app opens with the body filled in. */
export function smsHref(phone: string, body: string): string {
  const digits = phone.replace(/[^\d+]/g, '')
  return `sms:${digits}?&body=${encodeURIComponent(body)}`
}

/** The signing link with the in-person flag the page reads (`?inperson=1`). */
export function inPersonUrl(acceptUrl: string): string {
  try {
    const u = new URL(acceptUrl)
    u.searchParams.set('inperson', '1')
    return u.toString()
  } catch {
    return acceptUrl.includes('?') ? `${acceptUrl}&inperson=1` : `${acceptUrl}?inperson=1`
  }
}

/** Where a statement stands once its link is out, whatever it was: sent. A signed one stays signed. */
export function hoursStatementStateAfterSend(state: HoursStatementState): HoursStatementState {
  return state === 'signed' ? 'signed' : 'sent'
}

/** What the toast says once the channel did its part. */
export function hoursStatementSentWords(channel: HoursStatementChannel, args: { recordId: string; workerName: string; emailed?: boolean; emailError?: string | null }): string {
  const name = (args.workerName ?? '').trim() || 'the worker'
  switch (channel) {
    case 'email':
      return args.emailed === false ? `${args.recordId} is ready to sign, but the email did not go${args.emailError ? `: ${args.emailError}` : ''}. Copy the link instead.` : `${args.recordId} emailed to ${name} to sign.`
    case 'text':
      return `${args.recordId} is ready to sign. Your texting app has the link for ${name}.`
    case 'link':
      return `${args.recordId} is ready to sign. The link is on your clipboard.`
    default:
      return `${args.recordId} is open on this device for ${name} to sign.`
  }
}

/** The words under the presses on a sent statement. */
export const HOURS_STATEMENT_SENT_WORDS = 'This statement was sent for a signature, so it is a record now. Send it again to mint a new link. The old link stops working.'
/** The words under the presses on a signed statement. */
export const HOURS_STATEMENT_SIGNED_WORDS = 'This statement is signed. The signed PDF is the record. The paper prints again as it was.'
/** The words under the presses while the statement is still the office's to change. */
export const HOURS_STATEMENT_OPEN_WORDS = 'Send for signature… emails, texts or copies the signing link. Sign here now opens it on this device. File a signed scan… keeps a paper signed with a pen.'

export const HOURS_STATEMENT_SCAN_MAX_BYTES = 8 * 1024 * 1024
export const HOURS_STATEMENT_SCAN_MIMES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

/** A stated day as the paper path's sheet keeps it while the office types. */
export type ScanStatedRow = { day: string; hours: string; note: string }

export type ScanDraft = {
  file: { type: string; size: number } | null
  signedOn: string
  printedName: string
  attested: boolean
  rows: ScanStatedRow[]
  todayYmd: string
}

/** The first thing wrong with the paper filing, in words, or null when it can be filed. */
export function hoursStatementScanProblem(d: ScanDraft): string | null {
  if (!d.file) return 'Attach the signed paper as a photo or a PDF.'
  if (!HOURS_STATEMENT_SCAN_MIMES.includes(d.file.type)) return 'The scan must be a JPG, PNG, WEBP, HEIC or PDF.'
  if (d.file.size > HOURS_STATEMENT_SCAN_MAX_BYTES) return 'The scan is over 8 MB. Take a smaller photo.'
  if (!d.printedName.trim()) return 'Type the name the worker signed with.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.signedOn)) return 'Pick the day the worker signed.'
  if (d.signedOn > d.todayYmd) return 'The signing day cannot be ahead of today.'
  for (const [i, r] of d.rows.entries()) {
    const blank = !r.day.trim() && !r.hours.trim() && !r.note.trim()
    if (blank) continue
    if (!r.day.trim()) return `Stated row ${i + 1} needs its day.`
    if (r.hours.trim() && !/^\d+([.,]\d+)?$/.test(r.hours.trim())) return `Stated row ${i + 1}: hours must be a number.`
  }
  if (!d.attested) return 'Confirm the days were typed exactly as the worker wrote them.'
  return null
}

/** The rows the office typed, blanks dropped, as the function takes them. */
export function scanRowsToPost(rows: readonly ScanStatedRow[]): Array<{ day: string; hours: string | null; note: string }> {
  return rows.filter((r) => r.day.trim() || r.hours.trim() || r.note.trim()).map((r) => ({ day: r.day.trim(), hours: r.hours.trim() || null, note: r.note.trim() }))
}
