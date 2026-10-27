/**
 * Empty words for People, pay and hiring (punch list #184, sweep C): what each list in the area
 * says when it has no rows, in `EmptyState`'s shape (`main`, the press, `tail`). The rule is
 * `emptyWords.ts`'s: a list says what fills it and offers the press, a search with no match quotes
 * the search and offers Clear the search, and a list whose empty is the good state says so. Each
 * helper takes the surface's own handler, so the words and the press travel together and the
 * component only wires them. Where the press needs typing first (a date, a reading, an entry),
 * the words name the control instead. `peopleEmptyWords.test.ts` holds every sentence to plain words.
 */
import type { PersonKind } from '../../hooks/usePeopleRoster'
import { emptyWords, emptyWordsWithPress, type EmptyStateWords } from '../emptyWords'
import { OVERHEAD_PEOPLE_WINDOWS, type OverheadPeopleWindowKey } from '../overheadPeopleTable'
import type { SpendingPeriod } from './spendingPeriod'

type Press = () => void

/** People → Users, the page a roster fills from. */
export const PEOPLE_USERS_PATH = '/people?tab=users'

// People lists: a search, a filter chip

/** A people list a search emptied: *Nobody matches ‘Marisol’. Clear the search ▸* */
export function nobodyMatchesWords(query: string, clearSearch: Press): EmptyStateWords {
  return { main: `Nobody matches ‘${query.trim()}’.`, next: { label: 'Clear the search', onPress: clearSearch } }
}

/** A people list a filter chip emptied, where the chip that shows everyone is Everyone. */
export function nobodyUnderFilterWords(showEveryone: Press): EmptyStateWords {
  return { main: 'Nobody matches this filter.', next: { label: 'Everyone', onPress: showEveryone }, tail: 'shows the whole roster.' }
}

/** A list of things a search emptied, in the kernel's words: *No pay reports match ‘Ana’. Clear the search ▸* */
export function searchEmptyWords(noun: string, query: string, clearSearch: Press): EmptyStateWords {
  return emptyWordsWithPress(emptyWords({ kind: 'filter', noun, query }), { onPress: clearSearch })
}

// People → Users: the roster groups and the Link account window

/** The Hire window's button on People → Users, the press that makes a new person. */
export const HIRE_CONTROL = '+ Hire'

/** Each roster group's plural noun, for *No estimators yet.* */
export const ROSTER_GROUP_NOUN: Record<PersonKind | 'dev', string> = {
  assistant: 'assistants',
  controller: 'controllers',
  master_technician: 'leaders',
  sub: 'subcontractors',
  helper: 'helpers',
  estimator: 'estimators',
  primary: 'primaries',
  superintendent: 'superintendents',
  dev: 'devs',
}

/**
 * A roster group with nobody in it: *No estimators yet. + Hire adds the first.* The caller passes
 * the press: the Hire window on the group's kind, the group's own Add when the viewer has no Hire,
 * or null when the viewer adds nobody, and then the sentence stands alone.
 */
export function rosterGroupEmptyWords(group: PersonKind | 'dev', press: { label: string; onPress: Press } | null): EmptyStateWords {
  const noun = ROSTER_GROUP_NOUN[group]
  if (!press) return { main: `No ${noun} yet.` }
  return emptyWordsWithPress(emptyWords({ kind: 'make', noun, control: press.label }), { onPress: press.onPress })
}

/** The Link account window with no account free to link: + Hire makes the account first. */
export function linkAccountEmptyWords(roleLabel: string | null, hire: Press | null): EmptyStateWords {
  const main = roleLabel ? `No unlinked ${roleLabel.toLowerCase()} accounts to link.` : 'No unlinked accounts to link.'
  return hire ? { main, next: { label: HIRE_CONTROL, onPress: hire }, tail: 'makes the account first.' } : { main }
}

/** People → Subs with no subcontractor on the roster: + Hire opens the Hire window on Subcontractor. */
export function subsRosterEmptyWords(hire: Press | null): EmptyStateWords {
  const words = emptyWords({ kind: 'make', noun: 'subs', control: HIRE_CONTROL })
  return hire ? emptyWordsWithPress(words, { onPress: hire }) : { main: words.main }
}

// People → Employment and Contracts

/** People → Employment's roster column: a search with no match, or nobody on the roster at all. */
export function employmentRosterEmptyWords(query: string, clearSearch: Press): EmptyStateWords {
  if (query.trim()) return nobodyMatchesWords(query, clearSearch)
  return { main: 'Nobody on the roster yet.', next: { label: 'Users', to: PEOPLE_USERS_PATH }, tail: 'is where you hire.' }
}

/** A person's Time off list on People → Employment: the form below it adds one, so the words name it. */
export const TIME_OFF_EMPTY: EmptyStateWords = { main: 'No time off yet.', tail: 'Pick the dates below and press Add time off.' }

/** Contracts' Agreements panel before any document exists: the Contract library adds them. */
export function agreementsEmptyWords(openLibrary: Press | null): EmptyStateWords {
  return openLibrary
    ? { main: 'No agreements yet.', next: { label: 'Contract library', onPress: openLibrary }, tail: 'adds the documents.' }
    : { main: 'No agreements yet.', tail: 'The Contract library adds the documents.' }
}

// Pay: the ledger, the payments, the offsets, the forecast

/** The pay ledger's people column: a search, a group chip, or nobody with a pay report. */
export function payLedgerRosterEmptyWords(s: { query: string; filtered: boolean; clearSearch: Press; showAll: Press }): EmptyStateWords {
  if (s.query.trim()) return nobodyMatchesWords(s.query, s.clearSearch)
  if (s.filtered) return { main: 'Nobody in this group.', next: { label: 'All', onPress: s.showAll }, tail: 'shows everyone.' }
  return { main: 'Nobody has a pay report yet.' }
}

/** A person's statement grouped by report with nothing open: the settled chip shows the history. `settledHidden` is 0 once it shows. */
export function payStatementEmptyWords(s: { settledHidden: number; showSettled: Press }): EmptyStateWords {
  return s.settledHidden > 0
    ? { main: 'Nothing open.', next: { label: `Show ${s.settledHidden} settled`, onPress: s.showSettled }, tail: 'shows the history.' }
    : { main: 'No pay reports yet.' }
}

/** Payroll's payments table: the search, then the Method chips, then the window, in the order they hide rows. */
export function payRunPaymentsEmptyWords(s: { query: string; methodFiltered: boolean; allWindow: boolean; clearSearch: Press; clearMethod: Press; showAll: Press }): EmptyStateWords {
  if (s.query.trim()) return searchEmptyWords('payments', s.query, s.clearSearch)
  if (s.methodFiltered) return emptyWordsWithPress(emptyWords({ kind: 'filter', noun: 'payments', query: '' }), { onPress: s.clearMethod })
  if (!s.allWindow) return { main: 'No payments in this window.', next: { label: 'All', onPress: s.showAll }, tail: 'shows every payment.' }
  return { main: 'No payments recorded yet.' }
}

/** People → Offsets' Settle up list: empty is the good state, or a search hid the people. */
export function settleUpEmptyWords(s: { anyRows: boolean; query: string; clearSearch: Press }): EmptyStateWords {
  if (!s.anyRows) return { main: 'Nothing to settle.', tail: 'Nobody has an offset, an unpaid report or unreported hours.' }
  return nobodyMatchesWords(s.query, s.clearSearch)
}

/** The Payroll forecast before any bar: + Add bar starts it. */
export function forecastBarsEmptyWords(addBar: Press): EmptyStateWords {
  return { main: 'No bars yet.', next: { label: '+ Add bar', onPress: addBar }, tail: 'starts the forecast.' }
}

/** The forecast's unpaid balances: empty is the good state. */
export const FORECAST_UNPAID_EMPTY: EmptyStateWords = { main: 'Nothing unpaid.', tail: 'Everyone is caught up.' }

/** The period a Spending period steps back to, where it has one. */
const SPENDING_PERIOD_BEFORE: Partial<Record<SpendingPeriod, { key: SpendingPeriod; label: string; tail: string }>> = {
  this_week: { key: 'last_week', label: 'Last week', tail: 'shows the week before.' },
  this_month: { key: 'last_month', label: 'Last month', tail: 'shows the month before.' },
}

/** People → Spending with no card charge in the period: the period before, when the chips have one. */
export function spendingEmptyWords(period: SpendingPeriod, setPeriod: (period: SpendingPeriod) => void): EmptyStateWords {
  const main = 'No card charges in this period.'
  const before = SPENDING_PERIOD_BEFORE[period]
  return before ? { main, next: { label: before.label, onPress: () => setPeriod(before.key) }, tail: before.tail } : { main }
}

// People → Hours

/** Nobody clocked in is a fact, not a gap: the same words as the desktop Hours list. */
export const ON_THE_CLOCK_EMPTY: EmptyStateWords = { main: 'Nobody is on the clock right now.' }

/** A list of sessions waiting on the approver: empty is the good state. */
export const APPROVALS_WAITING_EMPTY: EmptyStateWords = { main: emptyWords({ kind: 'waiting', who: 'you' }).main }

/** The Align window when every closed session already has a job or a bid. */
export const ALIGN_EMPTY: EmptyStateWords = { main: 'Nothing to align.', tail: 'Every closed session in this range has a job or bid.' }

/** The approvals queue when Flagged only or Typed by hand hides every pending session. */
export function approvalsFilterEmptyWords(s: { typedOnly: boolean; flaggedOnly: boolean; clearFilters: Press }): EmptyStateWords {
  const next = { label: 'Clear the filters', onPress: s.clearFilters }
  return s.typedOnly && !s.flaggedOnly ? { main: 'Nothing typed by hand is waiting.', next } : { main: 'No flagged sessions. Everything left looks ordinary.', next }
}

/** Hours → Due by Team before a team exists: Add team makes one in Teams below. */
export function dueByTeamEmptyWords(addTeam: Press | null): EmptyStateWords {
  return addTeam
    ? { main: 'No teams yet.', next: { label: 'Add team', onPress: addTeam }, tail: 'starts the first in Teams below.' }
    : { main: 'No teams yet.', tail: 'Teams below is where they are made.' }
}

/** The Hours grid's job highlight when nobody in the list has that job this week. */
export function jobHighlightEmptyWords(clearHighlight: Press): EmptyStateWords {
  return { main: 'Nobody in this list has that job on crew assignments this week.', next: { label: 'Clear job highlight', onPress: clearHighlight } }
}

// People → Overhead and Day book

/** The overhead pool table: the next wider window looks further back, the widest says what fills it. */
export function overheadPoolEmptyWords(windowKey: OverheadPeopleWindowKey, setWindowKey: (key: OverheadPeopleWindowKey) => void): EmptyStateWords {
  const i = OVERHEAD_PEOPLE_WINDOWS.findIndex((w) => w.key === windowKey)
  const win = OVERHEAD_PEOPLE_WINDOWS[i]
  const phrase = !win ? 'this window' : win.key === 'day' ? 'today' : `the ${win.label.toLowerCase()}`
  const main = `Nothing in the pool for ${phrase}.`
  const wider = i >= 0 ? OVERHEAD_PEOPLE_WINDOWS[i + 1] : undefined
  return wider
    ? { main, next: { label: wider.label, onPress: () => setWindowKey(wider.key) }, tail: 'looks further back.' }
    : { main, tail: 'Office and bid sessions and office job purchases fill it.' }
}

/** The Day book's range with no office day: the pager's own step back. */
export function dayBookEmptyWords(view: 'week' | 'month', stepBack: Press): EmptyStateWords {
  const month = view === 'month'
  return { main: 'No office days in this range.', next: { label: month ? 'Earlier month' : 'Earlier week', onPress: stepBack }, tail: month ? 'shows the month before.' : 'shows the week before.' }
}

// People → Who's where

/** The week view with nothing clocked or scheduled: This week from another week, the week before from this one. */
export function whosWhereWeekEmptyWords(s: { isThisWeek: boolean; canGoEarlier: boolean; showThisWeek: Press; earlierWeek: Press }): EmptyStateWords {
  if (!s.isThisWeek) return { main: 'Nothing clocked or scheduled that week.', next: { label: 'This week', onPress: s.showThisWeek }, tail: 'shows the current week.' }
  const main = 'Nothing clocked or scheduled this week yet.'
  return s.canGoEarlier ? { main, next: { label: 'Earlier week', onPress: s.earlierWeek }, tail: 'shows the week before.' } : { main }
}

/** The day view at a minute when nobody is on a job: the people in that day, or the day's own pager. */
export function whosWhereDayEmptyWords(s: { time: string; peopleThatDay: number; isToday: boolean; canGoEarlier: boolean; showToday: Press; earlierDay: Press }): EmptyStateWords {
  if (s.peopleThatDay > 0) {
    const who = s.peopleThatDay === 1 ? '1 person was' : `${s.peopleThatDay} people were`
    return { main: `Nobody on a job at ${s.time}.`, tail: `${who} in that day. Drag the time to find them.` }
  }
  const main = 'Nothing clocked or scheduled that day.'
  if (!s.isToday) return { main, next: { label: 'Today', onPress: s.showToday }, tail: 'shows today.' }
  return s.canGoEarlier ? { main, next: { label: 'Earlier day', onPress: s.earlierDay }, tail: 'shows the day before.' } : { main }
}

// People → Review and Team summary

/** A period's people table or ranked bars: a search with no match, or nobody in the period. */
export function periodPeopleEmptyWords(query: string, clearSearch: Press, nobody: 'show' | 'rank'): EmptyStateWords {
  if (query.trim()) return nobodyMatchesWords(query, clearSearch)
  return { main: nobody === 'rank' ? 'Nobody to rank in this period.' : 'Nobody to show in this period.' }
}

// People → Feedback and the sub portal

/** Feedback's people table: the search, then the filter chip, then nobody at all. */
export function feedbackPeopleEmptyWords(s: { query: string; filtered: boolean; clearSearch: Press; showEveryone: Press }): EmptyStateWords {
  if (s.query.trim()) return nobodyMatchesWords(s.query, s.clearSearch)
  if (s.filtered) return nobodyUnderFilterWords(s.showEveryone)
  return { main: 'Nobody on the team yet.' }
}

/** The open words feed: Unread empty is the good state, and All shows what was read. */
export function openWordsEmptyWords(s: { unreadView: boolean; anyWords: boolean; showAll: Press }): EmptyStateWords {
  if (s.unreadView && s.anyWords) return { main: 'Nothing unread.', next: { label: 'All', onPress: s.showAll }, tail: 'shows everything written.' }
  return { main: 'Nothing written yet.' }
}

/** A sub's portal visits under a chip with none: All shows the rest of the trail. */
export function portalVisitsEmptyWords(s: { filter: 'all' | 'outside' | 'staff'; anyVisits: boolean; showAll: Press }): EmptyStateWords {
  if (s.filter === 'all') return { main: 'No visits on record yet.' }
  const main = s.filter === 'staff' ? 'Nobody on the team has opened this page.' : 'Nobody outside the team has opened this page yet.'
  return s.anyVisits ? { main, next: { label: 'All', onPress: s.showAll }, tail: 'shows every visit.' } : { main }
}

// Licenses, Vehicles, HR

/** Licenses due soon: empty is the good state. */
export const LICENSES_EXPIRING_EMPTY: EmptyStateWords = { main: 'Nothing expires in the next 30 days.' }

/** One person's licenses, opened on People → Licenses: + Add license is the row's own button. */
export function personLicensesEmptyWords(addLicense: Press): EmptyStateWords {
  return emptyWordsWithPress(emptyWords({ kind: 'make', noun: 'licenses', control: '+ Add license' }), { onPress: addLicense })
}

/** The Vehicles tab's add button, the press for every empty vehicle list. */
export const ADD_VEHICLE_CONTROL = '+ Add Vehicle'

/** No vehicle at all: + Add Vehicle adds the first, or the sentence alone where the list cannot reach it. */
export function addVehicleEmptyWords(addVehicle: Press | null): EmptyStateWords {
  const words = emptyWords({ kind: 'make', noun: 'vehicles', control: ADD_VEHICLE_CONTROL })
  return addVehicle ? emptyWordsWithPress(words, { onPress: addVehicle }) : { main: words.main }
}

/** The Vehicles tab's cards: none at all, or a search with no match. */
export function vehiclesEmptyWords(s: { anyVehicles: boolean; query: string; addVehicle: Press; clearSearch: Press }): EmptyStateWords {
  return s.anyVehicles ? searchEmptyWords('vehicles', s.query, s.clearSearch) : addVehicleEmptyWords(s.addVehicle)
}

/** A vehicle's ledger: a filter chip hid the rows, or nothing is on it yet. */
export function vehicleLedgerEmptyWords(s: { filtered: boolean; showAll: Press }): EmptyStateWords {
  return s.filtered
    ? { main: 'Nothing under this filter.', next: { label: 'All', onPress: s.showAll }, tail: 'shows the whole ledger.' }
    : { main: 'Nothing here yet.', tail: 'Save a reading above to start the ledger.' }
}

/** The odometer history window: its own box above takes the first reading. */
export const ODOMETER_HISTORY_EMPTY: EmptyStateWords = { main: 'No readings yet.', tail: "Type today's miles above and press Add reading." }

/** A person's HR log: the form above adds the first entry. */
export const HR_LOG_EMPTY: EmptyStateWords = { main: 'No entries yet.', tail: 'Write what happened above and press Add entry. The curated files are built from this log.' }

// Prospects → Hiring

/** The Unsorted column with nothing in it: empty is the good state. */
export const UNSORTED_EMPTY: EmptyStateWords = { main: 'Nothing unsorted.' }

/** A role column on Screen with no candidate: the column's own + Add candidate. */
export function roleColumnEmptyWords(addCandidate: Press): EmptyStateWords {
  return { main: 'No candidates yet.', next: { label: '+ Add candidate', onPress: addCandidate }, tail: 'adds one. You can also drag a card here.' }
}

/** An empty hiring stage: the stage tab where its cards come from. */
export function hiringStageEmptyWords(stage: 'interview' | 'tryout' | 'hire', openStage: (stage: 'screen' | 'interview') => void): EmptyStateWords {
  switch (stage) {
    case 'interview':
      return { main: 'No one in Interview yet.', next: { label: 'Screen', onPress: () => openStage('screen') }, tail: 'is where you Advance a candidate.' }
    case 'tryout':
      return { main: 'No one on a try-out.', next: { label: 'Screen', onPress: () => openStage('screen') }, tail: 'is where you press Try out on a card in a helper column. They get a login, and the card waits here.' }
    case 'hire':
      return { main: 'No hires yet.', next: { label: 'Interview', onPress: () => openStage('interview') }, tail: 'is where you Advance a good fit.' }
  }
}

/** The Hire stage before the dev defines an onboarding item: ⚙ Onboarding settings sets them up. */
export function onboardingItemsEmptyWords(openSettings: Press): EmptyStateWords {
  return { main: 'No onboarding items yet.', next: { label: '⚙ Onboarding settings', onPress: openSettings }, tail: 'sets them up.' }
}
