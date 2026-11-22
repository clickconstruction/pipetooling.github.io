/**
 * Before we start, on arrival (punch list #382, PR 10): the words of the crew's card **Is it as told?**, and what a No
 * sends Dispatch. A No goes down the road a stage check built (punch list #245): one `dispatch_requests` row,
 * `pending_action 'stage_check'`, written by `start_check_arrive`. It has no checklist question behind it, so
 * `stageCheckPayloadFrom` answers null for it and the inbox reads it here: its door is the job's list, not a check.
 * Screen-only words live here and not in `startChecks.ts`, which is copied to the edge. Pure.
 */
import { countWords } from './startChecks'

export const ARRIVAL_WORDS = {
  heading: 'Is it as told?',
  /** True of every bullet on the card, told or still open: each must be true before the stage. */
  lead: (stage: string) => `Look before you unload. These must be true before ${stage}.`,
  no: 'No',
  allYes: 'Yes, all as told',
  send: (n: number) => `Tell Dispatch: ${countWords(n, 'thing', 'things')} not as told`,
  noGoes: 'A No tells Dispatch. Keep working either way.',
  keeping: 'Keeping…',
  saidYes: 'Saved: all as told.',
  saidNo: (n: number) => `Dispatch has it: ${countWords(n, 'thing', 'things')} not as told.`,
  either: 'Keep working either way.',
  notKept: 'That was not kept',
  /** The fallback when a refused read carries no reason of its own. */
  notRead: 'The app could not read what to look at here',
} as const

/** What a No on arrival carries to Dispatch, off the request's payload. */
export type NotAsToldPayload = {
  fixtureId: string
  stageName: string
  arrivalId: string
  /** The bullets that were not as told. */
  bullets: string[]
  /** Who told us they were ready, '' when nobody had. */
  toldBy: string
}

/** The payload of a No on arrival off an inbox row, or null on any other request. */
export function notAsToldFrom(payload: unknown): NotAsToldPayload | null {
  if (!payload || typeof payload !== 'object') return null
  const sc = (payload as { stage_check?: unknown }).stage_check
  if (!sc || typeof sc !== 'object') return null
  const { fixture_id, stage_name, start_check_arrival_id, not_as_told, told_by } = sc as Record<string, unknown>
  if (typeof fixture_id !== 'string' || !fixture_id || typeof start_check_arrival_id !== 'string' || !start_check_arrival_id) return null
  return {
    fixtureId: fixture_id,
    stageName: typeof stage_name === 'string' ? stage_name : '',
    arrivalId: start_check_arrival_id,
    bullets: Array.isArray(not_as_told) ? not_as_told.filter((b): b is string => typeof b === 'string') : [],
    toldBy: typeof told_by === 'string' ? told_by : '',
  }
}

/** The words of a No in Dispatch's inbox. Nothing closes it by itself, so the foot says who does. */
export const NOT_AS_TOLD_WORDS = {
  openList: 'Open the list',
  openListTitle: (stage: string) => `Open the job on Documents, where Before we start holds ${stage ? `the ${stage} list` : 'the list'}: tick the bullet once it is true, or change the list`,
  windowFoot: 'Close it once the site is as told, or the list has changed.',
  /** Where the line came from, on the window's first line: the crew's card on arrival, never a checklist's sheet. */
  sentOnArrival: 'sent on arrival',
} as const
