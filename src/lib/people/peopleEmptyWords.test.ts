import { describe, expect, it, vi } from 'vitest'
import type { EmptyStateWords } from '../emptyWords'
import { plainWordsFailures } from '../plainWords'
import {
  ADD_VEHICLE_CONTROL,
  addVehicleEmptyWords,
  agreementsEmptyWords,
  ALIGN_EMPTY,
  APPROVALS_WAITING_EMPTY,
  approvalsFilterEmptyWords,
  dayBookEmptyWords,
  dueByTeamEmptyWords,
  employmentRosterEmptyWords,
  feedbackPeopleEmptyWords,
  FORECAST_UNPAID_EMPTY,
  forecastBarsEmptyWords,
  HIRE_CONTROL,
  hiringStageEmptyWords,
  HR_LOG_EMPTY,
  jobHighlightEmptyWords,
  LICENSES_EXPIRING_EMPTY,
  linkAccountEmptyWords,
  nobodyMatchesWords,
  nobodyUnderFilterWords,
  ODOMETER_HISTORY_EMPTY,
  ON_THE_CLOCK_EMPTY,
  onboardingItemsEmptyWords,
  openWordsEmptyWords,
  overheadPoolEmptyWords,
  payLedgerRosterEmptyWords,
  payRunPaymentsEmptyWords,
  payStatementEmptyWords,
  PEOPLE_USERS_PATH,
  periodPeopleEmptyWords,
  personLicensesEmptyWords,
  portalVisitsEmptyWords,
  roleColumnEmptyWords,
  ROSTER_GROUP_NOUN,
  rosterGroupEmptyWords,
  searchEmptyWords,
  settleUpEmptyWords,
  spendingEmptyWords,
  subsRosterEmptyWords,
  TIME_OFF_EMPTY,
  UNSORTED_EMPTY,
  vehicleLedgerEmptyWords,
  vehiclesEmptyWords,
  whosWhereDayEmptyWords,
  whosWhereWeekEmptyWords,
} from './peopleEmptyWords'

const noop = () => {}

/** What a person reads: the sentence, the press, the words after it. */
const read = (w: EmptyStateWords) => [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')

/** Fires the press when it is a button, and says which kind it was. */
function press(w: EmptyStateWords): 'button' | 'link' | 'none' {
  if (!w.next) return 'none'
  if ('to' in w.next) return 'link'
  w.next.onPress()
  return 'button'
}

describe('peopleEmptyWords', () => {
  it('a people search quotes what was typed and offers Clear the search', () => {
    const clear = vi.fn()
    const w = nobodyMatchesWords(' Marisol ', clear)
    expect(read(w)).toBe('Nobody matches ‘Marisol’. Clear the search')
    expect(press(w)).toBe('button')
    expect(clear).toHaveBeenCalledTimes(1)
    expect(read(searchEmptyWords('pay reports', 'Ana', noop))).toBe('No pay reports match ‘Ana’. Clear the search')
  })

  it('a filter chip hiding everyone offers Everyone', () => {
    const everyone = vi.fn()
    const w = nobodyUnderFilterWords(everyone)
    expect(read(w)).toBe('Nobody matches this filter. Everyone shows the whole roster.')
    press(w)
    expect(everyone).toHaveBeenCalledTimes(1)
  })

  it('a roster group names its kind and offers + Hire, Add, or nothing', () => {
    const hire = vi.fn()
    const w = rosterGroupEmptyWords('estimator', { label: HIRE_CONTROL, onPress: hire })
    expect(read(w)).toBe('No estimators yet. + Hire adds the first.')
    press(w)
    expect(hire).toHaveBeenCalledTimes(1)
    expect(read(rosterGroupEmptyWords('master_technician', { label: 'Add', onPress: noop }))).toBe('No leaders yet. Add adds the first.')
    expect(rosterGroupEmptyWords('helper', null)).toEqual({ main: 'No helpers yet.' })
    expect(Object.keys(ROSTER_GROUP_NOUN)).toHaveLength(9)
  })

  it('the Link account window and the Subs tab send the viewer to + Hire', () => {
    expect(read(linkAccountEmptyWords('Leader', noop))).toBe('No unlinked leader accounts to link. + Hire makes the account first.')
    expect(linkAccountEmptyWords(null, null)).toEqual({ main: 'No unlinked accounts to link.' })
    expect(read(subsRosterEmptyWords(noop))).toBe('No subs yet. + Hire adds the first.')
    expect(subsRosterEmptyWords(null)).toEqual({ main: 'No subs yet.' })
  })

  it('Employment: a search, else Users is where a roster fills from', () => {
    expect(read(employmentRosterEmptyWords('ana', noop))).toBe('Nobody matches ‘ana’. Clear the search')
    const w = employmentRosterEmptyWords('  ', noop)
    expect(w.next).toEqual({ label: 'Users', to: PEOPLE_USERS_PATH })
    expect(PEOPLE_USERS_PATH).toBe('/people?tab=users')
    expect(read(TIME_OFF_EMPTY)).toBe('No time off yet. Pick the dates below and press Add time off.')
  })

  it('Contracts: the Contract library adds the agreements', () => {
    const open = vi.fn()
    const w = agreementsEmptyWords(open)
    expect(read(w)).toBe('No agreements yet. Contract library adds the documents.')
    press(w)
    expect(open).toHaveBeenCalledTimes(1)
    expect(agreementsEmptyWords(null).next).toBeUndefined()
  })

  it('the pay ledger: the search first, then the group chip, then nobody', () => {
    const clearSearch = vi.fn()
    const showAll = vi.fn()
    press(payLedgerRosterEmptyWords({ query: 'Ana', filtered: true, clearSearch, showAll }))
    expect(clearSearch).toHaveBeenCalledTimes(1)
    const group = payLedgerRosterEmptyWords({ query: '', filtered: true, clearSearch, showAll })
    expect(read(group)).toBe('Nobody in this group. All shows everyone.')
    press(group)
    expect(showAll).toHaveBeenCalledTimes(1)
    expect(payLedgerRosterEmptyWords({ query: '', filtered: false, clearSearch, showAll }).next).toBeUndefined()
  })

  it('a statement with nothing open shows its settled reports by the chip’s own name', () => {
    const show = vi.fn()
    const w = payStatementEmptyWords({ settledHidden: 3, showSettled: show })
    expect(read(w)).toBe('Nothing open. Show 3 settled shows the history.')
    press(w)
    expect(show).toHaveBeenCalledTimes(1)
    expect(payStatementEmptyWords({ settledHidden: 0, showSettled: show })).toEqual({ main: 'No pay reports yet.' })
  })

  it('the payments table clears the search, then the Method chips, then widens to All', () => {
    const s = { query: '', methodFiltered: false, allWindow: false, clearSearch: vi.fn(), clearMethod: vi.fn(), showAll: vi.fn() }
    press(payRunPaymentsEmptyWords({ ...s, query: 'cash', methodFiltered: true }))
    expect(s.clearSearch).toHaveBeenCalledTimes(1)
    expect(read(payRunPaymentsEmptyWords({ ...s, methodFiltered: true }))).toBe('No payments match the filters. Clear the filters')
    press(payRunPaymentsEmptyWords({ ...s, methodFiltered: true }))
    expect(s.clearMethod).toHaveBeenCalledTimes(1)
    const win = payRunPaymentsEmptyWords(s)
    expect(read(win)).toBe('No payments in this window. All shows every payment.')
    press(win)
    expect(s.showAll).toHaveBeenCalledTimes(1)
    expect(payRunPaymentsEmptyWords({ ...s, allWindow: true })).toEqual({ main: 'No payments recorded yet.' })
  })

  it('Settle up: empty is the good state, else a search hid the people', () => {
    expect(read(settleUpEmptyWords({ anyRows: false, query: '', clearSearch: noop }))).toBe('Nothing to settle. Nobody has an offset, an unpaid report or unreported hours.')
    expect(read(settleUpEmptyWords({ anyRows: true, query: 'Kai', clearSearch: noop }))).toBe('Nobody matches ‘Kai’. Clear the search')
  })

  it('Spending steps back a week or a month, and has no press for the rest', () => {
    const setPeriod = vi.fn()
    const month = spendingEmptyWords('this_month', setPeriod)
    expect(read(month)).toBe('No card charges in this period. Last month shows the month before.')
    press(month)
    expect(setPeriod).toHaveBeenCalledWith('last_month')
    press(spendingEmptyWords('this_week', setPeriod))
    expect(setPeriod).toHaveBeenLastCalledWith('last_week')
    expect(spendingEmptyWords('last_30_days', setPeriod).next).toBeUndefined()
  })

  it('Hours: the clock, the waiting lists and the approvals filters', () => {
    expect(ON_THE_CLOCK_EMPTY.main).toBe('Nobody is on the clock right now.')
    expect(APPROVALS_WAITING_EMPTY.main).toBe('Nothing waiting on you.')
    const clearFilters = vi.fn()
    expect(read(approvalsFilterEmptyWords({ typedOnly: true, flaggedOnly: false, clearFilters }))).toBe('Nothing typed by hand is waiting. Clear the filters')
    const flagged = approvalsFilterEmptyWords({ typedOnly: true, flaggedOnly: true, clearFilters })
    expect(read(flagged)).toBe('No flagged sessions. Everything left looks ordinary. Clear the filters')
    press(flagged)
    expect(clearFilters).toHaveBeenCalledTimes(1)
    const addTeam = vi.fn()
    press(dueByTeamEmptyWords(addTeam))
    expect(addTeam).toHaveBeenCalledTimes(1)
    expect(dueByTeamEmptyWords(null).next).toBeUndefined()
    const clear = vi.fn()
    press(jobHighlightEmptyWords(clear))
    expect(clear).toHaveBeenCalledTimes(1)
  })

  it('the overhead pool widens one window at a time and names what fills the widest', () => {
    const setWindow = vi.fn()
    const today = overheadPoolEmptyWords('day', setWindow)
    expect(read(today)).toBe('Nothing in the pool for today. Last 7 days looks further back.')
    press(today)
    expect(setWindow).toHaveBeenCalledWith('week')
    expect(overheadPoolEmptyWords('week', setWindow).main).toBe('Nothing in the pool for the last 7 days.')
    expect(read(overheadPoolEmptyWords('quarter', setWindow))).toBe('Nothing in the pool for the last 90 days. Office and bid sessions and office job purchases fill it.')
  })

  it('the Day book and Who’s where use their pager’s own presses', () => {
    expect(read(dayBookEmptyWords('week', noop))).toBe('No office days in this range. Earlier week shows the week before.')
    expect(dayBookEmptyWords('month', noop).next?.label).toBe('Earlier month')
    const thisWeek = vi.fn()
    const week = whosWhereWeekEmptyWords({ isThisWeek: false, canGoEarlier: true, showThisWeek: thisWeek, earlierWeek: noop })
    expect(read(week)).toBe('Nothing clocked or scheduled that week. This week shows the current week.')
    press(week)
    expect(thisWeek).toHaveBeenCalledTimes(1)
    expect(whosWhereWeekEmptyWords({ isThisWeek: true, canGoEarlier: true, showThisWeek: noop, earlierWeek: noop }).next?.label).toBe('Earlier week')
    expect(whosWhereWeekEmptyWords({ isThisWeek: true, canGoEarlier: false, showThisWeek: noop, earlierWeek: noop }).next).toBeUndefined()
    expect(read(whosWhereDayEmptyWords({ time: '9:00 AM', peopleThatDay: 4, isToday: true, canGoEarlier: true, showToday: noop, earlierDay: noop }))).toBe(
      'Nobody on a job at 9:00 AM. 4 people were in that day. Drag the time to find them.',
    )
    expect(whosWhereDayEmptyWords({ time: '9:00 AM', peopleThatDay: 1, isToday: true, canGoEarlier: true, showToday: noop, earlierDay: noop }).tail).toBe('1 person was in that day. Drag the time to find them.')
    expect(read(whosWhereDayEmptyWords({ time: '9:00 AM', peopleThatDay: 0, isToday: false, canGoEarlier: true, showToday: noop, earlierDay: noop }))).toBe('Nothing clocked or scheduled that day. Today shows today.')
    expect(whosWhereDayEmptyWords({ time: '9:00 AM', peopleThatDay: 0, isToday: true, canGoEarlier: true, showToday: noop, earlierDay: noop }).next?.label).toBe('Earlier day')
  })

  it('a period of people: the search, else nobody to show or rank', () => {
    expect(read(periodPeopleEmptyWords('Ana', noop, 'rank'))).toBe('Nobody matches ‘Ana’. Clear the search')
    expect(periodPeopleEmptyWords('', noop, 'rank')).toEqual({ main: 'Nobody to rank in this period.' })
    expect(periodPeopleEmptyWords('', noop, 'show')).toEqual({ main: 'Nobody to show in this period.' })
  })

  it('Feedback, the open words and the portal visits', () => {
    const everyone = vi.fn()
    press(feedbackPeopleEmptyWords({ query: '', filtered: true, clearSearch: noop, showEveryone: everyone }))
    expect(everyone).toHaveBeenCalledTimes(1)
    expect(feedbackPeopleEmptyWords({ query: '', filtered: false, clearSearch: noop, showEveryone: everyone })).toEqual({ main: 'Nobody on the team yet.' })
    expect(read(openWordsEmptyWords({ unreadView: true, anyWords: true, showAll: noop }))).toBe('Nothing unread. All shows everything written.')
    expect(openWordsEmptyWords({ unreadView: true, anyWords: false, showAll: noop })).toEqual({ main: 'Nothing written yet.' })
    expect(read(portalVisitsEmptyWords({ filter: 'staff', anyVisits: true, showAll: noop }))).toBe('Nobody on the team has opened this page. All shows every visit.')
    expect(portalVisitsEmptyWords({ filter: 'outside', anyVisits: false, showAll: noop }).next).toBeUndefined()
    expect(portalVisitsEmptyWords({ filter: 'all', anyVisits: false, showAll: noop })).toEqual({ main: 'No visits on record yet.' })
  })

  it('Licenses and Vehicles name their own add buttons', () => {
    const add = vi.fn()
    const lic = personLicensesEmptyWords(add)
    expect(read(lic)).toBe('No licenses yet. + Add license adds the first.')
    press(lic)
    expect(add).toHaveBeenCalledTimes(1)
    expect(read(addVehicleEmptyWords(noop))).toBe(`No vehicles yet. ${ADD_VEHICLE_CONTROL} adds the first.`)
    expect(addVehicleEmptyWords(null)).toEqual({ main: 'No vehicles yet.' })
    const clear = vi.fn()
    press(vehiclesEmptyWords({ anyVehicles: true, query: 'F-150', addVehicle: noop, clearSearch: clear }))
    expect(clear).toHaveBeenCalledTimes(1)
    expect(read(vehiclesEmptyWords({ anyVehicles: false, query: '', addVehicle: noop, clearSearch: clear }))).toBe('No vehicles yet. + Add Vehicle adds the first.')
    const all = vi.fn()
    press(vehicleLedgerEmptyWords({ filtered: true, showAll: all }))
    expect(all).toHaveBeenCalledTimes(1)
    expect(vehicleLedgerEmptyWords({ filtered: false, showAll: all }).next).toBeUndefined()
  })

  it('Hiring: each empty stage opens the stage its cards come from', () => {
    const open = vi.fn()
    press(hiringStageEmptyWords('interview', open))
    expect(open).toHaveBeenLastCalledWith('screen')
    press(hiringStageEmptyWords('tryout', open))
    expect(open).toHaveBeenLastCalledWith('screen')
    press(hiringStageEmptyWords('hire', open))
    expect(open).toHaveBeenLastCalledWith('interview')
    expect(read(hiringStageEmptyWords('hire', open))).toBe('No hires yet. Interview is where you Advance a good fit.')
    const addCandidate = vi.fn()
    press(roleColumnEmptyWords(addCandidate))
    expect(addCandidate).toHaveBeenCalledTimes(1)
    expect(read(onboardingItemsEmptyWords(noop))).toBe('No onboarding items yet. ⚙ Onboarding settings sets them up.')
  })

  it('every sentence follows plain words', () => {
    const all: EmptyStateWords[] = [
      nobodyMatchesWords('Marisol', noop),
      nobodyUnderFilterWords(noop),
      searchEmptyWords('offsets', 'Kai', noop),
      ...(Object.keys(ROSTER_GROUP_NOUN) as Array<keyof typeof ROSTER_GROUP_NOUN>).flatMap((k) => [rosterGroupEmptyWords(k, { label: HIRE_CONTROL, onPress: noop }), rosterGroupEmptyWords(k, null)]),
      linkAccountEmptyWords('Superintendent', noop),
      linkAccountEmptyWords(null, null),
      subsRosterEmptyWords(noop),
      employmentRosterEmptyWords('', noop),
      TIME_OFF_EMPTY,
      agreementsEmptyWords(noop),
      agreementsEmptyWords(null),
      payLedgerRosterEmptyWords({ query: '', filtered: true, clearSearch: noop, showAll: noop }),
      payLedgerRosterEmptyWords({ query: '', filtered: false, clearSearch: noop, showAll: noop }),
      payStatementEmptyWords({ settledHidden: 12, showSettled: noop }),
      payStatementEmptyWords({ settledHidden: 0, showSettled: noop }),
      payRunPaymentsEmptyWords({ query: 'cash', methodFiltered: false, allWindow: false, clearSearch: noop, clearMethod: noop, showAll: noop }),
      payRunPaymentsEmptyWords({ query: '', methodFiltered: true, allWindow: false, clearSearch: noop, clearMethod: noop, showAll: noop }),
      payRunPaymentsEmptyWords({ query: '', methodFiltered: false, allWindow: false, clearSearch: noop, clearMethod: noop, showAll: noop }),
      payRunPaymentsEmptyWords({ query: '', methodFiltered: false, allWindow: true, clearSearch: noop, clearMethod: noop, showAll: noop }),
      settleUpEmptyWords({ anyRows: false, query: '', clearSearch: noop }),
      forecastBarsEmptyWords(noop),
      FORECAST_UNPAID_EMPTY,
      spendingEmptyWords('this_week', noop),
      spendingEmptyWords('this_month', noop),
      spendingEmptyWords('custom', noop),
      ON_THE_CLOCK_EMPTY,
      APPROVALS_WAITING_EMPTY,
      ALIGN_EMPTY,
      approvalsFilterEmptyWords({ typedOnly: true, flaggedOnly: false, clearFilters: noop }),
      approvalsFilterEmptyWords({ typedOnly: false, flaggedOnly: true, clearFilters: noop }),
      dueByTeamEmptyWords(noop),
      dueByTeamEmptyWords(null),
      jobHighlightEmptyWords(noop),
      overheadPoolEmptyWords('day', noop),
      overheadPoolEmptyWords('month', noop),
      overheadPoolEmptyWords('quarter', noop),
      dayBookEmptyWords('week', noop),
      dayBookEmptyWords('month', noop),
      whosWhereWeekEmptyWords({ isThisWeek: false, canGoEarlier: true, showThisWeek: noop, earlierWeek: noop }),
      whosWhereWeekEmptyWords({ isThisWeek: true, canGoEarlier: true, showThisWeek: noop, earlierWeek: noop }),
      whosWhereDayEmptyWords({ time: '10:35 AM', peopleThatDay: 12, isToday: true, canGoEarlier: true, showToday: noop, earlierDay: noop }),
      whosWhereDayEmptyWords({ time: '10:35 AM', peopleThatDay: 0, isToday: false, canGoEarlier: true, showToday: noop, earlierDay: noop }),
      whosWhereDayEmptyWords({ time: '10:35 AM', peopleThatDay: 0, isToday: true, canGoEarlier: true, showToday: noop, earlierDay: noop }),
      periodPeopleEmptyWords('', noop, 'show'),
      periodPeopleEmptyWords('', noop, 'rank'),
      feedbackPeopleEmptyWords({ query: '', filtered: false, clearSearch: noop, showEveryone: noop }),
      openWordsEmptyWords({ unreadView: true, anyWords: true, showAll: noop }),
      openWordsEmptyWords({ unreadView: false, anyWords: false, showAll: noop }),
      portalVisitsEmptyWords({ filter: 'staff', anyVisits: true, showAll: noop }),
      portalVisitsEmptyWords({ filter: 'outside', anyVisits: true, showAll: noop }),
      portalVisitsEmptyWords({ filter: 'all', anyVisits: false, showAll: noop }),
      LICENSES_EXPIRING_EMPTY,
      personLicensesEmptyWords(noop),
      addVehicleEmptyWords(noop),
      vehiclesEmptyWords({ anyVehicles: true, query: 'F-150', addVehicle: noop, clearSearch: noop }),
      vehicleLedgerEmptyWords({ filtered: true, showAll: noop }),
      vehicleLedgerEmptyWords({ filtered: false, showAll: noop }),
      ODOMETER_HISTORY_EMPTY,
      HR_LOG_EMPTY,
      UNSORTED_EMPTY,
      roleColumnEmptyWords(noop),
      hiringStageEmptyWords('interview', noop),
      hiringStageEmptyWords('tryout', noop),
      hiringStageEmptyWords('hire', noop),
      onboardingItemsEmptyWords(noop),
    ]
    for (const w of all) expect(plainWordsFailures(read(w)), read(w)).toEqual([])
  })
})
