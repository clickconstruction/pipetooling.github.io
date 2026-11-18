/**
 * What a Drive door tells the office when something inside it threw (v2.7635). Until then `drive-link` answered every
 * thrown error with the one word `failed`, and the screen showed that word: a receipt photo that Drive refused read
 * the same as one a lost connection dropped, and the reason stayed in the function's log.
 *
 * Pure: it reads the thrown error's own words, which the Drive helpers write in a few fixed shapes
 * (`Upload failed (403): …`, `Folder create failed (500): …`, `Trash failed (403): …`,
 * `Google token exchange failed (400): …`, `Drive answered 503`), and says who refused, in whose words, and whether sending the same file again can help.
 * `retry` is true for a busy or broken Drive (408, 429, 5xx, a rate limit, a web page where an answer should be) and
 * for a Drive the app could not reach, and false for a refusal the same file would meet again.
 */
export type DriveFailureWhy = 'drive' | 'google' | 'unreachable' | 'unknown'

export type DriveFailure = {
  /** The sentence the screen shows. */
  error: string
  why: DriveFailureWhy
  /** Sending the same thing again can help. */
  retry: boolean
  /** The HTTP status the door answers with: 502 when Drive or Google refused, 500 when the app itself tripped. */
  status: number
}

/** The longest reason the screen is handed: a thrown error can carry a page of text. */
export const DRIVE_FAILURE_REASON_MAX = 200

/** `said` is absent where the words after the status are the app's own, not Drive's: they are never quoted as Drive's. */
const SHAPES: ReadonlyArray<{ re: RegExp; why: DriveFailureWhy; lead: string; said?: string }> = [
  { re: /^Upload(?: start| piece| status)? failed \((\d{3})\):\s*(.*)$/s, why: 'drive', lead: 'Drive did not take the file.', said: 'Drive said' },
  { re: /^Folder create failed \((\d{3})\):\s*(.*)$/s, why: 'drive', lead: 'Drive did not make the folder.', said: 'Drive said' },
  { re: /^Trash failed \((\d{3})\):\s*(.*)$/s, why: 'drive', lead: 'Drive did not move the file to its trash.', said: 'Drive said' },
  { re: /^Untrash failed \((\d{3})\):\s*(.*)$/s, why: 'drive', lead: 'Drive did not put the file back.', said: 'Drive said' },
  { re: /^Google token exchange failed \((\d{3})\):\s*(.*)$/s, why: 'google', lead: 'Google did not let the app in to Drive.', said: 'Google said' },
  { re: /^Drive source fetch failed \((\d{3})\)(.*)$/s, why: 'drive', lead: 'Drive did not hand the file over.' },
  { re: /^Drive answered (\d{3})(.*)$/s, why: 'drive', lead: 'Drive did not answer as it should.' },
]

/** A status a second try can get past: Drive busy, Drive broken, or a wait that ran out. */
export function driveStatusRetries(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && typeof (e as { message?: unknown }).message === 'string') return (e as { message: string }).message
  return ''
}

function clip(words: string): string {
  const one = words.replace(/\s+/g, ' ').trim()
  return one.length > DRIVE_FAILURE_REASON_MAX ? `${one.slice(0, DRIVE_FAILURE_REASON_MAX - 1).trimEnd()}…` : one
}

/** A fetch that never got an answer: Deno and browsers throw a `TypeError` for it, with words that vary. */
function unreachable(e: unknown, message: string): boolean {
  const name = e instanceof Error ? e.name : ''
  if (name === 'TypeError' && /fetch|network|connect|dns|socket|tls/i.test(message)) return true
  return /error sending request|connection (?:reset|refused|closed)|network (?:error|is unreachable)|timed out|ECONNRESET|ENOTFOUND|ETIMEDOUT/i.test(message)
}

/** What the screen reads when Drive answered with a web page where its JSON should be. */
export const DRIVE_SENT_A_PAGE_WORDS = 'Drive sent a web page where its answer should be. It does that when it is busy.'

/**
 * A helper read Drive's answer as JSON and met a web page (`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`).
 * Google's front door sends one when it is busy or a gateway failed, whatever the status. This is the failure the
 * owner met on 2026-11-17: `uploadBytes` threw it, and the door said `failed`.
 */
function unreadableAnswer(e: unknown, message: string): boolean {
  const name = e instanceof Error ? e.name : ''
  return /is not valid JSON|<!DOCTYPE|<html/i.test(message) || (name === 'SyntaxError' && /JSON|Unexpected (?:token|end)/i.test(message))
}

/** The sentence, the kind and the retry answer for one thrown error. Never throws, never returns the bare word `failed`. */
export function driveFailureOf(e: unknown): DriveFailure {
  const message = messageOf(e).trim()
  for (const shape of SHAPES) {
    const m = shape.re.exec(message)
    if (!m) continue
    const status = Number(m[1])
    const reason = clip((m[2] ?? '').replace(/^[\s—–-]+/, ''))
    const known = shape.said && reason && reason !== 'unknown'
    const error = known ? `${shape.lead} ${shape.said}: ${reason}` : `${shape.lead} It gave no reason (${status}).`
    return { error, why: shape.why, retry: driveStatusRetries(status) || /rate limit/i.test(reason), status: 502 }
  }
  if (unreachable(e, message)) return { error: 'The app could not reach Drive.', why: 'unreachable', retry: true, status: 502 }
  if (unreadableAnswer(e, message)) return { error: DRIVE_SENT_A_PAGE_WORDS, why: 'drive', retry: true, status: 502 }
  if (!message || message === 'failed') return { error: 'The app hit a problem of its own and has no reason to give.', why: 'unknown', retry: true, status: 500 }
  return { error: `The app hit a problem of its own: ${clip(message)}`, why: 'unknown', retry: false, status: 500 }
}
