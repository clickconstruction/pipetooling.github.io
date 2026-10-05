/**
 * The job's Lien window names its next step (punch list #82, PR 3): one card above the papers
 * that says what to do now, how long there is, and one button that goes there. Pure: it reads
 * the timeline's own *Next on the path* (`lienTimeline.ts`) and adds only where the button goes.
 *
 * A § 53.056 notice or a retainage notice is drafted, approved and sent on the Lien desk, so
 * those buttons open the desk on this job. The affidavit, its service and the release of
 * record are made in this window, so those buttons switch its tab. A step that is counsel's,
 * or a path with nothing left on it, has no button.
 */
import type { LienTimelineNext, LienTimelineWaitingOn } from './lienTimeline'

export type LienWindowNextDoor = { to: 'desk'; kind: 'notice' | 'retainage' } | { to: 'tab'; tab: 'notice' | 'affidavit' | 'release_record' }

export type LienWindowNextStep = {
  words: string
  aside: string
  /** "10 days left", "today", "4 days late"; '' when the step has no day. */
  daysWords: string
  tone: LienTimelineNext['tone']
  /** "Waiting on the GC: …" — '' when the move is ours or nobody's. */
  waitingWords: string
  button: { label: string; door: LienWindowNextDoor } | null
}

export function lienNextStepDaysWords(daysLeft: number | null): string {
  if (daysLeft == null) return ''
  if (daysLeft < 0) return `${-daysLeft} ${daysLeft === -1 ? 'day' : 'days'} late`
  if (daysLeft === 0) return 'today'
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
}

const WHO: Record<string, string> = { ours: '', gc: 'the GC', owner: 'the owner', county: 'the county', counsel: 'counsel' }

export function lienWindowNextStep(next: LienTimelineNext, waitingOn: LienTimelineWaitingOn | null): LienWindowNextStep {
  let button: LienWindowNextStep['button'] = null
  switch (next.kind) {
    case 'notice':
      button = { label: 'Open it on the Lien desk', door: { to: 'desk', kind: 'notice' } }
      break
    case 'retainage':
      button = { label: 'Open it on the Lien desk', door: { to: 'desk', kind: 'retainage' } }
      break
    case 'affidavit':
      button = { label: 'Go to the affidavit', door: { to: 'tab', tab: 'affidavit' } }
      break
    case 'serve':
      button = { label: 'Record the service', door: { to: 'tab', tab: 'affidavit' } }
      break
    case 'release':
      button = { label: 'Go to the release of record', door: { to: 'tab', tab: 'release_record' } }
      break
    case 'suit':
    case 'lien_gone':
    case 'none':
      break
  }
  const who = waitingOn ? WHO[waitingOn.who] ?? '' : ''
  return {
    words: next.words,
    aside: next.aside,
    // A step with nothing left to do carries a day the clock stopped on, not a countdown.
    daysWords: next.kind === 'none' || next.kind === 'lien_gone' ? '' : lienNextStepDaysWords(next.daysLeft),
    tone: next.tone,
    waitingWords: waitingOn && who ? `Waiting on ${who}: ${waitingOn.words}` : '',
    button,
  }
}
