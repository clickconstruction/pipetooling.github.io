// @vitest-environment jsdom
/**
 * The schedule's PR 14b: the trade's chart in its portal (G-110). The page reads `schedules` beside the slice and draws
 * the job's chart first on the job's page, under its name and above the report (gc 3's pick, call 8): the work before
 * it, its own and the work waiting on it, each neighbour by name and never by price, with Today. A function deployed
 * before the chart sends none, and the page draws none. In Spanish, the chart's words are Spanish. `ownRow` sits under
 * the company's own bars only (call 9).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample, gcTradePortalSampleSchedules, SAMPLE_TRADE_IDS as ID } from '../../supabase/functions/_shared/gcTradePortalSample'
import { GcTradePortalSchedule } from '../components/gc/GcTradePortalSchedule'
import { PortalLangContext } from '../components/gc/gcTradePortalLang'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
let withCharts = true

beforeEach(() => {
  withCharts = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ today: TODAY, slice: gcTradePortalSample(TODAY), ...(withCharts ? { schedules: gcTradePortalSampleSchedules(TODAY) } : {}) }) })),
  )
})
afterEach(() => vi.unstubAllGlobals())

const openJob = async () => {
  render(
    <MemoryRouter initialEntries={[`/t/${TOKEN}`]}>
      <Routes>
        <Route path="/t/:token" element={<GcTradePortal />} />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
  await screen.findByRole('region', { name: 'Electrical · report your work and get paid' })
}

describe('the trade’s chart in its portal (the schedule’s PR 14b)', () => {
  it('draws first on the job’s page: the work before, its own and the work waiting on it, by name and never by price', async () => {
    await openJob()
    const chart = screen.getByRole('region', { name: 'Your schedule on this job' })
    const report = screen.getByRole('region', { name: 'Electrical · report your work and get paid' })
    // Above the report: its dates frame everything below.
    expect(chart.compareDocumentPosition(report) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const c = within(chart)
    for (const title of ['Before you', 'Your work', 'Waiting on you']) expect(c.getByText(title)).toBeTruthy()
    expect(c.getByText('Framing and drywall')).toBeTruthy()
    expect(c.getByText(/^Hill Country Framing · /)).toBeTruthy()
    expect(c.getByText('Paint and finishes')).toBeTruthy()
    expect(chart.querySelectorAll('[data-portal-bar="mine"]')).toHaveLength(2)
    expect(chart.querySelectorAll('[data-portal-bar="theirs"]')).toHaveLength(2)
    expect(chart.querySelector('[data-portal-today]')!.textContent).toBe('today')
    expect(chart.textContent).not.toContain('$')
  })

  it('draws no chart when the function sent none', async () => {
    withCharts = false
    await openJob()
    expect(screen.queryByRole('region', { name: 'Your schedule on this job' })).toBeNull()
  })

  it('says its words in Spanish, and keeps the slot under its own bars only', () => {
    const schedule = gcTradePortalSampleSchedules(TODAY)[ID.job]!
    render(
      <PortalLangContext.Provider value="es">
        <GcTradePortalSchedule schedule={schedule} today={TODAY} ownRow={(bar) => <span data-own-row={bar.lineId}>slot</span>} />
      </PortalLangContext.Provider>,
    )
    const chart = screen.getByRole('region', { name: 'Su cronograma en este trabajo' })
    for (const title of ['Antes de usted', 'Su trabajo', 'Esperando por usted']) expect(within(chart).getByText(title)).toBeTruthy()
    expect([...chart.querySelectorAll('[data-own-row]')].map((el) => el.getAttribute('data-own-row'))).toEqual(schedule.mine.map((b) => b.lineId))
  })
})

describe('the job’s phases above the bars (#204 PR 6, the owner’s call 5)', () => {
  it('draws the phases as a strip with their dates and the dates to meet, by name and dates alone', async () => {
    await openJob()
    const chart = screen.getByRole('region', { name: 'Your schedule on this job' })
    const strip = chart.querySelector('[data-portal-phases]')!
    expect(strip).toBeTruthy()
    expect(within(chart).getByText("The job's phases")).toBeTruthy()
    expect(strip.querySelectorAll('[data-portal-phase]')).toHaveLength(3)
    expect(within(chart).getByText('MEP rough-in')).toBeTruthy()
    expect(within(chart).getByText('Dates to meet')).toBeTruthy()
    expect(chart.querySelector('[data-portal-dates]')!.textContent).toContain('Roof on')
    expect(chart.querySelector('[data-portal-dates]')!.textContent).toContain(', met')
    // Above the bars: the strip comes before the first group.
    expect(strip.compareDocumentPosition(within(chart).getByText('Before you')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(strip.textContent).not.toContain('$')
  })

  it('says the strip’s words in Spanish, and draws none for a schedule with no phases', () => {
    const schedule = gcTradePortalSampleSchedules(TODAY)[ID.job]!
    render(
      <PortalLangContext.Provider value="es">
        <GcTradePortalSchedule schedule={schedule} today={TODAY} />
      </PortalLangContext.Provider>,
    )
    const chart = screen.getByRole('region', { name: 'Su cronograma en este trabajo' })
    for (const title of ['Las fases del trabajo', 'Fechas a cumplir']) expect(within(chart).getByText(title)).toBeTruthy()
    expect(chart.querySelector('[data-portal-dates]')!.textContent).toContain(', cumplida')
    expect(within(chart).getByText(/25 días/)).toBeTruthy()
    cleanup()
    const { phases: _phases, dates: _dates, ...bare } = schedule
    render(<GcTradePortalSchedule schedule={bare} today={TODAY} />)
    expect(document.querySelector('[data-portal-phases]')).toBeNull()
  })
})
