import { countingPass, roleMustTake, ymdAddMonths, ymdDiffDays, ymdWords, type CourseStanding, type TrainingColour, type TrainingPass, type TrainingPolicy } from './trainingState'

/**
 * A course's due date as a strip (punch list #217, field-11; a prototype behind the Training card's
 * *Due strip* switch). Today the card says *Done Nov 3, 2025 · due again Nov 3, in 4 days* and the amber
 * window `dueSoonDays` is invisible, so *in 4 days* is a number with no place; and `trainingState.ts`
 * colours a pass amber from `dueSoonDays` before the day until it is passed again, so *to take again*
 * and *lapsed* both cover a course that is still current. The strip runs from the day the person passed
 * to the day the pass runs out, today's tick on it and the amber window shaded, so *in 4 days* is a
 * position; and amber splits into *due soon* (inside the window, not yet past the day) and *lapsed*
 * (past the day).
 *
 * Versions, since the owner asked (2026-10-30): the app has ONE course per slug, and every pass records
 * `contentVersion`, the hash of the course's words on the day it was passed. `countingPass` never reads
 * it: the newest pass of the course counts, whatever its version, for `goodForMonths`. A changed lesson
 * voids nothing; the one thing that does is a dev's **Everyone takes it again** (`retakeFrom`), after
 * which a pass before that day counts for nothing and `courseStanding` turns red, as if the person had
 * never passed. So the strip draws what is true: one strip per course the role must hold, from the pass
 * of whichever version they passed, that version named at its start, to the due day the policy sets;
 * and when `retakeFrom` has voided the pass, its own case, `superseded`: the strip runs from the old
 * pass to the retake day, cut there, the chip red. The strip never says a pass on an older version is
 * worth less than one on the newest, because the policy does not. Pure; days are YYYY-MM-DD.
 */

export type DueState = 'current' | 'due-soon' | 'lapsed' | 'not-done' | 'superseded'

export type DueChip = { tone: TrainingColour | 'grey'; label: string }

export type DueLabel = { head: string; sub: string }

export type TrainingDueStrip = {
  slug: string
  title: string
  state: DueState
  /** The pass the strip runs from: the newest that counts, or with `superseded` the newest that no longer does; null with none. */
  passedOn: string | null
  /** The content version of that pass, eight hex characters; null with none. */
  version: string | null
  /** The day the pass runs out; with `superseded`, the retake day that cut it; null with no pass. */
  dueOn: string | null
  /** Days from today to `dueOn`, negative once past; null with no pass or when superseded. */
  daysToDue: number | null
  retakeFrom: string | null
  dueSoonDays: number
  /** Today's place on the strip, percent of its width, clamped to the ends; null with no strip. */
  todayPct: number | null
  /** Where the amber window starts, percent; 100 when the strip has none. */
  windowPct: number
  /** Today is past the end: the tick sits at the end and the chip says how far past. */
  overrun: boolean
  chip: DueChip
  /** Under the strip's start: *passed* and the day with the version. */
  startLabel: DueLabel | null
  /** Under the strip's end: *due Nov 3* and *in 4 days*; *was due*; or the retake cut. */
  endLabel: DueLabel | null
  /** The whole strip in one or two sentences, for the hover and the screen reader. */
  words: string
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10))
}

/** Amber split by the day: inside the window and not past it is *due soon*; past it is *lapsed*. */
export function dueStateOf(input: { hasPass: boolean; superseded: boolean; daysToDue: number | null; dueSoonDays: number }): DueState {
  if (input.superseded) return 'superseded'
  if (!input.hasPass || input.daysToDue == null) return 'not-done'
  if (input.daysToDue < 0) return 'lapsed'
  if (input.daysToDue <= input.dueSoonDays) return 'due-soon'
  return 'current'
}

/** The chip beside a course's name: the state, and the days when they matter. */
export function dueChip(state: DueState, daysToDue: number | null): DueChip {
  switch (state) {
    case 'current':
      return { tone: 'green', label: 'current' }
    case 'due-soon':
      return { tone: 'amber', label: daysToDue === 0 ? 'due today' : `due soon · ${plural(daysToDue ?? 0, 'day', 'days')}` }
    case 'lapsed':
      return { tone: 'red', label: `lapsed · ${plural(-(daysToDue ?? 0), 'day', 'days')}` }
    case 'superseded':
      return { tone: 'red', label: 'older version · take it again' }
    case 'not-done':
      return { tone: 'red', label: 'not done' }
  }
}

/** A standing the SQL twin gives (`training_standings`, no versions): red is not done, amber splits by the day, green is current. */
export function dueSplit(s: Pick<CourseStanding, 'colour' | 'daysToDue'>, dueSoonDays: number): DueState {
  if (s.colour === 'red') return 'not-done'
  if (s.colour === 'green') return 'current'
  return dueStateOf({ hasPass: true, superseded: false, daysToDue: s.daysToDue, dueSoonDays })
}

export type DueCounts = { current: number; dueSoon: number; lapsed: number; notDone: number }

/** Settings → Training's four counts; `superseded` counts as not done, as the SQL twin counts it. */
export function dueCounts(states: readonly DueState[]): DueCounts {
  const out: DueCounts = { current: 0, dueSoon: 0, lapsed: 0, notDone: 0 }
  for (const s of states) {
    if (s === 'current') out.current++
    else if (s === 'due-soon') out.dueSoon++
    else if (s === 'lapsed') out.lapsed++
    else out.notDone++
  }
  return out
}

export const DUE_COUNT_KINDS: ReadonlyArray<{ key: keyof DueCounts; state: DueState; word: string; tone: TrainingColour }> = [
  { key: 'current', state: 'current', word: 'current', tone: 'green' },
  { key: 'dueSoon', state: 'due-soon', word: 'due soon', tone: 'amber' },
  { key: 'lapsed', state: 'lapsed', word: 'lapsed', tone: 'red' },
  { key: 'notDone', state: 'not-done', word: 'not done', tone: 'red' },
]

/** The strip from its dates alone, for a standing with no passes at hand (Settings' See who rows). */
export function dueStripFromDates(input: {
  slug: string
  title: string
  passedOn: string | null
  dueOn: string | null
  dueSoonDays: number
  todayYmd: string
  version?: string | null
  /** Set when a retake day voided the pass: the strip is cut there. */
  retakeFrom?: string | null
  superseded?: boolean
}): TrainingDueStrip {
  const { slug, title, dueSoonDays, todayYmd } = input
  const version = input.version ?? null
  const retakeFrom = input.retakeFrom ?? null
  const superseded = Boolean(input.superseded && input.passedOn && retakeFrom)
  const passedOn = input.passedOn
  const dueOn = superseded ? retakeFrom : input.dueOn
  if (!passedOn || !dueOn) {
    return {
      slug,
      title,
      state: 'not-done',
      passedOn: null,
      version: null,
      dueOn: null,
      daysToDue: null,
      retakeFrom,
      dueSoonDays,
      todayPct: null,
      windowPct: 100,
      overrun: false,
      chip: dueChip('not-done', null),
      startLabel: null,
      endLabel: null,
      words: `${title}: not done.`,
    }
  }
  const daysToDue = superseded ? null : ymdDiffDays(todayYmd, dueOn)
  const state = dueStateOf({ hasPass: true, superseded, daysToDue, dueSoonDays })
  const total = Math.max(0, ymdDiffDays(passedOn, dueOn))
  const sinceStart = ymdDiffDays(passedOn, todayYmd)
  const todayPct = total === 0 ? 100 : clamp((100 * sinceStart) / total)
  const windowPct = superseded || total === 0 ? 100 : clamp((100 * (total - dueSoonDays)) / total)
  const overrun = sinceStart > total
  const versionWords = version ? ` · version ${version}` : ''
  const startLabel: DueLabel = { head: 'passed', sub: `${ymdWords(passedOn, todayYmd)}${versionWords}` }
  let endLabel: DueLabel
  let said: string
  const passSentence = `${title}: passed ${ymdWords(passedOn, todayYmd)}${version ? ` on version ${version}` : ''}`
  if (superseded) {
    endLabel = { head: `counts for nothing from ${ymdWords(dueOn, todayYmd)}`, sub: 'everyone takes it again' }
    said = `${passSentence}. A dev asked everyone to take it again from ${ymdWords(dueOn, todayYmd)}, so that pass counts for nothing. Take it again.`
  } else if (daysToDue != null && daysToDue < 0) {
    endLabel = { head: `was due ${ymdWords(dueOn, todayYmd)}`, sub: `${plural(-daysToDue, 'day', 'days')} ago` }
    said = `${passSentence}, good until ${ymdWords(dueOn, todayYmd)}. That was ${plural(-daysToDue, 'day', 'days')} ago: lapsed.`
  } else if (daysToDue === 0) {
    endLabel = { head: `due ${ymdWords(dueOn, todayYmd)}`, sub: 'today' }
    said = `${passSentence}, good until ${ymdWords(dueOn, todayYmd)}. That is today: due soon.`
  } else {
    endLabel = { head: `due ${ymdWords(dueOn, todayYmd)}`, sub: `in ${plural(daysToDue ?? 0, 'day', 'days')}` }
    said =
      state === 'due-soon'
        ? `${passSentence}, good until ${ymdWords(dueOn, todayYmd)}. Today is ${plural(daysToDue ?? 0, 'day', 'days')} before, inside the last ${plural(dueSoonDays, 'day', 'days')}: due soon.`
        : `${passSentence}, good until ${ymdWords(dueOn, todayYmd)}, ${plural(daysToDue ?? 0, 'day', 'days')} from today. The last ${plural(dueSoonDays, 'day', 'days')} before it are shaded: current.`
  }
  return { slug, title, state, passedOn, version, dueOn, daysToDue, retakeFrom, dueSoonDays, todayPct, windowPct, overrun, chip: dueChip(state, daysToDue), startLabel, endLabel, words: said }
}

/** The newest pass of the course, whether or not it counts under the retake day. */
function newestPass(slug: string, passes: readonly TrainingPass[]): TrainingPass | null {
  let best: TrainingPass | null = null
  for (const p of passes) if (p.slug === slug && (!best || p.passedOn > best.passedOn)) best = p
  return best
}

/**
 * One person's strip on one course: null when the course is off or the role need not take it; the
 * counting pass's strip; `superseded` when the only passes are before the retake day; `not-done` with none.
 */
export function trainingDueStrip(policy: TrainingPolicy, passes: readonly TrainingPass[], role: Parameters<typeof roleMustTake>[1], todayYmd: string): TrainingDueStrip | null {
  if (!roleMustTake(policy, role)) return null
  const pass = countingPass(policy, passes)
  if (pass) {
    return dueStripFromDates({ slug: policy.slug, title: policy.title, passedOn: pass.passedOn, dueOn: ymdAddMonths(pass.passedOn, policy.goodForMonths), dueSoonDays: policy.dueSoonDays, todayYmd, version: pass.contentVersion, retakeFrom: policy.retakeFrom })
  }
  const old = newestPass(policy.slug, passes)
  if (old && policy.retakeFrom) {
    return dueStripFromDates({ slug: policy.slug, title: policy.title, passedOn: old.passedOn, dueOn: null, dueSoonDays: policy.dueSoonDays, todayYmd, version: old.contentVersion, retakeFrom: policy.retakeFrom, superseded: true })
  }
  return dueStripFromDates({ slug: policy.slug, title: policy.title, passedOn: null, dueOn: null, dueSoonDays: policy.dueSoonDays, todayYmd, retakeFrom: policy.retakeFrom })
}

const RANK: Record<DueState, number> = { 'not-done': 0, superseded: 1, lapsed: 2, 'due-soon': 3, current: 4 }

/** Every course a person must take, worst first, the nearest day first inside a state. */
export function personDueStrips(policies: readonly TrainingPolicy[], passes: readonly TrainingPass[], role: Parameters<typeof roleMustTake>[1], todayYmd: string): TrainingDueStrip[] {
  return policies
    .map((p) => trainingDueStrip(p, passes, role, todayYmd))
    .filter((s): s is TrainingDueStrip => s != null)
    .sort((a, b) => RANK[a.state] - RANK[b.state] || (a.daysToDue ?? 0) - (b.daysToDue ?? 0) || a.title.localeCompare(b.title))
}

/** The card's verdict line with the split: *1 course to do*, *1 course to take again*, *1 course lapsed*, *1 course due soon*, *You are caught up*. */
export function dueVerdict(strips: readonly TrainingDueStrip[]): { colour: TrainingColour; line: string } | null {
  if (strips.length === 0) return null
  const n = (state: DueState) => strips.filter((s) => s.state === state).length
  if (n('not-done')) return { colour: 'red', line: `${plural(n('not-done'), 'course', 'courses')} to do` }
  if (n('superseded')) return { colour: 'red', line: `${plural(n('superseded'), 'course', 'courses')} to take again` }
  if (n('lapsed')) return { colour: 'red', line: `${plural(n('lapsed'), 'course', 'courses')} lapsed` }
  if (n('due-soon')) return { colour: 'amber', line: `${plural(n('due-soon'), 'course', 'courses')} due soon` }
  return { colour: 'green', line: 'You are caught up' }
}
