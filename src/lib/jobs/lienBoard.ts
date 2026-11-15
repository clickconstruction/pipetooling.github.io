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
 * Two names wait on sibling PRs (2026-11-15): *To send* for the To draft pile (PR 8186 renames it) and
 * *In the mail* for the approved and printed notices (the run-checklist session renames Printed to
 * *In the run*). `LIEN_BOARD_WORDS` holds both, so the swap is one line when they land.
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
}

export type LienBoardTileDestination = { kind: 'bin'; bin: LienBoardBinKey } | { kind: 'run' } | { kind: 'paper'; tab: 'notices' }

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
}

/** The bins' words. The two that wait on sibling PRs are named at the top of the file. */
export const LIEN_BOARD_WORDS = {
  needs_owner: 'Needs the owner',
  needs_property: 'Needs the property facts',
  to_send: 'To send',
  awaiting: 'Awaiting approval',
  in_mail: 'In the mail',
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

/** The stages still to pass before a notice is in the mail with its number on record. */
const NOTICE_STEPS_LEFT: Record<LienBoardNoticeStage, number> = { needs_owner: 4, to_send: 3, awaiting: 2, in_mail: 1, sent: 0, held: 2, missed: 0 }
/** The stages still to pass before an affidavit is filed. */
const AFFIDAVIT_STEPS_LEFT: Record<LienBoardAffidavitStage, number> = { needs_property: 4, to_send: 3, awaiting: 2, ready: 1, filed: 0, held: 2, missed: 0 }

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
  const notices: LienBoardChip[] = input.notices.map((e) => {
    const stage = noticeStage(e.pile)
    const stepsLeft = NOTICE_STEPS_LEFT[stage]
    const dueYmd = e.earliestDeadline
    const daysLeft = dueYmd ? e.daysLeft : null
    return {
      jobId: e.jobId,
      label: input.jobNumber(e.jobId),
      kind: 'notice',
      stage,
      bin: `notice:${stage}`,
      dueYmd,
      daysLeft,
      stepsLeft,
      urgency: stage === 'sent' ? 'later' : lienBoardUrgency(daysLeft, stage === 'awaiting'),
      atRisk: lienBoardAtRisk(stepsLeft, input.todayYmd, dueYmd),
      destination: noticeDestination(e, stage),
      tip: tipFor(e.jobId, e.gcCustomerId, e.openBalance),
      pairKey: pairKeyByJob.get(e.jobId) ?? null,
      openBalance: e.openBalance,
      pile: e.pile,
    }
  })
  const affidavits: LienBoardChip[] = input.affidavits.map((e) => {
    const stage = affidavitStage(e.pile)
    const stepsLeft = AFFIDAVIT_STEPS_LEFT[stage]
    const dueYmd = e.deadline || null
    const daysLeft = dueYmd ? e.daysLeft : null
    return {
      jobId: e.jobId,
      label: input.jobNumber(e.jobId),
      kind: 'affidavit',
      stage,
      bin: `affidavit:${stage}`,
      dueYmd,
      daysLeft,
      stepsLeft,
      urgency: stage === 'filed' ? 'later' : lienBoardUrgency(daysLeft, stage === 'awaiting'),
      atRisk: lienBoardAtRisk(stepsLeft, input.todayYmd, dueYmd),
      destination: affidavitDestination(e, stage),
      tip: tipFor(e.jobId, e.gcCustomerId, e.openBalance),
      pairKey: stage === 'needs_property' ? pairKeyByJob.get(e.jobId) ?? null : null,
      openBalance: e.openBalance,
      pile: e.pile,
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
  const dayLine = atRisk > 0 && dayWords ? `${atRisk} will not make ${dayWords} as ${atRisk === 1 ? 'it stands' : 'they stand'}.` : late > 0 ? `${late} ${plural(late, 'is', 'are')} past ${plural(late, 'its', 'their')} day.` : null
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
      },
      {
        key: 'waiting',
        figure: String(waiting.length),
        label: `waiting on ${leader}`,
        line: waiting.length === 0 ? `Nothing waits on ${leader}.` : null,
        tone: waiting.length > 0 ? 'violet' : 'quiet',
        destination: waiting.length > 0 ? { kind: 'bin', bin: 'notice:awaiting' } : null,
      },
      {
        key: 'in_mail',
        figure: String(printed + ready),
        label: LIEN_BOARD_WORDS.in_mail.toLowerCase(),
        line: printed > 0 ? `Type the tracking ${plural(printed, 'number', 'numbers')}.` : ready > 0 ? `Print the run.` : 'Nothing is in the mail.',
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

export type LienBoardLeaderView = {
  /** His two bins: the notices and the affidavits awaiting his approval. */
  bins: LienBoardBin[]
  /** The one press for the lot, in the run's shape: *Approve 5 papers*, dead when nothing waits. */
  press: BatchWords
  /** The chips the press acts on, by due day. */
  chips: LienBoardChip[]
}

/**
 * The leader's Board: only the bins that wait on him, and one counted press for the lot. A paper
 * past its window is held out of the press with its reason, since approving it sends nothing on time.
 */
export function lienBoardForLeader(board: Pick<LienBoard, 'notices' | 'affidavits'>): LienBoardLeaderView {
  const bins = [...board.notices, ...board.affidavits].filter((b) => b.stage === 'awaiting')
  const chips = bins.flatMap((b) => b.chips).sort(compareLienBoardChips)
  const late = chips.filter((c) => c.daysLeft != null && c.daysLeft < 0).length
  const press = batchWords({ verb: 'Approve', ready: chips.length - late, held: late, heldWhy: { one: 'is past its day', many: 'are past their day' }, noun: 'paper' })
  return { bins, press, chips }
}
