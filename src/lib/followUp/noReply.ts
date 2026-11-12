/**
 * No reply needed, in plain sight (v2.7029, punch list #324 PR 3). Closing a conversation with no reply existed since
 * cut 2 (`stateMenu`, `set_state`), but only inside the thread's ⋯, on a row in Needs a reply and on the Answer all
 * desk. A row in New had no such press, the thread never said it was Done, and the press left no trace of who closed it
 * or when. The dev looked at the six lanes on 2026-11-12 and concluded a thread could not be closed.
 *
 * This is the words and the rule. The press writes one grey line through `follow_up_event`, in the shape Heard back's
 * line has (`waitingOnThem.ts`): *Rosa said on Nov 12 that no reply is needed.* The thread's status row then reads the
 * state: the press while the conversation is Open, a grey chip with who and when once it is Done by that press, and a
 * chip for a thread that only old mail filed for the record ever touched. Pure; the write is `followUpIo.ts`'s
 * `noReplyNeeded`, the row `useFollowUpThreadSlots.tsx`, the sort card's press `NewLaneSlot.tsx`.
 */
import { courtOf, lastAsk, lastOut, NOTHING_WAITS, shortDay, type ThreadMessage } from '../messages/thread'
import type { ContactState } from './queue'

/** The press, as `stateMenu` already names it. */
export const NO_REPLY_PRESS = 'No reply needed'

/** Its hover on the thread and on the sort card. */
export const NO_REPLY_TIP = 'Takes the row off Follow up. Nothing is owed. The thread keeps a line that says who closed it.'

/** The sort card's hover: the sender stays unnamed. */
export const NO_REPLY_UNNAMED_TIP = 'Takes the row off Follow up without naming the sender. New asks again when they next write.'

/** The grey line's words: "Rosa said on Nov 12 that no reply is needed." */
export function noReplyBody(name: string, dayWords: string): string {
  return `${name.trim() || 'Someone'} said on ${dayWords} that no reply is needed.`
}

const NO_REPLY_LINE = /^(.+) said on (.+) that no reply is needed\.$/

/** Who said it and on what day, read back from a grey line; null for any other line. */
export function noReplyOf(body: string): { who: string; day: string } | null {
  const m = NO_REPLY_LINE.exec(body.trim())
  return m ? { who: m[1]!, day: m[2]! } : null
}

/** The LIKE pattern for those grey lines, for a read of what was closed (`doneFoldIo.ts`). */
export const NO_REPLY_LIKE = '% said on % that no reply is needed.'

/** What the thread's status row shows of the conversation's state, beside *We owe them…*. */
export type ThreadClose =
  /** Open: the press. */
  | { kind: 'press'; label: string; tip: string }
  /** Done by the press, or a thread only filed mail ever touched: a grey chip, and Reopen beside it. */
  | { kind: 'done'; how: 'noReply' | 'filed'; words: string; tip: string }

const at = (m: { at: string } | undefined): number => (m ? Date.parse(m.at) : Number.NEGATIVE_INFINITY)

/**
 * The status row's piece for the state. Open: **No reply needed**. Done by that press (its grey line is newer than
 * every word either way): *Done · no reply needed · Rosa, Nov 12*. Done with nothing live on the thread, only mail filed
 * for the record: *Done · old mail, filed Nov 9*. Nothing for a thread that is Snoozed (its own chip says so) or Done by
 * our reply (the move line says *Their move*).
 */
export function threadClose(input: { state: ContactState; lines: readonly ThreadMessage[]; contactId: string; nowIso: string }): ThreadClose | null {
  const { state, lines, contactId, nowIso } = input
  if (state === 'waiting') return { kind: 'press', label: NO_REPLY_PRESS, tip: NO_REPLY_TIP }
  if (state !== 'done') return null
  const mine = lines.filter((m) => m.contactId === contactId)
  const lastWord = Math.max(at(lastAsk(mine, contactId)), at(lastOut(mine, contactId)))
  const said = mine
    .filter((m) => m.channel === 'event' && noReplyOf(m.body) !== null && Date.parse(m.at) > lastWord)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]
  if (said) {
    const who = noReplyOf(said.body)!.who
    return { kind: 'done', how: 'noReply', words: `Done · no reply needed · ${who}, ${shortDay(said.at, nowIso)}`, tip: `${who} closed it with No reply needed. Reopen puts it back on Follow up.` }
  }
  const filed = mine.filter((m) => m.history)
  if (filed.length > 0 && courtOf(mine, contactId, nowIso).word === NOTHING_WAITS && !lastAsk(mine, contactId)) {
    const landed = filed.map((m) => m.landedAt).filter((d): d is string => !!d).sort()
    const newest = landed[landed.length - 1]
    return {
      kind: 'done',
      how: 'filed',
      words: newest ? `Done · old mail, filed ${shortDay(newest, nowIso)}` : 'Done · old mail, filed for the record',
      tip: 'Old mail, filed for the record. It asked nobody for a reply. Reopen puts it on Follow up.',
    }
  }
  return null
}
