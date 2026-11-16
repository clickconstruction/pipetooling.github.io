/**
 * One property whole (v2.7485): every job at one property record, with where each of its papers stands.
 *
 * The desk thinks by paper and by job. An office teammate looked at an owner's envelope that held one job, at a
 * property with seven jobs on the desk, and could not tell why. The envelope was right: six of the seven had their
 * notice out already. Nothing on the desk showed the property whole, so nothing said so.
 *
 * This is the words for that view, and it holds no rule of its own for a paper's state:
 *
 * - the jobs at one property are the jobs that share a property record (`jobs_ledger.customer_address_id`), never a
 *   match on typed addresses;
 * - a notice's and an affidavit's state is the pile the desk's queues put it in (`buildLienDeskQueue`,
 *   `buildLienAffidavitQueue`), said in the Board's words (`lienBoardPileWords`);
 * - the day a notice went is the To do row's (`lienAffidavitNoticeTag`), from the job's recorded filings, which a
 *   run's record and one made by hand both write;
 * - a filed affidavit and its served copy are the timeline's own steps.
 *
 * Fed by narrow facts, so By job's book rows (`lienPropertyJobLine`) and the run window's desk entries can both feed
 * it. A reason the desk does not hold is never guessed: a job with nothing on record says *No notice on record*.
 *
 * Pure.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatYmdMonthDay } from './billedExpectedPay'
import { workMonthShort } from './forecastWorkMonths'
import { lienBoardPileWords, LIEN_RUN_TILE_LABEL } from './lienBoard'
import type { LienDeskPile } from './lienDesk'
import { affidavitGateMissingWord, lienAffidavitGateHeld, type LienAffidavitPile } from './lienDeskAffidavits'
import type { LienPublicStanding } from './lienPublicProperty'
import { lienAffidavitNoticeTag } from './lienRowWords'
import type { LienTimelineStep } from './lienTimeline'
import type { LienTimelineBookRow } from './lienTimelineBook'

// ---------- the notice ----------

/**
 * Where a job's notice stands, as a person asks it of a property: it went, it is going now, it waits on something,
 * the job needs none, its window closed, or nothing is on record.
 */
export type LienPropertyNoticeState = 'sent' | 'going' | 'waits' | 'none_needed' | 'missed' | 'none'

export type LienPropertyNoticeFacts = {
  /** The job is under a GC. A job contracted with the owner needs no § 53.056 notice. */
  isSub: boolean
  /** The notice's pile on the desk, null when the desk's queue holds no notice for the job. */
  pile: LienDeskPile | null
  /** A notice is on record for the job, with or without a day. */
  noticed: boolean
  /** The days ('YYYY-MM-DD') a recorded notice went to the owner. */
  sentOn: ReadonlyArray<string>
  /** The paper's last day, when it has one. */
  dueOn?: string | null
  /** The day it was printed, for a paper that waits for the mail. */
  printedOn?: string | null
  /** The day a hold ends, for a held paper. */
  holdUntil?: string | null
}

export type LienPropertyNoticeLine = {
  state: LienPropertyNoticeState
  /** The line: the Board's bin for a live paper, else the day the notice went. */
  words: string
  /** One more fact under it: the last day, the print day, or an earlier notice that went. '' when none. */
  aside: string
  pile: LienDeskPile | null
  /** The days a notice went, oldest first, each once. */
  sentOn: string[]
}

const ymd = (v: string | null | undefined) => (/^\d{4}-\d{2}-\d{2}/.test(v ?? '') ? (v as string).slice(0, 10) : '')

function sentDays(days: ReadonlyArray<string>): string[] {
  return [...new Set(days.map(ymd).filter(Boolean))].sort()
}

export function lienPropertyNoticeLine(f: LienPropertyNoticeFacts): LienPropertyNoticeLine {
  const sentOn = sentDays(f.sentOn)
  if (!f.isSub) return { state: 'none_needed', words: lienAffidavitNoticeTag({ isSub: false, noticed: false, sentOn: [] }).words, aside: '', pile: f.pile, sentOn }
  const noticed = f.noticed || sentOn.length > 0
  const went = noticed ? lienAffidavitNoticeTag({ isSub: true, noticed: true, sentOn }).words : ''
  const lastDay = ymd(f.dueOn) ? `last day ${formatYmdMonthDay(ymd(f.dueOn))}` : ''
  const live = (state: LienPropertyNoticeState, pile: LienDeskPile, aside: string): LienPropertyNoticeLine => ({ state, words: lienBoardPileWords('notice', pile), aside: [aside, went ? `earlier: ${went}` : ''].filter(Boolean).join(' · '), pile, sentOn })
  switch (f.pile) {
    case 'ready':
      return live('going', 'ready', lastDay)
    case 'printed':
      return live('going', 'printed', ymd(f.printedOn) ? `printed ${formatYmdMonthDay(ymd(f.printedOn))}` : lastDay)
    case 'needs_owner':
    case 'to_draft':
    case 'awaiting':
      return live('waits', f.pile, lastDay)
    case 'held':
      return live('waits', 'held', ymd(f.holdUntil) ? `until ${formatYmdMonthDay(ymd(f.holdUntil))}` : lastDay)
    case 'missed':
      return live('missed', 'missed', '')
    default:
      break
  }
  if (noticed) return { state: 'sent', words: went, aside: '', pile: f.pile, sentOn }
  return { state: 'none', words: lienAffidavitNoticeTag({ isSub: true, noticed: false, sentOn: [] }).words, aside: '', pile: f.pile, sentOn }
}

// ---------- the affidavit ----------

export type LienPropertyAffidavitState = 'filed' | 'ready' | 'waits' | 'held' | 'missed' | 'blocked' | 'none'

type StepWords = Pick<LienTimelineStep, 'state' | 'dateWords' | 'words'>

export type LienPropertyAffidavitFacts = {
  /** The affidavit's pile on the desk, null when the desk's queue holds none for the job. */
  pile: LienAffidavitPile | null
  /** A gate closed after the paper's approval holds it, not the leader. */
  gateHeld: boolean
  /** The closed gates, in the list row's words (`affidavitGateMissingWord`). */
  missing: ReadonlyArray<string>
  /** The last day to file. */
  deadline?: string | null
  /** The timeline's own affidavit and serve steps, when the reader holds a timeline. */
  affidavitStep?: StepWords | null
  serveStep?: StepWords | null
}

export type LienPropertyAffidavitLine = { state: LienPropertyAffidavitState; words: string; aside: string; pile: LienAffidavitPile | null }

const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export function lienPropertyAffidavitLine(f: LienPropertyAffidavitFacts): LienPropertyAffidavitLine {
  const step = f.affidavitStep ?? null
  if (step?.state === 'done') {
    const serve = f.serveStep ?? null
    const aside = serve?.state === 'done' ? serve.dateWords : serve?.state === 'missed' ? 'serving its copy is overdue' : serve?.state === 'due' ? `serve its copy by ${serve.dateWords}` : ''
    return { state: 'filed', words: capital(step.dateWords), aside, pile: f.pile }
  }
  if (step?.state === 'blocked') return { state: 'blocked', words: capital(step.words), aside: '', pile: f.pile }
  if (!f.pile) return step?.state === 'missed' ? { state: 'missed', words: lienBoardPileWords('affidavit', 'missed'), aside: step.words, pile: null } : { state: 'none', words: '', aside: '', pile: null }
  const words = lienBoardPileWords('affidavit', f.pile)
  const lastDay = ymd(f.deadline) ? `last day ${formatYmdMonthDay(ymd(f.deadline))}` : ''
  const missing = f.missing.length ? `missing ${f.missing.join(', ')}` : ''
  switch (f.pile) {
    case 'filed':
      return { state: 'filed', words, aside: '', pile: f.pile }
    case 'missed':
      return { state: 'missed', words, aside: step?.state === 'missed' ? step.words : '', pile: f.pile }
    case 'ready':
      return { state: 'ready', words, aside: lastDay, pile: f.pile }
    case 'held':
      return { state: 'held', words, aside: f.gateHeld && missing ? missing : lastDay, pile: f.pile }
    case 'needs_property':
      return { state: 'waits', words, aside: missing || lastDay, pile: f.pile }
    default:
      return { state: 'waits', words, aside: lastDay, pile: f.pile }
  }
}

// ---------- one job's line ----------

export type LienPropertyJobLine = {
  jobId: string
  /** `273 · Dunmere (Linmoor)` */
  label: string
  /** The lien months the desk holds for the job, short and oldest first: `Sep, Oct`. */
  months: string
  gcName: string
  notice: LienPropertyNoticeLine
  affidavit: LienPropertyAffidavitLine
  openBalance: number
}

/** A book row as the property view's line. */
export function lienPropertyJobLine(row: LienTimelineBookRow): LienPropertyJobLine {
  const entry = row.notice ?? null
  const fromFilings = row.noticeSentOn ?? []
  // The recorded filings say the day; the months' own send days stand in for a reader that hands none (the firm's portal).
  const sentOn = fromFilings.length ? fromFilings : row.months.filter((m) => m.outcome === 'sent' && m.at).map((m) => m.at)
  const notice = lienPropertyNoticeLine({
    isSub: row.job.isSub,
    pile: entry?.pile ?? null,
    noticed: row.months.some((m) => m.outcome === 'sent'),
    sentOn,
    dueOn: entry?.earliestDeadline ?? null,
    printedOn: entry?.item?.printed_at ? calendarYmdInAppTzFromIso(entry.item.printed_at) : null,
    holdUntil: entry?.item?.hold_until ?? null,
  })
  const a = row.affidavit ?? null
  const affidavit = lienPropertyAffidavitLine({
    pile: a?.pile ?? null,
    gateHeld: lienAffidavitGateHeld(a),
    missing: (a?.gates ?? []).filter((g) => !g.ok).map((g) => affidavitGateMissingWord(g.key)),
    deadline: a?.deadline ?? null,
    affidavitStep: row.timeline.steps.find((s) => s.kind === 'affidavit') ?? null,
    serveStep: row.timeline.steps.find((s) => s.kind === 'serve') ?? null,
  })
  return { jobId: row.jobId, label: row.job.label, months: row.months.map((m) => workMonthShort(m.key)).join(', '), gcName: row.job.isSub ? row.job.gcName : '', notice, affidavit, openBalance: row.job.openBalance }
}

// ---------- the tally ----------

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The stage a job's notice is counted under: the state, and the pile for a paper that waits. */
function tallyKey(n: LienPropertyNoticeLine): string {
  return n.state === 'waits' ? `waits:${n.pile ?? ''}` : n.state
}

const TALLY: ReadonlyArray<{ key: string; words: (n: number) => string }> = [
  { key: 'sent', words: (n) => count(n, 'notice sent', 'notices sent') },
  { key: 'going', words: (n) => `${n} ${LIEN_RUN_TILE_LABEL}` },
  { key: 'waits:awaiting', words: (n) => `${n} awaiting approval` },
  { key: 'waits:to_draft', words: (n) => `${n} to send for approval` },
  { key: 'waits:needs_owner', words: (n) => count(n, 'needs the owner', 'need the owner') },
  { key: 'waits:held', words: (n) => `${n} held` },
  { key: 'missed', words: (n) => `${n} missed` },
  { key: 'none_needed', words: (n) => count(n, 'needs no notice', 'need no notice') },
  { key: 'none', words: (n) => `${n} with no notice on record` },
]

/** A job is at the affidavit when its notice is behind it (sent, or none needed) and its affidavit is not filed. */
export function lienPropertyAtAffidavit(l: Pick<LienPropertyJobLine, 'notice' | 'affidavit'>): boolean {
  return (l.notice.state === 'sent' || l.notice.state === 'none_needed') && (l.affidavit.state === 'waits' || l.affidavit.state === 'ready' || l.affidavit.state === 'held')
}

/** A property's one line: *4 notices sent · 1 to print and mail · 2 at the affidavit*. '' with no jobs. */
export function lienPropertyTally(lines: ReadonlyArray<Pick<LienPropertyJobLine, 'notice' | 'affidavit'>>): string {
  const by = new Map<string, number>()
  for (const l of lines) by.set(tallyKey(l.notice), (by.get(tallyKey(l.notice)) ?? 0) + 1)
  const parts = TALLY.filter((t) => (by.get(t.key) ?? 0) > 0).map((t) => t.words(by.get(t.key)!))
  const at = lines.filter(lienPropertyAtAffidavit).length
  if (at > 0) parts.push(`${at} at the affidavit`)
  const filed = lines.filter((l) => l.affidavit.state === 'filed').length
  if (filed > 0) parts.push(`${filed} filed`)
  return parts.join(' · ')
}

// ---------- why a job is not in a run ----------

export type LienNotInRunGroup = { count: number; words: string }

function notInRunWords(n: LienPropertyNoticeLine, k: number): string {
  const one = k === 1
  const day = n.sentOn.length ? ` ${formatYmdMonthDay(n.sentOn[n.sentOn.length - 1]!)}` : ''
  switch (n.state) {
    case 'sent':
      return day ? `${k} had ${one ? 'its' : 'their'} notice sent${day}.` : `${k} ${one ? 'has its' : 'have their'} notice on record.`
    case 'none_needed':
      return `${k} ${one ? 'needs' : 'need'} no notice.`
    case 'missed':
      return `${k} missed ${one ? 'its' : 'their'} notice window.`
    case 'none':
      return `${k} ${one ? 'has' : 'have'} no notice on record.`
    case 'going':
      return n.pile === 'printed' ? `${k} ${one ? 'is' : 'are'} printed and ${one ? 'waits' : 'wait'} for the mail.` : `${k} ${one ? 'is' : 'are'} approved and not printed yet.`
    case 'waits':
      if (n.pile === 'awaiting') return `${k} ${one ? 'waits' : 'wait'} on Master approval.`
      if (n.pile === 'needs_owner') return `${k} ${one ? 'needs' : 'need'} the owner.`
      if (n.pile === 'held') return `${k} ${one ? 'is' : 'are'} held.`
      return `${k} ${one ? 'is' : 'are'} not sent for approval yet.`
  }
}

/**
 * Why the other jobs at a property are not in a run, one sentence per reason, the largest group first. A reason is
 * the notice's own state on the desk, so the run's envelope and the property card never word it two ways.
 */
export function lienNotInRunGroups(notices: ReadonlyArray<LienPropertyNoticeLine>): LienNotInRunGroup[] {
  const groups = new Map<string, LienPropertyNoticeLine[]>()
  for (const n of notices) {
    const key = `${tallyKey(n)}|${n.state === 'going' ? n.pile : ''}|${n.state === 'sent' ? n.sentOn[n.sentOn.length - 1] ?? '' : ''}`
    groups.set(key, [...(groups.get(key) ?? []), n])
  }
  return [...groups.values()].sort((a, b) => b.length - a.length).map((g) => ({ count: g.length, words: notInRunWords(g[0]!, g.length) }))
}

/** *6 other jobs at this property are not in this envelope. 4 had their notice sent Oct 14. 2 had their notice sent Sep 22.* '' with none. */
export function lienNotInRunWords(notices: ReadonlyArray<LienPropertyNoticeLine>, where = 'this envelope'): string {
  if (notices.length === 0) return ''
  const n = notices.length
  return [`${count(n, 'other job', 'other jobs')} at this property ${n === 1 ? 'is' : 'are'} not in ${where}.`, ...lienNotInRunGroups(notices).map((g) => g.words)].join(' ')
}

// ---------- the properties ----------

export type LienPropertySameOwner = { addressId: string; address: string; jobs: number }

export type LienProperty = {
  /** The property record's id, '' for the jobs with no record. */
  key: string
  addressId: string | null
  /** The record's address, else the first job's typed one; '' with neither. */
  address: string
  /** The owner of record the jobs resolve to, '' when none or when the jobs do not agree. */
  ownerName: string
  /** Where the record stands on *Is this public property?*; absent with no record. */
  publicStanding?: LienPublicStanding
  rows: LienTimelineBookRow[]
  jobs: LienPropertyJobLine[]
  openBalance: number
  tally: string
  /** The owner's other properties in the book: the same name at the same mailing address, and nothing looser. */
  sameOwner: LienPropertySameOwner[]
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

function ownerKey(rows: ReadonlyArray<LienTimelineBookRow>): string {
  const keys = new Set(rows.map((r) => (norm(r.job.ownerName) && norm(r.job.ownerMailingAddress) ? `${norm(r.job.ownerName)}|${norm(r.job.ownerMailingAddress)}` : '')))
  const only = keys.size === 1 ? [...keys][0]! : ''
  return only
}

/**
 * The book's rows gathered by property record, in the book's own order (the property whose next date is soonest
 * leads, and its jobs keep their order). The jobs with no record gather under one group with the key ''.
 */
export function buildLienProperties(rows: ReadonlyArray<LienTimelineBookRow>): LienProperty[] {
  const groups = new Map<string, LienTimelineBookRow[]>()
  for (const r of rows) {
    const key = r.job.addressId ?? ''
    const g = groups.get(key)
    if (g) g.push(r)
    else groups.set(key, [r])
  }
  const properties: Array<LienProperty & { owner: string }> = [...groups.entries()].map(([key, group]) => {
    const jobs = group.map(lienPropertyJobLine)
    const names = new Set(group.map((r) => r.job.ownerName.trim()).filter(Boolean))
    const first = group[0]!
    return {
      key,
      addressId: key || null,
      address: key ? first.job.propertyAddress || first.job.address : '',
      ownerName: key && names.size === 1 ? [...names][0]! : '',
      ...(key && first.job.publicStanding ? { publicStanding: first.job.publicStanding } : {}),
      rows: group,
      jobs,
      openBalance: group.reduce((s, r) => s + r.job.openBalance, 0),
      tally: lienPropertyTally(jobs),
      sameOwner: [],
      owner: key ? ownerKey(group) : '',
    }
  })
  return properties.map(({ owner, ...p }) => ({
    ...p,
    sameOwner: owner ? properties.filter((o) => o.key !== p.key && o.owner === owner).map((o) => ({ addressId: o.key, address: o.address, jobs: o.jobs.length })) : [],
  }))
}

/** One property out of the book, by its record's id; null when no job in the book stands on it. */
export function lienPropertyOf(rows: ReadonlyArray<LienTimelineBookRow>, addressId: string | null | undefined): LienProperty | null {
  if (!addressId) return null
  return buildLienProperties(rows).find((p) => p.key === addressId) ?? null
}

/** The property a job stands on, with every other job there; null for a job with no record or not in the book. */
export function lienPropertyOfJob(rows: ReadonlyArray<LienTimelineBookRow>, jobId: string): LienProperty | null {
  return lienPropertyOf(rows, rows.find((r) => r.jobId === jobId)?.job.addressId ?? null)
}

/** The head's count: *7 jobs · $15,870 open* is the caller's to format; this is *1 job* / *7 jobs*. */
export function lienPropertyJobsWords(n: number): string {
  return count(n, 'job', 'jobs')
}
