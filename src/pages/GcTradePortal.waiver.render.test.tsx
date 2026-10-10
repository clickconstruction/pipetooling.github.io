// @vitest-environment jsdom
/**
 * The trade portal's unconditional waiver (P5c-3b, to-dos/gc-mode/mockups/portal-p5.md), with `WAIVER_SIGN_LIVE` turned on
 * as the owner's call will: a paid draw with its conditional waiver shows Sign the unconditional waiver; the plain lines
 * explain the paper, the paper is the Release of Lien window's own form filled from the draw, and the press posts the
 * typed name and the e-sign consent. While the call holds it, `GcTradePortal.job.render.test.tsx` finds no press.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample, SAMPLE_TRADE_IDS as ID } from '../../supabase/functions/_shared/gcTradePortalSample'
import type { TradePortalSlice } from '../../supabase/functions/_shared/gcTradePortalSlice'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))
vi.mock('../lib/gc/drawEmail', async (original) => ({ ...(await original<typeof import('../lib/gc/drawEmail')>()), WAIVER_SIGN_LIVE: true }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
const posts: Record<string, unknown>[] = []
let slice: TradePortalSlice

beforeEach(() => {
  posts.length = 0
  slice = gcTradePortalSample(TODAY)
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return { ok: true, json: async () => ({ ok: true }) }
      }
      return { ok: true, json: async () => ({ today: TODAY, slice }) }
    }),
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

describe('the unconditional waiver, once the owner turns it on', () => {
  it('lays the app’s own waiver paper under the plain lines, filled from the draw', async () => {
    const report = await openJob()
    fireEvent.click(report.getByRole('button', { name: 'Sign the unconditional waiver' }))
    expect(report.getByText('This waiver says we paid you $13,122 for draw 1. By signing, you give up your lien rights for the work it paid.')).toBeTruthy()
    const paper = within(document.querySelector('[data-trade-waiver-paper="unconditional_progress"]') as HTMLElement)
    expect(paper.getByText('Unconditional Waiver and Release on Progress Payment')).toBeTruthy()
    expect(paper.getByText(/has been paid and has received progress payment\(s\) totaling \$13,122\.00/)).toBeTruthy()
    expect(paper.getByText(/Sample Dental Office, 3 Sample Ln, Fair Oaks Ranch, through September 24, 2026/)).toBeTruthy()
    expect(paper.getByText('Sample Electric Co.', { exact: false })).toBeTruthy()
  })

  it('signs it with a typed name and the e-sign consent, the name on the paper as it is typed', async () => {
    const report = await openJob()
    fireEvent.click(report.getByRole('button', { name: 'Sign the unconditional waiver' }))
    fireEvent.change(report.getByPlaceholderText('Your full legal name'), { target: { value: 'Dana Ortiz' } })
    expect(within(document.querySelector('[data-trade-waiver-paper]') as HTMLElement).getByText('Dana Ortiz')).toBeTruthy()
    const boxes = report.getAllByRole('checkbox')
    fireEvent.click(boxes[0]!)
    fireEvent.click(boxes[1]!)
    fireEvent.click(report.getByRole('button', { name: 'Sign the unconditional waiver' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({
      token: TOKEN,
      kind: 'unconditional_waiver',
      drawId: ID.draw1,
      printedName: 'Dana Ortiz',
      esignConsent: { version: 2, lang: 'en', audience: 'sub', documentNoun: 'this unconditional lien waiver' },
    })
    expect(posts[0]).not.toHaveProperty('signaturePngBase64')
  })

  it('lays the final form on the final draw', async () => {
    slice = { ...slice, draws: (slice.draws ?? []).map((d) => ({ ...d, final: true, gross: 0, retainage: -4860, net: 4860 })) }
    const report = await openJob()
    fireEvent.click(report.getByRole('button', { name: 'Sign the final release' }))
    expect(document.querySelector('[data-trade-waiver-paper="unconditional_final"]')).not.toBeNull()
    expect(report.getByText(/final payment of \$4,860\.00/)).toBeTruthy()
  })
})
