/**
 * Punch list #140 PR 4: **Nudge fills the words**. Waiting on them's Nudge, and *Text Greg* on Nudges from the flow,
 * open the thread with the reply box already holding the reminder for the person's step, as the morning run would send
 * it (`nudgeLine`, the one place the words come from), and the send window open: one read, one press. A text that did
 * not deliver opens the same words as an email instead. Pure: the draft from the step on now and the team's lines; the
 * thread's URL carries the ask (`?nudge=text|email`, `useThreadWindow`), and the box (`ReplyBox`'s `nudge`) resolves it
 * from the reads it already makes.
 */
import type { ContactKind } from '../contacts/kernel'
import { contactFlowKind } from '../flows/facts'
import { nudgeLine, type NudgeLineStep } from '../flows/nudgeDispatch'
import type { QuickReply } from '../quickReplies/kernel'

/** How the nudge goes: as the step asks, a text, or as an email when the text cannot go. */
export type NudgeKind = 'text' | 'email'

export interface NudgeDraft {
  kind: NudgeKind
  words: string
}

/** Whom the draft is for: their first name, their kind, and the step on now for them, as the box's `useFlowNow` reads it. */
export interface NudgeAt {
  first: string
  kind: ContactKind
  step: NudgeLineStep | null
}

/** The words when the person is on no step: a plain check-in. */
export function nudgeFallback(first: string): string {
  return `${first.trim() || 'Hi'}, checking in. Anything you need from us?`
}

/** The URL's kind, or null for a value that is not one. */
export function nudgeKindOf(raw: string | null | undefined): NudgeKind | null {
  return raw === 'text' || raw === 'email' ? raw : null
}

/**
 * The draft for the box: the step's reminder line (the team's quick reply for the step, else the step's own words,
 * else a check on a paper of theirs, else a check-in on the step), or the plain check-in when they are on no step or
 * their flow could not be read. The link is each person's own and rides the send (their portal, when it is on), so none
 * goes in the words here, as Job Mode's sample does.
 */
export function nudgeDraftFor(at: NudgeAt, quickReplies: readonly QuickReply[] = [], link: string | null = null, kind: NudgeKind = 'text'): NudgeDraft {
  const first = at.first.trim() || 'Hi'
  const words = at.step ? nudgeLine({ first, reading: { kind: contactFlowKind(at.kind) } }, at.step, quickReplies, link) : nudgeFallback(first)
  return { kind, words }
}
