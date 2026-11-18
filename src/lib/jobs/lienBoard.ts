/**
 * The Lien desk's Board (the owner's ask of 2026-11-15): the whole month as one picture. Two
 * columns of bins, one per stage — the monthly notices on the left, the lien affidavits on the
 * right — every job in its bin as a small chip coloured by how soon its day is, thin arrows down
 * each column and one from Sent across to Waiting on its notice (the notice on record is the
 * affidavit's gate; the bin is its own since v2.7457, and Needs the property facts holds a missing fact alone), four tiles over the columns, a closed end at
 * each column's foot only while a job is in it (`lienClosedEnd.ts`), and retainage as one line under the notices.
 *
 * Pure. It folds the queues the desk already builds (`buildLienDeskQueue`, `buildLienAffidavitQueue`,
 * `buildLienRetainageQueue`) and reads nothing itself. Nothing here writes, and nothing here opens
 * a window: a chip only names the desk's door for its stage (`destination`), and the component
 * walks through it. Every line a person reads keeps to `plainWords.ts`; the `·` in a tile's label,
 * and in a tile's line of counts (*1 to approve · 7 to sign*), is the desk's own mark, as on every
 * pile chip, never glue inside a sentence.
 *
 * The bins take the list's own names (v2.7434, Taunya's ask; v2.7448, the owner's pick of two bins): *To send for
 * Master approval* for the `to_draft` pile, *Approved · to print* for the `ready` pile and *Approved · to mail* for the
 * `printed` one. From v2.7328 until v2.7448 one bin held both and an unprinted notice read *to mail* on the Board and
 * *to print* on the list. `LIEN_BOARD_WORDS` holds every name.
 *
 * Signing has a bin of its own (v2.7712, punch list #383, PR 2): *Approved · to sign*, between *Awaiting Master
 * approval* and *Approved · to print*. An approved notice the leader has not signed stood in *Approved · to print*,
 * so that bin read 8 while its press read 1 and nothing on screen said why. Now the print bin holds exactly what the
 * print takes, and the third tile counts the same papers. A notice to sign has two stages left where it had one.
 *
 * No bin is lit as the busiest since v2.7714 (PR 3): the blue border said *most papers*, not *most urgent*, beside
 * blue presses that mean *act here*. The component draws a blue edge on a bin whose own press is live instead.
 *
 * A held paper stands in the bin of the stage it is stopped at (v2.7783, the owner's pick of 2026-11-18: *B would make
 * things more uniform and show the user what stage it is being blocked at*). Until then **Held** was a bin of its own
 * on a column's heading line, and under *Ready to file* a line repeated its count, *1 held on a property fact*. Now an
 * approved affidavit a fact holds stands in *Ready to file*, and a paper the leader held stands in *Awaiting Master
 * approval*, each with `held` so the component draws a hold mark on it. Its colour is still its day's. A bin's count
 * is what can move (`lienBoardBinCount`), so the count and the bin's press stay one number. No bin is named Held; the
 * pile keeps the name on By paper.
 *
 * The same rule for the affidavits' *To send for Master approval* (v2.7852, found on the live look at punch list #383: the
 * bin read 5 beside *Send 1 for approval*). The batch send takes the papers someone has read. One nobody has opened
 * stands in the bin after them with `unread`, a dashed edge and a ○ mark, and the count leaves it out.
 */
import { batchWords, countedLabel, type BatchWords } from '../batchWords'
import { daysBetweenYmd, formatYmdMonthDay } from './billedExpectedPay'
import { formatUsdNoCents } from './jobFormatting'
import type { LienDeskEntry, LienDeskPile } from './lienDesk'
import { LIEN_CLOSED_BIN_WORDS, lienLateNoticeStillCounts, lienNoticeWindowClosed } from './lienClosedEnd'
import { lienAffidavitSendReady } from './lienAffidavitSendReady'
import { LIEN_AFFIDAVIT_NEEDS_NOTICE_LABEL, lienAffidavitGateHeld, type LienAffidavitEntry, type LienAffidavitGateKey, type LienAffidavitPile } from './lienDeskAffidavits'
import type { LienRetainageEntry } from './lienDeskRetainage'
import { lienItemUnsigned } from './lienNoticeSignature'

/** The two kinds of paper the Board draws; retainage is a line, not a column. */
export type LienBoardKind = 'notice' | 'affidavit'

/** A notice's stage: the column's bins in flow order, then *held* (a paper stopped in the bin it would move from, v2.7783) and *missed*, the closed end at the column's foot. */
export type LienBoardNoticeStage = 'needs_owner' | 'to_send' | 'awaiting' | 'to_sign' | 'to_print' | 'in_mail' | 'sent' | 'held' | 'missed'
/** An affidavit's stage: the column's bins in flow order, then *held* and *missed*, as the notices'. */
export type LienBoardAffidavitStage = 'needs_property' | 'needs_notice' | 'to_send' | 'awaiting' | 'ready' | 'filed' | 'served' | 'held' | 'missed'

/** A bin's key. No bin is named for *held* since v2.7783: a held paper stands in the bin of the stage it is stopped at. */
export type LienBoardBinKey = `notice:${Exclude<LienBoardNoticeStage, 'held'>}` | `affidavit:${Exclude<LienBoardAffidavitStage, 'held'>}`

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
  /** A held affidavit whose gate closed after its approval (punch list #335), not one the leader held: what is left is the gate, then the filing. */
  gateHeld?: true
  /** Held where it stands (v2.7783): its `stage` is *held* and its `bin` is the stage it is stopped at. The component draws a hold mark, and the bin's count leaves it out. */
  held?: true
  /** In the affidavits' *To send for Master approval* with no row a person made (v2.7852, `lienAffidavitSendReady`): the batch send leaves it, so it stands after the papers the press takes, with a ○ mark, and the bin's count leaves it out. */
  unread?: true
  /** An approved notice the leader has not signed as it stands (v2.7448, `lienItemUnsigned`): the run holds it, so it waits on him too. */
  unsigned?: boolean
  /** A closed month a late notice can still save, since the job's lien day is ahead: the one chip at a closed end with something left to send. */
  lateNotice?: true
}

export type LienBoardBin = {
  key: LienBoardBinKey
  kind: LienBoardKind
  stage: LienBoardNoticeStage | LienBoardAffidavitStage
  label: string
  chips: LienBoardChip[]
  /** The column's closed end, at its foot and apart from the flow: a window closed and nothing can be rushed. Drawn only while a job is in it. */
  closed: boolean
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

/** `leader` (v2.7448): every paper that waits on the leader, to approve or to sign, as the second tile counts them. */
export type LienBoardTileDestination = { kind: 'leader' } | { kind: 'run' } | { kind: 'risk' }

/** A job in both columns for one reason, cleared by one door: no owner of record, or (v2.7457) an affidavit that waits on its notice alone, beside that notice. */
export type LienBoardPair = { key: string; jobId: string; reason: 'owner' | 'notice'; destination: LienBoardDestination }

/** One of the four dots on the Dashboard's Needs you card. */
export type LienBoardDot = { key: LienBoardTileKey; figure: string; words: string; tone: LienBoardTile['tone'] }

export type LienBoard = {
  notices: LienBoardBin[]
  affidavits: LienBoardBin[]
  arrows: LienBoardArrow[]
  tiles: LienBoardTile[]
  pairs: LienBoardPair[]
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
  /** How many open jobs under a GC show retainage held with none recorded (`retainageSuggested.ts`); absent reads 0. */
  retainageUnrecorded?: number
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
  /**
   * Every filed affidavit whose copies are not yet mailed (punch list #366), with its serve-by day: its job stands in
   * *Filed · copies to mail*, and a filed affidavit that is not here stands in *Served*. A job listed here with no
   * affidavit on the desk (filed long ago, or outside the app) still gets a chip, so the bin, the list and the window
   * that mails the copies count the same liens. Absent reads as none.
   */
  serve?: ReadonlyArray<{ jobId: string; serveDue: string | null }>
}

/** The bins' words. The two that wait on sibling PRs are named at the top of the file. */
export const LIEN_BOARD_WORDS = {
  needs_owner: 'Needs the owner',
  needs_property: 'Needs the property facts',
  needs_notice: LIEN_AFFIDAVIT_NEEDS_NOTICE_LABEL,
  to_send: 'To send for Master approval',
  awaiting: 'Awaiting Master approval',
  /** Approved on the leader's word and not yet signed: the run holds it until he signs. Its own bin since v2.7712. */
  to_sign: 'Approved · to sign',
  to_print: 'Approved · to print',
  in_mail: 'Approved · to mail',
  sent: 'Sent',
  ready: 'Ready to file',
  /** Filed with the county, its copies not yet mailed (punch list #366): the five days of § 53.055 are running. Until v2.7497 this bin and the next were one, *Filed · Served*. */
  filed: 'Filed · copies to mail',
  served: 'Served',
  held: 'Held',
} as const

/** A bin's name: its stage's, and for the closed end the words for what closed in that column. */
export function lienBoardStageWords(kind: LienBoardKind, stage: LienBoardNoticeStage | LienBoardAffidavitStage): string {
  return stage === 'missed' ? LIEN_CLOSED_BIN_WORDS[kind] : LIEN_BOARD_WORDS[stage]
}

/** The bins each column builds, in order. *held* is a stage and no bin (v2.7783). */
export const LIEN_BOARD_NOTICE_STAGES: ReadonlyArray<Exclude<LienBoardNoticeStage, 'held'>> = ['needs_owner', 'to_send', 'awaiting', 'to_sign', 'to_print', 'in_mail', 'sent', 'missed']
export const LIEN_BOARD_AFFIDAVIT_STAGES: ReadonlyArray<Exclude<LienBoardAffidavitStage, 'held'>> = ['needs_property', 'needs_notice', 'to_send', 'awaiting', 'ready', 'filed', 'served', 'missed']

/**
 * The bin a held paper stands in: the stage it is stopped at. An approved affidavit a fact holds is stopped short of
 * the print, so it stands in *Ready to file*. A paper the leader held, a notice or an affidavit, waits on him again,
 * so it stands in *Awaiting Master approval*.
 */
export function lienBoardHeldBin(kind: LienBoardKind, gateHeld: boolean): LienBoardBinKey {
  return kind === 'notice' ? 'notice:awaiting' : gateHeld ? 'affidavit:ready' : 'affidavit:awaiting'
}

/** What a bin's count says (v2.7783): the papers in it that can move. A held one stands in the bin with its mark and is not counted, and neither is an affidavit nobody has read (v2.7852), so the count is the number the bin's press takes. */
export function lienBoardBinCount(bin: Pick<LienBoardBin, 'chips'>): number {
  return bin.chips.filter((c) => !c.held && !c.unread).length
}

/** Where a chip stands in its bin: what can move first, then what waits to be read, then what is held. */
function lienBoardChipRank(c: Pick<LienBoardChip, 'held' | 'unread'>): number {
  return c.held ? 2 : c.unread ? 1 : 0
}

/** The flow's stages, in order; the closed end stands at the foot. */
const NOTICE_FLOW: ReadonlyArray<Exclude<LienBoardNoticeStage, 'held'>> = ['needs_owner', 'to_send', 'awaiting', 'to_sign', 'to_print', 'in_mail', 'sent']
const AFFIDAVIT_FLOW: ReadonlyArray<Exclude<LienBoardAffidavitStage, 'held'>> = ['needs_property', 'needs_notice', 'to_send', 'awaiting', 'ready', 'filed', 'served']

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
const NOTICE_TAIL = ['Send it for approval', '{leader} approves and signs it', 'Print it, mail it and enter its mail number'] as const
/** The one stage an approved notice has before it can print: the leader's signature on it. */
export const LIEN_BOARD_SIGN_STEP = '{leader} signs it'
/** The stages still to pass before a notice is mailed with its number on record. */
const NOTICE_STAGES_LEFT: Record<LienBoardNoticeStage, ReadonlyArray<string>> = {
  needs_owner: ['Name the owner on the property record', ...NOTICE_TAIL],
  to_send: NOTICE_TAIL,
  awaiting: NOTICE_TAIL.slice(1),
  // Approved on his word, so the approval stands: what is left is his signature, then the print and the mail.
  to_sign: [LIEN_BOARD_SIGN_STEP, NOTICE_TAIL[2]],
  to_print: NOTICE_TAIL.slice(2),
  // One stage either way: the print and the mail are one sitting, so the day a paper races is the same.
  in_mail: ['Mail it and enter its mail number'],
  sent: [],
  held: NOTICE_TAIL.slice(1),
  missed: [],
}
const AFFIDAVIT_TAIL = ['Send it for approval', '{leader} approves it', 'Notarize it and file it with the county'] as const
/** The one stage a filed affidavit has left (punch list #366). */
export const LIEN_BOARD_SERVE_STEP = 'Mail its copies and enter their mail numbers'
/** The stages still to pass before an affidavit is filed. */
const AFFIDAVIT_STAGES_LEFT: Record<LienBoardAffidavitStage, ReadonlyArray<string>> = {
  needs_property: ['Clear what holds it', ...AFFIDAVIT_TAIL],
  // Its first stage is the notice's last (`NOTICE_TAIL`), named as the affidavit's reader meets it.
  needs_notice: ['Mail its notice and record the mailing', ...AFFIDAVIT_TAIL],
  to_send: AFFIDAVIT_TAIL,
  awaiting: AFFIDAVIT_TAIL.slice(1),
  ready: AFFIDAVIT_TAIL.slice(2),
  // On file: what is left is the copy to the owner, and to the original contractor on a job that has one.
  filed: [LIEN_BOARD_SERVE_STEP],
  served: [],
  held: AFFIDAVIT_TAIL.slice(1),
  missed: [],
}

/** An approved affidavit a gate closed on (punch list #335): the approval stands, so what is left is the gate and the filing. Two stages, as a leader's hold has. */
const AFFIDAVIT_GATE_HELD_LEFT: ReadonlyArray<string> = ['Clear what holds it', AFFIDAVIT_TAIL[2]]

/** The stages a chip's paper still has to pass, in order and by name; `leader` absent reads *The leader*. Empty once it is sent, filed or missed. */
export function lienBoardStagesLeft(chip: Pick<LienBoardChip, 'kind' | 'stage'> & Partial<Pick<LienBoardChip, 'gateHeld'>>, leader?: string | null): string[] {
  const list = chip.kind === 'notice' ? NOTICE_STAGES_LEFT[chip.stage as LienBoardNoticeStage] : chip.gateHeld ? AFFIDAVIT_GATE_HELD_LEFT : AFFIDAVIT_STAGES_LEFT[chip.stage as LienBoardAffidavitStage]
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
      return 'to_print'
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

/** The bin a notice stands in: its pile's, and *Approved · to sign* for an approved one the leader has not signed. */
function noticeStageOf(e: Pick<LienDeskEntry, 'pile' | 'item'>): LienBoardNoticeStage {
  return e.pile === 'ready' && lienItemUnsigned(e.item) ? 'to_sign' : noticeStage(e.pile)
}

function affidavitStage(pile: LienAffidavitPile): LienBoardAffidavitStage {
  switch (pile) {
    case 'needs_property':
      return 'needs_property'
    case 'needs_notice':
      return 'needs_notice'
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

/**
 * A pile's name as the Board says it, for a reader that holds a desk entry and no Board: the property card
 * (`lienPropertyPapers.ts`, v2.7485) names each job's notice and affidavit in the words of the bin they stand in.
 */
export function lienBoardPileWords(kind: 'notice', pile: LienDeskPile): string
export function lienBoardPileWords(kind: 'affidavit', pile: LienAffidavitPile): string
export function lienBoardPileWords(kind: LienBoardKind, pile: LienDeskPile | LienAffidavitPile): string {
  return lienBoardStageWords(kind, kind === 'notice' ? noticeStage(pile as LienDeskPile) : affidavitStage(pile as LienAffidavitPile))
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
    case 'to_print':
    case 'in_mail':
      return e.item ? { kind: 'run', itemId: e.item.id, jobId: e.jobId } : { kind: 'paper', tab: 'notices', jobId: e.jobId }
    default:
      return { kind: 'paper', tab: 'notices', jobId: e.jobId }
  }
}

function affidavitDestination(e: LienAffidavitEntry, stage: LienBoardAffidavitStage, notice?: LienDeskEntry | null): LienBoardDestination {
  // A paper a gate holds after its approval (punch list #335) opens where the gate is answered, as one not yet sent does.
  switch (lienAffidavitGateHeld(e) ? 'needs_property' : stage) {
    case 'needs_property':
    case 'needs_notice': {
      const failing = e.gates.filter((g) => !g.ok).map((g) => g.key)
      // The notice as the one gate left: the door is the notice, as the To do row's is (v2.4708). A notice already
      // approved stands in the run, so the door is its envelope there, as its own chip's is.
      if (failing.length === 1 && failing[0] === 'notice') {
        const door = notice ? noticeDestination(notice, noticeStageOf(notice)) : null
        if (door?.kind === 'run') return door
        return { kind: 'paper', tab: 'notices', jobId: e.jobId }
      }
      const focus = propertyFocus(e.gates)
      return focus ? { kind: 'property', jobId: e.jobId, focus } : { kind: 'paper', tab: 'affidavits', jobId: e.jobId }
    }
    case 'filed':
    case 'served':
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

/** The arrows: down each column between the flow's bins, and one across from Sent to Waiting on its notice, the bin a recorded mailing empties. */
export function lienBoardArrows(): LienBoardArrow[] {
  const arrows: LienBoardArrow[] = []
  for (let i = 1; i < NOTICE_FLOW.length; i += 1) arrows.push({ from: `notice:${NOTICE_FLOW[i - 1]!}`, to: `notice:${NOTICE_FLOW[i]!}`, kind: 'down' })
  for (let i = 1; i < AFFIDAVIT_FLOW.length; i += 1) arrows.push({ from: `affidavit:${AFFIDAVIT_FLOW[i - 1]!}`, to: `affidavit:${AFFIDAVIT_FLOW[i]!}`, kind: 'down' })
  arrows.push({ from: 'notice:sent', to: 'affidavit:needs_notice', kind: 'cross' })
  return arrows
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/** The retainage line under the notices: each pile with a job in it, in flow order; null when its desk is empty. */
export function lienBoardRetainageLine(retainage: ReadonlyArray<LienRetainageEntry>, unrecorded = 0): string | null {
  const live = retainage.filter((e) => e.pile !== 'sent' && e.pile !== 'clock_not_started')
  if (live.length === 0 && unrecorded <= 0) return null
  const count = (pile: LienRetainageEntry['pile']) => live.filter((e) => e.pile === pile).length
  const parts = [
    [count('needs_owner'), 'needs the owner', 'need the owner'],
    [count('to_draft'), 'to send for approval', 'to send for approval'],
    [count('awaiting'), 'awaiting approval', 'awaiting approval'],
    [count('ready'), 'approved to mail', 'approved to mail'],
    [count('held'), 'held', 'held'],
    [count('missed'), 'missed', 'missed'],
    // Retainage the bills or notes show and nobody recorded (fix A of the retainage clock check, PR 2): no clock runs on these yet.
    [Math.max(0, unrecorded), 'looks held, not on the job', 'look held, not on the job'],
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
  // An affidavit that waits on its notice alone stands beside that notice (v2.7457): point at one chip and both light,
  // so the reader sees where the notice is. The one door is the notice's own.
  const affidavitNeedsNotice = new Set(input.affidavits.filter((a) => a.pile === 'needs_notice').map((a) => a.jobId))
  for (const e of input.notices) {
    if (!affidavitNeedsNotice.has(e.jobId) || pairKeyByJob.has(e.jobId)) continue
    const key = `notice:${e.jobId}`
    pairKeyByJob.set(e.jobId, key)
    pairs.push({ key, jobId: e.jobId, reason: 'notice', destination: noticeDestination(e, noticeStageOf(e)) })
  }
  // A job on a property that reads as public and has no answer yet (v2.7443): no paper can be made there, so its chip
  // loses its red day and its *!*, and carries the mark instead.
  const publicJob = (jobId: string) => Boolean(input.publicJobIds?.has(jobId))
  // A job whose every month closed stands at the closed end until someone records the months (`lienNoticeWindowClosed`).
  // Recorded, it has its answer and no chip: By paper's Missed lens still lists it.
  const notices: LienBoardChip[] = input.notices.filter((e) => e.pile !== 'missed' || lienNoticeWindowClosed(e)).map((e) => {
    const stage = noticeStageOf(e)
    const stepsLeft = NOTICE_STAGES_LEFT[stage].length
    const dueYmd = e.earliestDeadline
    const daysLeft = dueYmd ? e.daysLeft : null
    const marked = publicJob(e.jobId)
    return {
      jobId: e.jobId,
      label: input.jobNumber(e.jobId),
      kind: 'notice',
      stage,
      bin: stage === 'held' ? lienBoardHeldBin('notice', false) : `notice:${stage}`,
      ...(stage === 'held' ? { held: true as const } : {}),
      dueYmd,
      daysLeft,
      stepsLeft,
      // A closed end is quiet: nothing there can be rushed.
      urgency: stage === 'sent' || stage === 'missed' || marked ? 'later' : lienBoardUrgency(daysLeft, stage === 'awaiting' || stage === 'to_sign'),
      atRisk: !marked && lienBoardAtRisk(stepsLeft, input.todayYmd, dueYmd),
      ...(marked ? { publicMark: true } : {}),
      ...(e.pile === 'ready' && lienItemUnsigned(e.item) ? { unsigned: true } : {}),
      ...(stage === 'missed' && lienLateNoticeStillCounts(e) ? { lateNotice: true as const } : {}),
      destination: noticeDestination(e, stage),
      tip: tipFor(e.jobId, e.gcCustomerId, e.openBalance),
      pairKey: pairKeyByJob.get(e.jobId) ?? null,
      openBalance: e.openBalance,
      pile: e.pile,
      gcId: e.gcCustomerId,
    }
  })
  // A filed affidavit's copies (punch list #366): the serve-by day of each one still to mail, by job.
  const serveDueByJob = new Map<string, string | null>((input.serve ?? []).map((x) => [x.jobId, x.serveDue]))
  const serveDay = (jobId: string): { dueYmd: string | null; daysLeft: number | null } => {
    const dueYmd = (serveDueByJob.get(jobId) ?? '') || null
    return { dueYmd, daysLeft: dueYmd ? daysBetweenYmd(input.todayYmd, dueYmd) : null }
  }
  const noticeByJob = new Map(input.notices.map((e) => [e.jobId, e] as const))
  const affidavits: LienBoardChip[] = input.affidavits.map((e) => {
    const onFile = affidavitStage(e.pile) === 'filed'
    // On file and its copies mailed, or on file with the copies still owed: two bins since v2.7497.
    const stage: LienBoardAffidavitStage = onFile && !serveDueByJob.has(e.jobId) ? 'served' : affidavitStage(e.pile)
    const gateHeld = lienAffidavitGateHeld(e)
    const stepsLeft = (gateHeld ? AFFIDAVIT_GATE_HELD_LEFT : AFFIDAVIT_STAGES_LEFT[stage]).length
    // A filed affidavit races its serve-by day, not the day it had to be filed by.
    const dueYmd = stage === 'filed' ? serveDay(e.jobId).dueYmd : e.deadline || null
    const daysLeft = stage === 'filed' ? serveDay(e.jobId).daysLeft : dueYmd ? e.daysLeft : null
    const marked = publicJob(e.jobId)
    return {
      jobId: e.jobId,
      label: input.jobNumber(e.jobId),
      kind: 'affidavit',
      stage,
      bin: stage === 'held' ? lienBoardHeldBin('affidavit', gateHeld) : `affidavit:${stage}`,
      ...(stage === 'held' ? { held: true as const } : {}),
      ...(stage === 'to_send' && !lienAffidavitSendReady(e) ? { unread: true as const } : {}),
      dueYmd,
      daysLeft,
      stepsLeft,
      urgency: stage === 'served' || stage === 'missed' || marked ? 'later' : lienBoardUrgency(daysLeft, stage === 'awaiting'),
      // The tiles count papers still to send or file; a filed one is in neither, so it is never *at risk* there.
      atRisk: stage !== 'filed' && stage !== 'served' && !marked && lienBoardAtRisk(stepsLeft, input.todayYmd, dueYmd),
      ...(marked ? { publicMark: true } : {}),
      ...(gateHeld ? { gateHeld: true as const } : {}),
      destination: affidavitDestination(e, stage, noticeByJob.get(e.jobId)),
      tip: tipFor(e.jobId, e.gcCustomerId, e.openBalance),
      pairKey: stage === 'needs_property' || stage === 'needs_notice' ? pairKeyByJob.get(e.jobId) ?? null : null,
      openBalance: e.openBalance,
      pile: e.pile,
      gcId: e.gcCustomerId,
    }
  })
  // A filed lien that owes its copies and has no affidavit on the desk: a chip of its own, so no lien is left off the bin.
  const onBoard = new Set(affidavits.filter((c) => c.stage === 'filed').map((c) => c.jobId))
  for (const jobId of serveDueByJob.keys()) {
    if (onBoard.has(jobId)) continue
    const { dueYmd, daysLeft } = serveDay(jobId)
    affidavits.push({
      jobId,
      label: input.jobNumber(jobId),
      kind: 'affidavit',
      stage: 'filed',
      bin: 'affidavit:filed',
      dueYmd,
      daysLeft,
      stepsLeft: AFFIDAVIT_STAGES_LEFT.filed.length,
      urgency: lienBoardUrgency(daysLeft, false),
      atRisk: false,
      destination: { kind: 'lienWindow', jobId },
      tip: tipFor(jobId, null, 0),
      pairKey: null,
      openBalance: 0,
      pile: 'filed',
      gcId: null,
    })
  }
  return { notices, affidavits, pairs }
}

function binsFor<S extends Exclude<LienBoardNoticeStage | LienBoardAffidavitStage, 'held'>>(kind: LienBoardKind, stages: ReadonlyArray<S>, chips: ReadonlyArray<LienBoardChip>): LienBoardBin[] {
  return stages.map((stage) => {
    const key = `${kind}:${stage}` as LienBoardBinKey
    return {
      key,
      kind,
      stage,
      label: lienBoardStageWords(kind, stage),
      // What can move first, by day, then what waits to be read, then what is held here, each by day.
      chips: chips.filter((c) => c.bin === key).sort((a, b) => lienBoardChipRank(a) - lienBoardChipRank(b) || compareLienBoardChips(a, b)),
      closed: stage === 'missed',
    }
  })
}

/** A chip still to send or file: not sent, not filed, not past its window. */
/** *will not make tomorrow as they stand*: the day tile's line after its count, the list's head over the same papers, and what a press on the line narrows the list to. */
export function lienBoardRiskPhrase(dayWords: string | null, n: number): string {
  return `will not make ${dayWords ?? (n === 1 ? 'its day' : 'their day')} as ${n === 1 ? 'it stands' : 'they stand'}`
}

function open(c: LienBoardChip): boolean {
  return c.stage !== 'sent' && c.stage !== 'filed' && c.stage !== 'served' && c.stage !== 'missed'
}

/** The third tile's words under its figure (v2.7448): what the two bins under it wait for, as the press that opens them says it. */
export const LIEN_RUN_TILE_LABEL = 'to print and mail'

/** What waits on the leader, in its two parts (v2.7448): papers to approve, and approved notices to sign. */
export type LienLeaderWaits = { toApprove: number; toSign: number; total: number }

/** The leader's two parts off the Board's chips: every paper awaiting approval, and every approved notice not yet signed. */
export function lienBoardLeaderWaits(notices: ReadonlyArray<Pick<LienBoardChip, 'stage' | 'unsigned'>>, affidavits: ReadonlyArray<Pick<LienBoardChip, 'stage'>>): LienLeaderWaits {
  const toApprove = [...notices, ...affidavits].filter((c) => c.stage === 'awaiting').length
  const toSign = notices.filter((c) => c.unsigned).length
  return { toApprove, toSign, total: toApprove + toSign }
}

/** *1 to approve · 7 to sign*: the parts that hold something, in the order the leader meets them. '' with nothing waiting. */
export function lienLeaderWaitWords(w: Pick<LienLeaderWaits, 'toApprove' | 'toSign'>): string {
  return [w.toApprove > 0 ? `${w.toApprove} to approve` : '', w.toSign > 0 ? `${w.toSign} to sign` : ''].filter(Boolean).join(' · ')
}

function tiles(input: LienBoardInput, notices: ReadonlyArray<LienBoardChip>, affidavits: ReadonlyArray<LienBoardChip>): { tiles: LienBoardTile[]; dayWords: string | null; atRisk: number } {
  // A chip on a property that reads as public and is unanswered (v2.7443) has no day to make: no paper can be made there.
  const liveChips = [...notices, ...affidavits].filter(open).filter((c) => !c.publicMark)
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
  const waits = lienBoardLeaderWaits(notices, affidavits)
  const leader = input.leaderName?.trim() || 'the leader'
  const printed = notices.filter((c) => c.pile === 'printed').length
  // The notices that can print: an approved one that waits on a signature is the second tile's, in its own bin.
  const ready = notices.filter((c) => c.stage === 'to_print').length
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
        // One count of what waits on the leader (v2.7448): the papers he has yet to approve and the approved notices he
        // has yet to sign, each part named. The run door's small words say the second part in the same word.
        figure: String(waits.total),
        label: `waiting on ${leader}`,
        line: waits.total === 0 ? `Nothing waits on ${leader}.` : lienLeaderWaitWords(waits),
        tone: waits.total > 0 ? 'violet' : 'quiet',
        destination: waits.total > 0 ? { kind: 'leader' } : null,
      },
      {
        key: 'in_mail',
        figure: String(printed + ready),
        // The tile counts the two bins under it and opens their window, so it reads as the press does (v2.7448): *to print and mail*.
        label: LIEN_RUN_TILE_LABEL,
        line: printed + ready === 0 ? 'Nothing waits to print or mail.' : [ready > 0 ? `${ready} to print` : '', printed > 0 ? `${printed} to mail` : ''].filter(Boolean).join(' · '),
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
  const t = tiles(input, notices, affidavits)
  return {
    notices: noticeBins,
    affidavits: affidavitBins,
    arrows: lienBoardArrows(),
    tiles: t.tiles,
    pairs,
    retainageLine: lienBoardRetainageLine(input.retainage, input.retainageUnrecorded ?? 0),
    dayWords: t.dayWords,
    atRisk: t.atRisk,
    empty: notices.length === 0 && affidavits.length === 0,
  }
}

/** The bins the Board draws: the flow's, and the closed end only while a job is in it. */
export function lienBoardBinsShown(bins: ReadonlyArray<LienBoardBin>): LienBoardBin[] {
  return bins.filter((b) => !b.closed || b.chips.length > 0)
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
  // A paper he held stands in his bin too (v2.7783), with its mark: the batch does not take it, and it is not one of the press's holds.
  const bins = [...board.notices, ...board.affidavits].filter((b) => b.stage === 'awaiting').map((b) => ({ ...b, chips: b.chips.filter((c) => leads(c.jobId) && !c.held) }))
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

/** The leader's press on his *Awaiting Master approval* bin of affidavits: its counted words, and what it leaves where it is. */
export type LienBoardLeaderBinPress = { label: string; dead: boolean; line: string | null }

/**
 * The leader's one press, on the title line of the bin it empties (v2.7708; it stood under his own two bins since
 * v2.7334, behind a switch). It counts the affidavits alone, since the bin holds affidavits alone: a notice that takes
 * his signature stands in the other column and is told there. Null when no affidavit of a job he leads waits.
 */
export function lienBoardLeaderBinPress(view: Pick<LienBoardLeaderView, 'chips' | 'held'>): LienBoardLeaderBinPress | null {
  const ready = view.chips.filter((c) => c.kind === 'affidavit').length
  const late = view.held.filter((h) => h.chip.kind === 'affidavit').length
  if (ready <= 0 && late <= 0) return null
  return { label: countedLabel('Approve', ready, 'affidavit'), dead: ready <= 0, line: late > 0 ? `${late} ${plural(late, 'is', 'are')} past ${plural(late, 'its', 'their')} day and ${plural(late, 'stays', 'stay')} here.` : null }
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

/** A pressed bin, the second tile's papers that wait on the leader (v2.7448), or the day tile's red line: what the list under the Board is narrowed to. */
export type LienBoardPick = {
  bins: LienBoardBinKey[]
  /** The bins' name: *To send for Master approval*, or *Awaiting Master approval* for the stage on both columns. */
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

/** The pick for one bin, or for several bins at once. */
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

/**
 * The second tile as a pick (v2.7448): every paper that waits on the leader, to approve or to sign, with the awaiting
 * bins lit. The list under the Board then shows the rows the tile counted, and a GC's row that holds one of them.
 */
export function lienBoardLeaderPick(board: Pick<LienBoard, 'notices' | 'affidavits'>, leaderName?: string | null): LienBoardPick {
  const chips = [...board.notices, ...board.affidavits].flatMap((b) => b.chips).filter((c) => c.stage === 'awaiting' || c.unsigned)
  const leader = leaderName?.trim() || 'the leader'
  return {
    bins: [...lienBoardStageBins(board, 'awaiting'), ...lienBoardStageBins(board, 'to_sign')],
    label: `waiting on ${leader}`,
    jobIds: new Set(chips.map((c) => c.jobId)),
    // A GC's run row stands for its approved notices, so it is in only when one of them is unsigned. A notice of that
    // GC's awaiting approval has its own row and does not bring the run row with it.
    gcIds: new Set(chips.filter((c) => c.unsigned).map((c) => c.gcId).filter((g): g is string => Boolean(g))),
    count: chips.length,
    papers: new Set(chips.map((c) => `${c.kind}:${c.jobId}`)),
    // No verb to agree with the count: *Showing 1 row waiting on Sam.* and *Showing 8 rows waiting on Sam.*
    words: `waiting on ${leader}`,
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
 * stands in the bin its notices are in. A reminder, a served copy, a returned envelope and a retainage row have no bin.
 */
export function lienBoardRowStage(board: Pick<LienBoard, 'notices' | 'affidavits'>, row: { key: string; kind: string; jobId: string | null; jobs?: ReadonlyArray<{ jobId: string }> }): string | null {
  const bin = lienBoardRowBin(board, row)
  if (!bin) return null
  // A held paper's row says so after the bin's name (v2.7783): the bin alone would read as a paper that can move.
  const held = Boolean(row.jobId && (row.kind === 'notice' || row.kind === 'affidavit') && row.key === `${row.kind}:${row.jobId}` && lienBoardChipFor(board, row.jobId, row.kind)?.held)
  return held ? lienBoardHeldWords(bin.label) : bin.label
}

/** What a held chip says of its hold, for its hover and a screen reader; '' for a chip that is not held. */
export function lienBoardHoldWords(chip: Pick<LienBoardChip, 'held' | 'gateHeld'>): string {
  return chip.held ? (chip.gateHeld ? 'held on a property fact' : 'held by the leader') : ''
}

/** What an unread chip says, for its hover, its card and a screen reader (v2.7852); '' for any other chip. */
export function lienBoardUnreadWords(chip: Pick<LienBoardChip, 'unread'>): string {
  return chip.unread ? 'nobody has read it yet' : ''
}

/** A bin's name as an unread paper's card says it (v2.7852): *To send for Master approval · not read yet*. */
export function lienBoardUnreadBinWords(binLabel: string): string {
  return `${binLabel} · not read yet`
}

/** A bin's name as a held paper's card and row say it (v2.7783): *Ready to file · held*. */
export function lienBoardHeldWords(binLabel: string): string {
  return `${binLabel} · held`
}

/**
 * The bin itself, with its place on the Board (punch list #362, step 4): the list under the Board is grouped by it, in
 * this order, the notices' column first. The same rule as the name above: a row is its job's notice or affidavit, a
 * run row stands in the notices' print or mail bin, and a reminder, a served copy, a returned envelope and a retainage row
 * have none.
 */
export function lienBoardRowBin(board: Pick<LienBoard, 'notices' | 'affidavits'>, row: { key: string; kind: string; jobId: string | null; jobs?: ReadonlyArray<{ jobId: string }> }): { key: LienBoardBinKey; label: string; kind: LienBoardKind; order: number } | null {
  const all = [...board.notices, ...board.affidavits]
  const of = (bin: LienBoardBin | undefined) => (bin ? { key: bin.key, label: bin.label, kind: bin.kind, order: all.indexOf(bin) } : null)
  // A run row for the printed notices stands in *Approved · to mail*; a GC's row of approved ones in *Approved · to print* (v2.7448).
  // A GC's row whose notices all wait on a signature can print none of them, so it stands in *Approved · to sign*; with
  // one that can print, the row is a print and stands with it.
  if (row.key.startsWith('run:')) {
    if (row.key === 'run:printed') return of(board.notices.find((b) => b.stage === 'in_mail'))
    const jobs = new Set((row.jobs ?? []).map((j) => j.jobId))
    const mine = (stage: LienBoardNoticeStage) => (board.notices.find((b) => b.stage === stage)?.chips ?? []).filter((c) => jobs.has(c.jobId)).length
    return of(board.notices.find((b) => b.stage === (jobs.size > 0 && mine('to_print') === 0 && mine('to_sign') > 0 ? 'to_sign' : 'to_print')))
  }
  // A filed lien's copies to mail (punch list #366) stand in their own bin, whether or not the job has an affidavit on the desk.
  if (row.key.startsWith('serve:')) return of(board.affidavits.find((b) => b.stage === 'filed'))
  if (!row.jobId || (row.kind !== 'notice' && row.kind !== 'affidavit') || row.key !== `${row.kind}:${row.jobId}`) return null
  const chip = lienBoardChipFor(board, row.jobId, row.kind)
  if (!chip) return null
  return of(all.find((b) => b.key === chip.bin))
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
