/**
 * Messages, punch list #223 PR 3 (v2.6222): an invitation to bid, read from an email's subject, words and links. A
 * general contractor's estimating platform and a public agency's procurement system send person-to-person mail that
 * asks us to price a job; the New lane reads such a line as **Bid it?** rather than *Who is this?*, since the sender
 * need not be named for the bid to start. Pure, and light enough for the edge copy (`scripts/edge-kernels.mjs`):
 * `gmail-sync` reads each line in with it and keeps the facts on the line (`messages.invitation`), so the sort card
 * never reads the body again; the client reads older lines with the same kernel.
 *
 * What it reads: the cue (*invitation to bid*, *ITB*, *RFP*, *addendum*, *solicitation*, *notice to bidders*, *pre-bid*,
 * *plans are available* …) in the subject, or in the first lines of the body when a bid platform's page is linked; the
 * project's name from the subject; a due day and time when the words name one (*bids due Thursday, November 12 at
 * 2:00 PM*); the platform's page by its host. A plain email that names none of it reads as none.
 */

/** What kind of mail it is: an invitation to price, an addendum to one, an agency's solicitation, or a pre-bid notice. */
export type InvitationKind = 'invitation' | 'addendum' | 'solicitation' | 'prebid'

/** How a person answered the invitation on the sort card (the RPCs write it into the same jsonb). */
export interface InvitationAnswer {
  what: 'bid' | 'not_for_us' | 'kept'
  at: string
  by: string | null
  reason?: string | null
  bid_id?: string | null
}

export interface Invitation {
  kind: InvitationKind
  /** The project's name as the subject gives it, the cue stripped. Null when the subject names none. */
  project: string | null
  /** When bids are due: the civil day as YYYY-MM-DD and, when the words give one, the time as 24-hour HH:MM. */
  due: { date: string; time: string | null } | null
  /** The bid platform's page: its label (PlanHub, BuildingConnected…) and the link. Null when none is linked. */
  portal: { label: string; url: string } | null
  /** The words that made it read as one, lower case: "invitation to bid". */
  cue: string
  /** A person's answer, once there is one. */
  answer?: InvitationAnswer | null
}

const CUES: ReadonlyArray<readonly [RegExp, InvitationKind]> = [
  [/\baddend(?:um|a)\b/i, 'addendum'],
  [/\bpre-?bid\b/i, 'prebid'],
  [/\binvitation to (?:bid|quote|tender|propose)\b|\binvited to (?:bid|quote)\b|\bbid invitation\b|\bITB\b|\bIFB\b|\bRFP\b|\bRFQ\b|\bRFB\b|\brequest for (?:proposals?|quotes?|quotations?|qualifications|bids?)\b|\bsubcontractor bids? (?:requested|wanted|needed)\b|\bbids? requested\b/i, 'invitation'],
  [/\bsolicitation\b|\bnotice to (?:respondents|bidders|proposers|offerors)\b|\bbid room\b|\bbid opening\b|\bplans (?:are|now) available\b|\bsealed bids?\b|\bbid (?:posting|opportunity)\b/i, 'solicitation'],
]

/** The bid platforms and procurement systems, by a piece of their host, with the label the card shows. */
const PORTAL_HOSTS: ReadonlyArray<readonly [string, string]> = [
  ['planhub', 'PlanHub'],
  ['buildingconnected', 'BuildingConnected'],
  ['procore', 'Procore'],
  ['constructconnect', 'ConstructConnect'],
  ['isqft', 'iSqFt'],
  ['buildingblok', 'BuildingBlok'],
  ['pantera', 'Pantera'],
  ['smartbid', 'SmartBid'],
  ['smartbidnet', 'SmartBid'],
  ['bidnet', 'BidNet'],
  ['bonfirehub', 'Bonfire'],
  ['gobonfire', 'Bonfire'],
  ['civcast', 'CivCast'],
  ['demandstar', 'DemandStar'],
  ['txsmartbuy', 'SmartBuy'],
  ['comptroller.texas.gov', 'ESBD'],
  ['ionwave', 'IonWave'],
  ['bidsync', 'Periscope'],
  ['periscopeholdings', 'Periscope'],
  ['publicpurchase', 'Public Purchase'],
  ['planetbids', 'PlanetBids'],
  ['opengov', 'OpenGov'],
  ['construction.com', 'Dodge'],
  ['bidclerk', 'BidClerk'],
  ['plan.room', 'the plan room'],
  ['planroom', 'the plan room'],
]

/** Hosts a mail's footer links point at that are never the invitation's page. */
const NEVER_PORTAL = /(?:^|\.)(?:google\.com|gstatic\.com|facebook\.com|linkedin\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|apple\.com|microsoft\.com|outlook\.com|w3\.org)$/i

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTH_WORDS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** How many lines of the body the cue is looked for in, when the subject carries none. */
export const CUE_LINES = 25

/** A due day read more than this many days before the mail came is next year's. */
const PAST_DAYS = 60

/** The cue in a text, the first one that matches, as the kind it says and the words that said it. */
export function invitationCue(text: string): { kind: InvitationKind; cue: string } | null {
  // The cue that comes first in the words wins: *Solicitation Notice: RFP 27-031* is a solicitation, *Addendum 2 to
  // the invitation* an addendum.
  let best: { kind: InvitationKind; cue: string; at: number } | null = null
  for (const [re, kind] of CUES) {
    const m = re.exec(text)
    if (m && (!best || m.index < best.at)) best = { kind, cue: m[0].toLowerCase(), at: m.index }
  }
  return best ? { kind: best.kind, cue: best.cue } : null
}

/** The bid platform's page among the links: the first whose host is a known platform's, else null. */
export function portalLink(links: readonly string[]): { label: string; url: string } | null {
  for (const url of links) {
    let host = ''
    try {
      host = new URL(url.includes('://') ? url : `https://${url}`).hostname.toLowerCase()
    } catch {
      continue
    }
    if (!host || NEVER_PORTAL.test(host)) continue
    const hit = PORTAL_HOSTS.find(([piece]) => host.includes(piece))
    if (hit) return { label: hit[1], url }
  }
  return null
}

/** The subject without its Re:/Fwd: and the cue, as the project's name: "Invitation to Bid: Oak Hill Clinic, Boerne" → "Oak Hill Clinic, Boerne". */
export function projectFromSubject(subject: string, cue: string): string | null {
  let s = subject.replace(/^\s*(?:(?:re|fwd?|fw)\s*:\s*)+/i, '').trim()
  if (!s) return null
  // The cue and what wraps it: "Invitation to Bid:", "[ITB]", "ITB -", "Addendum 2 -".
  const esc = cue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  s = s.replace(new RegExp(`\\[?\\b${esc}\\b\\]?(?:\\s+notice)?\\s*(?:#?\\s*\\d+[a-z]?)?\\s*[:\\-–—|]*`, 'i'), ' ')
  // A platform's own framing: "New invitation from Ridgeway Builders:" or "via PlanHub".
  s = s.replace(/\b(?:via|on|through)\s+(?:planhub|buildingconnected|procore|constructconnect|isqft|smartbid|bidnet|civcast|demandstar|bonfire)\b.*$/i, ' ')
  s = s.replace(/^\s*[:\-–—|]+\s*/, '').replace(/\s*[:\-–—|]+\s*$/, '').replace(/\s{2,}/g, ' ').trim()
  return s.length >= 3 ? s.slice(0, 120) : null
}

/** A year, month and day as YYYY-MM-DD, or null when they are not a day. */
function ymd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const t = new Date(Date.UTC(y, m - 1, d))
  if (t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const daysBetween = (a: string, b: string): number => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000)

/** The year a day with none named belongs to: the mail's, unless that puts it well in the past, then the next. */
function yearFor(m: number, d: number, received: string): number {
  const y = Number(received.slice(0, 4))
  const same = ymd(y, m, d)
  return same && daysBetween(same, received.slice(0, 10)) < -PAST_DAYS ? y + 1 : y
}

/** A time of day in the words, as 24-hour HH:MM: "2:00 PM", "2pm", "14:00", "noon". */
export function timeIn(words: string): string | null {
  if (/\bnoon\b/i.test(words)) return '12:00'
  const m = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i.exec(words) ?? /\b(\d{1,2}):(\d{2})\b(?!\s*(?:a|p)\.?m)/i.exec(words)
  if (!m) return null
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  const ap = m[3]?.toLowerCase().replace(/\./g, '')
  if (h > 23 || min > 59) return null
  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  if (!ap && h > 23) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** A day in the words: "Thursday, November 12, 2026", "Nov 12", "11/12/2026", "11/12". The mail's day gives a missing year. */
export function dayIn(words: string, received: string): string | null {
  const named = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i.exec(words)
  if (named) {
    const m = MONTHS[named[1]!.toLowerCase()]!
    const d = Number(named[2])
    const y = named[3] ? Number(named[3]) : yearFor(m, d, received)
    return ymd(y, m, d)
  }
  const numeric = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\b/.exec(words)
  if (numeric) {
    const m = Number(numeric[1])
    const d = Number(numeric[2])
    const y = numeric[3] ? (numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3])) : yearFor(m, d, received)
    return ymd(y, m, d)
  }
  return null
}

const DUE_LEADS = [
  /\b(?:bids?|proposals?|quotes?|quotations?|responses?|submissions?|pricing|offers?)\s+(?:are|is)?\s*due(?:\s+(?:by|on|at|no later than|before))?\s*[:\-–]?\s*([^\n]{3,80})/i,
  /\bdue\s+date(?:\s+and\s+time)?\s*[:\-–]\s*([^\n]{3,80})/i,
  /\b(?:bid|proposal|submission|response)\s+(?:due\s+)?(?:date|deadline)\s*[:\-–]\s*([^\n]{3,80})/i,
  /\bdue\s*[:\-–]\s*([^\n]{3,80})/i,
  /\bdue\s+(?:by|on|at|before)\s+([^\n]{3,80})/i,
  /\bdeadline\s*[:\-–]?\s*(?:is|of)?\s*([^\n]{3,80})/i,
]

/** When bids are due, from the first due line the words carry: the day, and the time when that line gives one. */
export function dueIn(text: string, received: string): { date: string; time: string | null } | null {
  for (const re of DUE_LEADS) {
    const m = re.exec(text)
    if (!m) continue
    const chunk = m[1]!
    const date = dayIn(chunk, received)
    if (date) return { date, time: timeIn(chunk) }
  }
  return null
}

export interface InvitationInput {
  subject: string
  /** The mail's words, text. */
  text: string
  /** Every link in the mail, as the reader lists them. The client, reading an older line, has none. */
  links?: readonly string[]
  /** When it came, ISO, for the due day's year. */
  at: string
}

/** The invitation an email is, or null when its subject and words name none. */
export function invitation(input: InvitationInput): Invitation | null {
  const subject = input.subject.trim()
  const portal = portalLink(input.links ?? [])
  let read = invitationCue(subject)
  if (!read) {
    const head = input.text.split('\n').filter((l) => l.trim()).slice(0, CUE_LINES).join('\n')
    const inBody = invitationCue(head)
    // The words alone are not enough: a body that says "bid" in passing is a person writing. A platform's page beside
    // them, or a subject about a bid, says it is one.
    if (inBody && (portal || /\bbid|\bproposal|\bquote|\brfp\b|\bproject\b/i.test(subject))) read = inBody
  }
  if (!read) return null
  const received = /^\d{4}-\d{2}-\d{2}/.test(input.at) ? input.at : new Date().toISOString()
  return {
    kind: read.kind,
    project: projectFromSubject(subject, read.cue),
    due: dueIn(`${subject}\n${input.text}`, received),
    portal,
    cue: read.cue,
  }
}

/** The kind in words: "Invitation to bid". */
export const KIND_WORDS: Readonly<Record<InvitationKind, string>> = {
  invitation: 'Invitation to bid',
  addendum: 'Addendum',
  solicitation: 'Solicitation',
  prebid: 'Pre-bid notice',
}

/** A due day and time in words: "Thu Nov 12 at 2:00 PM", "Thu Nov 12". */
export function dueWords(due: { date: string; time: string | null }): string {
  const [y, m, d] = due.date.split('-').map(Number) as [number, number, number]
  const day = `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${MONTH_WORDS[m - 1]} ${d}`
  if (!due.time) return day
  const [h, min] = due.time.split(':').map(Number) as [number, number]
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${day} at ${h12}:${String(min).padStart(2, '0')} ${ap}`
}

/** The card's first line, in plain words: "Invitation to bid, due Thu Nov 12 at 2:00 PM, on BuildingConnected". */
export function invitationFacts(inv: Pick<Invitation, 'kind' | 'due' | 'portal'>): string {
  const parts = [KIND_WORDS[inv.kind]]
  if (inv.due) parts.push(`due ${dueWords(inv.due)}`)
  if (inv.portal) parts.push(inv.portal.label === 'the plan room' ? 'in the plan room' : `on ${inv.portal.label}`)
  return parts.join(', ')
}

/** An invitation nobody has answered, on a line nobody has tied to a bid: the one the lane asks *Bid it?* about. */
export function openInvitation(line: { direction: string; channel: string; invitation?: Invitation | null; jobId?: string | null }): Invitation | null {
  const inv = line.invitation
  if (!inv || line.direction !== 'in' || line.channel !== 'email') return null
  if (inv.answer) return null
  if (line.jobId?.startsWith('bid:')) return null
  return inv
}

/** The facts as a row's jsonb gives them: the kernel's shape, or null for anything else. */
export function invitationOf(value: unknown): Invitation | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<Invitation>
  if (v.kind !== 'invitation' && v.kind !== 'addendum' && v.kind !== 'solicitation' && v.kind !== 'prebid') return null
  return {
    kind: v.kind,
    project: typeof v.project === 'string' ? v.project : null,
    due: v.due && typeof v.due === 'object' && typeof v.due.date === 'string' ? { date: v.due.date, time: typeof v.due.time === 'string' ? v.due.time : null } : null,
    portal: v.portal && typeof v.portal === 'object' && typeof v.portal.url === 'string' ? { label: typeof v.portal.label === 'string' ? v.portal.label : v.portal.url, url: v.portal.url } : null,
    cue: typeof v.cue === 'string' ? v.cue : '',
    answer: v.answer && typeof v.answer === 'object' && typeof v.answer.what === 'string' ? (v.answer as InvitationAnswer) : null,
  }
}
