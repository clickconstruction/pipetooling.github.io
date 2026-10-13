/**
 * The lien chip on an Accounts Receivable row (v2.5488): whether lien paper is out on the job
 * and where it stands, in the Lien desk's own words — one chip of a few words in the worst
 * tone, the sentence after it, and the one door. Pure: it folds what the desk already builds
 * (Do now's rows, the notice and affidavit entries, the filings with their mail pieces, letter
 * two) and reads nothing itself, so the modal and the desk can never disagree.
 *
 * When a row shows a chip (the owner's canvas, 2026-10-13):
 * - paper is out — a notice sent, in the mail, a lien filed, a release: green or blue;
 * - a paper is due inside the desk's lead (30 days) and not out yet, or waits on someone:
 *   amber, red inside 7 days (the desk's own severity);
 * - a window closed with nothing sent: red until someone writes it down, muted after;
 * - nothing out and nothing due inside 30 days: no chip — the Pipeline's dates ledger keeps
 *   the far date.
 *
 * The door is the Lien desk on that job when the next step lives there (a notice or retainage
 * paper: find the owner, draft, approve, sign, the run, the number, letter two, note a miss),
 * and the job's Lien window otherwise (paper that is out, the affidavit, its service, the
 * release) — the rule the Lien window's own next-step card follows (`lienWindowNextStep.ts`).
 */
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry } from './lienDeskAffidavits'
import type { JobLienFilingRow } from './lienDeadlines'
import type { LetterTwoStatus } from './lienLetterTwo'
import type { LienNextUpAction, LienNextUpRow } from './lienNextUp'
import { parseLienSends, sendsTrackingComing, sendsTrackingOwed } from './lienSendTracking'
import { lienWindowHref, type StagesLienWindowTab } from './stagesDeepLinks'
import { formatYmdMonthDay } from './billedExpectedPay'
import { workMonthLabel } from './forecastWorkMonths'
import { filingMailTail, type LienMailPieceRow } from '../mail/lienMailPieces'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

export type LienArTone = 'red' | 'amber' | 'green' | 'blue' | 'muted'

/** `due`: a paper is owed and not out; `out`: paper is out; `gone`: a window closed with nothing sent. */
export type LienArState = 'due' | 'out' | 'gone'

export type LienArPaper = 'notice' | 'retainage' | 'affidavit' | 'letter_two' | 'release'

export type LienArDoor =
  | { to: 'desk'; jobId: string | null; kind: 'notice' | 'affidavit' | 'retainage'; pile: LienDeskPile | null }
  | { to: 'window'; jobId: string; tab: StagesLienWindowTab }

export type LienArChip = {
  tone: LienArTone
  state: LienArState
  paper: LienArPaper
  /** The chip: "Notice by Oct 15 · 2d", "Delivered Sep 16 · day 12 · letter two", "Lien filed Oct 2 · served Oct 6". */
  words: string
  /** The plain words after the chip: the paper, who holds it, what came of the mailing. */
  sentence: string
  /** The chip's hover: where the door goes. */
  title: string
  door: LienArDoor
  /** The last day of the paper the chip names (YYYY-MM-DD); null when it has none. */
  dueOn: string | null
  daysLeft: number | null
}

export type LienArJobInput = {
  jobId: string
  todayYmd: string
  /** Every Do now row the desk built (`buildLienNextUp`); the kernel picks this job's. */
  nextUp: ReadonlyArray<LienNextUpRow>
  /** The job's notice entry when the desk lists it. */
  entry: LienDeskEntry | null
  /** The job's affidavit entry when the desk lists it. */
  affidavit: LienAffidavitEntry | null
  /** The job's live filings. */
  filings: ReadonlyArray<JobLienFilingRow>
  /** The mail pieces behind those filings, by filing id. */
  piecesByFiling: Readonly<Record<string, ReadonlyArray<LienMailPieceRow>>>
  letterTwo: LetterTwoStatus | null
  formatDay?: (ymd: string) => string
}

const TONE_RANK: Record<LienArTone, number> = { red: 0, amber: 1, blue: 2, green: 3, muted: 4 }

/** The chip's first words per Do now move — short, the desk's own. */
const MOVE_WORDS: Record<LienNextUpAction, string> = {
  find_owner: 'Needs the owner',
  draft: 'Notice to draft',
  draft_late: 'Late notice to draft',
  approve: 'Waiting on the leader',
  sign: 'Approved · unsigned',
  confirm_pen: 'Signed by pen · confirm it',
  send: 'Approved · ready to send',
  send_run: 'Approved · ready to send',
  add_tracking: 'In the mail · tracking owed',
  record_mailing: 'In the mail · tracking owed',
  mail_needs_you: 'Envelope came back',
  review_hold: 'Held',
  letter_two: 'Letter two',
  note_missed: 'Window closed',
  fix_property: 'Affidavit · fix the property',
  send_notice: 'Affidavit · notice first',
  file_affidavit: 'File the affidavit',
  record_service: 'Lien filed · serve it',
}

const SENT_BY: Record<string, string> = {
  certified_mail: 'by certified mail',
  traceable_courier: 'by courier',
  email: 'by email',
  hand: 'by hand',
}

function dayOf(iso: string | null | undefined): string {
  const v = (iso ?? '').trim()
  if (!v) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const ymd = calendarYmdInAppTzFromIso(v)
  return /^\d{4}-\d{2}-\d{2}/.test(ymd) ? ymd.slice(0, 10) : ''
}

export function lienArDaysWords(daysLeft: number | null): string {
  if (daysLeft == null) return ''
  if (daysLeft < 0) return `${-daysLeft}d late`
  if (daysLeft === 0) return 'today'
  return `${daysLeft}d`
}

/** "by Oct 15 · 2d" — '' with no day. */
function dueTail(dueOn: string | null, daysLeft: number | null, fmt: (ymd: string) => string): string {
  if (!dueOn) return ''
  const days = lienArDaysWords(daysLeft)
  return ` · by ${fmt(dueOn)}${days ? ` · ${days}` : ''}`
}

/** "July's" from 'YYYY-MM'. */
function monthPossessive(key: string): string {
  const label = workMonthLabel(key)
  const mon = /^(\w{3}) (\d{4})$/.exec(label)?.[1] ?? ''
  const full: Record<string, string> = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' }
  return `${mon ? full[mon] ?? mon : label}’s`
}

function rowsForJob(rows: ReadonlyArray<LienNextUpRow>, jobId: string, entry: LienDeskEntry | null): LienNextUpRow[] {
  const mine = rows.filter((r) => {
    if (r.jobId === jobId) return true
    if (r.jobId != null) return false
    // A run row stands for several jobs: the printed run names them; a GC's ready run is matched by the GC and the pile.
    if (r.jobs?.some((j) => j.jobId === jobId)) return true
    return r.action === 'send_run' && entry?.pile === 'ready' && !!r.gcId && r.gcId === entry.gcCustomerId
  })
  // The desk's own order: what is late or inside a week first, then by the last day.
  return mine.sort((a, b) => {
    if (a.group !== b.group) return a.group === 'now' || a.group === 'sign' || a.group === 'mine' ? -1 : 1
    if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1
    if (!!a.dueOn !== !!b.dueOn) return a.dueOn ? -1 : 1
    return 0
  })
}

function doorFor(row: LienNextUpRow, jobId: string): LienArDoor {
  const t = row.target
  switch (t.open) {
    case 'notices':
      return { to: 'desk', jobId, kind: 'notice', pile: t.pile }
    case 'affidavits':
      return { to: 'desk', jobId, kind: 'affidavit', pile: null }
    case 'retainage':
      return { to: 'desk', jobId, kind: 'retainage', pile: null }
    case 'run':
      return { to: 'desk', jobId, kind: 'notice', pile: row.action === 'record_mailing' || row.action === 'add_tracking' ? 'printed' : 'ready' }
    case 'lien_window':
      return { to: 'window', jobId, tab: t.tab }
  }
}

function paperOf(row: LienNextUpRow): LienArPaper {
  if (row.action === 'letter_two') return 'letter_two'
  return row.kind
}

function heldWhy(entry: LienDeskEntry | null): string {
  const r = entry?.item?.hold_reason
  return r === 'promised' ? 'they promised' : r === 'rule' ? 'the GC’s standing rule' : 'the leader will call first'
}

/** The month the chip names on a notice row: the first still owed, else the paper's first. */
function noticeMonth(entry: LienDeskEntry | null): string {
  return entry?.dueMonths[0] ?? entry?.item?.months?.[0] ?? ''
}

function missedWords(entry: LienDeskEntry | null, fmt: (ymd: string) => string): { closedOn: string; sentence: string } {
  const keys = entry?.missedUnrecorded.length ? entry.missedUnrecorded : entry?.missedMonths ?? []
  const closed = keys.map((k) => entry?.months.find((m) => m.key === k)?.deadline ?? '').filter(Boolean).sort()
  const closedOn = closed[closed.length - 1] ?? ''
  const months = keys.map(monthPossessive)
  const which = months.length === 0 ? 'A' : months.length === 1 ? months[0] : `${months.slice(0, -1).join(', ')} and ${months[months.length - 1]}`
  return { closedOn, sentence: `${which} notice never went out${closedOn ? ` · the window closed ${fmt(closedOn)}` : ''} · the money is still owed, chase it in Collections` }
}

function fromNextUp(row: LienNextUpRow, input: LienArJobInput, fmt: (ymd: string) => string): LienArChip {
  const { entry, letterTwo } = input
  const door = doorFor(row, input.jobId)
  const paper = paperOf(row)
  const prefix = row.kind === 'retainage' && !MOVE_WORDS[row.action].startsWith('Retainage') ? 'Retainage · ' : row.kind === 'affidavit' && !/affidavit|lien filed/i.test(MOVE_WORDS[row.action]) ? 'Affidavit · ' : ''
  const title = door.to === 'desk' ? 'Open it on the Lien desk' : 'Open the job’s Lien window'
  const red = row.severity === 'red'

  switch (row.action) {
    case 'note_missed': {
      const m = missedWords(entry, fmt)
      return { tone: 'red', state: 'gone', paper: 'notice', words: `Window closed${m.closedOn ? ` ${fmt(m.closedOn)}` : ''} · lien gone`, sentence: `${m.sentence} · write the closed window down with your name`, title, door, dueOn: null, daysLeft: null }
    }
    case 'letter_two': {
      const day = letterTwo?.day ?? null
      const overdue = letterTwo?.state === 'overdue'
      const delivered = letterTwo?.clock?.kind === 'delivered' ? dayOf(letterTwo.clock.at) : ''
      const lead = delivered ? `Delivered ${fmt(delivered)} · ` : ''
      return {
        tone: overdue ? 'red' : 'amber',
        state: 'due',
        paper: 'letter_two',
        words: `${lead}${day != null ? `day ${day} · ` : ''}letter two${overdue ? ' overdue' : ''}`,
        sentence: `${noticeSentence(input, fmt)} · the GC has not paid${letterTwo?.clock ? ` · counted ${letterTwo.clock.why}` : ''} · letter two is ${overdue ? 'overdue' : 'due by day 14'}`,
        title,
        door,
        dueOn: null,
        daysLeft: null,
      }
    }
    case 'review_hold': {
      const until = dayOf(entry?.item?.hold_until)
      return { tone: 'amber', state: 'due', paper, words: `${prefix}Held · ${heldWhy(entry)}${until ? ` · asks again ${fmt(until)}` : ''}`, sentence: `${paperWords(row, entry)} · held by the leader${until ? ` until ${fmt(until)}` : ''}`, title, door, dueOn: row.dueOn, daysLeft: row.daysLeft }
    }
    case 'add_tracking':
    case 'record_mailing': {
      const printed = dayOf(entry?.item?.printed_at)
      return { tone: 'blue', state: 'out', paper, words: `${prefix}In the mail · tracking owed`, sentence: `${paperWords(row, entry)} · printed with the run${printed ? ` ${fmt(printed)}` : ''} · type its certified number in the run to record it`, title, door, dueOn: row.dueOn, daysLeft: row.daysLeft }
    }
    case 'mail_needs_you': {
      // An envelope Docsmit mailed that came back or went unclaimed (the Docsmit train, 6b). The desk's row reads
      // "Docsmit · owner of record · returned to sender"; the chip leads with the pieces' own state and names who.
      const [, who = '', ...rest] = row.sub.split(' · ')
      const what = rest.join(' · ')
      const state = mailState(sentNotice(input)?.pieces ?? [])
      const lead = state?.tone === 'red' || state?.tone === 'amber' ? state.words : what ? what.charAt(0).toUpperCase() + what.slice(1) : MOVE_WORDS.mail_needs_you
      return { tone: 'red', state: 'due', paper: 'notice', words: `${lead}${who ? ` · ${who}` : ''}`, sentence: `${noticeSentence(input, fmt)}${state || !what ? '' : ` · ${what}`} · the envelope to the ${who || 'recipient'} needs you · open the notice under Sent to send it again`, title, door, dueOn: null, daysLeft: null }
    }
    case 'approve': {
      // The desk's row already names the leader and the day: "Waiting on Robert · since Oct 7".
      const who = /^Waiting on (.+?)(?: · |$)/.exec(row.sub)?.[1] ?? 'the leader'
      return { tone: red ? 'red' : 'amber', state: 'due', paper, words: `${prefix}${/your approval/i.test(row.sub) ? 'Approve the notice' : `Waiting on ${who}`}${dueTail(row.dueOn, row.daysLeft, fmt)}`, sentence: `${paperWords(row, entry)} · ${row.sub}`, title, door, dueOn: row.dueOn, daysLeft: row.daysLeft }
    }
    default:
      return { tone: red || row.action === 'draft_late' ? 'red' : 'amber', state: 'due', paper, words: `${prefix}${MOVE_WORDS[row.action]}${dueTail(row.dueOn, row.daysLeft, fmt)}`, sentence: `${paperWords(row, entry)} · ${row.sub}`, title, door, dueOn: row.dueOn, daysLeft: row.daysLeft }
  }
}

/** "August’s § 53.056 notice" · "the § 53.057 retainage notice" · "the § 53.052 affidavit". */
function paperWords(row: LienNextUpRow, entry: LienDeskEntry | null): string {
  if (row.kind === 'retainage') return 'the § 53.057 retainage notice'
  if (row.kind === 'affidavit') return 'the § 53.052 affidavit'
  const month = noticeMonth(entry)
  return `${month ? `${monthPossessive(month)} ` : 'the '}§ 53.056 notice`
}

type Sent = { filing: JobLienFilingRow | null; day: string; method: string; pieces: ReadonlyArray<LienMailPieceRow> }

/** The day a filing went out: the earliest day its sends carry, else the day it was recorded (a notice recorded after the fact names its mailing day on the send). */
function sentDay(f: JobLienFilingRow): string {
  const days = parseLienSends(f.sends).map((s) => dayOf(s.sent_on)).filter(Boolean).sort()
  return days[0] ?? dayOf(f.created_at)
}

/** The newest live, sent notice on the job: the filing, else the desk item's sent day. */
function sentNotice(input: LienArJobInput): Sent | null {
  const notices = input.filings
    .filter((f) => !f.voided_at && (f.kind === 'notice_53_056' || f.kind === 'retainage_53_057'))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
  const f = notices[0] ?? null
  if (f) {
    const sends = parseLienSends(f.sends)
    const owner = sends.find((x) => x.recipient === 'owner') ?? sends[0]
    return { filing: f, day: sentDay(f), method: owner?.method ?? '', pieces: input.piecesByFiling[f.id] ?? [] }
  }
  if (input.entry?.pile === 'sent' && input.entry.item?.sent_at) return { filing: null, day: dayOf(input.entry.item.sent_at), method: '', pieces: [] }
  return null
}

/** "Apr, Jun, Jul and Aug 2026" from 'YYYY-MM' keys; a span of years names each month with its year. */
export function lienArMonthsPhrase(keys: ReadonlyArray<string>): string {
  const sorted = [...keys].filter((k) => /^\d{4}-\d{2}/.test(k)).sort()
  if (sorted.length === 0) return ''
  const years = new Set(sorted.map((k) => k.slice(0, 4)))
  const words = years.size === 1 ? sorted.map((k) => workMonthLabel(k).slice(0, 3)) : sorted.map(workMonthLabel)
  const list = words.length === 1 ? words[0] ?? '' : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
  return years.size === 1 ? `${list} ${sorted[0]?.slice(0, 4) ?? ''}` : list
}

function noticeSentence(input: LienArJobInput, fmt: (ymd: string) => string): string {
  const s = sentNotice(input)
  if (!s) return 'The § 53.056 notice went out'
  const f = s.filing
  const kind = f?.kind === 'retainage_53_057' ? '§ 53.057 retainage notice' : '§ 53.056 notice'
  const months = f?.months_covered?.length ? ` for ${lienArMonthsPhrase(f.months_covered)}` : ''
  const sends = f ? parseLienSends(f.sends) : []
  const owner = sends.find((x) => x.recipient === 'owner') ?? sends[0]
  const by = SENT_BY[s.method] ?? ''
  const number = owner?.tracking?.trim() ? ` ${owner.tracking.trim()}` : ''
  return `${kind}${months} sent${s.day ? ` ${fmt(s.day)}` : ''}${by ? ` ${by}` : ''}${number}${filingMailTail(s.pieces, fmt)}`
}

/** The pieces' one state, worst first: returned · refused · unclaimed · number coming · delivered · in transit. */
function mailState(pieces: ReadonlyArray<LienMailPieceRow>): { tone: LienArTone; words: string } | null {
  if (pieces.length === 0) return null
  const has = (s: string) => pieces.some((p) => p.status === s)
  const day = (iso: string | null) => dayOf(iso)
  if (has('returned')) return { tone: 'red', words: 'Returned to sender' }
  if (has('failed')) return { tone: 'red', words: 'Docsmit refused it' }
  if (has('notice_left')) return { tone: 'amber', words: 'Notice left · unclaimed' }
  if (has('sent') || has('prepared')) return { tone: 'blue', words: 'With Docsmit · number coming' }
  const delivered = pieces.filter((p) => p.status === 'delivered').map((p) => day(p.delivered_at)).filter(Boolean).sort()
  const lastDelivered = delivered[delivered.length - 1] ?? ''
  if (delivered.length === pieces.length && lastDelivered) return { tone: 'green', words: `Delivered ${formatYmdMonthDay(lastDelivered)}` }
  const mailed = pieces.map((p) => day(p.mailed_at)).filter(Boolean).sort()
  if (lastDelivered) return { tone: 'green', words: `Delivered ${formatYmdMonthDay(lastDelivered)} · one in transit` }
  return { tone: 'green', words: `Mailed${mailed[0] ? ` ${formatYmdMonthDay(mailed[0])}` : ''} · in transit` }
}

function fromPaperOut(input: LienArJobInput, fmt: (ymd: string) => string): LienArChip | null {
  const live = input.filings.filter((f) => !f.voided_at)
  const newest = <T extends JobLienFilingRow>(rows: T[]): T | null => rows.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))[0] ?? null
  const release = newest(live.filter((f) => f.kind === 'release_of_record'))
  if (release) {
    const day = dayOf(release.filed_at ?? release.created_at)
    return { tone: 'muted', state: 'out', paper: 'release', words: `Released${day ? ` ${fmt(day)}` : ''}`, sentence: `Release of record filed${day ? ` ${fmt(day)}` : ''}${release.recording_number?.trim() ? `, recording no. ${release.recording_number.trim()}` : ''} · the clock stopped`, title: 'Open the job’s Lien window', door: { to: 'window', jobId: input.jobId, tab: 'release_record' }, dueOn: null, daysLeft: null }
  }
  const affidavit = newest(live.filter((f) => f.kind === 'affidavit' && f.filed_at))
  if (affidavit) {
    const filed = dayOf(affidavit.filed_at)
    const served = dayOf(affidavit.served_at)
    const serveDue = dayOf(affidavit.serve_due)
    const words = served ? `Lien filed ${fmt(filed)} · served ${fmt(served)}` : `Lien filed ${fmt(filed)}${serveDue ? ` · serve by ${fmt(serveDue)}` : ' · serve it'}`
    const rec = affidavit.recording_number?.trim() ? `, recording no. ${affidavit.recording_number.trim()}` : ''
    return { tone: served ? 'green' : 'amber', state: 'out', paper: 'affidavit', words, sentence: `Lien affidavit filed ${fmt(filed)}${rec}${served ? `, a copy served ${fmt(served)}` : ' · a copy to the owner and the GC within five days'} · paid: file the release of record · unpaid: counsel on the suit`, title: 'Open the job’s Lien window', door: { to: 'window', jobId: input.jobId, tab: 'affidavit' }, dueOn: served ? null : serveDue || null, daysLeft: null }
  }
  const sent = sentNotice(input)
  if (!sent) return null
  const two = input.letterTwo
  const mail = mailState(sent.pieces)
  let tone: LienArTone = mail?.tone ?? 'green'
  let words = mail?.words ?? ''
  if (!mail) {
    const owed = sent.filing ? sendsTrackingOwed(sent.filing.sends).length > 0 : false
    const coming = sent.filing ? sendsTrackingComing(sent.filing.sends).length > 0 : false
    const by = sent.method === 'hand' ? ' · by hand' : sent.method === 'email' ? ' · by email' : ''
    words = `Sent${sent.day ? ` ${fmt(sent.day)}` : ''}${by}${owed ? ' · tracking owed' : coming ? ' · number coming' : ''}`
    tone = owed || coming ? 'blue' : 'green'
  }
  let paper: LienArPaper = sent.filing?.kind === 'retainage_53_057' ? 'retainage' : 'notice'
  // Letter two rides on the notice's chip: the day count while waiting, its own state once it moved.
  if (two) {
    if (two.state === 'sent' && two.letterTwo?.sentAt) {
      words = `Letter two sent ${fmt(dayOf(two.letterTwo.sentAt))}`
      paper = 'letter_two'
      tone = 'green'
    } else if (two.state === 'in_flight') {
      words = `Letter two · ${two.letterTwo?.status === 'awaiting_approval' ? 'awaiting the leader' : 'in the run'}`
      paper = 'letter_two'
      tone = 'blue'
    } else if (two.state === 'due' || two.state === 'overdue') {
      // Without Do now's row (a light read), the clock still says it.
      words = `${mail?.words && mail.tone === 'green' ? `${mail.words} · ` : ''}day ${two.day ?? ''} · letter two${two.state === 'overdue' ? ' overdue' : ''}`.replace('day  ·', 'day ·')
      paper = 'letter_two'
      tone = two.state === 'overdue' ? 'red' : 'amber'
    } else if (two.state === 'gc_authorized' && two.gcAuthorized) {
      words = `GC authorized direct pay ${fmt(dayOf(two.gcAuthorized.at))}`
    } else if (two.state === 'waiting' && two.day != null && two.day > 0) {
      words = `${words} · day ${two.day}`
    }
  }
  const twoWords = two && two.words && two.state !== 'none' && two.state !== 'paid' ? ` · ${two.words}` : ''
  return { tone, state: 'out', paper, words, sentence: `${noticeSentence(input, fmt)}${twoWords}`, title: 'Open the job’s Lien window', door: { to: 'window', jobId: input.jobId, tab: 'notice' }, dueOn: null, daysLeft: null }
}

function fromMissed(input: LienArJobInput, fmt: (ymd: string) => string): LienArChip | null {
  const { entry, affidavit } = input
  if (entry?.pile === 'missed' && entry.dueMonths.length === 0) {
    const m = missedWords(entry, fmt)
    const noted = entry.missedUnrecorded.length === 0
    return { tone: noted ? 'muted' : 'red', state: 'gone', paper: 'notice', words: `Window closed${m.closedOn ? ` ${fmt(m.closedOn)}` : ''} · lien gone`, sentence: `${m.sentence}${noted ? ' · noted' : ' · write the closed window down with your name'}`, title: 'Open the job’s Lien window', door: { to: 'window', jobId: input.jobId, tab: 'notice' }, dueOn: null, daysLeft: null }
  }
  if (affidavit?.pile === 'missed') {
    return { tone: 'muted', state: 'gone', paper: 'affidavit', words: `Lien window closed${affidavit.deadline ? ` ${fmt(affidavit.deadline)}` : ''} · lien gone`, sentence: 'The affidavit window closed with nothing filed · the lien is gone · the money is still owed, chase it in Collections', title: 'Open the job’s Lien window', door: { to: 'window', jobId: input.jobId, tab: 'affidavit' }, dueOn: null, daysLeft: null }
  }
  return null
}

/** One job's chip, or null when the row shows none. */
export function lienArChipFor(input: LienArJobInput): LienArChip | null {
  const fmt = input.formatDay ?? formatYmdMonthDay
  const rows = rowsForJob(input.nextUp, input.jobId, input.entry)
  if (rows[0]) return fromNextUp(rows[0], input, fmt)
  return fromPaperOut(input, fmt) ?? fromMissed(input, fmt)
}

export type LienArCustomerChip = { tone: LienArTone; state: LienArState; words: string; title: string }

/** The customer header's one chip: the worst state among its jobs, with the count when several share it; the hover names each job. */
export function lienArCustomerChip(jobs: ReadonlyArray<{ label: string; chip: LienArChip | null }>): LienArCustomerChip | null {
  const withChip = jobs.filter((j): j is { label: string; chip: LienArChip } => j.chip != null)
  if (withChip.length === 0) return null
  const sorted = [...withChip].sort((a, b) => {
    const r = TONE_RANK[a.chip.tone] - TONE_RANK[b.chip.tone]
    if (r !== 0) return r
    if (a.chip.dueOn && b.chip.dueOn && a.chip.dueOn !== b.chip.dueOn) return a.chip.dueOn < b.chip.dueOn ? -1 : 1
    if (!!a.chip.dueOn !== !!b.chip.dueOn) return a.chip.dueOn ? -1 : 1
    return 0
  })
  const first = sorted[0]
  if (!first) return null
  const worst = first.chip
  const same = sorted.filter((j) => j.chip.tone === worst.tone && j.chip.state === worst.state).length
  const words = same > 1 ? `${worst.words} · ${same} jobs` : worst.words
  return { tone: worst.tone, state: worst.state, words, title: withChip.map((j) => `${j.label}: ${j.chip.words}`).join('\n') }
}

export type LienArLens = 'due' | 'out'

export type LienArLensCounts = {
  due: { count: number; open: number; tone: 'red' | 'amber' }
  out: { count: number; open: number }
}

/** The lens pair above the list: customers with a paper due (and how much they owe), customers with paper out. */
export function lienArLensCounts(rows: ReadonlyArray<{ open: number; chips: ReadonlyArray<LienArChip | null> }>): LienArLensCounts {
  const out: LienArLensCounts = { due: { count: 0, open: 0, tone: 'amber' }, out: { count: 0, open: 0 } }
  for (const r of rows) {
    const chips = r.chips.filter((c): c is LienArChip => c != null)
    if (chips.some((c) => c.state === 'due' || (c.state === 'gone' && c.tone === 'red'))) {
      out.due.count += 1
      out.due.open += r.open
      if (chips.some((c) => c.tone === 'red')) out.due.tone = 'red'
    }
    if (chips.some((c) => c.state === 'out')) {
      out.out.count += 1
      out.out.open += r.open
    }
  }
  return out
}

export function lienArLensMatch(chips: ReadonlyArray<LienArChip | null>, lens: LienArLens): boolean {
  return chips.some((c) => c != null && (lens === 'due' ? c.state === 'due' || (c.state === 'gone' && c.tone === 'red') : c.state === 'out'))
}

/** Where the chip goes: the Lien desk on the job's pane and pile, or the job's Lien window on a tab. */
export function lienArChipHref(door: LienArDoor): string {
  if (door.to === 'window') return lienWindowHref(door.jobId, door.tab)
  const p = new URLSearchParams({ tab: 'stages', liendesk: '1' })
  if (door.jobId) p.set('liendeskJob', door.jobId)
  p.set('kind', door.kind)
  if (door.pile) p.set('liendeskPile', door.pile)
  return `/jobs?${p.toString()}`
}
