// @vitest-environment jsdom
/**
 * Job Mode's top row under the new phone layout (`lib/phoneLayout/jobCard.ts`): the squares fold into the card
 * only for the job the card says it holds, and only with the switch on at a phone's width. Any other day keeps
 * its squares, so no press is ever left with no place. Every job here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const screenIs = vi.hoisted(() => ({ phone: true }))

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))
vi.mock('../../contexts/JobDetailModalContext', () => ({ useJobDetailModal: () => ({ openJobDetail: vi.fn() }) }))
vi.mock('../../hooks/useTallyUnlinkedCounts', () => ({ useTallyUnlinkedCounts: () => ({ unlinked: 2, staleUnlinked: 0, minAgeDays: 3, refetch: () => {} }) }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => screenIs.phone }))

import { UpdateFocusOpenerBridgeProvider } from '../../contexts/UpdateFocusOpenerBridgeContext'
import type { TopRowDay } from '../../lib/jobMode/topRow'
import { setFoldedJobId } from '../../lib/phoneLayout/foldedJob'
import { NEW_PHONE_LAYOUT_STORAGE_KEY } from '../../lib/phoneLayout/newPhoneLayout'
import { JobModeTopRow } from './JobModeTopRow'

const cedar = { id: 'j-cedar', number: 'J2417', name: 'Cedar Hollow 12', address: '1208 Wrenfield Loop' }
const noDay: TopRowDay = { clock: null, todayStops: [], visitedJobIds: [] }
const ahead: TopRowDay = { clock: null, todayStops: [{ job: cedar, timeStart: '08:00:00', timeEnd: '11:00:00' }], visitedJobIds: [] }
const onSite: TopRowDay = { clock: { job: cedar, leg: 'on-site' }, todayStops: ahead.todayStops, visitedJobIds: [] }

const settle = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}
const names = () => [...document.querySelectorAll('[data-job-mode-top-row] > *')].map((el) => el.textContent)
const row = () => document.querySelector('[data-job-mode-top-row]')

async function draw(day: TopRowDay, opts: { switchOn: boolean; phone?: boolean; folded: string | null }) {
  screenIs.phone = opts.phone ?? true
  if (opts.switchOn) localStorage.setItem(NEW_PHONE_LAYOUT_STORAGE_KEY, '1')
  setFoldedJobId(opts.folded)
  renderWithProviders(
    <UpdateFocusOpenerBridgeProvider>
      <JobModeTopRow userId="u1" role="helpers" hoursThisWeek={28.94} tomorrowJobs={2} load={async () => day} loadBoxes={async () => 0} />
    </UpdateFocusOpenerBridgeProvider>,
  )
  await settle()
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  setFoldedJobId(null)
  localStorage.clear()
})

describe('JobModeTopRow under the new phone layout', () => {
  it('folds into the card for the job the card holds: a stop ahead', async () => {
    await draw(ahead, { switchOn: true, folded: 'j-cedar' })
    expect(row()).toBeNull()
  })

  it('folds on site too: the card has Photos, Job details, Materials on site, Paint a map and My spend', async () => {
    await draw(onSite, { switchOn: true, folded: 'j-cedar' })
    expect(row()).toBeNull()
  })

  it('comes back when the card lets go of the job', async () => {
    await draw(ahead, { switchOn: true, folded: 'j-cedar' })
    expect(row()).toBeNull()
    await act(async () => setFoldedJobId(null))
    expect(names()).toEqual(['Directions', 'Job details', 'Paint a map', 'My spend2'])
  })

  it('stays when the card holds no job: a job its papers close, the short page, a day the card lays out the old way', async () => {
    await draw(ahead, { switchOn: true, folded: null })
    expect(names()).toEqual(['Directions', 'Job details', 'Paint a map', 'My spend2'])
  })

  it('stays when the card holds another job than the squares’', async () => {
    await draw(ahead, { switchOn: true, folded: 'j-other' })
    expect(names()).toEqual(['Directions', 'Job details', 'Paint a map', 'My spend2'])
  })

  it('a day with no job keeps This week and Tomorrow as they were', async () => {
    await draw(noDay, { switchOn: true, folded: null })
    expect(names()).toEqual(['28.9 hThis week', '2 jobsTomorrow', 'Paint a map', 'My spend2'])
  })

  it('switch off: the row is the row it was, whatever the card says', async () => {
    await draw(ahead, { switchOn: false, folded: 'j-cedar' })
    expect(names()).toEqual(['Directions', 'Job details', 'Paint a map', 'My spend2'])
  })

  it('at a desk: the row is the row it was, with the tick on', async () => {
    await draw(onSite, { switchOn: true, phone: false, folded: 'j-cedar' })
    expect(names()).toEqual(['Photo', 'Job details', 'Paint a map', 'My spend2'])
  })
})
