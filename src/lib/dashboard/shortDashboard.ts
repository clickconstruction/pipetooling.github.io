import type { NeedsYouItem } from '../dashboardNeedsYou'
import { needsYouActorOf, needsYouViewerActors } from '../needsYouActor'
import type { EmptyStateWords } from '../emptyWords'

/**
 * The short Dashboard (punch list: the leader's Dashboard, distilled). A leader who will not read a page of
 * forty cards gets one list instead: the lines that wait on him alone, each with one press, then his day, then
 * one door to everything else. The full Dashboard stays for a leader who wants it: the view is a setting per
 * person (`users.dashboard_view`), and the office may set it for him.
 *
 * Since punch list #384 a superintendent takes the view too. One setting gives the short form of whichever home
 * the person uses: `shortPageFor` says which. With Job Mode off it is this page. With Job Mode on it is the short
 * Job Mode page, for a superintendent alone: a leader in Job Mode keeps the full card, as #365 decided.
 *
 * This file is the rule and the words. `splitForShortDashboard` sorts the Needs you lines three ways:
 * **waiting** (only he can do it), **alsoYours** (his by `needsYouActor`, but the office can carry it or it can
 * wait behind the door) and **office** (someone else presses the button). Pure: items and a role in, piles out.
 */
export type DashboardView = 'short' | 'full'

export const DASHBOARD_VIEWS: readonly DashboardView[] = ['short', 'full']

/** What is stored, read safely: anything but `short` is the full Dashboard, so a missing column changes nothing. */
export function parseDashboardView(value: unknown): DashboardView {
  return value === 'short' ? 'short' : 'full'
}

/**
 * The roles whose account takes a view: the leader, a dev, who is the owner's own account, and a superintendent
 * (punch list #384). `set_dashboard_view` holds the same three, so a change here is a migration too.
 */
export const DASHBOARD_VIEW_ROLES: readonly string[] = ['master_technician', 'dev', 'superintendent']

/** Whether this role's account takes a view, so the pickers show and the row is read. */
export function canHaveShortDashboard(role: string | null | undefined): boolean {
  return typeof role === 'string' && DASHBOARD_VIEW_ROLES.includes(role)
}

/** The short page a person on Short opens onto: the short Dashboard, or the short Job Mode page. */
export type ShortPage = 'dashboard' | 'job_mode'

/**
 * Which short page the role gets, by the home the person uses. Job Mode off: the short Dashboard, for every role
 * that takes a view. Job Mode on: the short Job Mode page for a superintendent, and nothing for a leader or a dev,
 * who keep the full Job Mode card. Null is no short page: the person sees the page they see today.
 */
export function shortPageFor(role: string | null | undefined, jobModeOn: boolean): ShortPage | null {
  if (!canHaveShortDashboard(role)) return null
  if (!jobModeOn) return 'dashboard'
  return role === 'superintendent' ? 'job_mode' : null
}

/** The office set that may flip another person's view: the leader, a dev and the assistant. */
export function canSetDashboardViewFor(viewerRole: string | null | undefined): boolean {
  return viewerRole === 'dev' || viewerRole === 'master_technician' || viewerRole === 'assistant'
}

/**
 * Whether this viewer may press the view on this person's row, as `set_dashboard_view` rules it: the row's role
 * must take a view, and the viewer is the office or the person himself.
 */
export function canSetDashboardView(input: { viewerRole: string | null | undefined; viewerUserId: string | null | undefined; targetUserId: string | null | undefined; targetRole: string | null | undefined }): boolean {
  if (!input.targetUserId || !canHaveShortDashboard(input.targetRole)) return false
  if (canSetDashboardViewFor(input.viewerRole)) return true
  return input.viewerUserId === input.targetUserId
}

/**
 * The lines only the leader can clear. Five are reserved for a leader by the database: a lien notice's approval
 * and its signature, a GC's run, a lien waiver's signature and the weekly look at the assumed line budgets. The
 * sixth is a job note that tagged him: a teammate is waiting on his answer and nobody can give it for him.
 * `shortDashboard.test.ts` holds every key here to a line the leader's own role presses.
 */
export const SHORT_DASHBOARD_ALONE_KEYS: ReadonlySet<NeedsYouItem['key']> = new Set<NeedsYouItem['key']>([
  'lien-notice-approve',
  'lien-notice-sign',
  'lien-notice-batch',
  'lien-waivers-to-sign',
  'line-budgets-review',
  'tagged-notes',
])

export type ShortDashboardSplit<T> = {
  /** Only he can do it: the list on the page, in the order given (worst first). */
  waiting: T[]
  /** His by the actor rule but not his alone: behind the door, and the door says how many. */
  alsoYours: T[]
  /** Someone else presses the button: the office's count line. */
  office: T[]
}

export function splitForShortDashboard<T extends Pick<NeedsYouItem, 'key'>>(items: ReadonlyArray<T>, role: string | null | undefined): ShortDashboardSplit<T> {
  const mine = needsYouViewerActors(role as Parameters<typeof needsYouViewerActors>[0])
  const out: ShortDashboardSplit<T> = { waiting: [], alsoYours: [], office: [] }
  for (const it of items) {
    if (!mine.has(needsYouActorOf(it))) out.office.push(it)
    else if (SHORT_DASHBOARD_ALONE_KEYS.has(it.key)) out.waiting.push(it)
    else out.alsoYours.push(it)
  }
  return out
}

/**
 * Whether the list can be trusted yet. The page must never say *Nothing waiting on you* while the Lien desk is
 * still being read, or after its read failed: a window can close on a paper he never saw. `reading` holds the
 * list back, `failed` shows what did arrive under a line that says the desk could not be read.
 */
export type ShortDashboardRead = 'reading' | 'ready' | 'failed'

export function shortDashboardRead(input: {
  /** The Lien desk is one of this viewer's sources. */
  lienOn: boolean
  lienHasData: boolean
  lienLoading: boolean
  /** The desk's read has started at least once, so *not loading with no data* means it failed. */
  lienStarted: boolean
  waiversLoading: boolean
  /** The list was ready once this visit: a later re-read keeps it on screen. */
  settled: boolean
}): ShortDashboardRead {
  if (input.lienOn && !input.lienHasData) {
    if (input.lienLoading || !input.lienStarted) return 'reading'
    return 'failed'
  }
  if (input.settled) return 'ready'
  return input.waiversLoading ? 'reading' : 'ready'
}

/**
 * Whether the two count lines, the office's and the door's, can be drawn yet (punch list #365, v2.8616). They count
 * every source of the Needs you card, so they are whole only when the list's read is in **and** no source is still
 * being read: until then the page drew them from the counts as they stood, and each late source moved a number under
 * the reader. The page reads *still being read* off the client's own count of requests in flight (`useSupabaseQuiet`),
 * since most of the card's sixty hooks say nothing about their read. The cap is the guard against a read that never
 * ends: after it the counts draw as they stand. Once ready they stay ready for the visit, so a re-read
 * after a press never takes the numbers away. The list keeps its own rule, `shortDashboardRead`: a paper must not
 * wait on a slow source.
 */
export type ShortDashboardCountsRead = 'reading' | 'ready'

/** The watchdog's number (`useAuth`): the longest the counts wait on a source before they draw as they stand. */
export const SHORT_DASHBOARD_COUNTS_CAP_MS = 8000

export function shortDashboardCountsRead(input: {
  listRead: ShortDashboardRead
  /** Some read the counts depend on is not in yet: today, the client has a request in flight or just had one. */
  sourcesReading: boolean
  /** The cap has passed since the page was opened. */
  capped: boolean
  /** The counts were ready once this visit. */
  settled: boolean
}): ShortDashboardCountsRead {
  if (input.listRead !== 'ready') return 'reading'
  if (input.settled || input.capped) return 'ready'
  return input.sourcesReading ? 'reading' : 'ready'
}

const things = (n: number): string => (n === 1 ? '1 thing waits on you.' : `${n} things wait on you.`)

/** Morning before noon, Afternoon until five, Evening after. */
export function shortDashboardGreeting(firstName: string, hour: number): string {
  const part = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'
  const name = firstName.trim()
  return name ? `${part}, ${name}` : part
}

export const SHORT_DASHBOARD_WORDS = {
  title: 'Waiting on you',
  /** Under the greeting while something waits. With nothing waiting the card says it, so the line is left out. */
  count: (waiting: number): string => (waiting > 0 ? things(waiting) : ''),
  reading: 'Reading what waits on you…',
  failed: 'The Lien desk could not be read, so this list may be short.',
  failedPress: 'Open the Lien desk',
  /** Empty is the good state here, and the page says what would fill it. */
  empty: { main: 'Nothing waiting on you.', tail: 'The office puts a paper here when it needs your signature or your word.' } satisfies EmptyStateWords,
  office: (n: number): string => (n <= 0 ? 'Nothing else is open.' : n === 1 ? 'The office is handling 1 other thing.' : `The office is handling ${n} other things.`),
  door: 'Everything else',
  /**
   * The door's second line: what of his own is behind it, or what the door opens. A superintendent's full
   * Dashboard holds no money, and his Clock In sits behind the door, so his line names what is his.
   */
  doorNote: (alsoYours: number, role?: string | null): string =>
    alsoYours <= 0 ? (role === 'superintendent' ? 'Clock In, your hours, your crew and the full Dashboard.' : 'Money, crew, jobs and the full Dashboard.') : alsoYours === 1 ? '1 more of yours is in there.' : `${alsoYours} more of yours are in there.`,
  rateCrew: { title: 'Rate your crew', detail: 'A few taps on the people you worked with this week.', press: 'Rate' },
  /** The full Dashboard's way back, shown to a person whose view is Short. */
  back: 'Back to the short Dashboard',
} as const

/** The setting's two choices, in the words of Settings and the People desk. */
export const DASHBOARD_VIEW_WORDS: Record<DashboardView, { label: string; hint: string }> = {
  short: { label: 'Short', hint: 'What waits on you, your day, and one door to everything else.' },
  full: { label: 'Full', hint: 'Every section, as it is today.' },
}

export const DASHBOARD_VIEW_PICKER_WORDS = {
  label: 'Dashboard view',
  /** On the People desk, about the person the desk is open on. */
  hintFor: (first: string): string => `What ${first} sees when the app opens. The office can set it for them.`,
  /** In Settings, about the viewer. */
  hintSelf: 'What you see when the app opens.',
  notSaved: 'The view was not saved.',
} as const

/**
 * The bottom bar's Dashboard tab for a person on Short (punch list #365, PR 4): the short page, whichever mode is
 * on. With Dispatch Mode on the tab opened the Dispatch home, a second home that is not the page the app opens on.
 * The press carries `SHORT_DASHBOARD_HOME_STATE`, so a person who went through **Everything else** is back on
 * the short page: the tab is the way home.
 */
export const SHORT_DASHBOARD_PATH = '/dashboard'
export const SHORT_DASHBOARD_HOME_STATE = { shortHome: true } as const

/** Whether a navigation came from the bar's Dashboard tab of a person on Short. */
export function isShortDashboardHomePress(state: unknown): boolean {
  return typeof state === 'object' && state !== null && (state as { shortHome?: unknown }).shortHome === true
}

/** Where the view is remembered on this device, so the page does not draw Full and then swap to Short. */
export function dashboardViewStorageKey(userId: string): string {
  return `dashboard_view_${userId}`
}
