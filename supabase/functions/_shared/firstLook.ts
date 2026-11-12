/**
 * First look, the spike (punch list #319, v2.6981): the pure rules the `first-look` function and the two pages share.
 * A caller gets a link by text and adds photos and a short video of the problem on a page with no sign-in. This file
 * holds the link's code, what a link may take, the check of a file's first bytes, where a file sits in the bucket, a
 * look's state, and every word the customer's page and the desk say.
 *
 * No imports, so the app's tests import it as the function does (`src/lib/firstLook/look.ts` re-exports it).
 */

// ---------------------------------------------------------------------------------------------------------------------
// The link's code: ten letters from the estimate link's alphabet (no look-alikes), kept only as its SHA-256.

export const FIRST_LOOK_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export const FIRST_LOOK_CODE_LENGTH = 10
export const FIRST_LOOK_CODE_RE = /^[23456789abcdefghjkmnpqrstuvwxyz]{10}$/

/** The code as the path carries it: trimmed and lower-cased, or null when it is not ten letters of the alphabet. */
export function firstLookCode(raw: string | null | undefined): string | null {
  const code = (raw ?? '').trim().toLowerCase()
  return FIRST_LOOK_CODE_RE.test(code) ? code : null
}

/**
 * Ten letters from random bytes with no letter likelier than another: 31 letters go into 248 eight times, so a byte
 * at or past 248 is thrown away, as `share_estimate_link` does. `randomBytes` is the platform's own source.
 */
export function mintFirstLookCode(randomBytes: (n: number) => Uint8Array): string {
  let out = ''
  let guard = 0
  while (out.length < FIRST_LOOK_CODE_LENGTH) {
    if (++guard > 64) throw new Error('first look: the random source gave no usable bytes')
    for (const b of randomBytes(32)) {
      if (b >= 248) continue
      out += FIRST_LOOK_ALPHABET[b % FIRST_LOOK_ALPHABET.length]
      if (out.length === FIRST_LOOK_CODE_LENGTH) break
    }
  }
  return out
}

/** Lower-case hex of a digest, for the code's SHA-256. */
export function hexOf(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b.toString(16).padStart(2, '0')
  return s
}

// ---------------------------------------------------------------------------------------------------------------------
// What a link may take.

export const FIRST_LOOK_BUCKET = 'first-look-files'
/** The live project's storage limit for one file, read 2026-11-11. The bucket's own limit is the same number. */
export const FIRST_LOOK_STORAGE_LIMIT_BYTES = 52_428_800

export const FIRST_LOOK_CAPS = {
  photos: 20,
  videos: 3,
  /** A photo is shrunk on the phone to well under this; the cap only stops a file that would not shrink. */
  photoBytes: 8 * 1024 * 1024,
  videoBytes: FIRST_LOOK_STORAGE_LIMIT_BYTES,
  /**
   * How many upload addresses one link may ever be handed for each kind, arrived or not. A file that fails and is
   * tried again uses its own address again, so these only count files picked. They bound what a leaked link can
   * put in the bucket without ever finishing a file: 30 photos and 6 videos.
   */
  photoSigns: 30,
  videoSigns: 6,
  /** How long a link takes files. */
  days: 7,
} as const

export type FirstLookKind = 'photo' | 'video'

const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'] as const

/** A photo, a video, or nothing the page takes. */
export function firstLookKindOfMime(mime: string | null | undefined): FirstLookKind | null {
  const m = (mime ?? '').trim().toLowerCase().split(';')[0] ?? ''
  if ((PHOTO_MIMES as readonly string[]).includes(m)) return 'photo'
  if ((VIDEO_MIMES as readonly string[]).includes(m)) return 'video'
  return null
}

const EXT_BY_MIME: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
}

const MIME_BY_EXT: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
}

/**
 * A file's type as the page sends it: the type the phone gave, or, when a phone's picker gives none, the type its
 * name ends in. Empty for anything the page does not take.
 */
export function firstLookMimeOf(file: { type: string | null | undefined; name: string | null | undefined }): string {
  const given = (file.type ?? '').trim().toLowerCase().split(';')[0] ?? ''
  if (firstLookKindOfMime(given)) return given
  if (given) return ''
  const ext = /\.([a-z0-9]+)$/i.exec((file.name ?? '').trim())?.[1]?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? ''
}

/** Where a file sits in the bucket: `<look id>/<file id>.<ext>`. */
export function firstLookObjectPath(lookId: string, fileId: string, mime: string): string {
  const m = mime.trim().toLowerCase().split(';')[0] ?? ''
  return `${lookId}/${fileId}.${EXT_BY_MIME[m] ?? 'bin'}`
}

export type FirstLookCounts = { photos: number; videos: number; photoSigns: number; videoSigns: number }

export type FirstLookRefusalCode = 'kind' | 'empty' | 'photo-big' | 'video-big' | 'photos-full' | 'videos-full' | 'signs-full'
export type FirstLookRefusal = { code: FirstLookRefusalCode; words: string }

const MB = 1024 * 1024
const mbWords = (bytes: number): string => `${Math.round(bytes / MB)} MB`

/**
 * Whether a link hands out an upload address for this file. `counts` is what the link already holds: the photos and
 * videos that arrived, and the addresses it was ever handed for each kind. Null means yes.
 */
export function firstLookSignRefusal(file: { mime: string | null | undefined; bytes: number }, counts: FirstLookCounts): FirstLookRefusal | null {
  const kind = firstLookKindOfMime(file.mime)
  if (!kind) return { code: 'kind', words: 'Only photos and videos can be sent here.' }
  if (!Number.isFinite(file.bytes) || file.bytes <= 0) return { code: 'empty', words: 'That file is empty. Pick it again.' }
  const full: FirstLookRefusal = { code: 'signs-full', words: 'This link has taken all it can. Call the office and we will send a new one.' }
  if (kind === 'photo') {
    if (file.bytes > FIRST_LOOK_CAPS.photoBytes) return { code: 'photo-big', words: `That photo is too big to send. The most is ${mbWords(FIRST_LOOK_CAPS.photoBytes)}.` }
    if (counts.photos >= FIRST_LOOK_CAPS.photos) return { code: 'photos-full', words: `This link takes ${FIRST_LOOK_CAPS.photos} photos, and it has them.` }
    return counts.photoSigns >= FIRST_LOOK_CAPS.photoSigns ? full : null
  }
  if (file.bytes > FIRST_LOOK_CAPS.videoBytes) return { code: 'video-big', words: `That video is too big to send. The most is ${mbWords(FIRST_LOOK_CAPS.videoBytes)}, about 20 to 40 seconds. Take a shorter one.` }
  if (counts.videos >= FIRST_LOOK_CAPS.videos) return { code: 'videos-full', words: `This link takes ${FIRST_LOOK_CAPS.videos} videos, and it has them.` }
  return counts.videoSigns >= FIRST_LOOK_CAPS.videoSigns ? full : null
}

// ---------------------------------------------------------------------------------------------------------------------
// The first bytes of a file say what it is, whatever its name or declared type says.

const ascii = (bytes: Uint8Array, from: number, to: number): string => {
  let s = ''
  for (let i = from; i < to && i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0)
  return s
}

/** The brands an ISO media file (`ftyp`) carries when it is a still picture from a phone. */
const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']
/** The boxes a QuickTime movie may open with when it carries no `ftyp`: an older camera's file. */
const QUICKTIME_OPENERS = ['moov', 'mdat', 'wide', 'free', 'skip']

/** A photo, a video, or null for anything else: read from the first 16 bytes. */
export function firstLookSniff(bytes: Uint8Array): FirstLookKind | null {
  if (bytes.length < 12) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'photo'
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') return 'photo'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'photo'
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video'
  if (ascii(bytes, 4, 8) === 'ftyp') return HEIF_BRANDS.includes(ascii(bytes, 8, 12).toLowerCase()) ? 'photo' : 'video'
  if (QUICKTIME_OPENERS.includes(ascii(bytes, 4, 8))) return 'video'
  return null
}

// ---------------------------------------------------------------------------------------------------------------------
// A look's state.

export type FirstLookState = 'open' | 'closed' | 'expired'

export function firstLookState(row: { closed_at: string | null; expires_at: string }, nowIso: string): FirstLookState {
  if (row.closed_at) return 'closed'
  return Date.parse(row.expires_at) <= Date.parse(nowIso) ? 'expired' : 'open'
}

/** The day a link made now stops taking files. */
export function firstLookExpiry(nowIso: string): string {
  return new Date(Date.parse(nowIso) + FIRST_LOOK_CAPS.days * 24 * 60 * 60 * 1000).toISOString()
}

// ---------------------------------------------------------------------------------------------------------------------
// Words.

export const FIRST_LOOK_COMPANY = 'Click Plumbing'

/** The first word of a name, for *Rosa asked for a look*. Empty when there is no name. */
export function firstNameOf(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? ''
}

/** *3 photos and 1 video*, *1 photo*, *2 videos*, or empty for nothing. */
export function firstLookCountWords(photos: number, videos: number): string {
  const p = photos > 0 ? `${photos} ${photos === 1 ? 'photo' : 'photos'}` : ''
  const v = videos > 0 ? `${videos} ${videos === 1 ? 'video' : 'videos'}` : ''
  return p && v ? `${p} and ${v}` : p || v
}

/** The page's opening line under its heading. */
export function firstLookAskedWords(askedBy: string): string {
  const who = firstNameOf(askedBy)
  return `${who ? `${who} asked for a look.` : 'We asked for a look.'} Add a few photos or a short video. We price it before we come out.`
}

export const FIRST_LOOK_WORDS = {
  heading: 'Show us the problem',
  /** Two presses, one a kind: a phone opens the right camera for each, where one press for both opens only the photo camera on some. */
  takePhoto: 'Take a photo',
  takeVideo: 'Take a video',
  choose: 'Choose from your phone',
  tipsHead: 'What helps us most',
  tips: [
    'The whole thing, from a step back.',
    'A close-up of the leak or the broken part.',
    'The label on the water heater or the fixture.',
    'A video of 10 to 20 seconds if it drips, runs or makes a noise.',
  ],
  /** The owner's own line, 2026-11-11. */
  why: 'The more information you give us, and the higher the quality of the photos and videos, the more accurate we can be, allowing us to get you the best service and fewer trips means a better price.',
  only: 'Only Click Plumbing sees what you send.',
  emergency: 'Water running right now? Shut off the main and call',
  placeHead: 'Where is it?',
  places: ['Kitchen', 'Bathroom', 'Water heater', 'Outside', 'Somewhere else'],
  wordsHead: 'What is going on?',
  wordsHint: 'if you like',
  keepOpen: 'Keep this page open. If the signal drops it picks up where it stopped.',
  kept: 'Saved on this phone.',
  noSignal: 'No signal right now. It sends when the signal is back.',
  keptLater: 'Keep this page open if you can. If it closes, open the link again and they are still here for 7 days.',
  tryNow: 'Try now',
  waitsForSignal: 'Sends when the signal is back',
  wayRound: 'No luck with this page?',
  wayRoundRest: 'Reply to our text with the photos. They reach us the same way.',
  more: 'Add more photos or video',
  closeTab: 'You can close this page.',
  closedHead: 'This link is closed',
  closedBody: 'It no longer takes photos. Call the office and we will send a new one.',
  expiredHead: 'This link has run out',
  expiredBody: 'A link takes photos for 7 days. Call the office and we will send a new one.',
  notFoundHead: 'This link does not open anything',
  notFoundBody: 'Check that the whole link came through in the text, or call the office.',
  lockedHead: 'Too many tries',
  lockedBody: 'This phone has tried too many links that open nothing. Wait an hour, or call the office.',
} as const

/** The send press: *Send 3 photos and 1 video*, or why it waits. */
export function firstLookSendLabel(input: { photos: number; videos: number; sending: number; percent: number | null; waitingForSignal: boolean }): { label: string; ready: boolean } {
  if (input.waitingForSignal) return { label: FIRST_LOOK_WORDS.waitsForSignal, ready: false }
  if (input.sending > 0) {
    const what = input.sending === 1 ? 'one file' : `${input.sending} files`
    return { label: input.percent == null ? `Waiting for ${what}` : `Waiting for ${what}, ${input.percent}%`, ready: false }
  }
  const count = firstLookCountWords(input.photos, input.videos)
  return count ? { label: `Send ${count}`, ready: true } : { label: 'Add a photo or a video first', ready: false }
}

export type FirstLookThanks = { got: string; steps: string[] }

/**
 * The thank-you: what arrived, and a promise that is only the office's own hours. `closesWords` is the day's closing
 * time (*5 PM*) while the office is open; `opensWords` is when it next opens (*tomorrow at 7:30 AM*) while it is not.
 */
export function firstLookThanks(input: { askedBy: string; photos: number; videos: number; officeOpen: boolean; closesWords: string | null; opensWords: string | null }): FirstLookThanks {
  const who = firstNameOf(input.askedBy)
  const count = firstLookCountWords(input.photos, input.videos)
  const got = who ? `Got it. ${who} has your ${count}.` : `Got it. We have your ${count}.`
  const looks = input.officeOpen
    ? `${who || 'The office'} looks at them today${input.closesWords ? `, before ${input.closesWords}` : ''}.`
    : `We look first thing${input.opensWords ? ` ${input.opensWords}` : ' when the office opens'}.`
  return {
    got,
    steps: [looks, 'We text you at this number with a price or a time to come out.', 'The tech confirms the price at your home before any work starts.'],
  }
}

/** The thread's line when files arrive on a look tied to a person, and its key so a second send is a second line. */
export function firstLookSentLine(input: { lookId: string; sentCount: number; photos: number; videos: number }): { key: string; body: string } {
  return {
    key: `look:${input.lookId}:sent:${input.sentCount}`,
    body: `📷 Sent ${firstLookCountWords(input.photos, input.videos) || 'nothing new'} through the Show us link.`,
  }
}

/** The text the office sends with the link. Named by who is writing, since it is often a first text. */
export function firstLookAskLine(input: { customerFirst: string | null; me: string; url: string }): string {
  const hi = input.customerFirst?.trim() ? `Hi ${input.customerFirst.trim()}, this` : 'Hi, this'
  const me = firstNameOf(input.me)
  return `${hi} is ${me || 'the office'} with ${FIRST_LOOK_COMPANY}. So we can price this before we come out, send us a few photos or a short video here: ${input.url}`
}

/** A size in words: *24.1 MB*, *612 KB*. */
export function firstLookBytesWords(bytes: number | null | undefined): string {
  const b = Number(bytes)
  if (!Number.isFinite(b) || b <= 0) return ''
  return b >= MB ? `${(b / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`
}

/** What the desk says a file's upload was like: *24.1 MB · in pieces · picked up 2 times · 38 s · iPhone Safari*. */
export function firstLookFileFacts(file: { bytes: number | null; road: string | null; resumed: number; took_ms: number | null; seconds: number | null; client: string | null }): string {
  const parts: string[] = []
  const size = firstLookBytesWords(file.bytes)
  if (size) parts.push(size)
  if (file.seconds != null && file.seconds > 0) parts.push(`${Math.round(file.seconds)} s long`)
  if (file.road === 'pieces') parts.push('in pieces')
  if (file.road === 'whole') parts.push('in one go')
  if (file.resumed > 0) parts.push(`picked up ${file.resumed} ${file.resumed === 1 ? 'time' : 'times'}`)
  if (file.took_ms != null && file.took_ms > 0) parts.push(`took ${file.took_ms >= 10_000 ? `${Math.round(file.took_ms / 1000)} s` : `${(file.took_ms / 1000).toFixed(1)} s`}`)
  if (file.client) parts.push(file.client)
  return parts.join(' · ')
}

/** The phone and browser, in two words, from a user agent: what the spike's table is read by. */
export function firstLookClientWords(userAgent: string | null | undefined): string {
  const ua = userAgent ?? ''
  const device = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other'
  const browser = /CriOS|Chrome\//.test(ua) && !/Edg\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Safari\//.test(ua) ? 'Safari' : 'browser'
  return `${device} ${browser}`
}

// ---------------------------------------------------------------------------------------------------------------------
// What the function answers, and how the page reads it.

export type FirstLookPagePayload = {
  ok: true
  look: { askedBy: string; photos: number; videos: number; sentCount: number }
  caps: { photos: number; videos: number; photoBytes: number; videoBytes: number }
  office: { phone: string; open: boolean; closesWords: string | null; opensWords: string | null }
}

export type FirstLookPageView =
  | { kind: 'loading' }
  | { kind: 'open'; payload: FirstLookPagePayload }
  | { kind: 'closed'; phone: string }
  | { kind: 'expired'; phone: string }
  | { kind: 'not_found' }
  | { kind: 'locked' }
  | { kind: 'error'; status: number }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/** The page's view from the function's status and body. Never throws: an answer it cannot read is an error view. */
export function firstLookPageView(status: number, body: unknown): FirstLookPageView {
  const b = isRecord(body) ? body : {}
  if (status === 404) return { kind: 'not_found' }
  if (status === 429 && b.code === 'locked') return { kind: 'locked' }
  if (status === 410) return b.error === 'closed' ? { kind: 'closed', phone: str(b.phone) } : { kind: 'expired', phone: str(b.phone) }
  if (status !== 200 || b.ok !== true || !isRecord(b.look) || !isRecord(b.caps) || !isRecord(b.office)) return { kind: 'error', status }
  return {
    kind: 'open',
    payload: {
      ok: true,
      look: { askedBy: str(b.look.askedBy), photos: num(b.look.photos), videos: num(b.look.videos), sentCount: num(b.look.sentCount) },
      caps: {
        photos: num(b.caps.photos) || FIRST_LOOK_CAPS.photos,
        videos: num(b.caps.videos) || FIRST_LOOK_CAPS.videos,
        photoBytes: num(b.caps.photoBytes) || FIRST_LOOK_CAPS.photoBytes,
        videoBytes: num(b.caps.videoBytes) || FIRST_LOOK_CAPS.videoBytes,
      },
      office: {
        phone: str(b.office.phone),
        open: b.office.open === true,
        closesWords: str(b.office.closesWords) || null,
        opensWords: str(b.office.opensWords) || null,
      },
    },
  }
}

/** *17:00* as *5 PM*, *07:30* as *7:30 AM*. Empty for anything that is not a clock time. */
export function clockWords(hm: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hm ?? '').trim())
  if (!m) return ''
  const h = Number(m[1])
  const min = m[2] ?? '00'
  if (h > 23 || Number(min) > 59) return ''
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${min === '00' ? '' : `:${min}`} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * The closing time the thank-you names while the office is open: *5 PM*. Nothing when the office is set to answer
 * around the clock, or when its day runs to the last half hour before midnight, which is the same thing said in
 * hours: *before 11:59 PM* is no promise (seen on the live walk at 2 AM, 2026-11-12).
 */
export function firstLookClosesWords(hours: { closes: string; always: boolean }): string | null {
  if (hours.always) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(hours.closes.trim())
  if (!m) return null
  if (Number(m[1]) * 60 + Number(m[2]) >= 23 * 60 + 30) return null
  return clockWords(hours.closes) || null
}

/** The desk's row, as the function hands it. */
export type FirstLookDeskFile = {
  id: string
  kind: FirstLookKind
  mime: string
  name: string
  bytes: number | null
  seconds: number | null
  road: string | null
  resumed: number
  took_ms: number | null
  client: string | null
  finished_at: string | null
  url: string | null
}

export type FirstLookDeskRow = {
  id: string
  label: string
  contactId: string | null
  contactName: string | null
  askedBy: string
  madeAt: string
  expiresAt: string
  openedAt: string | null
  sentAt: string | null
  closedAt: string | null
  state: FirstLookState
  place: string | null
  words: string | null
  files: FirstLookDeskFile[]
}

/** A look's name on the desk: the person, else its label, else *A test look*. */
export function firstLookDeskName(row: Pick<FirstLookDeskRow, 'contactName' | 'label'>): string {
  return row.contactName?.trim() || row.label.trim() || 'A test look'
}

/** Where a look stands, in the desk's words. */
export function firstLookDeskStanding(row: Pick<FirstLookDeskRow, 'state' | 'openedAt' | 'sentAt' | 'files'>): string {
  if (row.state === 'closed') return 'Closed'
  if (row.state === 'expired') return 'Ran out'
  const done = row.files.filter((f) => f.finished_at)
  const photos = done.filter((f) => f.kind === 'photo').length
  const videos = done.filter((f) => f.kind === 'video').length
  const count = firstLookCountWords(photos, videos)
  if (row.sentAt) return `Sent ${count || 'nothing'}`
  if (count) return `${count} in, not sent yet`
  return row.openedAt ? 'Opened, nothing in yet' : 'Not opened yet'
}
