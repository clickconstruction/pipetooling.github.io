/**
 * People page tab groups (v2.2811).
 *
 * The People page kept growing tabs — eighteen for a dev — until the strip scrolled on a
 * laptop and hid the page title on a phone. Every view is kept; they are arranged as
 * sub-tabs under six top-level groups. The URL is unchanged: `?tab=<view key>` still
 * addresses a view directly, so every bookmark, Dashboard card, and hand-off link that
 * existed before keeps working. The group is derived from the view, never stored.
 *
 * Pure: no React, no storage. `People.tsx` owns the gates and the localStorage memory.
 */

export type PeopleTab =
  | 'scoreboard'
  | 'review'
  | 'hr'
  | 'person'
  | 'users'
  | 'subs'
  | 'overhead'
  | 'employment'
  | 'pay_stubs'
  | 'hours'
  | 'offsets'
  | 'vehicles'
  | 'housing'
  | 'licenses'
  | 'contracts'
  | 'writeups'
  | 'feedback'
  | 'activity'

export type PeopleTabGroupId = 'people' | 'pay' | 'paperwork' | 'fleet' | 'review' | 'feedback'

export type PeopleTabGroup = {
  id: PeopleTabGroupId
  label: string
  /** Views in display order; the first visible one is the group's default landing view. */
  views: readonly PeopleTab[]
}

/** Every People tab, in the order the strip shows them. */
export const PEOPLE_TABS: readonly PeopleTab[] = [
  'users',
  'subs',
  'person',
  'hours',
  'pay_stubs',
  'offsets',
  'employment',
  'overhead',
  'contracts',
  'licenses',
  'writeups',
  'hr',
  'vehicles',
  'housing',
  'review',
  'scoreboard',
  'activity',
  'feedback',
]

/** Sub-tab labels. `pay_stubs` has always been shown as Payroll. */
export const PEOPLE_TAB_LABELS: Record<PeopleTab, string> = {
  users: 'Users',
  subs: 'Subs',
  person: 'Person',
  hours: 'Hours',
  pay_stubs: 'Payroll',
  offsets: 'Offsets',
  employment: 'Employment',
  overhead: 'Overhead',
  contracts: 'Contracts',
  licenses: 'Licenses',
  writeups: 'Writeups',
  hr: 'HR',
  vehicles: 'Vehicles',
  housing: 'Housing',
  review: 'Review',
  scoreboard: 'Scoreboard',
  activity: 'Activity',
  feedback: 'Feedback',
}

export const PEOPLE_TAB_GROUPS: readonly PeopleTabGroup[] = [
  { id: 'people', label: 'People', views: ['users', 'subs', 'person'] },
  { id: 'pay', label: 'Pay', views: ['hours', 'pay_stubs', 'offsets', 'employment', 'overhead'] },
  { id: 'paperwork', label: 'Paperwork', views: ['contracts', 'licenses', 'writeups', 'hr'] },
  { id: 'fleet', label: 'Fleet & Housing', views: ['vehicles', 'housing'] },
  { id: 'review', label: 'Review', views: ['review', 'scoreboard', 'activity'] },
  { id: 'feedback', label: 'Feedback', views: ['feedback'] },
]

const GROUP_OF_TAB: Record<PeopleTab, PeopleTabGroupId> = (() => {
  const out = {} as Record<PeopleTab, PeopleTabGroupId>
  for (const g of PEOPLE_TAB_GROUPS) for (const v of g.views) out[v] = g.id
  return out
})()

export function isPeopleTab(value: unknown): value is PeopleTab {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PEOPLE_TAB_LABELS, value)
}

/** The group a view lives under. Total: every PeopleTab belongs to exactly one group. */
export function groupOfTab(tab: PeopleTab): PeopleTabGroupId {
  return GROUP_OF_TAB[tab]
}

/** A group with only the views the current user may open. */
export type VisiblePeopleTabGroup = PeopleTabGroup & { views: PeopleTab[] }

/**
 * Groups to draw in the strip for a user who may open `visible` views. A group appears
 * when any of its views would have appeared as a tab before; a group with nothing to show
 * is dropped, so the office (no Review / Feedback views) sees four tabs.
 */
export function visibleTabGroups(visible: Partial<Record<PeopleTab, boolean>>): VisiblePeopleTabGroup[] {
  const out: VisiblePeopleTabGroup[] = []
  for (const g of PEOPLE_TAB_GROUPS) {
    const views = g.views.filter((v) => visible[v] === true)
    if (views.length > 0) out.push({ ...g, views })
  }
  return out
}

/**
 * Where a click on a group tab lands: the view the user last used in that group when it is
 * still visible to them, else the group's first visible view. `null` when the group has no
 * visible view (the strip does not draw such a group, so callers rarely see this).
 */
export function landingViewForGroup(
  group: VisiblePeopleTabGroup,
  remembered: Partial<Record<PeopleTabGroupId, PeopleTab>>,
): PeopleTab | null {
  const r = remembered[group.id]
  if (r && group.views.includes(r)) return r
  return group.views[0] ?? null
}

/** localStorage key for the per-group last-view memory (a JSON object keyed by group id). */
export const PEOPLE_TAB_GROUP_MEMORY_KEY = 'people.tabGroupMemory.v1'

/** Parse the stored memory, dropping anything that is not a known group → known view of that group. */
export function parseGroupMemory(raw: string | null | undefined): Partial<Record<PeopleTabGroupId, PeopleTab>> {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== 'object') return {}
  const out: Partial<Record<PeopleTabGroupId, PeopleTab>> = {}
  for (const g of PEOPLE_TAB_GROUPS) {
    const v = (parsed as Record<string, unknown>)[g.id]
    if (isPeopleTab(v) && groupOfTab(v) === g.id) out[g.id] = v
  }
  return out
}

/** The memory after visiting `tab`: that tab becomes its group's remembered view. */
export function rememberTab(
  memory: Partial<Record<PeopleTabGroupId, PeopleTab>>,
  tab: PeopleTab,
): Partial<Record<PeopleTabGroupId, PeopleTab>> {
  const g = groupOfTab(tab)
  if (memory[g] === tab) return memory
  return { ...memory, [g]: tab }
}
