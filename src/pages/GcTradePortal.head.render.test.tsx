// @vitest-environment jsdom
/**
 * Punch list #205, PR 2: the job head at the top of a trade partner's job page. Sample Electric opens Sample Dental
 * Office and reads the start, the planned finish and the days left, its own work as one bar, Who to call right under the
 * head, and Needs you on this job with the job's own lines, each opening its block. A bidding project keeps Who to call
 * at the foot and draws no head. An answer with no finish draws the head without the finish line.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample, gcTradePortalSampleSchedules, SAMPLE_TRADE_IDS as ID } from '../../supabase/functions/_shared/gcTradePortalSample'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
let body: Record<string, unknown> = {}

beforeEach(() => {
  body = { today: TODAY, slice: gcTradePortalSample(TODAY), schedules: gcTradePortalSampleSchedules(TODAY) }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const open = async (project: RegExp) => {
  render(
    <MemoryRouter initialEntries={[`/t/${TOKEN}`]}>
      <Routes>
        <Route path="/t/:token" element={<GcTradePortal />} />
      </Routes>
    </MemoryRouter>,
  )
  fireEvent.click(await screen.findByRole('button', { name: project }))
}

const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('the job head (punch list #205, PR 2)', () => {
  it('opens the job on its dates, its own work as one bar, Who to call and Needs you on this job', async () => {
    await open(/^Sample Dental Office/)
    const head = (await screen.findByText('Started Sep 8 · Click plans to finish Nov 17 · 40 days left')).closest('[data-portal-head]')!
    const work = screen.getByRole('region', { name: 'Your work on this job' })
    expect(within(work).getByText('36% done · $17,496 of $48,600')).toBeTruthy()
    expect(within(work).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('36')
    expect(within(work).getByText('Rough-in 60% · Trim and fixtures 0% · from the percents you reported')).toBeTruthy()
    // Who to call moved up: under the head, above the chart.
    const call = screen.getByRole('region', { name: 'Who to call' })
    const chart = screen.getByRole('region', { name: 'Your schedule on this job' })
    expect(within(call).getByText('Jordan Reyes')).toBeTruthy()
    expect(follows(head, call)).toBe(true)
    expect(follows(call, chart)).toBe(true)
    // Needs you on this job: the job's own lines, the punch item among them, and none of another project's.
    const needs = screen.getByRole('region', { name: /^Needs you on this job · \d+$/ })
    expect(within(needs).getByText(/1 punch item to fix on Electrical for Sample Dental Office/)).toBeTruthy()
    expect(within(needs).queryByText(/Sample Retail Shell/)).toBeNull()
    expect(follows(call, needs)).toBe(true)
    expect(head.textContent).not.toContain('3910')
  })

  it('scrolls to the line’s block when a line of Needs you on this job is pressed', async () => {
    const scrolled = vi.fn()
    Element.prototype.scrollIntoView = scrolled
    await open(/^Sample Dental Office/)
    const needs = within(await screen.findByRole('region', { name: /^Needs you on this job/ }))
    scrolled.mockClear()
    fireEvent.click(needs.getByText(/Click charged you \$850/))
    const charges = document.querySelector(`[data-portal-anchor="charges:${ID.jobTrade}"]`)!
    expect(scrolled.mock.instances).toContain(charges)
  })

  it('draws the head without the finish line when the answer has no finish, and no head on a project we bid', async () => {
    const schedules = gcTradePortalSampleSchedules(TODAY)
    const { finish: _finish, ...bare } = schedules[ID.job]!
    body = { ...body, schedules: { [ID.job]: bare } }
    await open(/^Sample Dental Office/)
    expect(await screen.findByText('Started Sep 8')).toBeTruthy()
    expect(screen.queryByText(/plans to finish/)).toBeNull()
    cleanup()
    await open(/^Sample Retail Shell/)
    await screen.findByRole('region', { name: 'Electrical · plans' })
    expect(document.querySelector('[data-portal-head]')).toBeNull()
    // Who to call stays at the foot: after the ask block.
    expect(follows(screen.getByRole('region', { name: 'Electrical · invitation to quote' }), screen.getByRole('region', { name: 'Who to call' }))).toBe(true)
  })
})
