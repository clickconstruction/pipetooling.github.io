/**
 * The Lien desk's Board (the owner's ask of 2026-11-15): the whole month as one picture. Two
 * columns of bins, one per stage — the monthly notices on the left, the lien affidavits on the
 * right — every job in its bin as a small chip coloured by how soon its day is, thin arrows down
 * each column and one from Sent across to Needs the property facts (the notice on record is the
 * affidavit's gate), four tiles over the columns, the busiest bin lit, Held and Missed beside a
 * column only while a job is in one, and retainage as one line under the notices.
 *
 * Pure. It folds the queues the desk already builds (`buildLienDeskQueue`, `buildLienAffidavitQueue`,
 * `buildLienRetainageQueue`) and reads nothing itself. Nothing here writes, and nothing here opens
 * a window: a chip only names the desk's door for its stage (`destination`), and the component
 * walks through it. Every line a person reads keeps to `plainWords.ts`; the `·` in a tile's label
 * is the desk's own mark, as on every pile chip, never glue inside a sentence.
 *
 * Two names follow main's piles (2026-11-15): *To send* for the `to_draft` pile (v2.7327) and *In the run* for the
 * approved and printed notices (v2.7328). `LIEN_BOARD_WORDS` holds both.
 */
import { batchWords, type BatchWords } from '../batchWords'
import { daysBetweenYmd, formatYmdMonthDay } from './billedExpectedPay'
import { formatUsdNoCents } from './jobFormatting'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import type { LienAffidavitEntry, LienAffidavitGateKey, LienAffidavitPile } from './lienDeskAffidavits'
import type { LienRetainageEntry } from './lienDeskRetainage'

/** The two kinds of paper the Board draws; retainage is a line, not a column. */
export type LienBoardKind = 'notice' | 'affidavit'

/** The notice column's bins in flow order, then the two beside it. */
export type LienBoardNoticeStage = 'needs_owner' | 'to_send' | 'awaiting' | 'in_mail' | 'sent' | 'held' | 'missed'
/** The affidavit column's bins in flow order, then the two beside it. */
export type LienBoardAffidavitStage = 'needs_property' | 'to_send' | 'awaiting' | 'ready' | 'filed' | 'held' | 'missed'

export type LienBoardBinKey = `notice:${LienBoardNoticeStage}` | `affidavit:${LienBoardAffidavitStage}`

/** How soon a chip's day is: red within a day or past, amber this week, purple waiting on the leader, grey later. */
export type LienBoardUrgency = 'day' | 'week' | 'waiting' | 'later'

/** The desk's door for a chip's stage; the component opens it through the desk's own windows and address. */
export type LienBoardDestination =
  /** The property record, opened at the line that is missing. */
  | { kind: 'property'; jobId: string; focus: 'owner' | 'legal' | 'homestead_answer' }
  /** The job's paper on By paper: its notice or its affidavit pane. */
  | { kind: 'paper'; tab: 'notices' | 'affidavits'; jobId: string }
  /** The run, open on this notice's envelope. */
  | { kind: 'run'; itemId: string; jobId: string }
  /** The job's Lien window on its affidavit tab. */
  | { kind: 'lienWindow'; jobId: string }

export type LienBoardChip = {
  jobId: string
  /** The job's number, as the chip reads it. */
  label: string
  kind: LienBoardKind
  stage: LienBoardNoticeStage | LienBoardAffidavitStage
  bin: LienBoardBinKey
  /** The paper's last day, or null when it has none of its own. */
  dueYmd: string | null
  /** Whole days to `dueYmd`, negative once past; null with no day. */
  daysLeft: number | null
  /** The stages still to pass before the paper is sent or filed. */
  stepsLeft: number
  urgency: LienBoardUrgency
  /** The stages left outrun the working days left: it will not make its day as it stands. */
  atRisk: boolean
  destination: LienBoardDestination
  /** The hover's words: the job's name, its GC and what it owes. */
  tip: string
  /** The job stands in both columns for one reason; `pairKey` is shared by both chips. */
  pairKey: string | null
  /** What it still owes. */
  openBalance: number
  /** The desk's pile the chip came from, for the stage's own words. */
  pile: LienDeskPile | LienAffidavitPile
  /** The job's GC, for a run row that stands for a GC's notices; null without one. */
  gcId: string | null
  /** The job sits on a property that reads as public and has no answer yet (v2.7443): the chip carries ⊘ and no red day. */
  publicMark?: boolean
}

export type LienBoardBin = {
  key: LienBoardBinKey
  kind: LienBoardKind
  stage: LienBoardNoticeStage | LienBoardAffidavitStage
  label: string
  chips: LienBoardChip[]
  /** Held and Missed stand beside the column, drawn only while a job is in them. */
  beside: boolean
  /** The busiest bin on the Board. */
  lit: boolean
}

export type LienBoardArrow = { from: LienBoardBinKey; to: LienBoardBinKey; kind: 'down' | 'cross' }

export type LienBoardTileKey = 'by_day' | 'waiting' | 'in_mail' | 'unpaid'

export type LienBoardTile = {
  key: LienBoardTileKey
  /** The big figure. */
  figure: string
  /** The words under the figure, a label: *to file · to send*. */
  label: string
  /** One plain sentence under the label, or null. */
  line: string | null
  tone: 'red' | 'amber' | 'violet' | 'quiet'
  /** Where the tile's press goes, or null for a tile that only reads. */
  destination: LienBoardTileDestination | null
  /** Where the tile's line goes when the line is a press of its own (v2.7371): the day tile's red line narrows the list to the papers it counts. */
  lineDestination?: LienBoardTileDestination | null
}

export type LienBoardTileDestination = { kind: 'stage'; stage: 'awaiting' } | { kind: 'run' } | { kind: 'risk' }

/** A job in both columns for one reason, cleared by one door. */
export type LienBoardPair = { key: string; jobId: string; reason: 'owner'; destination: LienBoardDestination }

/** One of the four dots on the Dashboard's Needs you card. */
export type LienBoardDot = { key: LienBoardTileKey; figure: string; words: string; tone: LienBoardTile['tone'] }

export type LienBoard = {
  notices: LienBoardBin[]
  affidavits: LienBoardBin[]
  arrows: LienBoardArrow[]
  tiles: LienBoardTile[]
  pairs: LienBoardPair[]
  /** The busiest bin, or null on an empty Board. */
  lit: LienBoardBinKey | null
  /** Retainage as one line under the notices, or null when nothing is on its desk. */
  retainageLine: string | null
  /** The day the top tile counts to, as a day: *Monday*, *tomorrow*, *Nov 20*; null with nothing dated. */
  dayWords: string | null
  /** Chips that will not make their day as they stand. */
  atRisk: number
  /** True when no chip is on the Board. */
  empty: boolean
}

export type LienBoardInput = {
  notices: ReadonlyArray<LienDeskEntry>
  affidavits: ReadonlyArray<LienAffidavitEntry>
  retainage: ReadonlyArray<LienRetainageEntry>
  todayYmd: string
  /** The job's number as the desk prints it: *JP650*. */
  jobNumber: (jobId: string) => string
  /** The job's name, for the hover; empty when unknown. */
  jobName: (jobId: string) => string
  /** The GC by id, for the hover; empty when unknown. */
  gcName: (gcId: string) => string
  /** The leader the papers wait on, by name; absent reads *the leader*. */
  leaderName?: string | null
  /** Jobs on a property that reads as public and has no answer yet (v2.7443, `publicAskJobIds`): their chips carry the mark. */
  publicJobIds?: ReadonlySet<string>
}

/** The bins' words. The two that wait on sibling PRs are named at the top of the file. */
export const LIEN_BOARD_WORDS = {
  needs_owner: 'Needs the owner',
  needs_property: 'Needs the property facts',
  to_send: 'To send',
  awaiting: 'Awaiting approval',
  in_mail: 'In the run',
  sent: 'Sent',
  ready: 'Ready to file',
  filed: 'Filed · Served',
  held: 'Held',
  missed: 'Missed',
} as const

export const LIEN_BOARD_NOTICE_STAGES: ReadonlyArray<LienBoardNoticeStage> = ['needs_owner', 'to_send', 'awaiting', 'in_mail', 'sent', 'held', 'missed']
export const LIEN_BOARD_AFFIDAVIT_STAGES: ReadonlyArray<LienBoardAffidavitStage> = ['needs_property', 'to_send', 'awaiting', 'ready', 'filed', 'held', 'missed']

/** The flow's stages, in order; Held and Missed stand beside. */
const NOTICE_FLOW: ReadonlyArray<LienBoardNoticeStage> = ['needs_owner', 'to_send', 'awaiting', 'in_mail', 'sent']
const AFFIDAVIT_FLOW: ReadonlyArray<LienBoardAffidavitStage> = ['needs_property', 'to_send', 'awaiting', 'ready', 'filed']

/** A chip inside this many days, or past its day, is red. */
export const LIEN_BOARD_DAY_DAYS = 1
/** A chip inside this many days is amber. */
export const LIEN_BOARD_WEEK_DAYS = 7

/**
 * The stages a paper still has to pass, by name and in order, from the bin it stands in (v2.7419; Taunya's ask of
 * 2026-11-15: the card said *3 stages left* and did not say which three). `{leader}` is the job's leader by name.
 * The count the Board races against the working days is each list's length, so the names and the count cannot
 * disagree. A held paper waits on the leader again, so it has what an awaiting one has.
 */
const NOTICE_TAIL = ['Send it for approval', '{leader} approves and signs it', 'Mail it and record the mailing'] as const
/** The stages still to pass before a notice is mailed with its number on record. */
const NOTICE_STAGES_LEFT: Record<LienBoardNoticeStage, ReadonlyArray<string>> = {
  needs_owner: ['Name the owner on the property record', ...NOTICE_TAIL],
  to_send: NOTICE_TAIL,
  awaiting: NOTICE_TAIL.slice(1),
  in_mail: NOTICE_TAIL.slice(2),
  sent: [],
  held: NOTICE_TAIL.slice(1),
  missed: [],
}
const AFFIDAVIT_TAIL = ['Send it for approval', '{leader} approves it', 'Notarize it and file it with the county'] as const
/** The stages still to pass before an affidavit is filed. */
const AFFIDAVIT_STAGES_LEFT: Record<LienBoardAffidavitStage, ReadonlyArray<string>> = {
  needs_property: ['Clear what holds it', ...AFFIDAVIT_TAIL],
  to_send: AFFIDAVIT_TAIL,
  awaiting: AFFIDAVIT_TAIL.slice(1),
  ready: AFFIDAVIT_TAIL.slice(2),
  filed: [],
  held: AFFIDAVIT_TAIL.slice(1),
  missed: [],
}

/** The stages a chip's paper still has to pass, in order and by name; `leader` absent reads *The leader*. Empty once it is sent, filed or missed. */
export function lienBoardStagesLeft(chip: Pick<LienBoardChip, 'kind' | 'stage'>, leader?: string | null): string[] {
  const list = chip.kind === 'notice' ? NOTICE_STAGES_LEFT[chip.stage as LienBoardNoticeStage] : AFFIDAVIT_STAGES_LEFT[chip.stage as LienBoardAffidavitStage]
  const name = leader?.trim() || 'The leader'
  return (list ?? []).map((s) => s.replace('{leader}', name))
}

function noticeStage(pile: LienDeskPile): LienBoardNoticeStage {
  switch (pile) {
    case 'needs_owner':
      return 'needs_owner'
    case 'to_draft':
      return 'to_send'
    case 'awaiting':
      return 'awaiting'
    case 'ready':
    case 'printed':
      return 'in_mail'
    case 'sent':
      return 'sent'
    case 'held':
      return 'held'
    case 'missed':
      return 'missed'
  }
}

function affidavitStage(pile: LienAffidavitPile): LienBoardAffidavitStage {
  switch (pile) {
    case 'needs_property':
      return 'needs_property'
    case 'to_draft':
      return 'to_send'
    case 'awaiting':
      return 'awaiting'
    case 'ready':
      return 'ready'
    case 'filed':
      return 'filed'
    case 'held':
      return 'held'
    case 'missed':
      return 'missed'
  }
}

function utcDay(ymd: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return -1
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
}

function ymdShift(ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) + days * 86_400_000).toISOString().slice(0, 10)
}

/**
 * The working days from today through the due day, both counted when they are weekdays: a paper due
 * today has one day to act in, one due next Monday has six from a Monday. Zero once the day is past.
 */
export function lienBoardWorkingDaysLeft(todayYmd: string, dueYmd: string): number {
  const span = daysBetweenYmd(todayYmd, dueYmd)
  if (span == null || span < 0) return 0
  let n = 0
  for (let i = 0; i <= span; i += 1) {
    const d = utcDay(ymdShift(todayYmd, i))
    if (d !== 0 && d !== 6) n += 1
  }
  return n
}

/** The stages left outrun the working days left; a paper past its day or with none left to pass is never at risk here. */
export function lienBoardAtRisk(stepsLeft: number, todayYmd: string, dueYmd: string | null): boolean {
  if (!dueYmd || stepsLeft <= 0) return false
  const span = daysBetweenYmd(todayYmd, dueYmd)
  if (span == null || span < 0) return false
  return stepsLeft > lienBoardWorkingDaysLeft(todayYmd, dueYmd)
}

/** Red within a day or past, amber this week, purple while it waits on the leader, grey otherwise. The day wins over the wait: the bin already says it waits. */
export function lienBoardUrgency(daysLeft: number | null, waiting: boolean): LienBoardUrgency {
  if (daysLeft != null && daysLeft <= LIEN_BOARD_DAY_DAYS) return 'day'
  if (daysLeft != null && daysLeft <= LIEN_BOARD_WEEK_DAYS) return 'week'
  if (waiting) return 'waiting'
  return 'later'
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

/** A day as the tile names it: *today*, *tomorrow*, its weekday inside the week, else *Nov 20*. */
export function lienBoardDayWords(todayYmd: string, dueYmd: string): string {
  const span = daysBetweenYmd(todayYmd, dueYmd)
  if (span == null) return formatYmdMonthDay(dueYmd)
  if (span <= 0) return 'today'
  if (span === 1) return 'tomorrow'
  if (span <= 6) return WEEKDAYS[utcDay(dueYmd)] ?? formatYmdMonthDay(dueYmd)
  return formatYmdMonthDay(dueYmd)
}

/** The property line an affidavit's gates say is missing, or null when the record is whole or its hold is not the record's. */
function propertyFocus(gates: ReadonlyArray<{ key: LienAffidavitGateKey; ok: boolean }>): 'owner' | 'legal' | 'homestead_answer' | null {
  const failing = gates.filter((g) => !g.ok).map((g) => g.key)
  if (failing.includes('owner')) return 'owner'
  if (failing.includes('legal')) return 'legal'
  if (failing.includes('homestead_answer')) return 'homestead_answer'
  return null
}

function noticeDestination(e: LienDeskEntry, stage: LienBoardNoticeStage): LienBoardDestination {
  switch (stage) {
    case 'needs_owner':
      return { kind: 'property', jobId: e.jobId, focus: 'owner' }
    case 'in_mail':
      return e.item ? { kind: 'run', itemId: e.item.id, jobId: e.jobId } : { kind: 'paper', tab: 'notices', jobId: e.jobId }
    default:
      return { kind: 'paper', tab: 'notices', jobId: e.jobId }
  }
}

function affidavitDestination(e: LienAffidavitEntry, stage: LienBoardAffidavitStage): LienBoardDestination {
  switch (stage) {
    case 'needs_property': {
      const failing = e.gates.filter((g) => !g.ok).map((g) => g.key)
      // The notice as the one gate left: the door is the notice, as the To do row's is (v2.4708).
      if (failing.length === 1 && failing[0] === 'notice') return { kind: 'paper', tab: 'notices', jobId: e.jobId }
      const focus = propertyFocus(e.gates)
      return focus ? { kind: 'property', jobId: e.jobId, focus } : { kind: 'paper', tab: 'affidavits', jobId: e.jobId }
    }
    case 'filed':
      return { kind: 'lienWindow', jobId: e.jobId }
    default:
      return { kind: 'paper', tab: 'affidavits', jobId: e.jobId }
  }
}

/** The hover's words: the job's name, its GC and what it owes, the empty parts left out. */
export function lienBoardTip(parts: { jobName: string; gcName: string; openBalance: number }): string {
  return [parts.jobName.trim(), parts.gcName.trim(), parts.openBalance > 0 ? formatUsdNoCents(parts.openBalance) : ''].filter(Boolean).join(' · ')
}

/** By the day, the undated last; then by the number, so two chips due the same day keep one order. */
export function compareLienBoardChips(a: Pick<LienBoardChip, 'dueYmd' | 'label'>, b: Pick<LienBoardChip, 'dueYmd' | 'label'>): number {
  if (a.dueYmd && b.dueYmd && a.dueYmd !== b.dueYmd) return a.dueYmd < b.dueYmd ? -1 : 1
  if (!!a.dueYmd !== !!b.dueYmd) return a.dueYmd ? -1 : 1
  return a.label.localeCompare(b.label, undefined, { numeric: true })
}

/** The arrows: down each column between the flow's bins, and one across from Sent to Needs the property facts. */
export function lienBoardArrows(): LienBoardArrow[] {
  const arrows: LienBoardArrow[] = []
  for (let i = 1; i < NOTICE_FLOW.length; i += 1) arrows.push({ from: `notice:${NOTICE_FLOW[i - 1]!}`, to: `notice:${NOTICE_FLOW[i]!}`, kind: 'down' })
  for (let i = 1; i < AFFIDAVIT_FLOW.length; i += 1) arrows.push({ from: `affidavit:${AFFIDAVIT_FLOW[i - 1]!}`, to: `affidavit:${AFFIDAVIT_FLOW[i]!}`, kind: 'down' })
  arrows.push({ from: 'notice:sent', to: 'affidavit:needs_property', kind: 'cross' })
  return arrows
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/** The retainage line under the notices: each pile with a job in it, in flow order; null when its desk is empty. */
export function lienBoardRetainageLine(retainage: ReadonlyArray<LienRetainageEntry>): string | null {
  const live = retainage.filter((e) => e.pile !== 'sent' && e.pile !== 'clock_not_started')
  if (live.length === 0) return null
  const count = (pile: LienRetainageEntry['pile']) => live.filter((e) => e.pile === pile).length
  const parts = [
    [count('needs_owner'), 'needs the owner', 'need the owner'],
    [count('to_draft'), 'to send', 'to send'],
    [count('awaiting'), 'awaiting approval', 'awaiting approval'],
    [count('ready'), 'ready to send', 'ready to send'],
    [count('held'), 'held', 'held'],
    [count('missed'), 'missed', 'missed'],
  ] as const
  const words = parts.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${plural(n, one, many)}`)
  return `Retainage · ${words.join(' · ')}`
}

function buildChips(input: LienBoardInput): { notices: LienBoardChip[]; affidavits: LienBoardChip[]; pairs: LienBoardPair[] } {
  const tipFor = (jobId: string, gcId: string | null, openBalance: number) => lienBoardTip({ jobName: input.jobName(jobId), gcName: gcId ? input.gcName(gcId) : '', openBalance })
  // A job in both columns for the one reason: no owner of record. One door clears both.
  const affidavitNeedsOwner = new Set(input.affidavits.filter((a) => a.pile === 'needs_property' && a.gates.some((g) => g.key === 'owner' && !g.ok)).map((a) => a.jobId))
  const pairs: LienBoardPair[] = []
  const pairKeyByJob = new Map<string, string>()
  for (const e of input.notices) {
    if (e.pile === 'needs_owner' && affidavitNeedsOwner.has(e.jobId)) {
      const key = `owner:${e.jobId}`
      pairKeyByJob.set(e.jobId, key)
      pairs.push({ key, jobId: e.jobId, reason: 'owner', destination: { kind: 'property', jobId: e.jobId, focus: 'owner' } })
    }
  }
  // A job on a property that reads as public and has no answer yet (v2.7443): no paper can be made there, so its chip
  // loses its red day and its *!*, and carries the mark instead.
  const publicJob = (jobId: string) => Boolean(input.publicJobIds?.has(jobId))
  const notices: LienBoardChip[] = input.notices.map((e) => {
    const stage = noticeStage(e.pile)
    const stepsLeft = NOTICE_STAGES_LEFT[stage].length
    const dueYmd = e.earliestDeadline
    const daysLeft = dueYmd ? e.daysLeft : null
    const marked = publicJob(e.jobId)
    return {
      jobId: e.jobId,
      label: input.jobNumber(e.jobId),
      kind: 'notice',
      stage,
      bin: `notice:${stage}`,
      dueYmd,
      daysLeft,
      stepsLeft,
      urgency: stage === 'sent' || marked ? 'later' : lienBoardUrgency(daysLeft, stage === 'awaiting'),
      atRisk: !marked && lienBoardAtRisk(stepsLeft, input.todayYmd, dueYmd),
      ...(marked ? { publicMark: true } : {}),
      destination: noticeDestination(e, stage),
      tip: tipFor(e.jobId, e.gcCustomerId, e.openBalance),
      pairKey: pairKeyByJob.get(e.jobId) ?? null,
      openBalance: e.openBalance,
      pile: e.pile,
      gcId: e.gcCustomerId,
    }
  })
  const affidavits: LienBoardChip[] = input.affidavits.map((e) => {
    const stage = affidavitStage(e.pile)
    const stepsLeft = AFFIDAVIT_STAGES_LEFT[stage].length
    const dueYmd = e.deadline || null
    const daysLeft = dueYmd ? e.daysLeft : null
    const marked = publicJob(e.jobId)
    return {
      jobId: e.jobId,
      label: input.jobNumber(e.jobId),
      kind: 'affidavit',
      stage,
      bin: `affidavit:${stage}`,
      dueYmd,
      daysLeft,
      stepsLeft,
      urgency: stage === 'filed' || marked ? 'later' : lienBoardUrgency(daysLeft, stage === 'awaiting'),
      atRisk: !marked && lienBoardAtRisk(stepsLeft, input.todayYmd, dueYmd),
      ...(marked ? { publicMark: true } : {}),
      destination: affidavitDestination(e, stage),
      tip: tipFor(e.jobId, e.gcCustomerId, e.openBalance),
      pairKey: stage === 'needs_property' ? pairKeyByJob.get(e.jobId) ?? null : null,
      openBalance: e.openBalance,
      pile: e.pile,
      gcId: e.gcCustomerId,
    }
  })
  return { notices, affidavits, pairs }
}

function binsFor<S extends LienBoardNoticeStage | LienBoardAffidavitStage>(kind: LienBoardKind, stages: ReadonlyArray<S>, chips: ReadonlyArray<LienBoardChip>): LienBoardBin[] {
  return stages.map((stage) => {
    const key = `${kind}:${stage}` as LienBoardBinKey
    return {
      key,
      kind,
      stage,
      label: LIEN_BOARD_WORDS[stage],
      chips: chips.filter((c) => c.bin === key).sort(compareLienBoardChips),
      beside: stage === 'held' || stage === 'missed',
      lit: false,
    }
  })
}

/** The busiest bin, the first in column order on a tie; null when every bin is empty. */
export function lienBoardLitBin(bins: ReadonlyArray<Pick<LienBoardBin, 'key' | 'chips'>>): LienBoardBinKey | null {
  let best: { key: LienBoardBinKey; n: number } | null = null
  for (const b of bins) {
    if (b.chips.length > 0 && (!best || b.chips.length > best.n)) best = { key: b.key, n: b.chips.length }
  }
  return best?.key ?? null
}

/** A chip still to send or file: not sent, not filed, not past its window. */
/** *will not make tomorrow as they stand*: the day tile's line after its count, the list's head over the same papers, and what a press on the line narrows the list to. */
export function lienBoardRiskPhrase(dayWords: string | null, n: number): string {
  return `will not make ${dayWords ?? (n === 1 ? 'its day' : 'their day')} as ${n === 1 ? 'it stands' : 'they stand'}`
}

function open(c: LienBoardChip): boolean {
  return c.stage !== 'sent' && c.stage !== 'filed' && c.stage !== 'missed'
}

function tiles(input: LienBoardInput, notices: ReadonlyArray<LienBoardChip>, affidavits: ReadonlyArray<LienBoardChip>): { tiles: LienBoardTile[]; dayWords: string | null; atRisk: number } {
  const liveChips = [...notices, ...affidavits].filter(open)
  const dated = liveChips.filter((c) => c.dueYmd && c.daysLeft != null && c.daysLeft >= 0).map((c) => c.dueYmd as string).sort()
  const day = dated[0] ?? null
  const dayWords = day ? lienBoardDayWords(input.todayYmd, day) : null
  const byDay = day ? liveChips.filter((c) => c.dueYmd && c.dueYmd <= day) : []
  const toFile = byDay.filter((c) => c.kind === 'affidavit').length
  const toSend = byDay.filter((c) => c.kind === 'notice').length
  const atRisk = liveChips.filter((c) => c.atRisk).length
  const late = liveChips.filter((c) => c.daysLeft != null && c.daysLeft < 0).length
  const dayLabel = [toFile > 0 ? `${toFile} to file` : '', toSend > 0 ? `${toSend} to send` : ''].filter(Boolean).join(' · ')
  const dayLine = atRisk > 0 && dayWords ? `${atRisk} ${lienBoardRiskPhrase(dayWords, atRisk)}.` : late > 0 ? `${late} ${plural(late, 'is', 'are')} past ${plural(late, 'its', 'their')} day.` : null
  const waiting = [...notices, ...affidavits].filter((c) => c.stage === 'awaiting')
  const leader = input.leaderName?.trim() || 'the leader'
  const printed = notices.filter((c) => c.pile === 'printed').length
  const ready = notices.filter((c) => c.pile === 'ready').length
  const unpaidByJob = new Map<string, number>()
  for (const c of [...notices, ...affidavits]) if (!unpaidByJob.has(c.jobId)) unpaidByJob.set(c.jobId, c.openBalance)
  const unpaid = [...unpaidByJob.values()].reduce((s, n) => s + n, 0)
  const soonest = byDay.some((c) => c.urgency === 'day')
  return {
    dayWords,
    atRisk,
    tiles: [
      {
        key: 'by_day',
        figure: day ? String(byDay.length) : '0',
        label: day ? `by ${dayWords}${dayLabel ? ` · ${dayLabel}` : ''}` : 'nothing dated',
        line: dayLine,
        tone: atRisk > 0 || late > 0 || soonest ? 'red' : byDay.length > 0 ? 'amber' : 'quiet',
        destination: null,
        lineDestination: atRisk > 0 && dayWords ? { kind: 'risk' } : null,
      },
      {
        key: 'waiting',
        figure: String(waiting.length),
        label: `waiting on ${leader}`,
        line: waiting.length === 0 ? `Nothing waits on ${leader}.` : null,
        tone: waiting.length > 0 ? 'violet' : 'quiet',
        destination: waiting.length > 0 ? { kind: 'stage', stage: 'awaiting' } : null,
      },
      {
        key: 'in_mail',
        figure: String(printed + ready),
        label: LIEN_BOARD_WORDS.in_mail.toLowerCase(),
        line: printed > 0 ? `Type the tracking ${plural(printed, 'number', 'numbers')}.` : ready > 0 ? `Print the run.` : 'Nothing is in the run.',
        tone: printed + ready > 0 ? 'amber' : 'quiet',
        destination: printed + ready > 0 ? { kind: 'run' } : null,
      },
      {
        key: 'unpaid',
        figure: formatUsdNoCents(unpaid),
        label: 'unpaid on the desk',
        line: null,
        tone: 'quiet',
        destination: null,
      },
    ],
  }
}

export function buildLienBoard(input: LienBoardInput): LienBoard {
  const { notices, affidavits, pairs } = buildChips(input)
  const noticeBins = binsFor('notice', LIEN_BOARD_NOTICE_STAGES, notices)
  const affidavitBins = binsFor('affidavit', LIEN_BOARD_AFFIDAVIT_STAGES, affidavits)
  const lit = lienBoardLitBin([...noticeBins, ...affidavitBins])
  for (const b of [...noticeBins, ...affidavitBins]) b.lit = b.key === lit
  const t = tiles(input, notices, affidavits)
  return {
    notices: noticeBins,
    affidavits: affidavitBins,
    arrows: lienBoardArrows(),
    tiles: t.tiles,
    pairs,
    lit,
    retainageLine: lienBoardRetainageLine(input.retainage),
    dayWords: t.dayWords,
    atRisk: t.atRisk,
    empty: notices.length === 0 && affidavits.length === 0,
  }
}

/** The bins the Board draws: the flow's, and Held or Missed only while a job is in it. */
export function lienBoardBinsShown(bins: ReadonlyArray<LienBoardBin>): LienBoardBin[] {
  return bins.filter((b) => !b.beside || b.chips.length > 0)
}

/** The four dots for the Dashboard's Needs you card: the tiles' figures and a word each. */
export function lienBoardDots(board: Pick<LienBoard, 'tiles' | 'dayWords'>): LienBoardDot[] {
  return board.tiles.map((t) => ({
    key: t.key,
    figure: t.figure,
    words: t.key === 'by_day' ? (board.dayWords ? `by ${board.dayWords}` : 'nothing dated') : t.label,
    tone: t.tone,
  }))
}

export type LienBoardLeaderHeld = { chip: LienBoardChip; reason: string }

export type LienBoardLeaderView = {
  /** His two bins: the notices and the affidavits awaiting his approval, each holding only the jobs he leads. */
  bins: LienBoardBin[]
  /** The one press for the lot, in the run's shape: *Approve 2 papers · 3 need your signature ▸*, dead when nothing is ready. */
  press: BatchWords
  /** The chips the press acts on, by due day: the affidavits waiting on him and still inside their window. */
  chips: LienBoardChip[]
  /** What the press leaves where it is, each with its reason: a notice, which only his signature approves, and a paper past its day. */
  held: LienBoardLeaderHeld[]
}

/** Why the press holds a paper: a notice is approved by his signature on it, never by a batch; a paper past its day sends nothing on time. */
export const LIEN_BOARD_LEADER_HOLDS = {
  signature: 'needs your signature',
  late: 'is past its day',
} as const

/**
 * The leader's Board: only the bins that wait on him, holding only the jobs he leads (`leads`, absent: every job), and
 * one counted press for the lot. The press approves the affidavits that wait inside their window; a notice is held with
 * its reason, since the law wants his signature on each, and so is a paper past its day. What is held keeps its chip,
 * a press to its own door.
 */
export function lienBoardForLeader(board: Pick<LienBoard, 'notices' | 'affidavits'>, opts: { leads?: (jobId: string) => boolean } = {}): LienBoardLeaderView {
  const leads = opts.leads ?? (() => true)
  const bins = [...board.notices, ...board.affidavits].filter((b) => b.stage === 'awaiting').map((b) => ({ ...b, chips: b.chips.filter((c) => leads(c.jobId)) }))
  const all = bins.flatMap((b) => b.chips).sort(compareLienBoardChips)
  const held: LienBoardLeaderHeld[] = []
  const chips: LienBoardChip[] = []
  for (const c of all) {
    if (c.daysLeft != null && c.daysLeft < 0) held.push({ chip: c, reason: LIEN_BOARD_LEADER_HOLDS.late })
    else if (c.kind === 'notice') held.push({ chip: c, reason: LIEN_BOARD_LEADER_HOLDS.signature })
    else chips.push(c)
  }
  const signatures = held.filter((h) => h.reason === LIEN_BOARD_LEADER_HOLDS.signature).length
  const heldWhy = signatures === held.length ? { one: 'needs your signature', many: 'need your signature' } : signatures === 0 ? { one: 'is past its day', many: 'are past their day' } : { one: 'is held', many: 'are held' }
  const press = batchWords({ verb: 'Approve', ready: chips.length, held: held.length, heldWhy, noun: ['affidavit', 'affidavits'] })
  return { bins, press, chips, held }
}

/**
 * The papers that will not make their day as they stand (v2.7371): the chips the day tile's red line counts, by
 * `kind:jobId`, each with the stages it still has to pass. The To do list reads the same map, so the tile, the
 * marked chips and the list's first rows are one rule.
 */
export function lienBoardRiskPapers(board: Pick<LienBoard, 'notices' | 'affidavits'>): ReadonlyMap<string, number> {
  const out = new Map<string, number>()
  for (const b of [...board.notices, ...board.affidavits]) for (const c of b.chips) if (c.atRisk && open(c)) out.set(`${c.kind}:${c.jobId}`, c.stepsLeft)
  return out
}

/**
 * The stages a To do row's paper still has to pass when it will not make its day, else null. A row is its job's
 * notice or affidavit (`notice:…`, `affidavit:…`), or a run row standing for several notices, which takes the
 * longest road among them. A reminder, a served copy, a returned envelope and a retainage row are never at risk here.
 */
export function lienBoardRowRisk(papers: ReadonlyMap<string, number>, row: { key: string; kind: string; jobId: string | null; jobs?: ReadonlyArray<{ jobId: string }> }): number | null {
  if (row.jobs?.length) {
    const steps = row.jobs.map((j) => papers.get(`notice:${j.jobId}`)).filter((n): n is number => n != null)
    return steps.length ? Math.max(...steps) : null
  }
  if (!row.jobId || (row.kind !== 'notice' && row.kind !== 'affidavit') || row.key !== `${row.kind}:${row.jobId}`) return null
  return papers.get(row.key) ?? null
}

/** A pressed bin, a tile's stage across both columns, or the day tile's red line: what the list under the Board is narrowed to. */
export type LienBoardPick = {
  bins: LienBoardBinKey[]
  /** The bins' name: *To send*, or *Awaiting approval* for the stage on both columns. */
  label: string
  /** The papers themselves, by `kind:jobId`, when the pick is narrower than a job (the red line, v2.7371); absent, every row of a picked job is in. */
  papers?: ReadonlySet<string>
  /** What follows *Showing N rows* when the pick is not a bin: *that will not make tomorrow as they stand*. Absent, *in* and the label. */
  words?: string
  /** The jobs in those bins. */
  jobIds: ReadonlySet<string>
  /** The GCs whose notices stand in those bins, for a run row that names a GC and no job. */
  gcIds: ReadonlySet<string>
  /** How many chips the bins hold. */
  count: number
}

/** The pick for one bin, or for a stage on both columns (`bins` as the tile names it). */
export function lienBoardPick(board: Pick<LienBoard, 'notices' | 'affidavits'>, bins: ReadonlyArray<LienBoardBinKey>): LienBoardPick {
  const picked = [...board.notices, ...board.affidavits].filter((b) => bins.includes(b.key))
  const chips = picked.flatMap((b) => b.chips)
  const labels = [...new Set(picked.map((b) => b.label))]
  return {
    bins: picked.map((b) => b.key),
    label: labels.join(' · '),
    jobIds: new Set(chips.map((c) => c.jobId)),
    gcIds: new Set(chips.map((c) => c.gcId).filter((g): g is string => Boolean(g))),
    count: chips.length,
  }
}

/** The day tile's red line as a pick (v2.7371): the papers that will not make their day as they stand, with no bin lit. */
export function lienBoardRiskPick(board: Pick<LienBoard, 'notices' | 'affidavits' | 'dayWords'>): LienBoardPick {
  const chips = [...board.notices, ...board.affidavits].flatMap((b) => b.chips).filter((c) => c.atRisk && open(c))
  const phrase = lienBoardRiskPhrase(board.dayWords, chips.length)
  return {
    bins: [],
    label: phrase,
    jobIds: new Set(chips.map((c) => c.jobId)),
    gcIds: new Set(chips.filter((c) => c.kind === 'notice').map((c) => c.gcId).filter((g): g is string => Boolean(g))),
    count: chips.length,
    papers: new Set(chips.map((c) => `${c.kind}:${c.jobId}`)),
    words: `that ${phrase}`,
  }
}

/** The bins a stage names on both columns, for a tile's press. */
export function lienBoardStageBins(board: Pick<LienBoard, 'notices' | 'affidavits'>, stage: LienBoardNoticeStage | LienBoardAffidavitStage): LienBoardBinKey[] {
  return [...board.notices, ...board.affidavits].filter((b) => b.stage === stage).map((b) => b.key)
}

/** Whether a To do row is in the pick: its job is, or it is a run row for a GC whose notices are, or a run row listing one of the jobs. */
export function lienBoardRowInPick(pick: LienBoardPick, row: { jobId: string | null; gcId: string | null; kind?: string; jobs?: ReadonlyArray<{ jobId: string }> }): boolean {
  // A pick of papers (the red line): the row's own paper, or a run row holding one of the notices.
  if (pick.papers) {
    if (row.jobId) return pick.papers.has(`${row.kind === 'affidavit' ? 'affidavit' : row.kind === 'retainage' ? 'retainage' : 'notice'}:${row.jobId}`)
    if (row.jobs?.some((j) => pick.papers!.has(`notice:${j.jobId}`))) return true
    return Boolean(row.gcId && pick.gcIds.has(row.gcId))
  }
  if (row.jobId) return pick.jobIds.has(row.jobId)
  if (row.jobs?.some((j) => pick.jobIds.has(j.jobId))) return true
  return Boolean(row.gcId && pick.gcIds.has(row.gcId))
}

/** The line under the Board while a bin is pressed: what the list shows, and the press that puts it back. */
export function lienBoardPickWords(pick: LienBoardPick, shown: number): { head: string; clear: string } {
  const noun = shown === 1 ? 'row' : 'rows'
  return { head: pick.words ? `Showing ${shown} ${noun} ${pick.words}.` : `Showing ${shown} ${noun} in ${pick.label}.`, clear: 'Show every row' }
}

/** The chip a job number stands for (v2.7333): the job's chip in that column, or in either, the notice's first. Null when the job is not on the Board. */
export function lienBoardChipFor(board: Pick<LienBoard, 'notices' | 'affidavits'>, jobId: string, kind: LienBoardKind | 'either'): LienBoardChip | null {
  const columns = kind === 'notice' ? [board.notices] : kind === 'affidavit' ? [board.affidavits] : [board.notices, board.affidavits]
  for (const bins of columns) {
    for (const b of bins) {
      const chip = b.chips.find((c) => c.jobId === jobId)
      if (chip) return chip
    }
  }
  return null
}

/**
 * The bin a To do row's paper stands in, by the bin's own name (v2.7372, punch list #362 step 3): the row starts with
 * it, so the list and the Board use one set of words. A row is its job's notice or affidavit, or a run row, which
 * stands in the notices' mail bin. A reminder, a served copy, a returned envelope and a retainage row have no bin.
 */
export function lienBoardRowStage(board: Pick<LienBoard, 'notices' | 'affidavits'>, row: { key: string; kind: string; jobId: string | null; jobs?: ReadonlyArray<{ jobId: string }> }): string | null {
  if (row.key.startsWith('run:')) return board.notices.find((b) => b.stage === 'in_mail')?.label ?? null
  if (!row.jobId || (row.kind !== 'notice' && row.kind !== 'affidavit') || row.key !== `${row.kind}:${row.jobId}`) return null
  const chip = lienBoardChipFor(board, row.jobId, row.kind)
  if (!chip) return null
  return [...board.notices, ...board.affidavits].find((b) => b.key === chip.bin)?.label ?? null
}

/** The hover's words on a chip or a job number: where its press goes. */
export function lienBoardDoorWords(d: LienBoardDestination): string {
  switch (d.kind) {
    case 'property':
      return d.focus === 'owner' ? 'Open the property record at the owner' : d.focus === 'legal' ? 'Open the property record at the legal description' : 'Open the property record at the homestead question'
    case 'paper':
      return d.tab === 'notices' ? 'Open the notice' : 'Open the affidavit'
    case 'run':
      return 'Open the run on this envelope'
    case 'lienWindow':
      return 'Open the job’s Lien window'
  }
}
