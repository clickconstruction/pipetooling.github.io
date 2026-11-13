// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import ReceiptLink, { ReceiptLinkPage } from './ReceiptLink'
import { RECEIPT_LINK_WORDS, RECEIPT_PAGE_WORDS as W, type ReceiptPageCharge } from '../lib/tickets/receiptLink'
import type { ReceiptLinkIo, ReceiptLinkView, ReceiptWriteAnswer } from '../lib/tickets/receiptLinkIo'

// Every name and number here is made up.
const CODE = 'k7m2p9xq4d'

const shrink = (async (file: File) => ({ blob: file as Blob, width: 1200, height: 1600, shrunk: true })) as unknown as typeof import('../lib/photos/shrink').shrinkReportPhoto

const charge = (more: Partial<ReceiptPageCharge> = {}): ReceiptPageCharge => ({
  id: 'req-1',
  store: 'Ridgeway Supply',
  amount: 228.58,
  moneyBack: false,
  when: '2026-11-04T16:02:00Z',
  cardOf: 'Jordan',
  dead: false,
  sortedJob: null,
  ticket: null,
  dayJobs: [
    { id: 'job-a', label: 'JP1042 · Oak Hollow Bldg C' },
    { id: 'job-b', label: 'JP1038 · Cedar Bend water heater' },
  ],
  ...more,
})

const withTicket = (more: Partial<NonNullable<ReceiptPageCharge['ticket']>> = {}, c: Partial<ReceiptPageCharge> = {}): ReceiptPageCharge =>
  charge({ ticket: { id: 't1', door: 'link', takenAt: '2026-11-05T00:14:00Z', job: null, jobId: null, noOneJob: false, pages: [{ id: 'p1', pdf: false }], canChangeJob: true, canAddPage: true, ...more }, ...c })

function fakeIo(view: ReceiptLinkView, more: Partial<ReceiptLinkIo> = {}): ReceiptLinkIo {
  return {
    read: vi.fn(async () => view),
    addPage: vi.fn(async (): Promise<ReceiptWriteAnswer> => ({ ok: true, charge: withTicket(), kept: false })),
    setJob: vi.fn(async (): Promise<ReceiptWriteAnswer> => ({ ok: true, charge: withTicket({ job: 'JP1042 · Oak Hollow Bldg C', jobId: 'job-a' }), kept: false })),
    pageUrl: (code, pageId) => `https://fn.example/receipt-link?code=${code}&page=${pageId}`,
    ...more,
  }
}

const open = (...charges: ReceiptPageCharge[]): ReceiptLinkView => ({ kind: 'open', charges, closesOn: '2026-11-18' })
const photo = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9])], 'receipt.jpg', { type: 'image/jpeg' })

function mount(io: ReceiptLinkIo, code: string | null = CODE) {
  return render(<ReceiptLinkPage code={code} io={io} shrink={shrink} />)
}

function pick(testId: string, file: File) {
  fireEvent.change(screen.getByTestId(testId), { target: { files: [file] } })
}

beforeAll(() => {
  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn(() => 'blob:shot')
  URL.revokeObjectURL = vi.fn()
})
afterEach(cleanup)

describe('the receipt link’s page', () => {
  it('a first visit shows the charge and its one press, and nothing of anyone else', async () => {
    const io = fakeIo(open(charge()))
    mount(io)
    expect(await screen.findByRole('heading', { name: 'Ridgeway Supply' })).toBeTruthy()
    expect(io.read).toHaveBeenCalledWith(CODE)
    expect(screen.getByText('$228.58')).toBeTruthy()
    expect(screen.getByText('Wed, Nov 4, 10:02 AM')).toBeTruthy()
    expect(screen.getByText('Jordan’s card')).toBeTruthy()
    expect(screen.getByText('not sorted yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: W.camera })).toBeTruthy()
    expect(screen.getByRole('button', { name: W.file })).toBeTruthy()
    expect(screen.getByText(/This link opens until Nov 18\./)).toBeTruthy()
    // The day's jobs, skippable, and Not for one job.
    expect(screen.getByRole('button', { name: 'JP1042 · Oak Hollow Bldg C' })).toBeTruthy()
    expect(screen.getByRole('button', { name: W.notOneJob })).toBeTruthy()
  })

  it('the photo goes with the chip tapped, and the page says Got it', async () => {
    const io = fakeIo(open(charge()))
    mount(io)
    fireEvent.click(await screen.findByRole('button', { name: 'JP1042 · Oak Hollow Bldg C' }))
    expect(screen.getByRole('button', { name: /JP1042/ }).getAttribute('aria-pressed')).toBe('true')
    pick('receipt-camera-input', photo())
    await waitFor(() => expect(io.addPage).toHaveBeenCalledTimes(1))
    const sent = (io.addPage as ReturnType<typeof vi.fn>).mock.calls[0]!
    expect(sent[0]).toBe(CODE)
    expect(sent[1]).toMatchObject({ charge: 'req-1', job: { jobId: 'job-a' }, replace: null, width: 1200, height: 1600 })
    expect(String(sent[1].pageId)).toMatch(/^[0-9a-f-]{36}$/)
    expect(await screen.findByRole('heading', { name: 'Got it. The receipt is on $228.58 at Ridgeway Supply.' })).toBeTruthy()
    expect(screen.getByTestId('receipt-on-charge')).toBeTruthy()
    expect(screen.getByRole('button', { name: W.retake })).toBeTruthy()
    expect(screen.getByRole('button', { name: W.addPage })).toBeTruthy()
    expect(screen.queryByRole('button', { name: W.camera })).toBeNull()
  })

  it('with no signal the photo waits on the page, says so, and Try again sends the same page', async () => {
    let n = 0
    const io = fakeIo(open(charge()), {
      addPage: vi.fn(async (): Promise<ReceiptWriteAnswer> => (++n === 1 ? { ok: false, why: 'signal' } : { ok: true, charge: withTicket(), kept: false })),
    })
    mount(io)
    await screen.findByRole('button', { name: W.camera })
    pick('receipt-camera-input', photo())
    expect(await screen.findByText(W.noSignal)).toBeTruthy()
    expect(screen.getByText(W.leaveNote)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: W.retry }))
    expect(await screen.findByRole('heading', { name: /Got it\./ })).toBeTruthy()
    const calls = (io.addPage as ReturnType<typeof vi.fn>).mock.calls
    expect(calls).toHaveLength(2)
    // The same page id both times, so a first try that did land is not written twice.
    expect(calls[1]![1].pageId).toBe(calls[0]![1].pageId)
  })

  it('the signal coming back sends the waiting photo by itself', async () => {
    let n = 0
    const io = fakeIo(open(charge()), {
      addPage: vi.fn(async (): Promise<ReceiptWriteAnswer> => (++n === 1 ? { ok: false, why: 'signal' } : { ok: true, charge: withTicket(), kept: false })),
    })
    mount(io)
    await screen.findByRole('button', { name: W.camera })
    pick('receipt-camera-input', photo())
    await screen.findByText(W.noSignal)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(await screen.findByRole('heading', { name: /Got it\./ })).toBeTruthy()
  })

  it('a file the server refuses is dropped with its reason, and the press comes back', async () => {
    const io = fakeIo(open(charge()), { addPage: vi.fn(async (): Promise<ReceiptWriteAnswer> => ({ ok: false, why: 'refused', words: RECEIPT_LINK_WORDS.notAPicture })) })
    mount(io)
    await screen.findByRole('button', { name: W.camera })
    pick('receipt-file-input', new File(['not a picture'], 'notes.txt', { type: 'text/plain' }))
    expect((await screen.findByRole('alert')).textContent).toBe(RECEIPT_LINK_WORDS.notAPicture)
    expect(screen.queryByTestId('receipt-waiting')).toBeNull()
    expect((screen.getByRole('button', { name: W.camera }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('a PDF goes as it came, with no shrink', async () => {
    const io = fakeIo(open(charge()), { addPage: vi.fn(async (): Promise<ReceiptWriteAnswer> => ({ ok: true, charge: withTicket({ pages: [{ id: 'p1', pdf: true }] }), kept: false })) })
    const spy = vi.fn(shrink)
    render(<ReceiptLinkPage code={CODE} io={io} shrink={spy as unknown as typeof shrink} />)
    await screen.findByRole('button', { name: W.camera })
    const pdf = new File(['%PDF-1.7 made up'], 'receipt.pdf', { type: 'application/pdf' })
    pick('receipt-file-input', pdf)
    await waitFor(() => expect(io.addPage).toHaveBeenCalled())
    expect(spy).not.toHaveBeenCalled()
    expect((io.addPage as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toMatchObject({ width: 0, height: 0, originalBytes: pdf.size })
    expect(await screen.findByText(W.pdf)).toBeTruthy()
    // A PDF cannot be retaken with the camera: Add a page is the press.
    expect(screen.queryByRole('button', { name: W.retake })).toBeNull()
  })

  it('Retake names the page it replaces, and a filed first shot is kept and said', async () => {
    const io = fakeIo(open(withTicket()), {
      addPage: vi.fn(async (): Promise<ReceiptWriteAnswer> => ({ ok: true, charge: withTicket({ pages: [{ id: 'p1', pdf: false }, { id: 'p2', pdf: false }] }), kept: true })),
    })
    mount(io)
    fireEvent.click(await screen.findByRole('button', { name: W.retake }))
    pick('receipt-camera-input', photo())
    await waitFor(() => expect(io.addPage).toHaveBeenCalled())
    expect((io.addPage as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toMatchObject({ replace: 'p1' })
    expect(await screen.findByText(W.keptNote)).toBeTruthy()
    expect(screen.getByTestId('receipt-pages').querySelectorAll('img')).toHaveLength(2)
  })

  it('a chip tapped after the upload changes the ticket’s job', async () => {
    const io = fakeIo(open(withTicket()))
    mount(io)
    fireEvent.click(await screen.findByRole('button', { name: 'JP1042 · Oak Hollow Bldg C' }))
    await waitFor(() => expect(io.setJob).toHaveBeenCalledWith(CODE, 'req-1', { jobId: 'job-a' }))
    expect((await screen.findByRole('button', { name: /✓\s*JP1042/ })).getAttribute('aria-pressed')).toBe('true')
  })

  it('a job the office holds says so and changes nothing', async () => {
    const io = fakeIo(open(withTicket()), { setJob: vi.fn(async (): Promise<ReceiptWriteAnswer> => ({ ok: false, why: 'refused', words: RECEIPT_LINK_WORDS.jobHeld })) })
    mount(io)
    fireEvent.click(await screen.findByRole('button', { name: W.notOneJob }))
    expect((await screen.findByRole('alert')).textContent).toBe(RECEIPT_LINK_WORDS.jobHeld)
  })

  it('a charge the office sorted asks no job and still takes the photo', async () => {
    mount(fakeIo(open(charge({ sortedJob: 'JP1038 · Cedar Bend water heater', dayJobs: [] }))))
    expect(await screen.findByText('JP1038 · Cedar Bend water heater')).toBeTruthy()
    expect(screen.getByText(W.sortedNote)).toBeTruthy()
    expect(screen.queryByText(W.jobAsk)).toBeNull()
    expect(screen.getByRole('button', { name: W.camera })).toBeTruthy()
  })

  it('a charge with its ticket from Tally says so and offers one more page, no retake and no chips', async () => {
    mount(fakeIo(open(withTicket({ door: 'tally', takenAt: '2026-11-04T16:02:00Z', job: 'JP1042 · Oak Hollow Bldg C', jobId: 'job-a', canChangeJob: false }, { dayJobs: [] }))))
    expect(await screen.findByRole('heading', { name: 'This charge has its ticket already.' })).toBeTruthy()
    expect(screen.getByText('It was taken in Tally at 10:02 AM, for JP1042 · Oak Hollow Bldg C.')).toBeTruthy()
    expect(screen.getByRole('button', { name: W.addPage })).toBeTruthy()
    expect(screen.queryByRole('button', { name: W.retake })).toBeNull()
    expect(screen.queryByTestId('receipt-jobs')).toBeNull()
    // The picture it holds is asked from the function by the link's own code.
    expect(screen.getByRole('img').getAttribute('src')).toBe(`https://fn.example/receipt-link?code=${CODE}&page=p1`)
  })

  it('a charge the bank took back takes nothing', async () => {
    mount(fakeIo(open(charge({ dead: true, dayJobs: [] }))))
    expect(await screen.findByText(W.deadLine)).toBeTruthy()
    expect(screen.queryByRole('button', { name: W.camera })).toBeNull()
  })

  it('two charges on one link each get their own press', async () => {
    mount(fakeIo(open(charge(), charge({ id: 'req-2', store: 'Cedar Bend Hardware', amount: 41.17, dayJobs: [] }))))
    expect(await screen.findByRole('heading', { name: '2 charges on your card' })).toBeTruthy()
    expect(screen.getAllByTestId('receipt-charge')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: W.camera })).toHaveLength(2)
    expect(screen.getByText(/This link is for these charges alone\./)).toBeTruthy()
  })

  it('a closed link says so with the door to Tally, and a code that opens nothing has no press', async () => {
    mount(fakeIo({ kind: 'closed' }))
    expect(await screen.findByRole('heading', { name: W.closedHeadline })).toBeTruthy()
    expect(screen.getByText(W.closedLine)).toBeTruthy()
    expect(screen.getByRole('link', { name: W.openTally }).getAttribute('href')).toBe('/tally')
    cleanup()
    mount(fakeIo({ kind: 'not_found' }))
    expect(await screen.findByText(W.notFoundLine)).toBeTruthy()
    expect(screen.queryByRole('link', { name: W.openTally })).toBeNull()
  })

  it('a code that is not ten letters never asks the server', () => {
    const io = fakeIo({ kind: 'not_found' })
    mount(io, 'nope')
    expect(screen.getByText(W.notFoundLine)).toBeTruthy()
    expect(io.read).not.toHaveBeenCalled()
  })

  it('too many wrong links, and a page that did not load with its Try again', async () => {
    mount(fakeIo({ kind: 'locked' }))
    expect(await screen.findByRole('heading', { name: W.lockedHeadline })).toBeTruthy()
    cleanup()
    let n = 0
    const io = fakeIo({ kind: 'signal' }, { read: vi.fn(async (): Promise<ReceiptLinkView> => (++n === 1 ? { kind: 'signal' } : open(charge()))) })
    mount(io)
    expect(await screen.findByRole('heading', { name: W.signalHeadline })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: W.retry }))
    expect(await screen.findByRole('heading', { name: 'Ridgeway Supply' })).toBeTruthy()
  })

  it('the route reads the code from the address', () => {
    render(
      <MemoryRouter initialEntries={['/r/nope']}>
        <Routes>
          <Route path="/r/:code" element={<ReceiptLink />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText(W.notFoundLine)).toBeTruthy()
  })
})
