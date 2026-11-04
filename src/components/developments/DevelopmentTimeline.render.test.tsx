// @vitest-environment jsdom
/**
 * The Money look's Timeline (v2.6493, punch list #257): the job chips with All jobs the default, a
 * press that narrows the chart and the scope line that says so, the jobs with no dated event
 * counted, the chart's key, and the reading, failed and empty states. Made-up jobs only.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import type { SiteTimelineJob } from '../../lib/developments/siteTimeline'
import { DevelopmentTimeline } from './DevelopmentTimeline'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

beforeAll(installDomShims)
afterEach(cleanup)

function job(jobId: string, label: string, over: Partial<SiteTimelineJob> = {}): SiteTimelineJob {
  return { jobId, label, charges: [], payments: [], values: [], revenue: null, fallbackPercent: null, overheadDays: [], ...over }
}
const jobs: SiteTimelineJob[] = [
  job('j1', 'JP612', {
    charges: [
      { source: 'supply_house', dateKey: '2026-03-01', amount: 1200, label: 'Ferguson — invoice 1001', jobId: 'j1' },
      { source: 'mercury_card', dateKey: '2026-03-02', amount: 412.5, label: 'Lowe’s', jobId: 'j1' },
    ],
    payments: [{ dateKey: '2026-03-10', amount: 5000, label: 'Payment — check', jobId: 'j1' }],
  }),
  job('j2', 'JP583', { charges: [{ source: 'sub_labor', dateKey: '2026-03-08', amount: 80, label: 'Sub — sub labor', jobId: 'j2', who: 'Sub' }] }),
  job('j3', 'JP953'),
  job('j4', 'JP960', { charges: [{ source: 'tally_part', dateKey: null, amount: 9, label: 'Elbow', jobId: 'j4' }] }),
]

describe('DevelopmentTimeline', () => {
  it('draws the chips in order with All jobs pressed, counts the jobs left out, and the chart’s key', () => {
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs, fuelKnown: true, teamLaborNote: null }} phone={false} />)
    const group = screen.getByRole('group', { name: 'Jobs on the chart' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['All jobs', 'JP612', 'JP583'])
    expect(screen.getByTestId('timeline-chip-all').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('timeline-chip-j1').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('timeline-chip-j1').getAttribute('title')).toBe('JP612: $1,612.50 of cost so far')
    expect(screen.getByTestId('timeline-scope').textContent).toBe('All 2 jobs on one chart. 2 jobs with no dated charge or payment are left out.')
    expect(screen.getByText(/cost to date/).textContent).toContain('Red')
    expect(screen.getByText(/cost to date/).textContent).not.toContain('Value line hidden')
  })

  it('a chip narrows the chart to that job and the scope line says so; All jobs brings the site back', () => {
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs, fuelKnown: true, teamLaborNote: null }} phone={false} />)
    fireEvent.click(screen.getByTestId('timeline-chip-j2'))
    expect(screen.getByTestId('timeline-chip-j2').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('timeline-chip-all').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('timeline-scope').textContent).toContain('1 of 2 jobs on the chart. Press All jobs for the whole site.')
    fireEvent.click(screen.getByTestId('timeline-chip-j1'))
    expect(screen.getByTestId('timeline-scope').textContent).toContain('All 2 jobs on one chart.')
    fireEvent.click(screen.getByTestId('timeline-chip-j1'))
    expect(screen.getByTestId('timeline-scope').textContent).toContain('1 of 2 jobs on the chart.')
    fireEvent.click(screen.getByTestId('timeline-chip-all'))
    expect(screen.getByTestId('timeline-chip-all').getAttribute('aria-pressed')).toBe('true')
  })

  it('the chips wrap and the chart fills the width on a phone', () => {
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs, fuelKnown: false, teamLaborNote: 'The clock’s rows did not read, so team labor is not on the chart.' }} phone />)
    const group = screen.getByTestId('timeline-jobs') as HTMLElement
    expect(group.style.flexWrap).toBe('wrap')
    expect((screen.getByTestId('development-timeline') as HTMLElement).style.minWidth).toBe('0')
    expect(screen.getByTestId('timeline-scope').textContent).toContain('The clock’s rows did not read')
    expect(screen.getByTestId('timeline-scope').textContent).toContain('Fuel could not be told from the other card charges.')
  })

  it('reading, failed and nothing dated', () => {
    const r = renderWithProviders(<DevelopmentTimeline read={{ state: 'reading' }} phone={false} />)
    expect(screen.getByTestId('timeline-reading').textContent).toContain('Reading the site’s charges')
    r.unmount()
    renderWithProviders(<DevelopmentTimeline read={{ state: 'failed', reason: 'the bank’s rows are closed to you' }} phone={false} />)
    expect(screen.getByTestId('timeline-failed').textContent).toBe('The timeline did not read: the bank’s rows are closed to you')
    cleanup()
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs: [job('j3', 'JP953')], fuelKnown: true, teamLaborNote: null }} phone={false} />)
    expect(screen.getByText('Nothing dated on this site yet.')).toBeTruthy()
  })
})
