// @vitest-environment jsdom
/**
 * Job Mode's top row: the squares each day draws, the doors they open, and a row that never waits on a
 * read. Every job here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const navigate = vi.fn()
const openJobDetail = vi.fn()
const openInExternalBrowser = vi.fn()

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: vi.fn() }))
vi.mock('../../contexts/JobDetailModalContext', () => ({ useJobDetailModal: () => ({ openJobDetail }) }))
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => openInExternalBrowser(url) }))
vi.mock('../../hooks/useTallyUnlinkedCounts', () => ({ useTallyUnlinkedCounts: () => ({ unlinked: 2, staleUnlinked: 0, minAgeDays: 3, refetch: () => {} }) }))
vi.mock('../photos/JobPhotosWindowLazy', () => ({ JobPhotosWindowLazy: ({ job }: { job: { id: string } }) => <div data-testid="photos-window">{job.id}</div> }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

import { UpdateFocusOpenerBridgeProvider, useUpdateFocusOpenerBridge } from '../../contexts/UpdateFocusOpenerBridgeContext'
import { recordNavClick } from '../../lib/navClickTelemetry'
import type { TopRowDay } from '../../lib/jobMode/topRow'
import { JobModeTopRow } from './JobModeTopRow'

const cedar = { id: 'j-cedar', number: 'J2417', name: 'Cedar Hollow 12', address: '1208 Wrenfield Loop' }
const noDay: TopRowDay = { clock: null, todayStops: [], visitedJobIds: [] }
const ahead: TopRowDay = { clock: null, todayStops: [{ job: cedar, timeStart: '08:00:00', timeEnd: '11:00:00' }], visitedJobIds: [] }
const onSite: TopRowDay = { clock: { job: cedar, leg: 'on-site' }, todayStops: ahead.todayStops, visitedJobIds: [] }
const noBoxes = async () => 0

beforeEach(() => {
  navigate.mockClear()
  openJobDetail.mockClear()
  openInExternalBrowser.mockClear()
  vi.mocked(recordNavClick).mockClear()
})
afterEach(cleanup)

const settle = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}
const names = () => [...document.querySelectorAll('[data-job-mode-top-row] > *')].map((el) => el.textContent)
const square = (id: string) => document.querySelector(`[data-top-row-square="${id}"]`) as HTMLElement

describe('JobModeTopRow', () => {
  it('while the day is read: two empty squares hold the job pair\'s place beside the two that never move', async () => {
    let land: (d: TopRowDay) => void = () => {}
    renderWithProviders(<JobModeTopRow userId="u1" role="helpers" load={() => new Promise<TopRowDay>((r) => (land = r))} loadBoxes={noBoxes} />)
    expect(document.querySelector('[data-job-mode-top-row]')?.getAttribute('data-job-mode-top-row')).toBe('reading')
    expect(names()).toEqual(['', '', 'Paint a map', 'My spend2'])
    await act(async () => land(ahead))
    expect(names()).toEqual(['Directions', 'Job details', 'Paint a map', 'My spend2'])
  })

  it('a job ahead: Directions opens the phone\'s maps and Job details opens the job\'s window', async () => {
    renderWithProviders(<JobModeTopRow userId="u1" role="helpers" load={async () => ahead} loadBoxes={noBoxes} />)
    await settle()
    expect(document.querySelector('[data-job-mode-top-row]')?.getAttribute('data-job-mode-top-row')).toBe('ahead')
    fireEvent.click(screen.getByRole('button', { name: 'Directions to J2417 · Cedar Hollow 12' }))
    expect(openInExternalBrowser).toHaveBeenCalledWith('https://www.google.com/maps/dir/?api=1&destination=1208%20Wrenfield%20Loop')
    fireEvent.click(screen.getByRole('button', { name: 'Job details, J2417 · Cedar Hollow 12' }))
    expect(openJobDetail).toHaveBeenCalledWith({ jobId: 'j-cedar' })
    expect(vi.mocked(recordNavClick).mock.calls.map((c) => [c[2], c[3]])).toEqual([
      ['job-mode-row', '#directions'],
      ['job-mode-row', '#job-details'],
    ])
  })

  it('on site: Photo opens the job\'s photos, and Job details keeps its place', async () => {
    renderWithProviders(<JobModeTopRow userId="u1" role="helpers" load={async () => onSite} loadBoxes={noBoxes} />)
    await settle()
    expect(names()).toEqual(['Photo', 'Job details', 'Paint a map', 'My spend2'])
    expect(screen.queryByTestId('photos-window')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Photo: add one to J2417 · Cedar Hollow 12' }))
    expect(screen.getByTestId('photos-window').textContent).toBe('j-cedar')
  })

  it('on a site that holds boxes: a fifth square with the count, opening On site on the job', async () => {
    const loadBoxes = vi.fn(async () => 93)
    renderWithProviders(<JobModeTopRow userId="u1" role="helpers" load={async () => onSite} loadBoxes={loadBoxes} />)
    await settle()
    expect(loadBoxes).toHaveBeenCalledWith('j-cedar')
    expect(names()).toEqual(['Photo', 'Job details', 'On site93', 'Paint a map', 'My spend2'])
    fireEvent.click(screen.getByRole('button', { name: 'On site: 93 boxes of materials on this site' }))
    expect(navigate).toHaveBeenCalledWith('/tally?tab=on-site&job=j-cedar')
  })

  it('the box count is not read for a job the person is not standing on', async () => {
    const loadBoxes = vi.fn(async () => 93)
    renderWithProviders(<JobModeTopRow userId="u1" role="helpers" load={async () => ahead} loadBoxes={loadBoxes} />)
    await settle()
    expect(loadBoxes).not.toHaveBeenCalled()
    expect(square('on-site')).toBeNull()
  })

  it('no job today: the week\'s hours and tomorrow, as values with their names', async () => {
    renderWithProviders(<JobModeTopRow userId="u1" role="helpers" hoursThisWeek={28.94} tomorrowJobs={2} load={async () => noDay} loadBoxes={noBoxes} />)
    await settle()
    expect(names()).toEqual(['28.9 hThis week', '2 jobsTomorrow', 'Paint a map', 'My spend2'])
    fireEvent.click(screen.getByRole('button', { name: 'Tomorrow: 2 jobs. Open the schedule' }))
    expect(navigate).toHaveBeenCalledWith('/job-mode/schedule')
  })

  it('before the week and the schedule are read, the same two squares say what they open', async () => {
    renderWithProviders(<JobModeTopRow userId="u1" role="helpers" load={async () => noDay} loadBoxes={noBoxes} />)
    await settle()
    expect(names()).toEqual(['My hours', 'Schedule', 'Paint a map', 'My spend2'])
  })

  it('a read that fails draws the person\'s own squares, with no press held', async () => {
    renderWithProviders(<JobModeTopRow userId="u1" role="helpers" hoursThisWeek={12} tomorrowJobs={0} load={async () => Promise.reject(new Error('no signal'))} loadBoxes={noBoxes} />)
    await settle()
    expect(names()).toEqual(['12 hThis week', 'No jobsTomorrow', 'Paint a map', 'My spend2'])
  })

  it('My spend carries its name and its count, and is a link to the charges', async () => {
    renderWithProviders(<JobModeTopRow userId="u1" role="helpers" load={async () => noDay} loadBoxes={noBoxes} />)
    await settle()
    const spend = screen.getByRole('link', { name: 'My spend: 2 charges to put on a job' })
    expect(spend.getAttribute('href')).toBe('/tally?tab=transactions')
  })

  it('every square is the same size, 44 px or taller', async () => {
    renderWithProviders(<JobModeTopRow userId="u1" role="helpers" load={async () => onSite} loadBoxes={async () => 3} />)
    await settle()
    const all = [...document.querySelectorAll('[data-job-mode-top-row] > *')] as HTMLElement[]
    expect(all).toHaveLength(5)
    for (const el of all) {
      expect(el.style.flex).toBe('1 1 0px')
      expect(parseInt(el.style.minHeight, 10)).toBeGreaterThanOrEqual(44)
    }
  })

  it('reads the day again when the clock changes', async () => {
    let day: TopRowDay = ahead
    const load = vi.fn(async () => day)
    let tell = () => {}
    const Teller = () => {
      tell = useUpdateFocusOpenerBridge().notifySessionChanged
      return null
    }
    renderWithProviders(
      <UpdateFocusOpenerBridgeProvider>
        <Teller />
        <JobModeTopRow userId="u1" role="helpers" load={load} loadBoxes={noBoxes} />
      </UpdateFocusOpenerBridgeProvider>,
    )
    await settle()
    expect(names()[0]).toBe('Directions')
    day = onSite
    act(() => tell())
    await settle()
    expect(load).toHaveBeenCalledTimes(2)
    expect(names()[0]).toBe('Photo')
  })

  it('draws nothing with nobody signed in', () => {
    const { container } = renderWithProviders(<JobModeTopRow userId={null} role={null} load={async () => noDay} loadBoxes={noBoxes} />)
    expect(container.querySelector('[data-job-mode-top-row]')).toBeNull()
  })
})
