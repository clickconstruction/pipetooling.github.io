// @vitest-environment jsdom
/**
 * The trade portal's job (P5c-1 to P5c-3b, to-dos/gc-mode/mockups/portal-p5.md): once its statement of work is signed,
 * the company reads each line's percent and what was paid through, its punch list, its submittals, its draws and its
 * questions while we build. Since P5c-2 it marks a punch item fixed, sends a submittal round and asks a question; since
 * P5c-3b it reports a line's percent and signs a change we sent. Each posts its kind, the page reads the slice again, a
 * refusal shows in the company's words, and the preview posts nothing. The unconditional waiver waits on the owner's call
 * (`GcTradePortal.waiver.render.test.tsx` turns it on); the pay application takes no press until P5c-3c. The bidding questions, closed long ago, give way to the questions while
 * we build.
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
  fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
  return within(await screen.findByRole('region', { name: 'Electrical · report your work and get paid' }))
}

/** A typed signature as `/contract/accept`'s form takes it: the name, then I agree and I agree to sign electronically. */
function fillTheForm(block: ReturnType<typeof within>, name = 'Dana Ortiz') {
  fireEvent.change(block.getByPlaceholderText('Your full legal name'), { target: { value: name } })
  const boxes = block.getAllByRole('checkbox')
  fireEvent.click(boxes[0]!)
  fireEvent.click(boxes[1]!)
}

const questionsBlock = () => {
  const blocks = screen.getAllByRole('region', { name: 'Electrical · questions about the plans' })
  expect(blocks).toHaveLength(1)
  return within(blocks[0]!)
}

describe('the company’s job (P5c-1)', () => {
  it('reads each line’s percent done and paid through, its draw and the totals', async () => {
    const report = await openJob()
    expect((report.getByRole('combobox', { name: 'Percent done, Rough-in' }) as HTMLSelectElement).value).toBe('60')
    expect(report.getByText(/paid through 50%/)).toBeTruthy()
    expect(report.getByText('Draw 1')).toBeTruthy()
    expect(report.getByText('paid')).toBeTruthy()
    expect(report.getByText(/^Paid so far \$13,122/)).toBeTruthy()
  })

  it('reads each line’s percent as text, with no picker, on a job we no longer build', async () => {
    slice = { ...slice, projects: slice.projects.map((p) => (p.project.id === ID.job ? { ...p, gc: { ...p.gc, closed_on: '2026-10-07' } } : p)) }
    const report = await openJob()
    expect(report.getByText('60% done')).toBeTruthy()
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
    fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
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
    fireEvent.click(await screen.findByRole('button', { name: /^Sample Dental Office/ }))
    await screen.findByRole('region', { name: 'Electrical · statement of work' })
    expect(screen.queryByRole('button', { name: 'Ask Click a question' })).toBeNull()
  })
})

describe('report, waiver and change (P5c-3b)', () => {
  it('reports a line’s percent from a picker that never goes below what was billed', async () => {
    const report = await openJob()
    const rough = report.getByRole('combobox', { name: 'Percent done, Rough-in' }) as HTMLSelectElement
    expect([...rough.options].map((o) => o.value)).toEqual(['50', '60', '70', '80', '90', '100'])
    const trim = report.getByRole('combobox', { name: 'Percent done, Trim and fixtures' }) as HTMLSelectElement
    expect(trim.options).toHaveLength(11)
    fireEvent.change(rough, { target: { value: '80' } })
    await waitFor(() => expect(posts).toEqual([{ token: TOKEN, kind: 'sow_report', packageId: ID.jobTrade, line: ID.jobLine1, pct: 80 }]))
    await waitFor(() => expect(reads).toHaveLength(2))
  })

  it('says a split line in the company’s words, under its picker', async () => {
    postAnswer = { ok: false, body: { error: 'splitLine' } }
    const report = await openJob()
    fireEvent.change(report.getByRole('combobox', { name: 'Percent done, Rough-in' }), { target: { value: '70' } })
    expect(await report.findByText('That line is split into parts. Tell us how far each part is.')).toBeTruthy()
    expect((report.getByRole('combobox', { name: 'Percent done, Rough-in' }) as HTMLSelectElement).value).toBe('60')
    expect(reads).toHaveLength(1)
  })

  it('draws no waiver press while the owner’s call holds it (WAIVER_SIGN_LIVE)', async () => {
    const report = await openJob()
    expect(report.getByText('Draw 1')).toBeTruthy()
    expect(report.queryByRole('button', { name: 'Sign the unconditional waiver' })).toBeNull()
  })

  it('reads a waiver signed, with no press', async () => {
    slice = { ...slice, draws: (slice.draws ?? []).map((d) => ({ ...d, waiver: 'unconditional', waiver_on: '2026-10-07' })) }
    const report = await openJob()
    expect(report.getByText('waiver signed')).toBeTruthy()
    expect(report.queryByRole('button', { name: 'Sign the unconditional waiver' })).toBeNull()
  })

  it('signs a change we sent: what it adds, then a typed name and the e-sign consent', async () => {
    slice = {
      ...slice,
      changeOrders: (slice.changeOrders ?? []).map((o) => ({ ...o, status: 'signed', description: 'Two more circuits for the dental chairs.' })),
      changeSends: [{ change_order_id: ID.changeOrder, sow_id: ID.sow, sent_on: '2026-10-06', signed_on: null, sow_line_id: null }],
    }
    const report = await openJob()
    expect(report.getByText('Change order 2 to your statement of work.')).toBeTruthy()
    expect(report.getByText(/Two more circuits for the dental chairs\. It adds \$3,400\./)).toBeTruthy()
    fireEvent.click(report.getByRole('button', { name: 'Sign the change' }))
    expect(report.getByText(/By signing, this change becomes a line of your statement of work\./)).toBeTruthy()
    fillTheForm(report)
    fireEvent.click(report.getByRole('button', { name: 'Sign the change' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({ kind: 'sign_change', changeOrderId: ID.changeOrder, printedName: 'Dana Ortiz', esignConsent: { documentNoun: 'this change order' } })
  })

  it('posts nothing from the office’s preview, and says so under the picker', async () => {
    const report = await openJob(`/t/${TOKEN}?preview=1`)
    fireEvent.change(report.getByRole('combobox', { name: 'Percent done, Rough-in' }), { target: { value: '70' } })
    expect(await report.findByText('Preview. Nothing is saved from here.')).toBeTruthy()
    expect(posts).toEqual([])
  })
})
