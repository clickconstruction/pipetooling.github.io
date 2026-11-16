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
 * it. The tally (`lienPropertyTallies`) counts each kind of paper apart and takes any list of jobs, so the run's
 * envelope line hands it the jobs of a property that are not in the envelope and words them as the card does. A reason the desk does not hold is never guessed: a job with nothing on record says *No notice on record*.
 *
 * Pure.
 */
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { formatYmdMonthDay } from './billedExpectedPay'
import { workMonthShort } from './forecastWorkMonths'
import { lienBoardPileWords, LIEN_RUN_TILE_LABEL } from './lienBoard'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import { affidavitGateMissingWord, lienAffidavitGateHeld, type LienAffidavitEntry, type LienAffidavitPile } from './lienDeskAffidavits'
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

/** `serve`: where a filed affidavit's copy to the owner stands, when the timeline says; absent on a paper not filed. */
export type LienPropertyAffidavitLine = { state: LienPropertyAffidavitState; words: string; aside: string; pile: LienAffidavitPile | null; serve?: 'served' | 'due' | 'overdue' }

const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export function lienPropertyAffidavitLine(f: LienPropertyAffidavitFacts): LienPropertyAffidavitLine {
  const step = f.affidavitStep ?? null
  if (step?.state === 'done') {
    const serve = f.serveStep ?? null
    const aside = serve?.state === 'done' ? serve.dateWords : serve?.state === 'missed' ? 'serving its copy is overdue' : serve?.state === 'due' ? `serve its copy by ${serve.dateWords}` : ''
    const serveState = serve?.state === 'done' ? 'served' : serve?.state === 'missed' ? 'overdue' : serve?.state === 'due' ? 'due' : null
    return { state: 'filed', words: capital(step.dateWords), aside, pile: f.pile, ...(serveState ? { serve: serveState } : {}) }
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

/**
 * The desk's own queues, when the reader holds them (v2.7488). The Board is drawn from these, and a job's entry there
 * wins over the book's: the desk builds its affidavit queue with the drafted and approved papers and with the facts
 * it joins on (the homestead answer, the GC's address, a public owner), which the book's wider read does not carry.
 * So a card never says *To send for Master approval* of a paper the Board holds in *Ready to file*.
 */
export type LienPropertyDesk = { notices?: ReadonlyArray<LienDeskEntry> | null; affidavits?: ReadonlyArray<LienAffidavitEntry> | null }

/** A book row as the property view's line. */
export function lienPropertyJobLine(row: LienTimelineBookRow, desk?: LienPropertyDesk | null): LienPropertyJobLine {
  const entry = desk?.notices?.find((e) => e.jobId === row.jobId) ?? row.notice ?? null
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
  const a = desk?.affidavits?.find((e) => e.jobId === row.jobId) ?? row.affidavit ?? null
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

type TallyPart = { n: number; kind: 'sent' | 'other' | 'whole'; words: string }

/** `first` carries the kind's noun (*4 notices sent Oct 14*); the next ones do not (*2 on Sep 22*, *1 held*). */
function joinTally(parts: ReadonlyArray<TallyPart>, one: string, many: string): string {
  const out: string[] = []
  let named = false
  let prev: TallyPart | null = null
  for (const p of parts) {
    if (p.kind === 'whole') out.push(p.words)
    else if (!named) out.push(`${count(p.n, one, many)} ${p.kind === 'sent' ? 'sent ' : ''}${p.words}`)
    else out.push(`${p.n} ${p.kind === 'sent' ? (prev?.kind === 'sent' ? 'on ' : 'sent ') : ''}${p.words}`)
    if (p.kind !== 'whole') named = true
    prev = p
  }
  return out.join(' · ')
}

const NOTICE_WAITS: ReadonlyArray<{ pile: LienDeskPile; words: string }> = [
  { pile: 'awaiting', words: 'awaiting approval' },
  { pile: 'to_draft', words: 'to send for approval' },
  { pile: 'needs_owner', words: 'needing the owner' },
  { pile: 'held', words: 'held' },
]

const AFFIDAVIT_ORDER: ReadonlyArray<{ key: string; words: string }> = [
  { key: 'ready', words: 'ready to file' },
  { key: 'waits:awaiting', words: 'awaiting approval' },
  { key: 'waits:to_draft', words: 'to send for approval' },
  { key: 'waits:needs_property', words: 'needing the property facts' },
  { key: 'held', words: 'held' },
  { key: 'filed:served', words: 'filed and served' },
  { key: 'filed:due', words: 'filed, copy to serve' },
  { key: 'filed:overdue', words: 'filed, copy overdue' },
  { key: 'filed', words: 'filed' },
  { key: 'missed', words: 'missed' },
  { key: 'blocked', words: 'blocked' },
]

function affidavitKey(a: LienPropertyAffidavitLine): string {
  if (a.state === 'filed') return a.serve ? `filed:${a.serve}` : 'filed'
  if (a.state === 'waits') return `waits:${a.pile ?? ''}`
  return a.state
}

export type LienPropertyTallies = {
  /** *4 notices sent Oct 14 · 2 on Sep 22 · 1 to print and mail*; '' with no notice to count. */
  notices: string
  /** *6 lien affidavits ready to file · 1 held*; '' with no affidavit to count. */
  affidavits: string
}

/**
 * One count per kind of paper, over whatever jobs the caller hands in (a whole property, or the jobs of a property
 * that are not in a run). The office counts a property's liens apart from its notices, so the two never share a
 * number: a job with a sent notice and an affidavit ready to file is counted once in each.
 *
 * Notices that went are counted by the day they went, the newest first. An affidavit is counted by its own stage, in
 * the Board's words. A job with nothing on record says only that.
 */
export function lienPropertyTallies(lines: ReadonlyArray<Pick<LienPropertyJobLine, 'notice' | 'affidavit'>>): LienPropertyTallies {
  const notices = lines.map((l) => l.notice)
  const parts: TallyPart[] = []
  const sent = notices.filter((n) => n.state === 'sent')
  const days = [...new Set(sent.map((n) => n.sentOn[n.sentOn.length - 1] ?? ''))].sort().reverse()
  for (const d of days.filter(Boolean)) parts.push({ n: sent.filter((n) => (n.sentOn[n.sentOn.length - 1] ?? '') === d).length, kind: 'sent', words: formatYmdMonthDay(d) })
  const undated = sent.filter((n) => n.sentOn.length === 0).length
  if (undated) parts.push({ n: undated, kind: 'other', words: 'on record' })
  const going = notices.filter((n) => n.state === 'going').length
  if (going) parts.push({ n: going, kind: 'other', words: LIEN_RUN_TILE_LABEL })
  for (const w of NOTICE_WAITS) {
    const n = notices.filter((x) => x.state === 'waits' && x.pile === w.pile).length
    if (n) parts.push({ n, kind: 'other', words: w.words })
  }
  const missed = notices.filter((n) => n.state === 'missed').length
  if (missed) parts.push({ n: missed, kind: 'other', words: 'missed' })
  const noneNeeded = notices.filter((n) => n.state === 'none_needed').length
  if (noneNeeded) parts.push({ n: noneNeeded, kind: 'whole', words: `${count(noneNeeded, 'job needs', 'jobs need')} no notice` })
  const none = notices.filter((n) => n.state === 'none').length
  if (none) parts.push({ n: none, kind: 'whole', words: `${count(none, 'job', 'jobs')} with no notice on record` })

  const affidavits = lines.map((l) => l.affidavit).filter((a) => a.state !== 'none')
  const aParts: TallyPart[] = []
  const seen = new Set<string>()
  for (const o of AFFIDAVIT_ORDER) {
    const n = affidavits.filter((a) => affidavitKey(a) === o.key).length
    if (n) aParts.push({ n, kind: 'other', words: o.words })
    seen.add(o.key)
  }
  // A pile this list does not name yet keeps the Board's own words for it, so a new bin is counted the day it lands.
  for (const key of [...new Set(affidavits.map(affidavitKey))].filter((k) => !seen.has(k))) {
    const of = affidavits.filter((a) => affidavitKey(a) === key)
    aParts.push({ n: of.length, kind: 'other', words: of[0]!.pile ? lienBoardPileWords('affidavit', of[0]!.pile).toLowerCase() : of[0]!.state })
  }
  return { notices: joinTally(parts, 'notice', 'notices'), affidavits: joinTally(aParts, 'lien affidavit', 'lien affidavits') }
}

/** Both kinds on one line, the notices first: *4 notices sent Oct 14 · 2 on Sep 22 · 6 lien affidavits ready to file*. '' with nothing to count. */
export function lienPropertyTally(lines: ReadonlyArray<Pick<LienPropertyJobLine, 'notice' | 'affidavit'>>): string {
  const t = lienPropertyTallies(lines)
  return [t.notices, t.affidavits].filter(Boolean).join(' · ')
}

// ---------- the properties ----------

/** `sameAddress`: the other record reads the same address as this one, so it is a second record for one place, not a second property. */
export type LienPropertySameOwner = { addressId: string; address: string; jobs: number; sameAddress?: boolean }

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
  /** The two kinds on one line, the notices first. */
  tally: string
  /** Each kind of paper counted apart (`lienPropertyTallies`): a count of liens is never mixed into a count of notices. */
  tallies: LienPropertyTallies
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
export function buildLienProperties(rows: ReadonlyArray<LienTimelineBookRow>, desk?: LienPropertyDesk | null): LienProperty[] {
  const groups = new Map<string, LienTimelineBookRow[]>()
  for (const r of rows) {
    const key = r.job.addressId ?? ''
    const g = groups.get(key)
    if (g) g.push(r)
    else groups.set(key, [r])
  }
  const properties: Array<LienProperty & { owner: string }> = [...groups.entries()].map(([key, group]) => {
    const jobs = group.map((r) => lienPropertyJobLine(r, desk))
    const tallies = lienPropertyTallies(jobs)
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
      tally: [tallies.notices, tallies.affidavits].filter(Boolean).join(' · '),
      tallies,
      sameOwner: [],
      owner: key ? ownerKey(group) : '',
    }
  })
  return properties.map(({ owner, ...p }) => ({
    ...p,
    sameOwner: owner ? properties.filter((o) => o.key !== p.key && o.owner === owner).map((o) => ({ addressId: o.key, address: o.address, jobs: o.jobs.length, ...(norm(o.address) && norm(o.address) === norm(p.address) ? { sameAddress: true } : {}) })) : [],
  }))
}

/** One property out of the book, by its record's id; null when no job in the book stands on it. */
export function lienPropertyOf(rows: ReadonlyArray<LienTimelineBookRow>, addressId: string | null | undefined, desk?: LienPropertyDesk | null): LienProperty | null {
  if (!addressId) return null
  return buildLienProperties(rows, desk).find((p) => p.key === addressId) ?? null
}

/** The property a job stands on, with every other job there; null for a job with no record or not in the book. */
export function lienPropertyOfJob(rows: ReadonlyArray<LienTimelineBookRow>, jobId: string, desk?: LienPropertyDesk | null): LienProperty | null {
  return lienPropertyOf(rows, rows.find((r) => r.jobId === jobId)?.job.addressId ?? null, desk)
}

/** The head's count: *7 jobs · $15,870 open* is the caller's to format; this is *1 job* / *7 jobs*. */
export function lienPropertyJobsWords(n: number): string {
  return count(n, 'job', 'jobs')
}
