/**
 * The queue lanes' help sentences (punch list #151 PR 3, v2.5802), in one home: what each lane holds, as its heading
 * printed under its name until `/messages` moved the sentences behind the ? on its bar (`messages/laneLegend.ts`).
 * GC projects' Follow up still prints them under the headings (`FollowUpSections`, `laneLook: 'plain'`). Pure.
 */
import { CALL_WORDS } from '../calls/callTasks'

/** What Needs you holds, in parts: the clause sentence only where the host draws the clause rows. */
export const NEEDS_YOU_NOTE = {
  back: 'A note with a day comes back here that morning.',
  portal: 'A portal row is a customer who wrote on their page.',
  clause: 'A clause row waits on a controller or a dev.',
} as const

export const LANE_NOTES = {
  new: 'What came in and still needs sorting. Its row opens the thread, with the sort at the top.',
  needsYou: (withClauses: boolean): string => [NEEDS_YOU_NOTE.back, NEEDS_YOU_NOTE.portal, ...(withClauses ? [NEEDS_YOU_NOTE.clause] : [])].join(' '),
  needsReply: 'Texts, voicemails, missed calls and emails nobody has answered. The one waiting longest is first.',
  weOwe: `What we still have to do for someone, with its day. It stays our move until a note or a message marks it done. ${CALL_WORDS.lane}`,
} as const
