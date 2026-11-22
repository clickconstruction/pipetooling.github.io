/**
 * The phone's bars under the new phone layout (`newPhoneLayout.ts`): what the top bar holds, what moves
 * into the gear menu, and the sizes the three bars are drawn at.
 *
 * Before the switch a helper's Dashboard gave about 310 px of a phone to its bars: the Home Screen offer,
 * a row of up to eight icons with no words, the day's presses on two rows and the tabs. With the switch
 * on the top bar is one row: the menu where the role has one, the page's name in words, Search, the green
 * phone and the gear. Every other press of the old row is a named row at the top of the gear menu, in the
 * row's own order, opening what it opened. Nothing is dropped: `phoneBarPlan` only sorts the presses a
 * person already has into three places, and its test holds that the three add up to the row it was given.
 *
 * Layout names the presses this person's row holds today, in the row's order; this kernel never asks who
 * the person is, so a new role or a new gate changes no rule here.
 */

/** A press of the phone's top row as it is drawn before the switch, named by what it does. */
export type PhoneBarPress =
  | 'menu'
  | 'home'
  | 'statement'
  | 'search'
  | 'tell-the-dev'
  | 'call-office'
  | 'task-dispatch'
  | 'ask-estimating'
  | 'task'
  | 'new-bid'
  | 'customers'
  | 'people'
  | 'gear'

/** The old row's order, left to right. Layout lists a person's presses in this order. */
export const PHONE_BAR_ORDER: readonly PhoneBarPress[] = [
  'menu',
  'home',
  'statement',
  'search',
  'tell-the-dev',
  'call-office',
  'task-dispatch',
  'ask-estimating',
  'task',
  'new-bid',
  'customers',
  'people',
  'gear',
]

/** Each press in words: its row's name in the gear menu, and its name in a report of where it went. */
export const PHONE_BAR_PRESS_NAMES: Readonly<Record<PhoneBarPress, string>> = {
  menu: 'Menu',
  home: 'Dashboard',
  statement: 'Statement',
  search: 'Search',
  'tell-the-dev': 'Tell the dev',
  'call-office': 'Call the office',
  'task-dispatch': 'Task Dispatch',
  'ask-estimating': 'Ask estimating',
  task: 'Task',
  'new-bid': 'New Bid',
  customers: 'Customers',
  people: 'People',
  gear: 'Settings',
}

/**
 * The presses that keep a place in the one-row bar: the menu, Search, the green phone and the gear, and the
 * Bids page's own **Bid** press, which is that page's main press and has its words on it. Home is decided
 * apart (`dashboardTab`).
 */
const STAYS_IN_BAR: ReadonlySet<PhoneBarPress> = new Set(['menu', 'search', 'call-office', 'new-bid', 'gear'])

export type PhoneBarPlan = {
  /** The top bar, in order: the menu and home at the left, then Search, the phone, Bid and the gear at the right. */
  bar: PhoneBarPress[]
  /** The rows at the top of the gear menu, in the old row's order. */
  gearRows: PhoneBarPress[]
  /** Presses a bottom tab already is, so they are drawn nowhere else: home, while a tab opens the Dashboard. */
  onTabs: PhoneBarPress[]
}

/**
 * Where each press of today's row goes.
 *
 * - `dashboardTab`: a bottom tab opens the Dashboard (Job Mode's tabs). Home then leaves the bar, since the
 *   tab under the thumb is the same press. Dispatch Mode's first tab opens the Dispatch home, not the
 *   Dashboard, so there home stays.
 * - A row with no gear (the role dock, whose More sheet stands in for the gear) has nowhere to move a press
 *   to, so it keeps every press it has.
 */
export function phoneBarPlan(today: readonly PhoneBarPress[], facts: { dashboardTab: boolean }): PhoneBarPlan {
  const ordered = PHONE_BAR_ORDER.filter((p) => today.includes(p))
  if (!ordered.includes('gear')) return { bar: ordered, gearRows: [], onTabs: [] }
  const bar: PhoneBarPress[] = []
  const gearRows: PhoneBarPress[] = []
  const onTabs: PhoneBarPress[] = []
  for (const press of ordered) {
    if (press === 'home') (facts.dashboardTab ? onTabs : bar).push(press)
    else if (STAYS_IN_BAR.has(press)) bar.push(press)
    else gearRows.push(press)
  }
  return { bar, gearRows, onTabs }
}

/** Where a press is with the switch on, in words, for the list of every role's presses. */
export function phoneBarWhere(plan: PhoneBarPlan, press: PhoneBarPress): 'top bar' | 'gear menu' | 'Dashboard tab' | null {
  if (plan.bar.includes(press)) return 'top bar'
  if (plan.gearRows.includes(press)) return 'gear menu'
  if (plan.onTabs.includes(press)) return 'Dashboard tab'
  return null
}

/** The top bar is one row this tall or less, with its bottom line. */
export const PHONE_BAR_MAX_HEIGHT_PX = 52
/** Every press in the top bar is at least this tall and this wide. */
export const PHONE_BAR_PRESS_PX = 44
/** The room above and below the presses: 3 + 44 + 3 and the 1 px line is 51. */
export const PHONE_BAR_PAD_Y_PX = 3
/** The tabs keep their words and stand this tall or more, before the phone's own inset at the foot. */
export const PHONE_TABS_MIN_HEIGHT_PX = 52
/** The day's presses are one row this tall: the main press and the compact ones beside it. */
export const PHONE_DAY_PRESS_ROW_PX = 52
/** A compact press of that row is at least this tall, whatever the row. */
export const PHONE_DAY_PRESS_COMPACT_MIN_PX = 44

/** The pages the app's own words name better than the address does. Keyed by the path's first segments. */
const PAGE_NAMES: Readonly<Record<string, string>> = {
  dashboard: 'Dashboard',
  // Dispatch Mode's pages, in the words a pin to them reads (`pinnedTabs.ts`).
  'dispatch-mode': 'Dispatch',
  'dispatch-mode/schedule': 'Dispatch Schedule',
  'dispatch-mode/inbox': 'Dispatch Inbox',
  'dispatch-mode/customers': 'Dispatch Customers',
  'dispatch-mode/po': 'Dispatch PO',
  // Job Mode's pages, in the words of the tab that is lit under them.
  'job-mode/schedule': 'Schedule',
  'job-mode/inbox': 'Inbox',
  'job-mode/customers': 'Customers',
  customers: 'Customers',
  developments: 'Development',
  projects: 'Projects',
  workflows: 'Project workflow',
  jobs: 'Jobs',
  'accounts-receivable': 'Accounts receivable',
  'bills-sent': 'Bills sent',
  'in-kind': 'In kind',
  'legal-desk': 'Legal desk',
  'lien-desk': 'Lien desk',
  'projects-board': 'Projects board',
  'schedule-dispatch': 'Schedule',
  banking: 'Banking',
  quickfill: 'Quickfill',
  bridge: 'The Bridge',
  gc: 'GC projects',
  messages: 'Messages',
  training: 'Training',
  moneyfill: 'Moneyfill',
  partnerships: 'Partnerships',
  'my-statement': 'Statement',
  logbook: 'Logbook',
  'my-logbook': 'My logbook',
  people: 'People',
  calendar: 'Calendar',
  map: 'Map',
  templates: 'Templates',
  materials: 'Materials',
  estimates: 'Estimates',
  documents: 'Documents',
  duplicates: 'Duplicates',
  bids: 'Bids',
  prospects: 'Prospects',
  checklist: 'Checklist',
  roadmap: 'Roadmap',
  'punch-list': 'Punch list',
  'first-looks': 'First looks',
  'first-look': 'First look',
  tally: 'Tally',
  m: 'Machine',
  settings: 'Settings',
  help: 'Help',
}

/** A path segment as words, for a page with no name of its own here: `some-new-page` reads Some new page. */
function segmentWords(segment: string): string {
  const words = segment.replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : ''
}

/**
 * The page's name in words, for the top bar. The first two segments are tried, then the first, then the
 * first segment written out as words, so a page added later still reads as something. The Dashboard is the
 * name for the root address, which the app opens the Dashboard at.
 */
export function phoneBarPageName(pathname: string): string {
  const segments = (pathname ?? '').split('/').filter(Boolean)
  const first = segments[0] ?? ''
  if (!first) return PAGE_NAMES.dashboard!
  const two = segments.length > 1 ? PAGE_NAMES[`${first}/${segments[1]}`] : undefined
  return two ?? PAGE_NAMES[first] ?? (segmentWords(first) || PAGE_NAMES.dashboard!)
}
