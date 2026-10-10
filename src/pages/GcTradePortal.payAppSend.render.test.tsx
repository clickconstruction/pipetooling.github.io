// @vitest-environment jsdom
/**
 * The trade portal's pay application sends (P5c-3c-ii, to-dos/gc-mode/mockups/portal-p5.md), on since the owner's call 2
 * (`WAIVER_SIGN_LIVE`, v2.5178): the door opens the window on a new pay application, its sign step lays out the
 * conditional waiver it signs as the app's own paper with the e-sign consent, and Send posts `pay_app` (or the final
 * one, `final_pay_app`). A refusal keeps the window open in the company's words. With the flag off,
 * `GcTradePortal.payApp.render.test.tsx` finds no Fill out button.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { gcTradePortalSample, SAMPLE_TRADE_IDS as ID } from '../../supabase/functions/_shared/gcTradePortalSample'
import type { TradePortalSlice } from '../../supabase/functions/_shared/gcTradePortalSlice'

vi.mock('../lib/publicFunctionStaffHeaders', () => ({ staffAwarePublicHeaders: async () => ({ apikey: 'anon', Authorization: 'Bearer anon' }) }))

import GcTradePortal from './GcTradePortal'

const TODAY = '2026-10-08'
const TOKEN = '0123456789abcdef0123456789abcdef'
const reads: string[] = []
const posts: Record<string, unknown>[] = []
let slice: TradePortalSlice
let postAnswer: { ok: boolean; body: unknown } = { ok: true, body: { ok: true } }

beforeEach(() => {
  reads.length = 0
  posts.length = 0
  slice = gcTradePortalSample(TODAY)
  postAnswer = { ok: true, body: { ok: true } }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)) as Record<string, unknown>)
        return { ok: postAnswer.ok, json: async () => postAnswer.body }
      }
      reads.push(url)
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

/** The details and the signature: the period, the title, I agree, and I agree to sign electronically. */
function fillAndSign(dialog: ReturnType<typeof within>, agree = 'I read this waiver and I agree to it.') {
  fireEvent.change(dialog.getByLabelText('Period ends'), { target: { value: '2026-10-05' } })
  fireEvent.change(dialog.getByLabelText('Your title'), { target: { value: 'Owner' } })
  fireEvent.click(dialog.getByRole('checkbox', { name: agree }))
  fireEvent.click(dialog.getByRole('checkbox', { name: /I agree to sign electronically/ }))
}

describe('a pay application sent from the portal, once the owner turns the waivers on (P5c-3c-ii)', () => {
  it('lays the conditional waiver it signs as the app’s paper, and sends it with the e-sign consent', async () => {
    const report = await openJob()
    fireEvent.click(report.getByRole('button', { name: 'Fill out pay application 2' }))
    const dialog = within(screen.getByRole('dialog', { name: /Pay application 2/ }))
    const paper = within(document.querySelector('[data-trade-waiver-paper="conditional_progress"]') as HTMLElement)
    expect(paper.getByText('Conditional Waiver and Release on Progress Payment')).toBeTruthy()
    expect(paper.getByText(/a check from Click Construction in the sum of \$2,624\.\d\d payable to Sample Electric Co\./)).toBeTruthy()
    const sendIt = dialog.getByRole('button', { name: 'Send to Click' }) as HTMLButtonElement
    expect(sendIt.disabled).toBe(true)
    fillAndSign(dialog)
    expect(sendIt.disabled).toBe(false)
    fireEvent.click(sendIt)
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({
      token: TOKEN,
      kind: 'pay_app',
      packageId: ID.jobTrade,
      app: {
        periodTo: '2026-10-05',
        address: '400 Sample St, Boerne',
        signedBy: 'Dana Ortiz',
        signedTitle: 'Owner',
        lines: [
          { line: ID.jobLine1, toPct: 60 },
          { line: ID.jobLine2, toPct: 0 },
        ],
      },
      esignConsent: { version: 2, lang: 'en', audience: 'sub', documentNoun: 'this conditional lien waiver' },
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(reads).toHaveLength(2)
  })

  it('keeps the window open with a refusal in the company’s words', async () => {
    postAnswer = { ok: false, body: { error: 'drawWaiting' } }
    const report = await openJob()
    fireEvent.click(report.getByRole('button', { name: 'Fill out pay application 2' }))
    const dialog = within(screen.getByRole('dialog', { name: /Pay application 2/ }))
    fillAndSign(dialog)
    fireEvent.click(dialog.getByRole('button', { name: 'Send to Click' }))
    expect(await dialog.findByText('Your last pay application is still with us.')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(reads).toHaveLength(1)
  })

  it('sends the final one from the closeout, on the final conditional release, with no lines', async () => {
    slice = {
      ...slice,
      sows: (slice.sows ?? []).map((s) => ({ ...s, accepted_on: '2026-10-07' })),
      punch: [],
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
    fireEvent.click(report.getByRole('button', { name: 'Fill out the final pay application' }))
    const dialog = within(screen.getByRole('dialog', { name: /Final pay application/ }))
    expect(document.querySelector('[data-trade-waiver-paper="conditional_final"]')).not.toBeNull()
    fillAndSign(dialog, 'I read this release and I agree to it.')
    fireEvent.click(dialog.getByRole('button', { name: 'Send to Click' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({ kind: 'final_pay_app', packageId: ID.jobTrade, app: { periodTo: '2026-10-05', signedTitle: 'Owner' }, esignConsent: { documentNoun: 'this conditional final release of lien' } })
    expect((posts[0]!.app as Record<string, unknown>).lines).toBeUndefined()
  })
})
