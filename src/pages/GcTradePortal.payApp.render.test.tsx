// @vitest-environment jsdom
/**
 * The trade portal's pay application door (P5c-3c-i, to-dos/gc-mode/mockups/portal-p5.md), lifted from the spike's
 * `GcBuildingPayApp.tsx`: where its pay application stands under its report, one sent read in its window (the G702 and
 * G703), one we sent back with our note, and the closeout. These run with `WAIVER_SIGN_LIVE` off, as it would be
 * should the owner take the waivers back: a pay application (a conditional waiver itself) goes by email, no Fill out
 * button, one line that says so, and the home's Needs you leaves out the to-dos whose press is a waiver. It is on since
 * the owner's call 2 (v2.5178); `GcTradePortal.payAppSend.render.test.tsx` holds the door and its window with it on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample, SAMPLE_TRADE_IDS as ID } from '../../supabase/functions/_shared/gcTradePortalSample'
import type { SliceRow, TradePortalSlice } from '../../supabase/functions/_shared/gcTradePortalSlice'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))
vi.mock('../lib/gc/drawEmail', async (original) => ({ ...(await original<typeof import('../lib/gc/drawEmail')>()), WAIVER_SIGN_LIVE: false }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
const DRAW2 = '00000000-5a00-4000-8000-000000000099'
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
  fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
  return within(await screen.findByRole('region', { name: 'Electrical · report your work and get paid' }))
}

/** A second pay application, in the shape the slice passes it. */
function draw2(change: SliceRow): SliceRow {
  const first = (slice.draws ?? [])[0]!
  return { ...first, id: DRAW2, number: 2, seq: 2, requested_on: '2026-10-06', status: 'requested', gross: 5832, retainage: 583.2, net: 5248.8, approved_on: null, paid_on: null, period_to: '2026-10-05', signed_on: '2026-10-06', ...change }
}

describe('the pay application door (P5c-3c-i)', () => {
  it('says what it can ask for, and to email the pay application with the waivers off', async () => {
    const report = await openJob()
    expect(report.getByText(/You can ask for/)).toBeTruthy()
    expect(report.queryByText(/Most of the pay application is filled in/)).toBeNull()
    expect(report.getByText('For now, email your pay application to Click.')).toBeTruthy()
    expect(report.queryByRole('button', { name: /Fill out pay application/ })).toBeNull()
  })

  it('reads a pay application with us, and opens it in its window: who sent it and the G702', async () => {
    slice = { ...slice, draws: [...(slice.draws ?? []), draw2({})], drawLines: [...(slice.drawLines ?? []), { draw_id: DRAW2, sow_line_id: ID.sowLine1, to_pct: 70, stored: 0, we_see: null }] }
    const report = await openJob()
    expect(report.getByText('Pay application 2 is with Click. They are checking it.')).toBeTruthy()
    expect(report.queryByText('For now, email your pay application to Click.')).toBeNull()
    fireEvent.click(report.getByRole('button', { name: 'See pay application 2' }))
    const dialog = within(screen.getByRole('dialog', { name: /Pay application 2/ }))
    expect(dialog.getByText(/You sent this/)).toBeTruthy()
    expect(dialog.getByText(/Dana Ortiz, Owner, signed it with a conditional lien waiver/)).toBeTruthy()
    expect(dialog.getByText('Application and certificate for payment')).toBeTruthy()
    fireEvent.click(dialog.getByRole('button', { name: 'Page 2 · 703' }))
    expect(dialog.getByText('Rough-in')).toBeTruthy()
  })

  it('reads one we sent back with our note, and says to email the fixed one', async () => {
    slice = {
      ...slice,
      draws: [...(slice.draws ?? []), draw2({ status: 'sent_back', sent_back_on: '2026-10-07', sent_back_note: 'The trim is not started yet.' })],
      drawLines: [...(slice.drawLines ?? []), { draw_id: DRAW2, sow_line_id: ID.sowLine1, to_pct: 90, stored: 0, we_see: 70 }],
    }
    const report = await openJob()
    expect(report.getByText(/Click sent pay application 2 back/)).toBeTruthy()
    expect(report.getByText(/The trim is not started yet\./)).toBeTruthy()
    expect(report.getByText('Rough-in: Click sees 70%. You asked for 90%.')).toBeTruthy()
    expect(report.getByText('For now, email your pay application to Click.')).toBeTruthy()
    expect(report.queryByRole('button', { name: /Fix and resend/ })).toBeNull()
  })

  it('turns into the closeout once every line is billed', async () => {
    slice = {
      ...slice,
      sows: (slice.sows ?? []).map((s) => ({ ...s, accepted_on: '2026-10-07' })),
      drawLines: [
        { draw_id: ID.draw1, sow_line_id: ID.sowLine1, to_pct: 100, stored: 0, we_see: null },
        { draw_id: ID.draw1, sow_line_id: ID.sowLine2, to_pct: 100, stored: 0, we_see: null },
      ],
      lineReports: [
        { sow_line_id: ID.sowLine1, pct: 100, reported_on: '2026-10-01', seq: 3 },
        { sow_line_id: ID.sowLine2, pct: 100, reported_on: '2026-10-01', seq: 4 },
      ],
    }
    const report = await openJob()
    expect(report.getByText('Closeout.')).toBeTruthy()
    expect(report.getByText(/Click accepted your work/)).toBeTruthy()
    expect(report.queryByRole('button', { name: 'Fill out the final pay application' })).toBeNull()
    expect(report.getByText('Last, you sign the unconditional final release of lien.')).toBeTruthy()
  })
})

describe('the home’s Needs you (P5c-3c-i)', () => {
  const home = async () => {
    render(
      <MemoryRouter initialEntries={[`/t/${TOKEN}`]}>
        <Routes>
          <Route path="/t/:token" element={<GcTradePortal />} />
        </Routes>
      </MemoryRouter>,
    )
    return within(await screen.findByRole('region', { name: /^Needs you/ }))
  }

  it('lists its to-dos, leaving out a draw to ask for and the waiver with the waivers off', async () => {
    const needs = await home()
    expect(needs.getByText('1 punch item to fix on Electrical for Sample Dental Office.')).toBeTruthy()
    expect(needs.queryByText(/You can ask Click for/)).toBeNull()
    expect(needs.queryByText(/Sign the unconditional waiver/)).toBeNull()
  })

  it('opens the project a to-do is about', async () => {
    const needs = await home()
    fireEvent.click(needs.getByRole('button', { name: '1 punch item to fix on Electrical for Sample Dental Office.' }))
    expect(await screen.findByRole('region', { name: 'Electrical · report your work and get paid' })).toBeTruthy()
  })
})
