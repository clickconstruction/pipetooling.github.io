/**
 * The hand-to menu's order and search (v2.6506). Grace, 2026-11-04, on the who-has-it pill's menu: she wants to
 * start typing to find a person, and the assistants and estimators at the top. The menu lists the team in three
 * groups, each by name: the office and the estimators first (assistant, controller, estimator — the people who
 * answer customers all day), then the owner and the devs, then anyone else the read lets through. The order is by
 * role, never by who holds the most waiting: a busy person is not promoted, as Grace asked. The search is one typed
 * run against the name, case-blind, lit where it landed (`splitTextForQueryHighlight`); the keys walk a flat list
 * of the rows the menu draws. Pure: `WhoHasItPill` draws it.
 */

export type HandToGroupKey = 'office' | 'ownerDev' | 'others'

export interface HandToGroup<T> {
  key: HandToGroupKey
  /** The thin heading over the group: "Office and estimators". */
  heading: string
  people: T[]
}

export const HAND_TO_HEADINGS: Readonly<Record<HandToGroupKey, string>> = {
  office: 'Office and estimators',
  ownerDev: 'Owner and devs',
  others: 'Everyone else',
}

const GROUP_ORDER: readonly HandToGroupKey[] = ['office', 'ownerDev', 'others']

/** Which group a role sits in. */
export function handToGroupOf(role: string): HandToGroupKey {
  if (role === 'assistant' || role === 'controller' || role === 'estimator') return 'office'
  if (role === 'master_technician' || role === 'dev') return 'ownerDev'
  return 'others'
}

/** The team in the menu's order: the three groups, each by name, an empty group left out. */
export function orderHandTo<T extends { name: string; role: string }>(team: readonly T[]): HandToGroup<T>[] {
  const by = new Map<HandToGroupKey, T[]>(GROUP_ORDER.map((k) => [k, []]))
  for (const t of team) by.get(handToGroupOf(t.role))!.push(t)
  return GROUP_ORDER.map((key) => ({ key, heading: HAND_TO_HEADINGS[key], people: by.get(key)!.sort((a, b) => a.name.localeCompare(b.name)) })).filter((g) => g.people.length > 0)
}

/** Whether a typed run lands on a name: case-blind, any part of the name; nothing typed matches everyone. */
export function handToMatches(name: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return name.toLowerCase().includes(q)
}

/** The groups with only the people the typed run lands on, a group with nobody left out. */
export function filterHandTo<T extends { name: string }>(groups: readonly HandToGroup<T>[], query: string): HandToGroup<T>[] {
  return groups.map((g) => ({ ...g, people: g.people.filter((p) => handToMatches(p.name, query)) })).filter((g) => g.people.length > 0)
}

/** The lit row after an arrow key: down from the last wraps to the first, up from the first to the last; nothing to light stays nowhere. */
export function nextLit(lit: number, count: number, delta: -1 | 1): number {
  if (count <= 0) return -1
  if (lit < 0) return delta === 1 ? 0 : count - 1
  return (lit + delta + count) % count
}
