/**
 * GC mode design spike: a trade not ready to start, the Gantt's Phase 4 (G-77; the mock-up and the
 * plan are `to-dos/gc-mode/mockups/G-77.md`). A bar that has not started, on a trade whose papers
 * are not in, is held the way a bar waiting on a submittal is: the chart stripes it and says what it
 * waits on, and the opened activity lists each paper with its next step, so the office can act
 * from the bar.
 *
 * Ready is Get started's five steps (awarded, master agreement, insurance, W-9, statement of work),
 * read the way Get started reads them, with one difference: insurance is read on the day the work
 * starts, not on today. A certificate that runs out before then is a gap once the renewal ask is
 * due (`INSURANCE_ASK_DAYS`); further out, the usual renewal takes care of it.
 *
 * Its own file, out of the barrel: it reads Get started, the papers' next steps and the Gantt's
 * hold shape, and the Schedule tab adds its holds to the chart's.
 */
import type { GcProject, GcState, Partner, TradePackage } from './gcTypes'
import { addDays } from './gcBuilding'
import { scheduleItems } from './gcBuildingSchedule'
import { startChecklist, type StartTradeRow } from './gcStart'
import { paperStep } from './gcPaperSend'
import { INSURANCE_ASK_DAYS, openPromiseFor, tradePromiseWords } from './gcPromises'
import { START_REMINDER_DAYS } from './gcStartReminders'
import { daysUntil, shortDate, weekdayDate } from './gcWords'
import { planLabel } from './gcLookups'
import type { GanttHold } from './gcGantt'

/** A bar starting within this many days with its papers not in is late: the trade's last start reminder has gone (G-114). */
export const NOT_READY_LATE_DAYS: number = START_REMINDER_DAYS[1]

export type StartGapKind = 'award' | 'msa' | 'insurance' | 'w9' | 'sow'

/** One thing a trade still needs before it starts, in the words each place says it. */
export interface StartGap {
  kind: StartGapKind
  /** Get started's column: "Insurance", "Statement of work". */
  label: string
  /** The opened activity's line: "Insurance ran out Tue Sep 15." */
  line: string
  /** On the bar when it is the only gap, after "waits on": "current insurance, theirs ran out Sep 15". */
  barWords: string
  /** On the bar in a list of several: "current insurance". */
  noun: string
  /** The company window's paper: 'msa', 'insurance', 'w9' or 'sow-<package>'. Null: nothing there to send. */
  doc: string | null
}

/**
 * What a trade still needs before it starts work on `on`, in Get started's order. Empty: it is
 * ready. A trade with no company picked needs the award first; nothing else is judged before it,
 * as on Get started.
 */
function gapsOf(state: GcState, project: GcProject, row: StartTradeRow, on: string): StartGap[] {
  const { pkg, partner } = row
  if (pkg.selfPerform) return []
  if (!partner) return [{ kind: 'award', label: 'Award', line: 'Award: no company picked.', barWords: 'an award, no company yet', noun: 'an award', doc: null }]
  const done = (key: string) => row.checks.find((c) => c.key === key)?.done === true
  const gaps: StartGap[] = []
  if (!done('msa')) {
    const sentOn = partner.msa === 'sent' ? (partner.msaSentOn ?? null) : null
    gaps.push({
      kind: 'msa',
      label: 'Master agreement',
      line: partner.msa === 'sent' ? `Master agreement sent${sentOn ? ` ${shortDate(sentOn)}` : ''}, not signed.` : 'Master agreement not sent.',
      barWords: partner.msa === 'sent' ? (sentOn ? `a signed master agreement, sent ${shortDate(sentOn)}` : 'a signed master agreement, not signed yet') : 'a signed master agreement, not sent yet',
      noun: 'a signed master agreement',
      doc: 'msa',
    })
  }
  const insurance = insuranceGap(partner, on, state.today)
  if (insurance) gaps.push(insurance)
  if (!done('w9')) gaps.push({ kind: 'w9', label: 'W-9', line: 'W-9 missing.', barWords: 'a W-9, none on file', noun: 'a W-9', doc: 'w9' })
  if (!done('sow')) gaps.push(sowGap(project, pkg))
  return gaps
}

/** Insurance read on the day the work starts: none on file, run out, or running out before then once the renewal ask is due. */
function insuranceGap(partner: Partner, on: string, today: string): StartGap | null {
  const expires = partner.coiExpires
  const base = { kind: 'insurance' as const, label: 'Insurance', noun: 'current insurance', doc: 'insurance' }
  if (!expires) return { ...base, line: 'Insurance: none on file.', barWords: 'insurance, none on file' }
  if (expires < today) return { ...base, line: `Insurance ran out ${weekdayDate(expires)}.`, barWords: `current insurance, theirs ran out ${shortDate(expires)}` }
  if (expires < on && daysUntil(expires, today) <= INSURANCE_ASK_DAYS) {
    return { ...base, line: `Insurance runs out ${weekdayDate(expires)}, before this starts.`, barWords: `current insurance, theirs runs out ${shortDate(expires)}` }
  }
  return null
}

function sowGap(project: GcProject, pkg: TradePackage): StartGap {
  const sow = pkg.sow
  const base = { kind: 'sow' as const, label: 'Statement of work', noun: 'a signed statement of work', doc: sow ? `sow-${pkg.id}` : null }
  if (!sow) return { ...base, line: 'Statement of work not written.', barWords: 'a signed statement of work, not written yet' }
  if (sow.status === 'draft') return { ...base, line: 'Statement of work drafted, not sent.', barWords: 'a signed statement of work, not sent yet' }
  if (sow.status === 'sent') {
    return sow.sentOn
      ? { ...base, line: `Statement of work sent ${shortDate(sow.sentOn)}, not signed.`, barWords: `a signed statement of work, sent ${shortDate(sow.sentOn)}` }
      : { ...base, line: 'Statement of work sent, not signed.', barWords: 'a signed statement of work, not signed yet' }
  }
  // Signed on plans older than the newest set, which Get started does not count as done.
  return { ...base, noun: 'a new statement of work', line: `Statement of work signed on ${planLabel(project, sow.basedOnRev)}, older than the plans.`, barWords: 'a new statement of work, the plans changed' }
}

/** What a trade still needs before it starts work on `on`, in Get started's order. Empty: it is ready (or it is our own crew). */
export function startGaps(state: GcState, project: GcProject, pkg: TradePackage, on: string): StartGap[] {
  const row = startChecklist(state, project).trades.find((t) => t.pkg.id === pkg.id)
  return row ? gapsOf(state, project, row, on) : []
}

/** A bar that has not started, on a trade not ready for it. */
export interface NotReadyBar {
  lineId: string
  pkg: TradePackage
  partner: Partner | null
  start: string
  gaps: StartGap[]
  /** It starts within NOT_READY_LATE_DAYS, or its day passed with nothing reported. */
  late: boolean
}

/**
 * Every bar on a job being built that has not started, on a trade not ready for it. A bar counts
 * when it is a trade's line (not an inspection, our own crew's stage or an added activity) with no
 * real start recorded and nothing reported. A trade already on site still counts for its bars that
 * have not started. While buying out nothing counts: the whole job is not ready, and Get started is
 * the place for that.
 */
export function notReadyBars(state: GcState, project: GcProject): NotReadyBar[] {
  if (project.stage !== 'building' || !project.schedule) return []
  const rows = new Map(startChecklist(state, project).trades.map((t) => [t.pkg.id, t]))
  const lateBy = addDays(state.today, NOT_READY_LATE_DAYS)
  return scheduleItems(state, project).flatMap((item) => {
    const a = item.activity
    const row = item.pkg ? rows.get(item.pkg.id) : undefined
    if (!item.pkg || !row || item.pkg.selfPerform || a.inspection || a.added) return []
    if (item.actual > 0 || a.actualStart) return []
    const gaps = gapsOf(state, project, row, a.start)
    return gaps.length === 0 ? [] : [{ lineId: a.lineId, pkg: item.pkg, partner: row.partner, start: a.start, gaps, late: a.start <= lateBy }]
  })
}

/** "a, b and c" */
function listWords(words: string[]): string {
  if (words.length <= 1) return words[0] ?? ''
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

/** The bar's words after "waits on": one gap with where it stands, or several by name. */
export function notReadyWords(gaps: StartGap[]): string {
  const [only] = gaps
  return gaps.length === 1 && only ? only.barWords : listWords(gaps.map((g) => g.noun))
}

/** A typed title's first words that read lowercase inside the merged list. */
const PLAIN_FIRST_WORDS = ['The', 'A', 'An', 'Their', 'Its', 'Our']

/**
 * A hold's words as they read folded into the merged "waits on" list. A wait's title is what the
 * office typed, so it keeps its capitals, except a plain first word: "The transformer, …" reads
 * "the transformer, …". "RFI-004" and "CPS Energy" never change.
 */
export function holdWordsInList(words: string): string {
  const first = words.split(/[\s,]/, 1)[0] ?? ''
  return PLAIN_FIRST_WORDS.includes(first) ? `${words.charAt(0).toLowerCase()}${words.slice(1)}` : words
}

/**
 * The chart's holds with each not-ready bar added (G-77), the kind 'paperwork'. A bar already held
 * by a submittal, a question or a wait keeps that hold too, last in one list after the papers:
 * "current insurance and submittal 28 31 11-01", "current insurance and the transformer, …"
 * (`holdWordsInList`). Late when either is.
 */
export function withNotReady(holds: Map<string, GanttHold>, state: GcState, project: GcProject): Map<string, GanttHold> {
  const bars = notReadyBars(state, project)
  if (bars.length === 0) return holds
  const out = new Map(holds)
  for (const bar of bars) {
    const had = holds.get(bar.lineId)
    out.set(bar.lineId, {
      kind: 'paperwork',
      words: had ? listWords([...bar.gaps.map((g) => g.noun), holdWordsInList(had.words)]) : notReadyWords(bar.gaps),
      late: bar.late || Boolean(had?.late),
    })
  }
  return out
}

/** One paper on the opened activity: its line, its next step's button, a day they gave, or a sentence where nothing can be sent from here. */
export interface NotReadyLine extends StartGap {
  /** The paper's own next step (`paperStep`): "Ask for it", "Remind them", "Send to sign". Null: no button. */
  verb: string | null
  /** An open promise for it, in Follow up's words: "Promised the signed statement of work by Fri Oct 9, in 7 days." */
  promise: string | null
  /** What to do instead, where there is no button: "Pick a company and award the trade." */
  hint: string | null
}

export interface NotReadyBlock {
  /** "Pecan Valley Electric is not ready to start this on Mon Oct 19." */
  title: string
  partner: Partner | null
  lines: NotReadyLine[]
  /** "The bar stays held until it is in." */
  last: string
  late: boolean
}

/** The block first in the opened activity (G-77). Null: the bar is not a trade's bar waiting to start, or its trade is ready. */
export function notReadyBlock(state: GcState, project: GcProject, lineId: string): NotReadyBlock | null {
  const bar = notReadyBars(state, project).find((b) => b.lineId === lineId)
  if (!bar) return null
  const { partner, pkg, start } = bar
  const today = state.today
  const title = partner
    ? start > today
      ? `${partner.company} is not ready to start this on ${weekdayDate(start)}.`
      : start === today
        ? `This starts today. ${partner.company} is not ready.`
        : `This was to start ${weekdayDate(start)}. ${partner.company} is not ready.`
    : start > today
      ? `Nobody is awarded this work yet. It starts ${weekdayDate(start)}.`
      : `Nobody is awarded this work yet. It was to start ${weekdayDate(start)}.`
  // Get started sends a statement of work only once the master agreement, the W-9 and current insurance are in.
  const sowWaits = partner !== null && (partner.msa !== 'signed' || !partner.w9 || !partner.coiExpires || daysUntil(partner.coiExpires, today) < 0)
  const lines = bar.gaps.map((g): NotReadyLine => {
    if (!partner) return { ...g, verb: null, promise: null, hint: 'Pick a company and award the trade.' }
    if (g.kind === 'sow' && pkg.sow?.status === 'signed') return { ...g, verb: null, promise: null, hint: 'The plans changed after they signed. Send a new statement of work.' }
    if (g.kind === 'sow' && pkg.sow?.status === 'draft' && sowWaits) return { ...g, verb: null, promise: null, hint: 'It goes once the papers above are in.' }
    const step = g.doc ? paperStep(state, partner, g.doc) : null
    const match = g.kind === 'sow' ? { partnerId: partner.id, kind: 'sow' as const, projectId: project.id, packageId: pkg.id } : g.kind === 'award' ? null : { partnerId: partner.id, kind: g.kind }
    const promised = match ? openPromiseFor(state, match) : undefined
    return { ...g, verb: step?.verb ?? null, promise: promised ? tradePromiseWords(promised, today) : null, hint: null }
  })
  const last = !partner ? 'The bar stays held until the trade is awarded.' : bar.gaps.length === 1 ? 'The bar stays held until it is in.' : 'The bar stays held until they are in.'
  return { title, partner, lines, last, late: bar.late }
}
