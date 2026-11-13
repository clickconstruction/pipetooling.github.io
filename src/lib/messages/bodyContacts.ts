/**
 * Messages: the contact points in a line's words (v2.6513, Grace's ask on Glenn Gelwin's invitation to bid). An email's
 * signature carries a phone number, an address or two and a street address, and the viewer drew them as plain words:
 * to call Glenn's cell a person copied the number out of the window. This kernel reads the words into pieces the
 * viewer draws — text, a web address, and a **contact point**: a phone number (an extension kept as words, "(832)
 * 871-4166 ext. 121"), an email address, or a street address — so each point can be a press (`MessageBodyContacts`).
 *
 * The mail client's markers, `[image: phone]`, `[image: email]`, `[image: company-address]` and the rest, fold into
 * the kind of the line and are hidden: a line marked *phone* is read for its number, one marked *email* for its
 * address, one marked *company-address* is the address whole; a marker on a line that holds nothing pressable stays
 * as it came, since hiding it would hide that the sender's picture was there. A tracking link (`server.utags.co`, the
 * social links) stays a plain link and is never a contact point, because a link piece is never read for one.
 *
 * `contactPieces` works over pieces of text and links, so it sits on top of `bodyLinks.ts`'s `bodyPieces` (v2.6508):
 * `bodyContactPieces(body)` is `contactPieces(bodyPieces(body))`, the links and the sender's bold read there, the
 * contact points cut out here. Pure.
 */

import { normalizeChannel, type ChannelKind } from '../contacts/kernel'
import { bodyPieces } from './bodyLinks'

export type ContactPoint =
  /** A phone number as written, the extension's digits beside it when the words carried one. */
  | { kind: 'phone'; number: string; ext: string | null; words: string }
  | { kind: 'email'; address: string; words: string }
  /** A street address, as written. */
  | { kind: 'address'; words: string }

export type BodyContactPiece =
  | { kind: 'text'; text: string; bold?: boolean }
  | { kind: 'link'; href: string; bold?: boolean }
  | { kind: 'contact'; point: ContactPoint; bold?: boolean }

/** What `contactPieces` reads: `bodyLinks.ts`'s pieces. */
export type WordsPiece = { kind: 'text'; text: string; bold?: boolean } | { kind: 'link'; href: string; bold?: boolean }

/** The mail client's picture marker at the start of a line, or anywhere on one: `[image: phone]`. */
const MARKER_RE = /\[image:\s*([a-z0-9_-]+)\]\s*/gi
const LEAD_MARKER_RE = /^\s*\[image:\s*([a-z0-9_-]+)\]\s*/i
/** The same, asked once per line: a global pattern's `test` would remember where it stopped. */
const HAS_MARKER_RE = /\[image:\s*[a-z0-9_-]+\]/i

/** A number as a person writes it, with or without the country's 1, then an extension when there is one. */
const PHONE_RE = /(?<![\d@.])(\+?1[\s.-]?)?(\(\d{3}\)\s?|\d{3}[\s.-])\d{3}[\s.-]\d{4}(?!\d)(?:[\s,]*(?:ext\.?|extension|x)\s*(\d{1,6})\b)?/gi
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
/**
 * A street address in the words: a number, the street's words (a comma allowed after the last), a suite when there is
 * one, the city, a two-letter state and the ZIP. "4150 Bluebonnet Dr. Suite 102 Stafford, TX, 77477".
 */
const ADDRESS_RE = /\b\d{1,6}\s+(?:[A-Za-z0-9.'\-]+,?\s+){1,7}?(?:(?:Suite|Ste\.?|Unit|Bldg\.?|#)\s*[A-Za-z0-9\-]+,?\s+)?[A-Za-z.'\-]+(?:\s+[A-Za-z.'\-]+){0,3},\s*[A-Z]{2},?\s+\d{5}(?:-\d{4})?\b/g

type Marker = 'phone' | 'email' | 'address' | 'other' | null

/** The marker's kind, read off the line's leading `[image: …]`. */
function markerOf(line: string): Marker {
  const m = LEAD_MARKER_RE.exec(line)
  if (!m) return null
  const word = m[1]!.toLowerCase()
  if (word === 'phone' || word === 'mobile' || word === 'cell' || word === 'fax') return 'phone'
  if (word === 'email' || word === 'mail') return 'email'
  if (word.includes('address')) return 'address'
  return 'other'
}

type Found = { start: number; end: number; point: ContactPoint }

const overlaps = (found: readonly Found[], start: number, end: number): boolean => found.some((p) => start < p.end && end > p.start)

/** The contact points the patterns find in some words, with where each sits; `given` ranges are already taken. */
function pointsIn(text: string, given: readonly Found[] = []): Found[] {
  const out: Found[] = [...given]
  for (const m of text.matchAll(EMAIL_RE)) {
    const address = m[0].replace(/\.+$/, '')
    if (overlaps(out, m.index!, m.index! + address.length)) continue
    out.push({ start: m.index!, end: m.index! + address.length, point: { kind: 'email', address, words: address } })
  }
  for (const m of text.matchAll(PHONE_RE)) {
    const ext = m[3] ?? null
    const words = m[0].trim()
    const number = ext ? words.replace(/[\s,]*(?:ext\.?|extension|x)\s*\d{1,6}$/i, '') : words
    if (overlaps(out, m.index!, m.index! + words.length)) continue
    out.push({ start: m.index!, end: m.index! + words.length, point: { kind: 'phone', number, ext, words } })
  }
  for (const m of text.matchAll(ADDRESS_RE)) {
    if (overlaps(out, m.index!, m.index! + m[0].length)) continue
    // An address the mail client wrapped reads as one line of words.
    out.push({ start: m.index!, end: m.index! + m[0].length, point: { kind: 'address', words: m[0].replace(/\s+/g, ' ') } })
  }
  return out.sort((a, b) => a.start - b.start)
}

/** Whether a line holds something pressable: a link, a contact point, or the address a marker names. */
function lineHasPress(line: string, marker: Marker): boolean {
  if (/https?:\/\//.test(line)) return true
  const rest = line.replace(LEAD_MARKER_RE, '')
  if (marker === 'address') return rest.trim().length > 0
  return pointsIn(rest).length > 0
}

/**
 * The pieces with every contact point cut out of the text as its own piece, the markers hidden on the lines that hold a
 * press. A link piece passes through untouched, so a tracking link never reads as a contact point. The pieces are read
 * in the body's order, newlines counted, so a line split by a link in its middle is still one line.
 */
export function contactPieces(pieces: readonly WordsPiece[]): BodyContactPiece[] {
  // The lines as the body has them, for each line's marker and whether it holds a press.
  const lines: string[] = ['']
  for (const p of pieces) {
    const last = lines.length - 1
    if (p.kind === 'link') {
      lines[last] = (lines[last] ?? '') + p.href
      continue
    }
    const parts = p.text.split('\n')
    lines[last] = (lines[last] ?? '') + (parts[0] ?? '')
    for (const part of parts.slice(1)) lines.push(part)
  }
  const markers = lines.map(markerOf)
  const hides = lines.map((line, i) => HAS_MARKER_RE.test(line) && lineHasPress(line, markers[i]!))

  const out: BodyContactPiece[] = []
  let lineAt = 0
  for (const p of pieces) {
    if (p.kind === 'link') {
      out.push(p)
      continue
    }
    const parts = p.text.split('\n')
    // The piece's words with the markers hidden, and the addresses the markers name, taken whole.
    const given: Found[] = []
    let text = ''
    parts.forEach((part, j) => {
      const i = lineAt + j
      if (j > 0) text += '\n'
      const cleaned = hides[i] ? part.replace(MARKER_RE, '') : part
      if (markers[i] === 'address' && hides[i] && cleaned.trim()) {
        const words = cleaned.trim()
        const start = text.length + cleaned.indexOf(words)
        given.push({ start, end: start + words.length, point: { kind: 'address', words } })
      }
      text += cleaned
    })
    lineAt += parts.length - 1
    let cursor = 0
    for (const f of pointsIn(text, given)) {
      if (f.start > cursor) out.push({ kind: 'text', text: text.slice(cursor, f.start), bold: p.bold })
      out.push({ kind: 'contact', point: f.point, bold: p.bold })
      cursor = f.end
    }
    if (cursor < text.length) out.push({ kind: 'text', text: text.slice(cursor), bold: p.bold })
  }
  return out
}

/** The body as the viewer draws it: `bodyLinks.ts`'s text, links and bold, and each contact point as its own piece. */
export function bodyContactPieces(body: string): BodyContactPiece[] {
  return contactPieces(bodyPieces(body))
}

/** A point's value, as two points are told apart: the digits of a number, an address in lower case, the words as written. */
export function contactPointKey(p: ContactPoint): string {
  if (p.kind === 'phone') return `phone:${p.number.replace(/\D/g, '')}${p.ext ? `x${p.ext}` : ''}`
  if (p.kind === 'email') return `email:${p.address.toLowerCase()}`
  return `address:${p.words.replace(/\s+/g, ' ').toLowerCase()}`
}

/** Every contact point in the words, once each, in order. */
export function bodyContactPoints(body: string): ContactPoint[] {
  const seen = new Set<string>()
  const out: ContactPoint[] = []
  for (const p of bodyContactPieces(body)) {
    if (p.kind !== 'contact') continue
    const key = contactPointKey(p.point)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(p.point)
  }
  return out
}

/** The words a point reads as on a line: the number with its extension, the address, the street address. */
export function contactPointWords(p: ContactPoint): string {
  return p.kind === 'email' ? p.address : p.words
}

/** Whether a number can take a text: ten digits of the US and Canada, and no extension, which a text cannot dial. */
export function canTextPoint(p: ContactPoint): boolean {
  if (p.kind !== 'phone' || p.ext) return false
  const digits = p.number.replace(/\D/g, '')
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return /^\d{10}$/.test(ten)
}

/** Where *Open the map* goes: the same search the customer window and the bid form open an address with. */
export function mapHref(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`
}

// ---------- the line a press leaves on the thread ----------

export type ContactPress = 'call' | 'text' | 'email' | 'thread' | 'map'

/** Where the press was made: the line's sender and channel, and its day. */
export interface PressSource {
  /** The sender's first name; null for our own line or a note. */
  first: string | null
  /** The line's kind in words: *email*, *text*, *note*. */
  channel: string
  /** The day as `formatDenverCalendarDayShort` writes it: *Oct 22*. */
  dayWords: string
  /** Whether the line is ours. */
  ours: boolean
}

const PRESS_WORDS: Record<ContactPress, string> = {
  call: 'pressed Call on',
  text: 'pressed Text on',
  email: 'pressed Email on',
  thread: 'opened a thread for',
  map: 'opened the map for',
}

/** *Glenn's email of Oct 22*, *our email of Oct 22*, *a note of Nov 4*. */
export function pressSourceWords(s: PressSource): string {
  if (s.channel === 'note' || s.channel === 'event') return `a note of ${s.dayWords}`
  if (s.ours || !s.first) return `our ${s.channel} of ${s.dayWords}`
  return `${s.first}'s ${s.channel} of ${s.dayWords}`
}

/**
 * The gray line a press writes, in the app's words: *Grace pressed Call on (832) 871-4166 ext. 121 from Glenn's email
 * of Oct 22.*, *Grace opened a thread for glenn@marrexbuilders.example from Glenn's email of Oct 22.* The line names the
 * intent; a call Quo places lands its own call line as the fact.
 */
export function contactPressBody(who: string, press: ContactPress, value: string, source: PressSource): string {
  return `${who.trim() || 'Someone'} ${PRESS_WORDS[press]} ${value} from ${pressSourceWords(source)}.`
}

const PRESS_LINE_RE = /^(.+?) (pressed Call on|pressed Text on|pressed Email on|opened a thread for|opened the map for) (.+) from (.+?)\.$/

/** The press a line records, or null for any other line: its kind and the number or address it was made on. */
export function contactPressOf(body: string): { who: string; press: ContactPress; value: string } | null {
  const m = PRESS_LINE_RE.exec(body.trim())
  if (!m) return null
  const press = (Object.keys(PRESS_WORDS) as ContactPress[]).find((k) => PRESS_WORDS[k] === m[2])
  return press ? { who: m[1]!, press, value: m[3]! } : null
}

/**
 * The thread a press's line opens to: the contact whose number or address is the line's value, compared as the spine
 * compares them (`normalizeChannel`). Null when nobody holds it now, and the line keeps no door.
 */
export function contactForPressValue(contacts: ReadonlyArray<{ id: string; channels: ReadonlyArray<{ kind: ChannelKind; value: string }> }>, value: string): string | null {
  const kind: ChannelKind = value.includes('@') ? 'email' : 'phone'
  const key = normalizeChannel(kind, value)
  if (!key) return null
  return contacts.find((c) => c.channels.some((ch) => ch.kind === kind && normalizeChannel(ch.kind, ch.value) === key))?.id ?? null
}

/** How long Undo stands before the line is written, as Heard back's. */
export const PRESS_UNDO_MS = 10_000

/** The presses' labels: the house Call, Text and Email, and the map's door. */
export const PRESS_LABEL = { call: 'Call', text: 'Text', email: 'Email', map: 'Open the map' } as const

export const PRESS_WORDS_UI = {
  /** The toast while the ten seconds run. */
  toast: (press: ContactPress, value: string) =>
    press === 'thread'
      ? `A thread for ${value} is open. The line lands on this thread in ten seconds.`
      : press === 'map'
        ? `The map opened for ${value}. The line lands on the thread in ten seconds.`
        : `${PRESS_LABEL[press]} pressed on ${value}. The line lands on the thread in ten seconds.`,
  undo: 'Undo',
  undone: 'Undone. Nothing was written.',
  /** The event line's door to the thread a press opened. */
  openIt: 'open it ›',
  tips: {
    call: 'Calls this number. A line on the thread says you pressed it.',
    text: 'Opens the reply box on a text to this number. A line on the thread says you pressed it.',
    email: 'Opens the reply box on an email to this address. A line on the thread says you pressed it.',
    map: 'Opens the address in Google Maps. A line on the thread says you pressed it.',
  },
} as const
