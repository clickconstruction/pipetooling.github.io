// @vitest-environment jsdom
/**
 * Trips on this job, the line in the Job window's Job tab (punch list #379, PR 6): the sentence, the job's
 * hours in the five figures, and the two presses. A job no trip names draws nothing. Every name is made up.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { JobTripsState } from '../../hooks/useJobTrips'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { JOB_TRIPS_HOURS_WORDS, JOB_TRIPS_NO_POINT_WORDS } from '../../lib/trips/jobTrips'
import type { TripRecord } from '../../lib/trips/tripRecord'
import { JobTripsLine } from './JobTripsLine'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

const TODAY = '2026-11-17'
const JOB = { id: 'j2101', label: 'J2101', name: 'Rough-in: lodge and bunkhouse' }
const line = { gone: 3, count: '3 trips', last: 'last Trip 5, Oct 23 to Nov 4, Luis, Priya', lastTripId: 't5', lastDoor: 'Open Trip 5', next: 'next Trip 6, Dec 1 to 5', nextTripId: 't6', nextDoor: 'Open Trip 6', words: '3 trips · last Trip 5, Oct 23 to Nov 4, Luis, Priya · next Trip 6, Dec 1 to 5' }
const hours = { site: 840, road: 96, ready: 12, noPlace: 31.5, home: 42, all: 1021.5, notAtSite: 181.5 }
function state(over: Partial<JobTripsState> = {}): JobTripsState {
  return { records: [], line, hours, hoursState: 'read', noSitePoint: false, clockTags: new Map(), roster: [{ id: 'p-dana', name: 'Dana', userId: 'u-dana' }], save: vi.fn(async () => undefined), ...over }
}
function Where() {
  const at = useLocation()
  return <span data-testid="where">{at.pathname + at.search}</span>
}
function draw(trips: JobTripsState, developmentId: string | null = 'd-heron') {
  const onLeave = vi.fn()
  renderWithProviders(
    <>
      <JobTripsLine trips={trips} job={JOB} developmentId={developmentId} siteName="Heron Point" todayYmd={TODAY} onLeave={onLeave} />
      <Where />
    </>,
    { route: '/jobs' },
  )
  return { onLeave }
}

describe('JobTripsLine', () => {
  it('says the job’s trips: how many went out in bold, the last with who went, and the next', () => {
    draw(state())
    expect(screen.getByTestId('job-trips-line').textContent).toContain('Trips on this job')
    const words = screen.getByTestId('job-trips-words')
    expect(words.textContent).toBe('3 trips · last Trip 5, Oct 23 to Nov 4, Luis, Priya · next Trip 6, Dec 1 to 5')
    expect(words.querySelector('strong')?.textContent).toBe('3 trips')
  })

  it('last and next are doors: each closes the Job window and opens its own trip on the site’s page', () => {
    const { onLeave } = draw(state())
    const last = screen.getByTestId('job-trips-last')
    expect(last.textContent).toBe('last Trip 5, Oct 23 to Nov 4, Luis, Priya')
    expect(last.getAttribute('title')).toBe('Open Trip 5 on Heron Point’s page')
    fireEvent.click(last)
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('where').textContent).toBe('/developments/d-heron?trip=t5')
    cleanup()
    draw(state())
    const next = screen.getByTestId('job-trips-next')
    expect(next.textContent).toBe('next Trip 6, Dec 1 to 5')
    fireEvent.click(next)
    expect(screen.getByTestId('where').textContent).toBe('/developments/d-heron?trip=t6')
  })

  it('a trip made before numbers is a door too, told by its days', () => {
    draw(state({ line: { ...line, last: 'last Oct 23 to Nov 4, Luis, Priya', lastDoor: 'Open this trip', next: null, nextTripId: null, nextDoor: null, words: '3 trips · last Oct 23 to Nov 4, Luis, Priya' } }))
    expect(screen.getByTestId('job-trips-words').textContent).toBe('3 trips · last Oct 23 to Nov 4, Luis, Priya')
    expect(screen.queryByTestId('job-trips-next')).toBeNull()
    fireEvent.click(screen.getByTestId('job-trips-last'))
    expect(screen.getByTestId('where').textContent).toBe('/developments/d-heron?trip=t5')
  })

  it('leaves out the count when no trip has gone out yet', () => {
    draw(state({ line: { gone: 0, count: null, last: null, lastTripId: null, lastDoor: null, next: 'next Trip 6, Dec 1 to 5', nextTripId: 't6', nextDoor: 'Open Trip 6', words: 'next Trip 6, Dec 1 to 5' } }))
    expect(screen.getByTestId('job-trips-words').textContent).toBe('next Trip 6, Dec 1 to 5')
    expect(screen.queryByTestId('job-trips-last')).toBeNull()
  })

  it('draws the job’s hours in the five figures, each with its hours', () => {
    draw(state())
    expect(screen.getByRole('img', { name: 'Of 1,022 hours on this job, 840 were at the site' })).toBeTruthy()
    expect([...screen.getByTestId('trip-hours-bar').querySelectorAll('i')].map((i) => i.getAttribute('data-bucket'))).toEqual(['site', 'road', 'ready', 'noPlace', 'home'])
    expect(screen.getByTestId('job-trips-hours-site').textContent).toBe('At the site 840 h')
    expect(screen.getByTestId('job-trips-hours-road').textContent).toBe('On the road 96 h')
    expect(screen.getByTestId('job-trips-hours-ready').textContent).toBe('Getting ready 12 h')
    expect(screen.getByTestId('job-trips-hours-noPlace').textContent).toBe('No place on the punch 31.5 h')
    expect(screen.getByTestId('job-trips-hours-home').textContent).toBe('At home for the site 42 h')
    expect(screen.queryByTestId('job-trips-no-point')).toBeNull()
  })

  it('says why there is no bar while the hours are out, closed or did not read', () => {
    for (const hoursState of ['reading', 'closed', 'failed'] as const) {
      draw(state({ hours: null, hoursState }))
      expect(screen.getByTestId('job-trips-hours-wait').textContent).toBe(JOB_TRIPS_HOURS_WORDS[hoursState])
      expect(screen.queryByTestId('trip-hours-bar')).toBeNull()
      cleanup()
    }
  })

  it('says when the site’s address has no point, so no hour reads At the site', () => {
    draw(state({ noSitePoint: true }))
    expect(screen.getByTestId('job-trips-no-point').textContent).toBe(JOB_TRIPS_NO_POINT_WORDS)
  })

  it('draws nothing on a job no trip names, and nothing for a job with no development', () => {
    draw(state({ line: null }))
    expect(screen.queryByTestId('job-trips-line')).toBeNull()
    cleanup()
    draw(state(), null)
    expect(screen.queryByTestId('job-trips-line')).toBeNull()
  })

  it('Open the site’s trips closes the Job window and goes to the Development page at its Trips look', () => {
    const { onLeave } = draw(state())
    fireEvent.click(screen.getByRole('button', { name: 'Open the site’s trips' }))
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('where').textContent).toBe('/developments/d-heron?look=trips')
  })

  it('+ Trip opens the sheet on a new trip kept on the site, with this job already picked, and saves it', async () => {
    const save = vi.fn(async (_: TripRecord) => undefined)
    draw(state({ save }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '+ Trip' }))
    expect(screen.getByRole('dialog', { name: 'A trip to Heron Point' })).toBeTruthy()
    // The job is under Work goes on, so More is already open.
    expect(screen.getByTestId('trip-job-chip').textContent).toContain('J2101')
    fireEvent.change(screen.getByTestId('trip-add-person'), { target: { value: 'p-dana' } })
    fireEvent.click(screen.getByText('Save the trip'))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0]?.[0]).toMatchObject({ developmentId: 'd-heron', jobId: null, jobIds: ['j2101'], people: [{ personId: 'p-dana', name: 'Dana', days: { [TODAY]: 'site' } }] })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
