import { TODO_TAG_PARAM, type CallTodo } from './callTodo'

/**
 * Where each thing on the Bridge's list stands as a to-do (punch list #334, PR 9).
 *
 * The owner: "I would like to see the checkmark in light gray and when someone clicks it makes the check blue until
 * the task is complete, so someone can click the box and see a modal of the task and who it's assigned to and when
 * it was assigned, and once it's done the task can go back to able to be assigned."
 *
 * So every line carries a check with four readings:
 *   - nobody has it: a grey check, and a press makes the card;
 *   - someone has it: a blue check with the name and how long, and a press shows the card;
 *   - it has waited too long: the same in amber (past its due day, or `TODO_LATE_DAYS` with no due day);
 *   - it was finished: grey again, so it can be handed out again, with who finished it and when for a while. The
 *     line beside it is today's reading, so a card closed without its result shows at a glance.
 *
 * A customer's card covers its projects: a project under it reads *covered* and its press shows the customer's card.
 *
 * The page finds a card again by the tag its first link carries (`todoLinkPaths`). Pure: no React, no Supabase.
 */

/** Days a card may wait before its check turns amber, when it has no due day of its own. */
export const TODO_LATE_DAYS = 3
/** Days a finished card stays named on its line. */
export const TODO_DONE_SHOWN_DAYS = 14

/** One to-do card as the page reads it. Dates are local days. */
export type TodoCard = {
  itemId: string
  title: string
  links: string[]
  madeYmd: string
  dueYmd: string | null
  /** The people it is with, by name, in the card's order. */
  who: string[]
  /** One per scheduled day: the day it was finished, null while it is open. */
  instances: Array<{ id: string; doneYmd: string | null; doneBy: string | null }>
}

export type TodoState =
  | { kind: 'none' }
  | { kind: 'open'; card: TodoCard; who: string; days: number; late: boolean }
  | { kind: 'done'; card: TodoCard; who: string; doneYmd: string }
  /** A project under a customer whose own card is open. */
  | { kind: 'covered'; card: TodoCard; who: string }

export const NO_TODO: TodoState = { kind: 'none' }

const dayNumber = (ymd: string): number => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))) / 86_400_000
const daysFrom = (fromYmd: string, toYmd: string): number => Math.round(dayNumber(toYmd) - dayNumber(fromYmd))
const first = (name: string): string => name.trim().split(/\s+/)[0] ?? ''

/** The people on a card in a few words: *Dana*, *Dana and Sam*, *Dana and 2 more*, or *Nobody yet*. */
export function whoWords(names: ReadonlyArray<string>): string {
  const firsts = names.map(first).filter(Boolean)
  if (firsts.length === 0) return 'Nobody yet'
  if (firsts.length === 1) return firsts[0] ?? ''
  if (firsts.length === 2) return `${firsts[0]} and ${firsts[1]}`
  return `${firsts[0]} and ${firsts.length - 1} more`
}

/** The tag a link carries, or null for a link that is not a Bridge to-do's. */
export function todoKeyOfLink(link: string): string | null {
  const q = link.indexOf('?')
  if (q < 0) return null
  const key = new URLSearchParams(link.slice(q + 1).split('#')[0]).get(TODO_TAG_PARAM)
  return key && key.trim() ? key.trim() : null
}

/** Where one card stands today. */
function stateOf(card: TodoCard, todayYmd: string): TodoState {
  const open = card.instances.length === 0 || card.instances.some((i) => i.doneYmd == null)
  if (open) {
    const days = Math.max(0, daysFrom(card.madeYmd, todayYmd))
    const late = card.dueYmd ? todayYmd > card.dueYmd : days >= TODO_LATE_DAYS
    return { kind: 'open', card, who: whoWords(card.who), days, late }
  }
  const last = card.instances.reduce<{ doneYmd: string; doneBy: string | null } | null>((best, i) => (i.doneYmd && (!best || i.doneYmd > best.doneYmd) ? { doneYmd: i.doneYmd, doneBy: i.doneBy } : best), null)
  if (!last || daysFrom(last.doneYmd, todayYmd) > TODO_DONE_SHOWN_DAYS) return NO_TODO
  return { kind: 'done', card, who: last.doneBy ? first(last.doneBy) : whoWords(card.who), doneYmd: last.doneYmd }
}

/** Every tagged card → the state of the thing it is about. An open card wins over a finished one; then the newest. */
export function todoStates(cards: ReadonlyArray<TodoCard>, todayYmd: string): Map<string, TodoState> {
  const out = new Map<string, TodoState>()
  const rank = (s: TodoState): number => (s.kind === 'open' ? 2 : s.kind === 'done' ? 1 : 0)
  const made = (s: TodoState): string => (s.kind === 'none' ? '' : s.card.madeYmd)
  for (const card of cards) {
    const state = stateOf(card, todayYmd)
    if (state.kind === 'none') continue
    for (const link of card.links) {
      const key = todoKeyOfLink(link)
      if (!key) continue
      const had = out.get(key)
      if (!had || rank(state) > rank(had) || (rank(state) === rank(had) && made(state) > made(had))) out.set(key, state)
    }
  }
  return out
}

/** A line's state; a project with no card of its own under a customer whose card is open reads as covered. */
export function todoStateFor(states: ReadonlyMap<string, TodoState> | null | undefined, todo: CallTodo | undefined, parent?: CallTodo): TodoState {
  if (!states || !todo) return NO_TODO
  const own = states.get(todo.key)
  if (own && own.kind === 'open') return own
  const above = parent ? states.get(parent.key) : undefined
  if (above && above.kind === 'open') return { kind: 'covered', card: above.card, who: above.who }
  return own ?? NO_TODO
}

const daysWords = (n: number): string => (n <= 0 ? 'today' : n === 1 ? '1 day' : `${n} days`)

/** The few words beside the check. Empty when nobody has it and nobody finished it. */
export function todoStateWords(state: TodoState, dayLabel: (ymd: string) => string): string {
  if (state.kind === 'open') return `${state.who}, ${daysWords(state.days)}`
  if (state.kind === 'done') return `${state.who} finished ${dayLabel(state.doneYmd)}`
  if (state.kind === 'covered') return `With ${state.who}`
  return ''
}

/** What a screen reader hears on the check. */
export function todoCheckLabel(todo: CallTodo, state: TodoState, dayLabel: (ymd: string) => string): string {
  if (state.kind === 'open') return `See the to-do. ${state.who} has had it ${state.days <= 0 ? 'since today' : `for ${daysWords(state.days)}`}${state.late ? ', and it has waited too long' : ''}: ${state.card.title}`
  if (state.kind === 'covered') return `See the customer’s to-do, with ${state.who}: ${state.card.title}`
  if (state.kind === 'done') return `Make a to-do again. ${state.who} finished the last one ${dayLabel(state.doneYmd)}: ${todo.title}`
  return `Make a to-do: ${todo.title}`
}

/** How many of a customer's projects are with someone, for the customer's own line. Empty when none is. */
export function handedOutWords(states: ReadonlyMap<string, TodoState> | null | undefined, projects: ReadonlyArray<CallTodo | undefined>): string {
  if (!states || projects.length === 0) return ''
  const n = projects.filter((p) => p && states.get(p.key)?.kind === 'open').length
  return n > 0 ? `${n} of ${projects.length} handed out` : ''
}

/** The lines of the window a blue check opens: who has it, since when, when it is due. */
export function todoWindowLines(state: Extract<TodoState, { kind: 'open' | 'covered' | 'done' }>, todayYmd: string, dayLabel: (ymd: string) => string): string[] {
  const card = state.card
  const out: string[] = []
  out.push(card.who.length > 0 ? `${whoWords(card.who)} ${card.who.length === 1 ? 'has' : 'have'} it.` : 'Nobody is on it yet.')
  const days = Math.max(0, daysFrom(card.madeYmd, todayYmd))
  out.push(`Handed over ${dayLabel(card.madeYmd)}, ${days <= 0 ? 'today' : `${daysWords(days)} ago`}.`)
  if (state.kind === 'done') out.push(`Finished ${dayLabel(state.doneYmd)}.`)
  else if (card.dueYmd) out.push(todayYmd > card.dueYmd ? `It was due ${dayLabel(card.dueYmd)}.` : `Due ${dayLabel(card.dueYmd)}.`)
  else if (state.kind === 'open' && state.late) out.push(`It has waited more than ${TODO_LATE_DAYS - 1} days.`)
  return out
}
