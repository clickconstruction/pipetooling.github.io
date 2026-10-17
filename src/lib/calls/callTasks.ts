/**
 * Calls (v2.5596, punch list #115 PR 5; the plan `to-dos/tell-the-customer/README.md`). A call to make is a task in
 * Follow up → We owe them: who, about what, the day, and what to say. It comes from the receipt's **Add to my calls**
 * or the thread's quiet line, and ends when Quo logs a completed call to that person, when the office presses **I
 * called** with a note, or **Skip**. Pure: the rows as the lane draws them, their order, the day words, and the words
 * on the presses. The reads and the writes are `callTasksIo.ts`; the rows render in `followUp/FollowUpSections.tsx`.
 */
import { dayLabel } from '../messages/owed'

/** A `call_tasks` row as the office reads it, the maker named. */
export interface CallTaskRecord {
  id: string
  contactId: string
  stepKey: string | null
  jobKey: string | null
  /** YYYY-MM-DD. */
  dueYmd: string
  /** "about the estimate". */
  what: string
  script: string | null
  madeBy: string
  madeAt: string
  doneAt: string | null
}

/** One row in We owe them for a call. */
export interface CallTaskRow {
  id: string
  contactId: string
  stepKey: string | null
  jobKey: string | null
  dueYmd: string
  what: string
  script: string | null
  madeBy: string
  madeAt: string
  /** "call · today", "call · Sat Oct 18", "call · Fri Oct 17, late". */
  pill: string
  late: boolean
  today: boolean
}

/** The open calls, soonest first, then by when they were added; a person may have one a step a job. */
export function callRows(tasks: ReadonlyArray<CallTaskRecord>, todayYmd: string): CallTaskRow[] {
  return tasks
    .filter((t) => !t.doneAt)
    .sort((a, b) => a.dueYmd.localeCompare(b.dueYmd) || Date.parse(a.madeAt) - Date.parse(b.madeAt))
    .map((t) => {
      const late = t.dueYmd < todayYmd
      const today = t.dueYmd === todayYmd
      return {
        id: t.id,
        contactId: t.contactId,
        stepKey: t.stepKey,
        jobKey: t.jobKey,
        dueYmd: t.dueYmd,
        what: t.what,
        script: t.script,
        madeBy: t.madeBy,
        madeAt: t.madeAt,
        pill: late ? `call · ${dayLabel(t.dueYmd)}, late` : today ? 'call · today' : `call · ${dayLabel(t.dueYmd)}`,
        late,
        today,
      }
    })
}

/** The day after a YYYY-MM-DD. */
export function dayAfter(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const next = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1))
  return next.toISOString().slice(0, 10)
}

/** What a call is about, after the person's name, by the step the text went on. */
export function callWhat(stepKey: string | null | undefined, jobName?: string | null): string {
  switch (stepKey) {
    case 'booked':
      return 'about the visit'
    case 'estimate':
    case 'approved':
      return 'about the estimate'
    default:
      return jobName ? `about ${jobName}` : 'to follow up'
  }
}

/** The name a call's words use: what they go by, else the first word of their name that is not a title. */
export function callFirst(c: { name: string; goesBy?: string | null }): string | null {
  const goesBy = c.goesBy?.trim()
  if (goesBy) return goesBy
  const words = c.name.split(/\s+/).filter((w) => w && !/^(dr|mr|mrs|ms|miss|sr|sra|srta)\.?$/i.test(w))
  return words[0] ?? null
}

/** "Call Dana about the estimate": the row's title. */
export function callTitle(first: string | null, what: string): string {
  return `Call ${first ?? 'them'} ${what}`
}

export const CALL_WORDS = {
  addToMyCalls: 'Add to my calls',
  added: (first: string | null, day: string) => `Added a call to ${first ?? 'them'} for ${dayLabel(day)}. It waits in Follow up under We owe them.`,
  call: 'Call',
  iCalled: 'I called',
  tomorrow: 'Tomorrow',
  skip: 'Skip',
  calledToast: 'Done. The note is in the thread.',
  skippedToast: 'Skipped.',
  movedToast: (day: string) => `Moved to ${dayLabel(day)}.`,
  whatToSay: 'What to say',
  quietAsk: (first: string | null) => `Call ${first ?? 'them'} to talk it through?`,
  noteAsk: 'A note for the team, or leave it and the app writes one.',
  lane: 'A call to make sits here with its day and the words to say. Quo closes it when the call lands in the thread.',
} as const
