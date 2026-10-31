/**
 * The Mark says what happened (punch list #176, change 1). Every station bar used to offer one
 * green press, *Looked · N open · next*, whatever the count said; eight weeks of marks read as
 * one press every nine seconds. Now the press that fits the count is the one lit: **Done** at
 * zero, **Worked it · N left** above zero, and **Not sure what to do** always, which files a
 * Dispatch inbox request to the owner so the thing skipped becomes a row someone answers. Each
 * press writes its outcome on the mark event. Pure: counts in, presses and words out.
 */

import { READING_AGAIN_WORDS } from '../keptRead'

export type MarkOutcome = 'done' | 'worked' | 'question'

export const MARK_OUTCOMES: readonly MarkOutcome[] = ['done', 'worked', 'question']

export function isMarkOutcome(v: unknown): v is MarkOutcome {
  return v === 'done' || v === 'worked' || v === 'question'
}

/** The outcome a plain press means for a count: nothing left at zero, rows left above it. A station with no count is a look, which reads as done. */
export function markOutcomeForCount(count: number | null | undefined): 'done' | 'worked' {
  return typeof count === 'number' && count > 0 ? 'worked' : 'done'
}

export type MarkPress = {
  outcome: MarkOutcome
  /** The button's words. */
  label: string
  /** Lit, or drawn dim as the thing to reach. */
  enabled: boolean
  /** The small line under the words on a wide bar; the title elsewhere. */
  hint: string
}

/**
 * The three presses for a count. Done is lit at zero or when the station has no count (a look);
 * Worked it is lit above zero; Not sure is always lit. `noun` is the count's word (*open*, *due*,
 * *waiting*), *open* by default. `held` (punch list #183 PR 4): the station's count on screen is
 * the device's kept read, so Done and Worked it wait with the words they would have and the hint
 * *reading again…*, and a press never records yesterday's count; Not sure stays lit.
 */
export function markPresses(count: number | null | undefined, noun = 'open', loading = false, held = false): MarkPress[] {
  if (held && !loading) {
    const [done, worked, question] = markPresses(count, noun, false)
    return [
      { ...done!, enabled: false, hint: READING_AGAIN_WORDS },
      { ...worked!, enabled: false, hint: READING_AGAIN_WORDS },
      question!,
    ]
  }
  // Still counting (v2.5868): Done and Worked it wait, so a press never saves a mark with no count; Not sure stays lit.
  if (loading) {
    return [
      { outcome: 'done', label: 'Done', enabled: false, hint: 'counting…' },
      { outcome: 'worked', label: 'Worked it', enabled: false, hint: 'counting…' },
      { outcome: 'question', label: 'Not sure what to do', enabled: true, hint: 'asks the owner' },
    ]
  }
  const n = typeof count === 'number' ? count : null
  const atZero = n === null || n <= 0
  return [
    {
      outcome: 'done',
      label: n === null ? 'Looked' : `Done · 0 ${noun}`,
      enabled: atZero,
      hint: n === null ? 'this station has no count' : atZero ? 'nothing left here' : 'lights up at zero',
    },
    {
      outcome: 'worked',
      label: n !== null && n > 0 ? `Worked it · ${n} left` : 'Worked it',
      enabled: !atZero,
      hint: 'records the count',
    },
    {
      outcome: 'question',
      label: 'Not sure what to do',
      enabled: true,
      hint: 'asks the owner',
    },
  ]
}

/** The press's words on the Roller and the round, where the bar also says where it goes next: `Done · 0 open · next →`. */
export function markPressBarLabel(press: MarkPress, nextLabel: string): string {
  return press.outcome === 'question' ? press.label : `${press.label} · ${nextLabel}`
}

/** `dispatch_requests.pending_action` for the request a Not sure press files; one open request per station. */
export const QUICKFILL_QUESTION_ACTION = 'quickfill_question'

export type QuickfillQuestionPayload = {
  sectionId: string
  label: string
  count: number | null
  question: string | null
}

/** The request's title, which is the inbox message: the station, its count, and what the person wrote. */
export function questionRequestTitle(label: string, count: number | null | undefined, words: string): string {
  const countPart = typeof count === 'number' ? ` · ${count} open` : ''
  const typed = words.trim()
  const head = `Quickfill · ${label}${countPart}: not sure what to do.`
  return typed ? `${head} ${typed}` : head
}

/** The request's reference line: the station's own question, so the owner answers in context. */
export function questionRequestReference(question: string | null | undefined): string | null {
  const q = (question ?? '').trim()
  return q ? `The station asks: ${q}` : null
}

export function questionRequestPayload(args: QuickfillQuestionPayload): QuickfillQuestionPayload {
  return { sectionId: args.sectionId, label: args.label, count: args.count, question: args.question }
}

/** The one word the history uses for an outcome: a cell's title, a row's column. */
export function markOutcomeWord(outcome: MarkOutcome | null | undefined): string {
  switch (outcome) {
    case 'done':
      return 'done'
    case 'worked':
      return 'worked'
    case 'question':
      return 'asked'
    default:
      return 'looked'
  }
}

/** The grey line under a row's name on the round, and the Focus fold's words: *worked today 9:12* or *done 9:12*. */
export function markOutcomeStampWord(outcome: MarkOutcome | null | undefined): string {
  switch (outcome) {
    case 'done':
      return 'done'
    case 'worked':
      return 'worked'
    case 'question':
      return 'asked'
    default:
      return 'marked'
  }
}
