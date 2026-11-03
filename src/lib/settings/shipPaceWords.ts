/**
 * How fast a change ships (v2.6399): the words Settings → How fast a change ships prints, in one place for the
 * smoke and the guide. Plain words: one idea a sentence, none over 20 words.
 */
import { SHIP_PACE_READ_MINUTES } from '../../../supabase/functions/_shared/shipPace'

/** The words the section prints, in one place for the smoke. */
export const SHIP_PACE_WORDS = {
  intro: `How long a change takes from its pull request opening to the app, read from GitHub every ${SHIP_PACE_READ_MINUTES} minutes.`,
  chartTitle: 'Hours from a pull request opening to its merge, median of the merges in each hour',
  gaps: 'A gap is an hour with no merge.',
  meaning: 'The hours count from the pull request opening, not from when you asked. The app updates a few minutes after a merge.',
  emptyMain: 'No read yet.',
  emptyTail: `The first read lands within ${SHIP_PACE_READ_MINUTES} minutes of the ship-pace function’s deploy, once a dev sets its GitHub token.`,
  loading: 'Reading…',
  readNow: 'Read GitHub now',
  reading: 'Reading GitHub…',
  nowLabel: 'Merges are taking',
  openedToday: 'Opened today',
  mergedToday: 'Merged today',
  openNow: 'Open now',
  inQueue: 'In the merge queue',
  queueNotRead: 'not read',
  /** The card under the tiles (v2.6401): the merge queue's line, so a person can find their change on its way to the app. */
  queueTitle: 'In line now',
  queueOrder: 'The order changes go live in, the top one next.',
  /** The empty state's who: *Nothing waiting on the queue.* */
  queueWho: 'the queue',
  queueUnread: 'The queue was not read. Ask a dev about the token’s scopes.',
} as const
