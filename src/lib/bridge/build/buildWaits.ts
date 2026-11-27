/**
 * A Build job waits, with a reason (punch list #192, write A, v2.8723). The Build desk tells its reader to crew a
 * stalled job or name why it waits. This kernel is the naming: the six reasons, when the window's press is live, and
 * every word the wait is said in, on the desk, on the job's Stages card and in the job window. The job's status does
 * not change: it stays Working, and the wait is a row of its own (`job_build_waits`, written by `set_job_build_wait`).
 * Every sentence here is held to the plain-words rule by `buildWaits.test.ts`. Pure: no React, no Supabase.
 */
import { stageUsd } from '../stageFlow'

export type BuildWaitReason = 'gc_not_ready' | 'materials' | 'inspection' | 'customer_hold' | 'weather' | 'other'

/** The six reasons, in the order the window lists them. Each label is short enough for a phone. */
export const BUILD_WAIT_REASONS: ReadonlyArray<{ key: BuildWaitReason; label: string }> = [
  { key: 'gc_not_ready', label: 'The GC is not ready for us' },
  { key: 'materials', label: 'Waiting on materials' },
  { key: 'inspection', label: 'Waiting on an inspection' },
  { key: 'customer_hold', label: 'The customer asked us to hold' },
  { key: 'weather', label: 'Weather' },
  { key: 'other', label: 'Something else' },
]

/** The most a person types beside a reason; the table holds the same. */
export const BUILD_WAIT_NOTE_MAX = 300

/** A wait that is not lifted, as the desk and the job's card read it. */
export type BuildWait = {
  jobId: string
  reason: BuildWaitReason
  /** The person's words; '' when they typed none. */
  note: string
  /** The company's day the job was marked waiting, YYYY-MM-DD. */
  sinceYmd: string
  /** Who marked it, as their name read that day; '' when it is not known. */
  markedByName: string
}

const REASON_KEYS: ReadonlySet<string> = new Set(BUILD_WAIT_REASONS.map((r) => r.key))

export function buildWaitReasonOf(raw: string | null | undefined): BuildWaitReason | null {
  return raw != null && REASON_KEYS.has(raw) ? (raw as BuildWaitReason) : null
}

const monthDay = (ymd: string): string => new Date(`${ymd}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? ''
/** A person's own words without the stop they may have typed, so a sentence ends once. */
const bare = (words: string): string => words.trim().replace(/[.\s]+$/, '')

/**
 * The reason inside a sentence: *the GC is not ready for us*, *waiting on materials*. Another reason is the person's
 * own words, as typed.
 */
export function buildWaitReasonWords(wait: Pick<BuildWait, 'reason' | 'note'>): string {
  switch (wait.reason) {
    case 'gc_not_ready':
      return 'the GC is not ready for us'
    case 'materials':
      return 'waiting on materials'
    case 'inspection':
      return 'waiting on an inspection'
    case 'customer_hold':
      return 'the customer asked us to hold'
    case 'weather':
      return 'weather'
    case 'other':
      return bare(wait.note) || 'a reason of its own'
  }
}

/** The chip on the desk's row and on the job's Stages card: *Waits · the GC is not ready for us · since Oct 26*. A label. */
export function buildWaitChipWords(wait: BuildWait): string {
  return `Waits · ${buildWaitReasonWords(wait)} · since ${monthDay(wait.sinceYmd)}`
}

/** The job window's fact row: *Since Oct 26 · the GC is not ready for us · Dana*. A label. */
export function buildWaitFactWords(wait: BuildWait): string {
  const who = firstName(wait.markedByName)
  return `Since ${monthDay(wait.sinceYmd)} · ${buildWaitReasonWords(wait)}${who ? ` · ${who}` : ''}`
}

/**
 * The desk's why-line on a waiting row. `leftUsd` is the sold work still on the job, or null when the job has no
 * price or no percent.
 *
 *   Waits since Oct 26: the GC is not ready for us. Dana marked it. This window does not count the $47.1k against
 *   the crew while it waits. The Build card still counts it as sold work.
 */
export function buildWaitWhy(wait: BuildWait, leftUsd: number | null): string {
  const who = firstName(wait.markedByName)
  const typed = wait.reason !== 'other' && bare(wait.note) ? ` ${bare(wait.note)}.` : ''
  const money = leftUsd != null && leftUsd > 0 ? `the ${stageUsd(leftUsd)}` : 'the job'
  return `Waits since ${monthDay(wait.sinceYmd)}: ${buildWaitReasonWords(wait)}.${typed}${who ? ` ${who} marked it.` : ''} This window does not count ${money} against the crew while it waits. The Build card still counts it as sold work.`
}

/** What the person has picked and typed in the window. */
export type BuildWaitDraft = { reason: BuildWaitReason | null; note: string }

export const EMPTY_BUILD_WAIT_DRAFT: BuildWaitDraft = { reason: null, note: '' }

/** Why **Mark it waiting** is dead, in words; null when it is live. */
export function buildWaitDraftHold(draft: BuildWaitDraft): string | null {
  if (!draft.reason) return 'Pick the reason first.'
  if (draft.reason === 'other' && !draft.note.trim()) return 'Say why the job waits.'
  if (draft.note.trim().length > BUILD_WAIT_NOTE_MAX) return `Keep the words under ${BUILD_WAIT_NOTE_MAX} characters.`
  return null
}

/** The small window's words. `label` is the job as the desk names it, *878 · Tune 5 Seguin*. */
export function buildWaitWindowWords(label: string, leftUsd: number | null): { title: string; lede: string; noteLabel: string; foot: string; confirmLabel: string; busyLabel: string } {
  const money = leftUsd != null && leftUsd > 0 ? `the ${stageUsd(leftUsd)}` : 'this job'
  return {
    title: `${label} waits`,
    lede: `Pick the reason. This window stops counting ${money} against the crew until someone lifts the wait.`,
    noteLabel: 'A line to add, if you like',
    foot: 'Written on the job with your name and today’s date.',
    confirmLabel: 'Mark it waiting',
    busyLabel: 'Marking…',
  }
}

/** The presses' names, one place for the desk, the job's card and the job window. */
export const BUILD_WAIT_WORDS = {
  name: 'Name why it waits',
  lift: 'Lift the wait',
  lifting: 'Lifting…',
  /** The job window's fact row. */
  factLabel: 'Waits',
} as const

/** The toast once a job is marked waiting. */
export function buildWaitMarkedWords(label: string, draft: { reason: BuildWaitReason; note: string }): string {
  return `${label} waits: ${buildWaitReasonWords(draft)}.`
}

/** The toast once a wait is lifted. */
export function buildWaitLiftedWords(label: string): string {
  return `The wait on ${label} is lifted. It counts on the Build desk again.`
}
