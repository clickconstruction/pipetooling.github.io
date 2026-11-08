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
// The print window (v2.6499): captured, never opened.
const printed = vi.hoisted(() => ({ html: [] as string[], open: true }))
vi.mock('../../lib/jobsDocuments/printWindow', () => ({
  openHtmlPrintWindow: (html: string) => {
    printed.html.push(html)
    return printed.open
  },
}))

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
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs, fuelKnown: true, teamLaborNote: null, overheadNote: null, overheadSinceLabel: null, valueNote: null, siteName: 'Harlow Ranch', customerName: null, printedBy: null }} phone={false} />)
    const group = screen.getByRole('group', { name: 'Jobs on the chart' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['All jobs', 'JP612', 'JP583'])
    expect(screen.getByTestId('timeline-chip-all').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('timeline-chip-j1').getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByTestId('timeline-chip-j1').getAttribute('title')).toBe('JP612: $1,612.50 of cost so far')
    expect(screen.getByTestId('timeline-scope').textContent).toBe('All 2 jobs on one chart. 2 jobs have no dated charge or payment. They are listed under the chart.')
    expect(screen.getByText(/cost to date/).textContent).toContain('Red')
    expect(screen.getByText(/cost to date/).textContent).not.toContain('Value line hidden')
  })

  it('a chip narrows the chart to that job and the scope line says so; All jobs brings the site back', () => {
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs, fuelKnown: true, teamLaborNote: null, overheadNote: null, overheadSinceLabel: null, valueNote: null, siteName: 'Harlow Ranch', customerName: null, printedBy: null }} phone={false} />)
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
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs, fuelKnown: false, teamLaborNote: 'The clock’s rows did not read, so team labor is not on the chart.', overheadNote: 'The overhead ledger is still reading. The amber band lands with it.', overheadSinceLabel: null, valueNote: 'The reports are still reading. The value line comes with them.', siteName: 'Harlow Ranch', customerName: null, printedBy: null }} phone />)
    const group = screen.getByTestId('timeline-jobs') as HTMLElement
    expect(group.style.flexWrap).toBe('wrap')
    expect((screen.getByTestId('development-timeline') as HTMLElement).style.minWidth).toBe('0')
    expect(screen.getByTestId('timeline-scope').textContent).toContain('The clock’s rows did not read')
    expect(screen.getByTestId('timeline-scope').textContent).toContain('Fuel could not be told from the other card charges.')
    expect(screen.getByTestId('timeline-scope').textContent).toContain('The overhead ledger is still reading.')
    expect(screen.getByText(/cost to date/).textContent).not.toContain('Amber')
  })

  it('the amber band draws once a job carries overhead days, and the key says where office cost begins (v2.6498)', () => {
    const withOverhead = jobs.map((j) => (j.jobId === 'j1' ? { ...j, overheadDays: [{ dateKey: '2026-03-02', amount: 120.5 }, { dateKey: '2026-03-15', amount: 80 }] } : j))
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs: withOverhead, fuelKnown: true, teamLaborNote: null, overheadNote: null, overheadSinceLabel: 'Feb 19, 2026', valueNote: null, siteName: 'Harlow Ranch', customerName: 'Ridgeway Builders', printedBy: 'Dana' }} phone={false} />)
    const key = screen.getByText(/cost to date/).textContent ?? ''
    expect(key).toContain('Amber')
    expect(key).toContain('since Feb 19, 2026, where office cost begins')
  })

  it('the value line waits behind its toggle once a job has a price and a percent, and the scope line counts the jobs that add their current percent (v2.6499)', () => {
    const withValue = jobs.map((j) => (j.jobId === 'j1' ? { ...j, revenue: 10000, values: [{ dateKey: '2026-03-05', percent: 40, label: 'Report by Dana', jobId: 'j1' }] } : j.jobId === 'j2' ? { ...j, revenue: 4000, fallbackPercent: 25 } : j))
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs: withValue, fuelKnown: true, teamLaborNote: null, overheadNote: null, overheadSinceLabel: null, valueNote: null, siteName: 'Harlow Ranch', customerName: null, printedBy: null }} phone={false} />)
    const toggle = screen.getByLabelText('Value created (right axis)') as HTMLInputElement
    expect(toggle.checked).toBe(false)
    expect(screen.getByTestId('timeline-scope').textContent).toContain('1 job with no dated percent adds its current percent at the end of the value line.')
    fireEvent.click(toggle)
    expect(screen.getByText(/cost to date/).textContent).toContain('Blue = value created (each job’s % done × its price, summed, right axis)')
  })

  it('without a priced job with a percent the key says why the value line is hidden, in the site’s words', () => {
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs, fuelKnown: true, teamLaborNote: null, overheadNote: null, overheadSinceLabel: null, valueNote: 'The reports are still reading. The value line comes with them.', siteName: 'Harlow Ranch', customerName: null, printedBy: null }} phone={false} />)
    expect(screen.queryByLabelText('Value created (right axis)')).toBeNull()
    expect(document.body.textContent).toContain('Value line hidden: no job on the chart has both a price and a percent')
    expect(screen.getByTestId('timeline-scope').textContent).toContain('The reports are still reading.')
  })

  it('Print or save as PDF opens the print page with the site’s name, the scope line and the chart; a blocked window says so (v2.6499)', () => {
    printed.html.length = 0
    printed.open = true
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs, fuelKnown: true, teamLaborNote: null, overheadNote: null, overheadSinceLabel: null, valueNote: null, siteName: 'Harlow Ranch', customerName: 'Ridgeway Builders', printedBy: 'Dana' }} phone={false} />)
    // jsdom draws no plot (no box for the responsive container), so a stand-in surface takes the chart’s place.
    const host = screen.getByTestId('development-timeline')
    const surface = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    surface.setAttribute('class', 'recharts-surface')
    surface.setAttribute('width', '800')
    surface.setAttribute('height', '320')
    host.querySelector('.recharts-responsive-container')?.appendChild(surface)
    fireEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    expect(printed.html).toHaveLength(1)
    expect(printed.html[0]).toContain('<h1>Harlow Ranch · cost timeline</h1>')
    expect(printed.html[0]).toContain('Ridgeway Builders · All 2 jobs on one chart.')
    expect(printed.html[0]).toContain('viewBox="0 0 800 320"')
    expect(printed.html[0]).toContain('by Dana')
    // The strip rides into the print (v2.6711).
    expect(printed.html[0]).toContain('<p class="head">Not on the chart · 2 jobs with no dated charge or payment</p>')
    expect(printed.html[0]).toContain('<p>JP960 · 1 tally part with no date · date it and the job joins the chart · $9.00</p>')
    expect(printed.html[0]).toContain('Together $1,701.50, the Scoreboard’s cost before overhead')
    expect(screen.queryByTestId('timeline-print-note')).toBeNull()
    printed.open = false
    fireEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    expect(screen.getByTestId('timeline-print-note').textContent).toContain('The print window was blocked.')
  })

  it('the ledger strip lists the jobs the chart cannot draw with their cost and reason, sums them with the chart’s end, and opens a job from its name (v2.6711)', () => {
    const openJob = vi.fn()
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs, fuelKnown: true, teamLaborNote: null, overheadNote: null, overheadSinceLabel: null, valueNote: null, siteName: 'Harlow Ranch', customerName: null, printedBy: null }} phone={false} openJob={openJob} />)
    const strip = screen.getByTestId('timeline-strip')
    expect(strip.textContent).toContain('Not on the chart · 2 jobs')
    expect(strip.textContent).toContain('no dated charge or payment')
    const rows = [screen.getByTestId('timeline-strip-row-j3'), screen.getByTestId('timeline-strip-row-j4')]
    expect(rows[0]!.textContent).toBe('JP953nothing charged yet$0.00')
    expect(rows[1]!.textContent).toBe('JP9601 tally part with no date · date it and the job joins the chart$9.00')
    // The chart ends on the two dated jobs, 1,612.50 + 80; the strip holds the 9 off it.
    expect(screen.getByTestId('timeline-strip-sum').textContent).toBe('Chart ends at $1,692.50 · Not on the chart $9.00 · Together $1,701.50, the Scoreboard’s cost before overhead')
    fireEvent.click(within(rows[1]!).getByRole('button', { name: 'JP960' }))
    expect(openJob).toHaveBeenCalledWith('j4')
    // The strip sits under the chart and above the print press.
    const chart = document.querySelector('.recharts-responsive-container')!
    expect(chart.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(strip.compareDocumentPosition(screen.getByRole('button', { name: 'Print or save as PDF' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the strip narrows to two columns on a phone with the reason on its own line, and is not drawn when every job is dated', () => {
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs, fuelKnown: true, teamLaborNote: null, overheadNote: null, overheadSinceLabel: null, valueNote: null, siteName: 'Harlow Ranch', customerName: null, printedBy: null }} phone />)
    const row = screen.getByTestId('timeline-strip-row-j4') as HTMLElement
    expect(row.style.gridTemplateColumns).toBe('minmax(0, 1fr) auto')
    const reason = within(row).getByText(/with no date/) as HTMLElement
    expect(reason.style.gridColumn).toBe('1 / -1')
    expect((screen.getByTestId('timeline-strip') as HTMLElement).style.minWidth).toBe('0')
    // Without openJob the name is plain words, not a press.
    expect(within(row).queryByRole('button')).toBeNull()
    cleanup()
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs: jobs.filter((j) => j.jobId === 'j1' || j.jobId === 'j2'), fuelKnown: true, teamLaborNote: null, overheadNote: null, overheadSinceLabel: null, valueNote: null, siteName: 'Harlow Ranch', customerName: null, printedBy: null }} phone={false} />)
    expect(screen.queryByTestId('timeline-strip')).toBeNull()
    expect(screen.getByTestId('timeline-scope').textContent).toBe('All 2 jobs on one chart.')
  })

  it('reading, failed and nothing dated', () => {
    const r = renderWithProviders(<DevelopmentTimeline read={{ state: 'reading' }} phone={false} />)
    expect(screen.getByTestId('timeline-reading').textContent).toContain('Reading the site’s charges')
    r.unmount()
    renderWithProviders(<DevelopmentTimeline read={{ state: 'failed', reason: 'the bank’s rows are closed to you' }} phone={false} />)
    expect(screen.getByTestId('timeline-failed').textContent).toBe('The timeline did not read: the bank’s rows are closed to you')
    cleanup()
    renderWithProviders(<DevelopmentTimeline read={{ state: 'ready', jobs: [job('j3', 'JP953')], fuelKnown: true, teamLaborNote: null, overheadNote: null, overheadSinceLabel: null, valueNote: null, siteName: 'Harlow Ranch', customerName: null, printedBy: null }} phone={false} />)
    expect(screen.getByText('Nothing dated on this site yet.')).toBeTruthy()
  })
})
