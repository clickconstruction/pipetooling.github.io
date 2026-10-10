// @vitest-environment jsdom
/**
 * The trade portal's job, read only (P5c-1, to-dos/gc-mode/mockups/portal-p5.md): once its statement of work is signed,
 * the company reads each line's percent and what was paid through, its punch list, its submittals, its draws and its
 * questions while we build. Nothing on them can be pressed until their kinds come (P5c-2, P5c-3), and the bidding
 * questions, closed long ago, give way to the questions while we build.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample } from '../../supabase/functions/_shared/gcTradePortalSample'
import type { TradePortalSlice } from '../../supabase/functions/_shared/gcTradePortalSlice'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
let slice: TradePortalSlice

beforeEach(() => {
  slice = gcTradePortalSample(TODAY)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ today: TODAY, slice }) })),
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
  fireEvent.click(await screen.findByRole('button', { name: /Sample Dental Office/ }))
  return within(await screen.findByRole('region', { name: 'Electrical · report your work and get paid' }))
}

describe('the company’s job, read only (P5c-1)', () => {
  it('reads each line’s percent done and paid through, its draw and the totals', async () => {
    const report = await openJob()
    expect(report.getByText('60% done')).toBeTruthy()
    expect(report.getByText(/paid through 50%/)).toBeTruthy()
    expect(report.getByText('Draw 1')).toBeTruthy()
    expect(report.getByText('paid')).toBeTruthy()
    expect(report.getByText(/^Paid so far \$13,122/)).toBeTruthy()
  })

  it('reads its punch list and the submittal it owes, with nothing to press yet', async () => {
    const report = await openJob()
    expect(report.getByText('Cover plate missing in operatory 2.')).toBeTruthy()
    expect(report.getByText('Panelboards')).toBeTruthy()
    expect(report.queryByRole('button')).toBeNull()
    expect(report.queryByRole('textbox')).toBeNull()
  })

  it('reads its question while we build with the architect’s answer, in place of the closed bidding questions', async () => {
    await openJob()
    const questions = screen.getAllByRole('region', { name: 'Electrical · questions about the plans' })
    expect(questions).toHaveLength(1)
    const q = within(questions[0]!)
    expect(q.getByText('RFI-001')).toBeTruthy()
    expect(q.getByText(/Recessed, as the elevation on E-201 shows\./)).toBeTruthy()
    expect(q.queryByRole('button')).toBeNull()
  })

  it('shows no job before its statement of work is signed', async () => {
    slice = { ...slice, sows: (slice.sows ?? []).map((s) => ({ ...s, status: 'sent', signed_on: null })) }
    render(
      <MemoryRouter initialEntries={[`/t/${TOKEN}`]}>
        <Routes>
          <Route path="/t/:token" element={<GcTradePortal />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(await screen.findByRole('button', { name: /Sample Dental Office/ }))
    await screen.findByRole('region', { name: 'Electrical · statement of work' })
    expect(screen.queryByRole('region', { name: 'Electrical · report your work and get paid' })).toBeNull()
  })
})
