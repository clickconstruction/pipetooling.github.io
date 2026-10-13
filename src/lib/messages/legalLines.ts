/**
 * Residential build, R8 · 7: the Lien desk's sends in a person's thread. A notice, a demand letter or a lien release
 * that went to them shows as a grey line from the office, read only. Under it the reply box is off for everyone but the
 * office, and a reply that comes after it goes to the office alone. The after state is card 7 of
 * `customer-messages-integrations-mockups.html` on branch spike/gc-mode. Pure: a loader hands it the rows.
 *
 * The lines are an overlay, as `sentLines.ts`'s are, never rows written into `messages`. Each is an `event` going out,
 * so the thread draws it as its own grey row and the stamps and the move line skip it: a certified letter never reads
 * as an email we sent. Its id carries `legal:`, and it is marked `legal: true` with its paper.
 *
 * Where the desk keeps its sends: `job_lien_filings` (a notice, a retainage notice, an affidavit, a release, each with
 * `sends`: who it went to, how and on what day), `job_lien_desk_items` (a sent item marked `letterTwo` names the filing
 * that was the second letter) and `job_demand_letters`.
 */
import { isLienOffice } from '../jobs/lienDesk'
import type { Tables } from '../../types/database'
import { calendarYmdInAppTzFromIso, startOfYmdInAppTzMs } from '../../utils/dateUtils'
import type { ContactFollowUpRow } from '../followUp/followUpRows'
import { jobKey } from './load'
import type { ThreadMessage } from './thread'

/** The papers the desk sends. */
export type LegalPaper = 'notice' | 'retainage' | 'affidavit' | 'release' | 'demand' | 'secondLetter'

/** Each paper's name, as the app already calls it (the customer's timeline). It is the line's subject. */
export const LEGAL_PAPER_NAMES: Readonly<Record<LegalPaper, string>> = {
  notice: 'Notice of unpaid balance',
  retainage: 'Retainage notice',
  affidavit: 'Lien affidavit',
  release: 'Lien release',
  demand: 'Demand letter',
  secondLetter: 'Second letter',
}

/** How a paper went, as the desk records it. */
export type LegalSendMethod = 'certified_mail' | 'traceable_courier' | 'email' | 'hand'

const METHOD_WORDS: Readonly<Record<LegalSendMethod, string>> = {
  certified_mail: 'certified mail',
  traceable_courier: 'traceable courier',
  email: 'email',
  hand: 'hand',
}
const METHODS = Object.keys(METHOD_WORDS) as LegalSendMethod[]

/** One paper that went to one person, from whichever table keeps it. */
export interface LegalSend {
  /** `filing:<job_lien_filings.id>` or `demand:<job_demand_letters.id>`. */
  id: string
  /** The Pipeline job it went on (`jobs_ledger.id`). */
  jobId: string
  paper: LegalPaper
  /** How it went, in the desk's order. Empty when the desk recorded it with no send. */
  methods: LegalSendMethod[]
  /** When it went, ISO. */
  at: string
}

/** The prefix a legal line's id carries. */
export const LEGAL_LINE_PREFIX = 'legal:'

/** A legal send as a thread line: from the office, read only. */
export type LegalLine = ThreadMessage & { legal: true; paper: LegalPaper }

export function isLegalLine(m: ThreadMessage): m is LegalLine {
  return m.id.startsWith(LEGAL_LINE_PREFIX) && (m as Partial<LegalLine>).legal === true
}

/** The line's sentence: "Sent by certified mail and email from the Lien desk." */
export function legalHowSentence(methods: readonly LegalSendMethod[]): string {
  const words = methods.map((m) => METHOD_WORDS[m])
  if (words.length === 0) return 'Recorded on the Lien desk.'
  const list = words.length === 1 ? words[0]! : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]!}`
  return `Sent by ${list} from the Lien desk.`
}

/** A sent day as a time: the recorded time when it is that day, else noon of the day in the app's zone. */
function atOfDay(ymd: string, recordedIso: string): string {
  if (calendarYmdInAppTzFromIso(recordedIso) === ymd) return recordedIso
  const start = startOfYmdInAppTzMs(ymd)
  return Number.isFinite(start) ? new Date(start + 12 * 3_600_000).toISOString() : recordedIso
}

const FILING_PAPERS: Readonly<Record<string, LegalPaper>> = {
  notice_53_056: 'notice',
  retainage_53_057: 'retainage',
  affidavit: 'affidavit',
  release_of_record: 'release',
}

type FilingRow = Pick<Tables<'job_lien_filings'>, 'id' | 'job_id' | 'kind' | 'created_at' | 'filed_at' | 'served_at' | 'voided_at' | 'sends'>
type DeskItemRow = Pick<Tables<'job_lien_desk_items'>, 'sent_filing_id' | 'fields' | 'voided_at'>
type DemandLetterRow = Pick<Tables<'job_demand_letters'>, 'id' | 'job_id' | 'created_at' | 'sent_at' | 'sent_method' | 'voided_at'>

/** One entry of a filing's `sends`: who it went to, how, and the day. */
interface FilingSend {
  recipient: string
  method: LegalSendMethod
  sentOn: string | null
}

function filingSends(raw: unknown): FilingSend[] {
  if (!Array.isArray(raw)) return []
  const out: FilingSend[] = []
  for (const s of raw as Array<Record<string, unknown> | null>) {
    const method = s?.method
    if (typeof method !== 'string' || !(method in METHOD_WORDS)) continue
    const sentOn = typeof s?.sent_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.sent_on) ? s.sent_on : null
    out.push({ recipient: typeof s?.recipient === 'string' ? s.recipient : '', method: method as LegalSendMethod, sentOn })
  }
  return out
}

function inOrder(methods: Iterable<LegalSendMethod>): LegalSendMethod[] {
  const set = new Set(methods)
  return METHODS.filter((m) => set.has(m))
}

/** The filings a sent item marked as letter two went out as. */
function secondLetterFilings(items: readonly DeskItemRow[]): Set<string> {
  const out = new Set<string>()
  for (const i of items) {
    const fields = i.fields as { letterTwo?: unknown } | null
    if (i.sent_filing_id && !i.voided_at && fields && typeof fields === 'object' && fields.letterTwo) out.add(i.sent_filing_id)
  }
  return out
}

/**
 * The filings that reached one person. `recipient` says which copy is theirs: the owner's (a residential customer) or
 * the original contractor's (a GC). A paper with no copy to them never reached them, so it has no line, except a served
 * affidavit and a release: a release always shows, since it is what lifts the box. Voided filings have no line.
 */
export function legalSendsFromFilings(
  filings: readonly FilingRow[],
  opts: { items?: readonly DeskItemRow[]; recipient?: 'owner' | 'original_contractor' } = {},
): LegalSend[] {
  const second = secondLetterFilings(opts.items ?? [])
  const out: LegalSend[] = []
  for (const f of filings) {
    if (f.voided_at) continue
    const kind = FILING_PAPERS[f.kind]
    if (!kind) continue
    const paper: LegalPaper = second.has(f.id) ? 'secondLetter' : kind
    const sends = filingSends(f.sends).filter((s) => !opts.recipient || s.recipient === opts.recipient)
    const served = paper === 'affidavit' ? f.served_at : null
    if (sends.length === 0 && !served && paper !== 'release') continue
    const days = sends.map((s) => s.sentOn).filter((d): d is string => !!d).sort()
    const day = days[0] ?? served ?? f.filed_at ?? calendarYmdInAppTzFromIso(f.created_at)
    out.push({ id: `filing:${f.id}`, jobId: f.job_id, paper, methods: inOrder(sends.map((s) => s.method)), at: atOfDay(day, f.created_at) })
  }
  return out
}

/** The demand letters that went: sent and not voided. */
export function legalSendsFromDemandLetters(letters: readonly DemandLetterRow[]): LegalSend[] {
  const out: LegalSend[] = []
  for (const d of letters) {
    if (d.voided_at || !d.sent_at) continue
    const methods = d.sent_method in METHOD_WORDS ? [d.sent_method as LegalSendMethod] : []
    out.push({ id: `demand:${d.id}`, jobId: d.job_id, paper: 'demand', methods, at: atOfDay(d.sent_at, d.created_at) })
  }
  return out
}

/** One person's legal sends as thread lines, oldest first: from the office, the paper's name, how it went. */
export function legalLines(sends: readonly LegalSend[], contactId: string): LegalLine[] {
  return sends
    .map(
      (s): LegalLine => ({
        id: `${LEGAL_LINE_PREFIX}${s.id}`,
        contactId,
        jobId: jobKey({ kind: 'pipeline', id: s.jobId }),
        channel: 'event',
        direction: 'out',
        at: s.at,
        who: 'the office',
        subject: LEGAL_PAPER_NAMES[s.paper],
        body: legalHowSentence(s.methods),
        channelId: null,
        legal: true,
        paper: s.paper,
      }),
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

/**
 * The legal line a thread stands under: the newest one on any job whose newest legal line is not a Lien release. A
 * release on one job leaves a notice on another standing. Null when no job is under one.
 */
export function standingLegalLine(lines: readonly ThreadMessage[]): LegalLine | null {
  const newestByJob = new Map<string, LegalLine>()
  for (const m of lines) {
    if (!isLegalLine(m)) continue
    const key = m.jobId ?? ''
    const best = newestByJob.get(key)
    if (!best || Date.parse(m.at) > Date.parse(best.at)) newestByJob.set(key, m)
  }
  let standing: LegalLine | null = null
  for (const m of newestByJob.values()) {
    if (m.paper === 'release') continue
    if (!standing || Date.parse(m.at) > Date.parse(standing.at)) standing = m
  }
  return standing
}

/** What the reply box says when a legal line keeps it off. */
export const LEGAL_BOX_WORDS = 'Replies on a legal line go to the office. Open the Lien desk to answer.'

export interface BoxState {
  open: boolean
  /** Why it is off, in the box's place. Null while it is open. */
  words: string | null
}

/**
 * The reply box under a thread's lines. Under a legal line it is off for everyone but the office (`isLienOffice`: dev,
 * master, assistant, controller), who answer from the Lien desk. A Lien release on that job turns it back on.
 */
export function boxStateAfter(lines: readonly ThreadMessage[], role: string | null | undefined): BoxState {
  if (isLienOffice(role) || !standingLegalLine(lines)) return { open: true, words: null }
  return { open: false, words: LEGAL_BOX_WORDS }
}

/** Who has a reply that came after a legal line: always the office, in the shape R5's `hasRule.ts` returns. */
export interface LegalRoute {
  has: 'office'
  /** The office's pick (`whoGetsIt`), or null for whoever in the office answers first. */
  userId: string | null
  name: string | null
  reason: 'legal'
  why: string
  /**
   * `contacts`' own columns. The rule wrote it, so `has_how` is `rule`. A stored `legal` would widen
   * `contacts_has_how_known`; it is left out until a screen needs to tell the two apart, and `reason` carries it.
   */
  write: Pick<ContactFollowUpRow, 'has_user_id' | 'has_since' | 'has_how'>
}

/** Why the reply went to the office. */
export const LEGAL_ROUTE_WHY = 'A reply after a legal line goes to the office, never to a tech.'

/**
 * Where a reply goes when a legal line stands (`standingLegalLine`): to the office alone, never to a tech. Null when it
 * is not a reply from them, came before the line, or no line stands, so the usual rule decides.
 */
export function routeReply(
  inbound: Pick<ThreadMessage, 'direction' | 'at'>,
  lastLegal: LegalLine | null,
  officePick: { userId: string; name: string } | null = null,
): LegalRoute | null {
  if (inbound.direction !== 'in' || !lastLegal || lastLegal.paper === 'release') return null
  if (Date.parse(inbound.at) < Date.parse(lastLegal.at)) return null
  return {
    has: 'office',
    userId: officePick?.userId ?? null,
    name: officePick?.name ?? null,
    reason: 'legal',
    why: LEGAL_ROUTE_WHY,
    write: officePick
      ? { has_user_id: officePick.userId, has_since: inbound.at, has_how: 'rule' }
      : { has_user_id: null, has_since: null, has_how: null },
  }
}
