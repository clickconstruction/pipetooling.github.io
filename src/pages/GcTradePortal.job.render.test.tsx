// @vitest-environment jsdom
/**
 * The trade portal's job (P5c-1 and P5c-2, to-dos/gc-mode/mockups/portal-p5.md): once its statement of work is signed, the
 * company reads each line's percent and what was paid through, its punch list, its submittals, its draws and its
 * questions while we build. Since P5c-2 it marks a punch item fixed, sends a submittal round and asks a question; each
 * posts its kind, the page reads the slice again, a refusal shows in the company's words, and the preview posts nothing.
 * The report, the pay application and the waivers take no press until P5c-3. The bidding questions, closed long ago, give
 * way to the questions while we build.
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

const open = (path = `/t/${TOKEN}`) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:token" element={<GcTradePortal />} />
      </Routes>
    </MemoryRouter>,
  )

const openJob = async (path?: string) => {
  open(path)
  fireEvent.click(await screen.findByRole('button', { name: /Sample Dental Office/ }))
  return within(await screen.findByRole('region', { name: 'Electrical · report your work and get paid' }))
}

const questionsBlock = () => {
  const blocks = screen.getAllByRole('region', { name: 'Electrical · questions about the plans' })
  expect(blocks).toHaveLength(1)
  return within(blocks[0]!)
}

describe('the company’s job (P5c-1)', () => {
  it('reads each line’s percent done and paid through, its draw and the totals, with no picker yet', async () => {
    const report = await openJob()
    expect(report.getByText('60% done')).toBeTruthy()
    expect(report.getByText(/paid through 50%/)).toBeTruthy()
    expect(report.getByText('Draw 1')).toBeTruthy()
    expect(report.getByText('paid')).toBeTruthy()
    expect(report.getByText(/^Paid so far \$13,122/)).toBeTruthy()
    expect(report.queryByRole('combobox')).toBeNull()
  })

  it('reads its question while we build with the architect’s answer, in place of the closed bidding questions', async () => {
    await openJob()
    const q = questionsBlock()
    expect(q.getByText('RFI-001')).toBeTruthy()
    expect(q.getByText(/Recessed, as the elevation on E-201 shows\./)).toBeTruthy()
  })

  it('shows no job before its statement of work is signed', async () => {
    slice = { ...slice, sows: (slice.sows ?? []).map((s) => ({ ...s, status: 'sent', signed_on: null })) }
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Sample Dental Office/ }))
    await screen.findByRole('region', { name: 'Electrical · statement of work' })
    expect(screen.queryByRole('region', { name: 'Electrical · report your work and get paid' })).toBeNull()
  })
})

describe('its presses (P5c-2)', () => {
  it('marks a punch item fixed with one press, then reads the slice again', async () => {
    const report = await openJob()
    expect(report.getByText(/Fix each one, then tell Click here\./)).toBeTruthy()
    fireEvent.click(report.getByRole('button', { name: 'It is fixed' }))
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'punch_fixed', itemId: ID.punch1 }]))
    await waitFor(() => expect(reads).toHaveLength(2))
  })

  it('sends the submittal round it owes: the file’s name, its Drive link and a note', async () => {
    const report = await openJob()
    const send = report.getByRole('button', { name: 'Send it' })
    expect((send as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(report.getByLabelText('The file you send'), { target: { value: ' panelboards.pdf ' } })
    fireEvent.change(report.getByLabelText('Its Drive link, if you have one'), { target: { value: 'https://drive.google.com/file/d/p' } })
    fireEvent.change(report.getByLabelText('A note for Click'), { target: { value: 'Square D, as specified.' } })
    fireEvent.click(send)
    await waitFor(() =>
      expect(posts).toEqual([
        { token: TOKEN, kind: 'submittal_send', submittalId: ID.submittal1, fileName: 'panelboards.pdf', driveUrl: 'https://drive.google.com/file/d/p', note: 'Square D, as specified.' },
      ]),
    )
  })

  it('asks a question while we build, with the sheets it is about', async () => {
    await openJob()
    const q = questionsBlock()
    fireEvent.click(q.getByRole('button', { name: 'Ask Click a question' }))
    const sendQ = q.getByRole('button', { name: 'Send to Click' })
    expect((sendQ as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(q.getByPlaceholderText('What the plans do not say, or say two ways'), { target: { value: ' Is the trim ring white or brushed? ' } })
    fireEvent.change(q.getByLabelText(/Sheets it is about/), { target: { value: 'E-301, E-302' } })
    fireEvent.click(sendQ)
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'rfi_ask', packageId: ID.jobTrade, question: 'Is the trim ring white or brushed?', sheets: ['E-301', 'E-302'] }]))
  })

  it('shows a refusal in the company’s words under the press, and reads nothing again', async () => {
    postAnswer = { ok: false, body: { error: 'punchNotOpen' } }
    const report = await openJob()
    fireEvent.click(report.getByRole('button', { name: 'It is fixed' }))
    expect(await report.findByText('That item is marked fixed already. Reload the page.')).toBeTruthy()
    expect(reads).toHaveLength(1)
  })

  it('posts nothing from the office’s preview, and says so', async () => {
    const report = await openJob(`/t/${TOKEN}?preview=1`)
    fireEvent.click(report.getByRole('button', { name: 'It is fixed' }))
    expect(await report.findByText('Preview. Nothing is saved from here.')).toBeTruthy()
    expect(posts).toEqual([])
  })

  it('offers no question on a job we are not building yet', async () => {
    slice = { ...slice, projects: slice.projects.map((p) => (p.project.id === ID.job ? { ...p, gc: { ...p.gc, stage: 'buyout' } } : p)), rfis: [] }
    open()
    fireEvent.click(await screen.findByRole('button', { name: /Sample Dental Office/ }))
    await screen.findByRole('region', { name: 'Electrical · statement of work' })
    expect(screen.queryByRole('button', { name: 'Ask Click a question' })).toBeNull()
  })
})
