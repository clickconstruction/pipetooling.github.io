// @vitest-environment jsdom
/**
 * Render smokes for the Choose job sheet (punch list #216): Recent with its when words and Show N
 * more, All jobs with its count, typing lighting the run where it landed with number hits first, a
 * customer hit showing the customer line, the empty state's press, a pick, and a failed Recent read.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
const fetchMarks = vi.fn()
vi.mock('../../lib/tally/fetchRecentJobsForTally', () => ({
  fetchRecentJobMarks: (...args: unknown[]) => fetchMarks(...args),
}))

import { TallyChooseJobSheet } from './TallyChooseJobSheet'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { todayYmdInAppTz, ymdAddDays } from '../../utils/dateUtils'
import type { RecentJobMark } from '../../lib/tally/recentJobs'

const JOBS = [
  { id: '972', hcp_number: '972', job_name: 'Pinpoint & gas test', job_address: '1140 Lago Vista Dr, San Marcos', customer_name: 'Alvarez Homes', service_type_id: null },
  { id: '971', hcp_number: '971', job_name: 'Water heater swap', job_address: '408 Pecan Hollow, Kyle', customer_name: 'Nguyen', service_type_id: null },
  { id: '968', hcp_number: '968', job_name: 'PRV replacement', job_address: '210 Cliffside Dr, Shavano Park', customer_name: null, service_type_id: null },
  { id: '967', hcp_number: '967', job_name: 'Well pump', job_address: '530 S Ranch Rd, Blanco', customer_name: null, service_type_id: null },
  { id: '925', hcp_number: '925', job_name: 'Tunnel repair', job_address: '250 Pincea Pl, San Marcos', customer_name: null, service_type_id: null },
  { id: '924', hcp_number: '924', job_name: 'Slab leak', job_address: '215 Jetlyn Dr, San Antonio', customer_name: null, service_type_id: null },
  { id: '97', hcp_number: '97', job_name: 'Diagnostic visit', job_address: '6320 Aster Run, New Braunfels', customer_name: null, service_type_id: null },
]

const today = todayYmdInAppTz()
const clock = (jobId: string, daysAgo: number): RecentJobMark => {
  const ymd = ymdAddDays(today, -daysAgo)
  return { jobId, ymd, at: `${ymd}T13:00:00Z`, source: 'clock' }
}
const FIVE_MARKS = [clock('968', 0), clock('972', 1), clock('925', 2), clock('924', 5), clock('967', 6)]

function renderSheet(marks: RecentJobMark[] = FIVE_MARKS, over: Record<string, unknown> = {}) {
  fetchMarks.mockReset()
  fetchMarks.mockResolvedValue({ marks, failure: null })
  const onPick = vi.fn()
  const onClose = vi.fn()
  const r = renderWithProviders(<TallyChooseJobSheet jobs={JOBS} selectedJobId="968" viewerUserId="u-1" onPick={onPick} onClose={onClose} {...over} />)
  return { ...r, onPick, onClose }
}

const rowTexts = (container: HTMLElement) => Array.from(container.querySelectorAll('button')).map((b) => b.textContent ?? '').filter((t) => /·/.test(t))
/** The row whose words include `text`; the runs split a row's text across spans, so a text query cannot find it. */
const rowWith = (container: HTMLElement, text: string) => Array.from(container.querySelectorAll('button')).find((b) => (b.textContent ?? '').includes(text)) ?? null

describe('TallyChooseJobSheet', () => {
  it('opens on Recent with when words, Show 2 more, then All jobs with its count', async () => {
    const { container } = renderSheet()
    expect(await screen.findByText('Clocked in today')).toBeTruthy()
    expect(screen.getByText('Clocked in yesterday')).toBeTruthy()
    expect(screen.getByText(/jobs you were on/)).toBeTruthy()
    expect(screen.getByText('· 7')).toBeTruthy()
    const rows = rowTexts(container)
    expect(rows[0]).toContain('968 · PRV replacement')
    expect(rows[0]).toContain('Clocked in today')
    expect(rows.filter((t) => t.includes('967 · Well pump'))).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }))
    await settle()
    expect(rowTexts(container).filter((t) => t.includes('967 · Well pump'))).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Show .* more/ })).toBeNull()
    expect(fetchMarks).toHaveBeenCalledWith('u-1')
  })

  it('the search is not focused on open', async () => {
    renderSheet()
    await screen.findByText('Clocked in today')
    expect(document.activeElement).not.toBe(screen.getByLabelText('Find a job'))
  })

  it('typing a number lights it, puts the number typed first and counts the matches', async () => {
    const { container } = renderSheet()
    await screen.findByText('Clocked in today')
    fireEvent.change(screen.getByLabelText('Find a job'), { target: { value: '97' } })
    await settle()
    const marks = Array.from(container.querySelectorAll('mark')).map((m) => m.textContent)
    expect(marks.length).toBeGreaterThan(0)
    expect(marks.every((t) => t === '97')).toBe(true)
    expect(screen.getByText('· 1 match')).toBeTruthy()
    expect(screen.getByText('· 3 match')).toBeTruthy()
    const rows = rowTexts(container)
    expect(rows[0]).toContain('972 · Pinpoint & gas test')
    expect(rows[0]).toContain('Clocked in yesterday')
    expect(rows[1]).toContain('97 · Diagnostic visit')
    expect(rows[2]).toContain('972 · Pinpoint')
    expect(rows[3]).toContain('971 · Water heater swap')
    expect(screen.queryByText(/Show .* more/)).toBeNull()
  })

  it('a customer hit shows the customer line with the hit lit', async () => {
    const { container } = renderSheet()
    await screen.findByText('Clocked in today')
    fireEvent.change(screen.getByLabelText('Find a job'), { target: { value: 'alvarez' } })
    await settle()
    expect(container.querySelector('mark')?.textContent).toBe('Alvarez')
    expect(rowWith(container, '972 · Pinpoint')?.textContent).toContain('Alvarez Homes')
    expect(rowWith(container, '971 · Water heater')).toBeNull()
    expect(screen.queryByText(/jobs you were on/)).toBeNull()
  })

  it('two words land whichever way round, and ⊗ clears what was typed', async () => {
    const { container } = renderSheet()
    await screen.findByText('Clocked in today')
    fireEvent.change(screen.getByLabelText('Find a job'), { target: { value: 'marcos tunnel' } })
    await settle()
    expect(Array.from(container.querySelectorAll('mark')).map((m) => m.textContent)).toEqual(['Tunnel', 'Marcos', 'Tunnel', 'Marcos'])
    fireEvent.click(screen.getByRole('button', { name: 'Clear what you typed' }))
    await settle()
    expect(screen.getByText('· 7')).toBeTruthy()
  })

  it('nothing matching says so and the press clears the search', async () => {
    renderSheet()
    await screen.findByText('Clocked in today')
    fireEvent.change(screen.getByLabelText('Find a job'), { target: { value: 'lago vista 99' } })
    await settle()
    expect(screen.getByText('No jobs match ‘lago vista 99’.')).toBeTruthy()
    expect(screen.queryByText(/All jobs/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }))
    await settle()
    expect(screen.getByText('· 7')).toBeTruthy()
  })

  it('a pick hands back the job', async () => {
    const { onPick, container } = renderSheet()
    await screen.findByText('Clocked in today')
    fireEvent.click(rowWith(container, '971 · Water heater swap') as HTMLButtonElement)
    expect(onPick).toHaveBeenCalledWith('971')
  })

  it('draws no Recent section without marks, and none for a viewer it does not know', async () => {
    renderSheet([])
    await screen.findByText('· 7')
    expect(screen.queryByText(/^Recent/)).toBeNull()
    fetchMarks.mockClear()
    renderSheet(FIVE_MARKS, { viewerUserId: null })
    await settle()
    expect(fetchMarks).not.toHaveBeenCalled()
  })

  it('Show my jobs only holds All jobs to the ids, and an empty hold offers the press', async () => {
    const onClearOnly = vi.fn()
    const { container } = renderSheet([], { onlyIds: new Set(['971']), onClearOnly })
    await screen.findByText('· 1')
    expect(rowWith(container, '971 · Water heater swap')).toBeTruthy()
    expect(rowWith(container, '972 · Pinpoint & gas test')).toBeNull()
    renderSheet([], { onlyIds: new Set<string>(), onClearOnly })
    await screen.findByText('No jobs match the filters.')
    fireEvent.click(screen.getByRole('button', { name: 'Clear the filters' }))
    expect(onClearOnly).toHaveBeenCalled()
  })

  it('a failed Recent read draws its reason with Retry, and All jobs still lists', async () => {
    fetchMarks.mockReset()
    fetchMarks.mockResolvedValue({ marks: [], failure: { kind: 'network', message: 'Your recent jobs did not load.' } })
    renderWithProviders(<TallyChooseJobSheet jobs={JOBS} selectedJobId={null} viewerUserId="u-1" onPick={vi.fn()} onClose={vi.fn()} />)
    // A network failure is the kind the panel offers Retry on; its sentence is the panel's own.
    const alert = await screen.findByRole('alert')
    expect(alert.querySelector('button')).toBeTruthy()
    expect(screen.getByText('· 7')).toBeTruthy()
    expect(screen.queryByText(/^Recent/)).toBeNull()
  })
})
