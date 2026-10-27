import { describe, expect, it, vi } from 'vitest'
import type { EmptyStateWords } from '../emptyWords'
import { plainWordsFailures } from '../plainWords'
import {
  DISPATCH_CLOSED_EMPTY,
  DISPATCH_INBOX_EMPTY,
  ESTIMATOR_INBOX_EMPTY,
  HELP_FEEDBACK_EMPTY,
  JOBS_REPORTS_PATH,
  JOBS_STAGES_PATH,
  LIEN_RELEASE_QUEUE_EMPTY,
  LIEN_WAIVERS_TO_SIGN_EMPTY,
  MY_BIDS_UNSENT_EMPTY,
  NEEDS_YOU_EMPTY,
  READY_TO_BILL_EMPTY,
  SUPERVISOR_CREW_EMPTY,
  TEAM_CLOCKED_IN_TODAY_EMPTY,
  WAITING_ON_YOU_EMPTY,
  arCustomersEmptyWords,
  assignedJobsSearchEmptyWords,
  crewDayEmptyWords,
  crewDayOfficeOnlyEmptyWords,
  financeDrillEmptyWords,
  myScheduleDayEmptyWords,
  myTimeWeekEmptyWords,
  recentReportsEmptyWords,
  staleFollowUpEmptyWords,
  supervisorReportsOwedEmptyWords,
} from './dashboardEmptyWords'

const noop = () => {}

/** The sentence a person reads: main, the press's label, the tail. */
const read = (w: EmptyStateWords) => [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')

/** Fires the press, or fails when the words carry a link or no press. */
function press(w: EmptyStateWords) {
  if (!w.next || !('onPress' in w.next)) throw new Error(`no handler press on: ${w.main}`)
  w.next.onPress()
}

describe('dashboardEmptyWords: the good states', () => {
  it('Needs you keeps its model words; the queues the viewer clears say Nothing waiting on you', () => {
    expect(NEEDS_YOU_EMPTY).toEqual({ main: 'Nothing waits on you.' })
    expect(WAITING_ON_YOU_EMPTY).toEqual({ main: 'Nothing waiting on you.' })
    expect(LIEN_WAIVERS_TO_SIGN_EMPTY.main).toBe('Nothing waits for your signature.')
    expect(read(LIEN_RELEASE_QUEUE_EMPTY)).toBe('Nothing waiting on you. Every cleared conditional release has its unconditional version.')
  })

  it('the inboxes name who they wait on and the press that fills them', () => {
    expect(read(DISPATCH_INBOX_EMPTY)).toBe('Nothing waiting on dispatch. A request lands here when someone presses Send to Dispatch.')
    expect(read(ESTIMATOR_INBOX_EMPTY)).toBe('Nothing waiting on an estimator. A request lands here when someone presses Send to Estimator Inbox.')
    expect(read(HELP_FEEDBACK_EMPTY)).toBe('Nothing waiting on you. Feedback lands here when someone presses Send feedback on a help guide.')
    expect(DISPATCH_CLOSED_EMPTY.main).toBe('Nothing closed yet.')
  })

  it('Ready to bill links to Jobs → Stages', () => {
    expect(READY_TO_BILL_EMPTY.next).toEqual({ label: 'Stages', to: JOBS_STAGES_PATH })
    expect(read(READY_TO_BILL_EMPTY)).toBe('Nothing is ready to bill. Stages shows what is still in progress.')
  })

  it('My bids and My crew say their good state', () => {
    expect(read(MY_BIDS_UNSENT_EMPTY)).toBe('Nothing unsent. Every bid went out.')
    expect(read(supervisorReportsOwedEmptyWords(3))).toBe('Every job-day you supervised has a report. 3 filed.')
    expect(supervisorReportsOwedEmptyWords(0)).toEqual({ main: 'Nothing owed.' })
    expect(SUPERVISOR_CREW_EMPTY.next).toBeUndefined()
    expect(TEAM_CLOCKED_IN_TODAY_EMPTY).toEqual({ main: 'Nobody has clocked in yet today.' })
  })
})

describe('dashboardEmptyWords: the presses', () => {
  it('AR by customer: the search, then the lenses, then the good state', () => {
    const clearSearch = vi.fn()
    const clearFilters = vi.fn()
    const search = arCustomersEmptyWords({ query: ' Ridgeway ', filtered: true, hasCollections: false, clearSearch, clearFilters })
    expect(read(search)).toBe('No customers match ‘Ridgeway’. Clear the search')
    press(search)
    expect(clearSearch).toHaveBeenCalledTimes(1)
    expect(arCustomersEmptyWords({ query: 'Ridgeway', filtered: false, hasCollections: false, clearSearch: null, clearFilters })).toEqual({ main: 'No customers match ‘Ridgeway’.' })
    const lenses = arCustomersEmptyWords({ query: '', filtered: true, hasCollections: false, clearSearch, clearFilters })
    expect(read(lenses)).toBe('No customers match the filters. Clear the filters')
    press(lenses)
    expect(clearFilters).toHaveBeenCalledTimes(1)
    expect(read(arCustomersEmptyWords({ query: '', filtered: false, hasCollections: false, clearSearch, clearFilters }))).toBe('Nothing waiting on a customer. Every bill is paid.')
    expect(arCustomersEmptyWords({ query: '', filtered: false, hasCollections: true, clearSearch, clearFilters })).toEqual({ main: 'Nothing waiting on a customer.' })
  })

  it('the Financials drill window: Clear the search under a search, Clear the filters under an age band', () => {
    const clearSearch = vi.fn()
    const clearFilters = vi.fn()
    const search = financeDrillEmptyWords({ query: 'Hartline', clearSearch, clearFilters })
    expect(search.main).toBe('No items match ‘Hartline’.')
    press(search)
    expect(clearSearch).toHaveBeenCalledTimes(1)
    const band = financeDrillEmptyWords({ query: '  ', clearSearch, clearFilters })
    expect(band.main).toBe('No items match the filters.')
    press(band)
    expect(clearFilters).toHaveBeenCalledTimes(1)
  })

  it('My time offers Last week until last week is open', () => {
    const show = vi.fn()
    const words = myTimeWeekEmptyWords(show)
    expect(read(words)).toBe('Nothing clocked this week. Last week shows the week before.')
    press(words)
    expect(show).toHaveBeenCalledTimes(1)
    expect(myTimeWeekEmptyWords(null)).toEqual({ main: 'Nothing clocked this week.' })
  })

  it('the stale purchases window: Stale hiding everything offers To sort', () => {
    const toSort = vi.fn()
    const stale = staleFollowUpEmptyWords({ staleOnly: true, anyRows: true, showToSort: toSort })
    expect(stale.next?.label).toBe('To sort')
    press(stale)
    expect(toSort).toHaveBeenCalledTimes(1)
    expect(staleFollowUpEmptyWords({ staleOnly: true, anyRows: false, showToSort: toSort })).toEqual({ main: 'Nothing waiting on the people you follow up with.' })
    expect(staleFollowUpEmptyWords({ staleOnly: false, anyRows: true, showToSort: toSort }).next).toBeUndefined()
  })

  it('Assigned jobs, Crew day and My Schedule press their own controls', () => {
    const clear = vi.fn()
    const assigned = assignedJobsSearchEmptyWords('zzz', clear)
    expect(read(assigned)).toBe('No assigned jobs match ‘zzz’. Clear the search')
    press(assigned)
    expect(clear).toHaveBeenCalledTimes(1)

    const back = vi.fn()
    const day = crewDayEmptyWords(back)
    expect(read(day)).toBe('No crew activity on this day. Previous day shows the day before.')
    press(day)
    expect(back).toHaveBeenCalledTimes(1)
    const office = vi.fn()
    const officeOnly = crewDayOfficeOnlyEmptyWords(office)
    expect(officeOnly.next?.label).toBe('Show office staff')
    press(officeOnly)
    expect(office).toHaveBeenCalledTimes(1)

    const addJob = vi.fn()
    const today = myScheduleDayEmptyWords('today', addJob)
    expect(read(today)).toBe('Nothing scheduled today. + Add job puts a job on your day.')
    press(today)
    expect(addJob).toHaveBeenCalledTimes(1)
    expect(myScheduleDayEmptyWords('tomorrow', addJob).main).toBe('Nothing scheduled tomorrow.')
  })

  it('Recent Reports: Jobs → Reports for the office, the card above for a reports-only person', () => {
    expect(recentReportsEmptyWords(false).next).toEqual({ label: 'Reports', to: JOBS_REPORTS_PATH })
    expect(recentReportsEmptyWords(true)).toEqual({ main: 'No reports yet.', tail: 'Create one above.' })
  })
})

describe('dashboardEmptyWords: plain words', () => {
  it('every sentence reads in plain words: under 20 words, no dash, semicolon or parenthesis', () => {
    const all: EmptyStateWords[] = [
      NEEDS_YOU_EMPTY,
      WAITING_ON_YOU_EMPTY,
      DISPATCH_INBOX_EMPTY,
      DISPATCH_CLOSED_EMPTY,
      ESTIMATOR_INBOX_EMPTY,
      HELP_FEEDBACK_EMPTY,
      READY_TO_BILL_EMPTY,
      LIEN_RELEASE_QUEUE_EMPTY,
      LIEN_WAIVERS_TO_SIGN_EMPTY,
      MY_BIDS_UNSENT_EMPTY,
      TEAM_CLOCKED_IN_TODAY_EMPTY,
      SUPERVISOR_CREW_EMPTY,
      supervisorReportsOwedEmptyWords(0),
      supervisorReportsOwedEmptyWords(12),
      arCustomersEmptyWords({ query: 'Ridgeway', filtered: false, hasCollections: false, clearSearch: noop, clearFilters: noop }),
      arCustomersEmptyWords({ query: '', filtered: true, hasCollections: false, clearSearch: noop, clearFilters: noop }),
      arCustomersEmptyWords({ query: '', filtered: false, hasCollections: false, clearSearch: noop, clearFilters: noop }),
      financeDrillEmptyWords({ query: 'Hartline', clearSearch: noop, clearFilters: noop }),
      financeDrillEmptyWords({ query: '', clearSearch: noop, clearFilters: noop }),
      myTimeWeekEmptyWords(noop),
      staleFollowUpEmptyWords({ staleOnly: true, anyRows: true, showToSort: noop }),
      staleFollowUpEmptyWords({ staleOnly: false, anyRows: false, showToSort: noop }),
      assignedJobsSearchEmptyWords('zzz', noop),
      crewDayEmptyWords(noop),
      crewDayOfficeOnlyEmptyWords(noop),
      myScheduleDayEmptyWords('today', noop),
      recentReportsEmptyWords(false),
      recentReportsEmptyWords(true),
    ]
    for (const w of all) expect(plainWordsFailures(read(w)), read(w)).toEqual([])
  })
})
