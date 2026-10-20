// @vitest-environment jsdom
/**
 * The schedule's PR 14b: the trade's chart in its portal (G-110). The page reads `schedules` beside the slice and draws
 * the job's chart first on the job's page, under its name and above the report (gc 3's pick, call 8): the work before
 * it, its own and the work waiting on it, each neighbour by name and never by price, with Today. A function deployed
 * before the chart sends none, and the page draws none. In Spanish, the chart's words are Spanish. `ownRow` sits under
 * the company's own bars only (call 9).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
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
