/**
 * The question a punch-list card waits on (punch list #438). A card's front matter may carry one line,
 *
 *     ask: owner · walk · Walk the pace card with one superintendent, on his own phone.
 *
 * which says who the card waits on, what kind of thing is asked of them and the question itself, as a
 * sentence that person can act on. The Next line stays the next act of the work; the ask is what a
 * person must say or do before it. The board reads it so a person can see the questions that wait on
 * them without opening a card (Diane's ask of 2026-11-24).
 *
 * Pure: a string in, the ask or the reason it does not read out.
 */

/** Who a card can wait on. `anyone` is a person at hand, for a walk that needs one. `time` is a dated wait. */
export const ASK_WHO = ['owner', 'office', 'anyone', 'counsel', 'time', 'dev'] as const
export type AskWho = (typeof ASK_WHO)[number]

export const ASK_WHO_LABEL: Record<AskWho, string> = {
  owner: 'The owner',
  office: 'The office',
  anyone: 'Anyone at hand',
  counsel: 'Counsel',
  time: 'Time',
  dev: 'A dev',
}

/** What is asked: open a screen and say, read a text through, be there for a walk, pick among answers, use it for a while. */
export const ASK_KINDS = ['look', 'read', 'walk', 'decide', 'use'] as const
export type AskKind = (typeof ASK_KINDS)[number]

export const ASK_KIND_LABEL: Record<AskKind, string> = { look: 'Look', read: 'Read', walk: 'Walk', decide: 'Decide', use: 'Use' }

export interface CardAsk {
  who: AskWho
  kind: AskKind
  /** One sentence, ending in a full stop or a question mark. */
  question: string
}

/** The parts' divider, the middle dot the cards' status lines already use. */
const DIVIDER = ' · '

/** A question longer than this does not fit a row; the card's prose is the place for the rest. */
export const ASK_QUESTION_MAX = 160

/**
 * `owner · walk · Walk it with one superintendent.` -> the ask. An empty value is no ask (null).
 * Anything else that does not read is a problem, in words `check:todos` prints as they are.
 */
export function parseAsk(raw: string | null | undefined): { ask: CardAsk } | { problem: string } | null {
  const text = (raw ?? '').trim()
  if (!text) return null
  const parts = text.split(DIVIDER)
  if (parts.length < 3) {
    return { problem: `ask "${text}" is not who · kind · question (three parts, each divided by " · ").` }
  }
  const who = (parts[0] ?? '').trim().toLowerCase()
  const kind = (parts[1] ?? '').trim().toLowerCase()
  // The question may hold the divider itself; everything after the second one is the question.
  const question = parts.slice(2).join(DIVIDER).trim()
  if (!isAskWho(who)) return { problem: `ask names "${parts[0]?.trim() ?? ''}" as who it waits on, which is not one of ${ASK_WHO.join(', ')}.` }
  if (!isAskKind(kind)) return { problem: `ask names "${parts[1]?.trim() ?? ''}" as its kind, which is not one of ${ASK_KINDS.join(', ')}.` }
  if (!question) return { problem: 'ask has no question after its who and its kind.' }
  if (!/[.?]$/.test(question)) return { problem: `ask's question "${question}" does not end in a full stop or a question mark.` }
  if (question.length > ASK_QUESTION_MAX) {
    return { problem: `ask's question is ${question.length} characters, over the ${ASK_QUESTION_MAX} a row holds. Say it shorter and keep the rest in the card.` }
  }
  return { ask: { who, kind, question } }
}

export function isAskWho(value: string): value is AskWho {
  return (ASK_WHO as readonly string[]).includes(value)
}

export function isAskKind(value: string): value is AskKind {
  return (ASK_KINDS as readonly string[]).includes(value)
}

/** The front-matter line for an ask, as `parseAsk` reads it back. */
export function formatAsk(ask: CardAsk): string {
  return [ask.who, ask.kind, ask.question].join(DIVIDER)
}
