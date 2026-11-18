// @vitest-environment jsdom
/**
 * Render smokes for the sheet's tie to one bill (v2.7835, punch list #388, step 1): a job with one open
 * bill is never asked; a job with several opens Which bill does this sheet ride on?, leaning to the one
 * sent bill; Cancel stops the move; the pick is saved after the move; and from the sheet's row the same
 * window changes or clears the tie, saying the refusal's own reason when the save is refused. Every name
 * and amount is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { DrawBill } from '../lib/subWorkOrders/drawTie'

const { io } = vi.hoisted(() => ({ io: { loadDrawTieSheet: vi.fn(), loadDrawTies: vi.fn(), saveDrawBill: vi.fn() } }))

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../lib/subWorkOrders/drawTieIo', () => io)

import { installDomShims, renderWithProviders } from '../test/renderSmokeMocks'
import { useDrawBillPick, type DrawBillAnswer } from './useDrawBillPick'

installDomShims()
afterEach(cleanup)
beforeEach(() => {
  io.loadDrawTieSheet.mockReset()
  io.saveDrawBill.mockReset()
  io.saveDrawBill.mockResolvedValue(undefined)
})

const bill = (id: string, seq: number, status: string, amount: number, billedAt: string | null = null): DrawBill => ({ id, status, sequence_order: seq, amount, billed_at: billedAt, created_at: `2026-10-0${seq + 1}T12:00:00Z` })
const PAID = bill('b1', 0, 'paid', 1800)
const SENT = bill('b2', 1, 'billed', 3000, '2026-10-21T17:00:00Z')
const DRAFT = bill('b3', 2, 'ready_to_bill', 1200)

const sheet = (bills: DrawBill[], over: { stage?: string; drawInvoiceId?: string | null } = {}) => ({ sheetId: 's-1', jobId: 'j-1', stage: over.stage ?? 'walkthrough', drawInvoiceId: over.drawInvoiceId ?? null, bills })

type Api = ReturnType<typeof useDrawBillPick>
const api: { current: Api | null } = { current: null }

function Harness() {
  const drawBill = useDrawBillPick()
  api.current = drawBill
  return <div>{drawBill.host}</div>
}

function mount(): Api {
  renderWithProviders(<Harness />)
  return new Proxy({} as Api, { get: (_t, key: keyof Api) => api.current![key] })
}

/** Start an ask and wait until the read behind it has answered. The answer stays boxed: an open window has none yet. */
async function ask<T>(start: () => Promise<T>): Promise<{ answer: Promise<T> }> {
  let answer!: Promise<T>
  await act(async () => {
    answer = start()
    await Promise.resolve()
    await Promise.resolve()
  })
  return { answer }
}

describe('a move to Waiting on customer', () => {
  it('asks nothing on a job with one open bill: the database ties it', async () => {
    io.loadDrawTieSheet.mockResolvedValue(sheet([PAID, SENT]))
    const h = mount()
    const answer = await (await ask(() => h.askOnArrival('s-1', 'Harlan Pruitt'))).answer
    expect(answer).toEqual({ go: true })
    expect(screen.queryByRole('dialog')).toBeNull()
    await act(async () => h.tieAfterMove('s-1', answer))
    expect(io.saveDrawBill).not.toHaveBeenCalled()
  })

  it('asks nothing when the read is refused, on a job with no bill, or on a sheet already there', async () => {
    const h = mount()
    io.loadDrawTieSheet.mockResolvedValue(null)
    expect(await (await ask(() => h.askOnArrival('s-1', 'Harlan Pruitt'))).answer).toEqual({ go: true })
    io.loadDrawTieSheet.mockRejectedValue(new Error('offline'))
    expect(await (await ask(() => h.askOnArrival('s-1', 'Harlan Pruitt'))).answer).toEqual({ go: true })
    io.loadDrawTieSheet.mockResolvedValue(sheet([]))
    expect(await (await ask(() => h.askOnArrival('s-1', 'Harlan Pruitt'))).answer).toEqual({ go: true })
    io.loadDrawTieSheet.mockResolvedValue(sheet([SENT, DRAFT], { stage: 'customer_pay' }))
    expect(await (await ask(() => h.askOnArrival('s-1', 'Harlan Pruitt'))).answer).toEqual({ go: true })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the window on a job with several open bills, leaning to the one sent bill, and saves the pick after the move', async () => {
    io.loadDrawTieSheet.mockResolvedValue(sheet([PAID, SENT, DRAFT]))
    const h = mount()
    const pending = await ask(() => h.askOnArrival('s-1', 'Harlan Pruitt'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Which bill does this sheet ride on?')
    expect(dialog.textContent).toContain('Harlan Pruitt’s page will say the customer paid when this bill is paid in full.')
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    // Open bills first, the paid one after, No bill last.
    expect(radios.map((r) => r.closest('label')?.textContent)).toEqual([
      'Bill 2 of 3$3,000 · billed Oct 21 · open',
      'Bill 3 of 3$1,200 · not billed yet',
      'Bill 1 of 3$1,800 · paid',
      'No billTheir page stays on Draw requested until you queue the payment. You can pick a bill later from the sheet’s row.',
    ])
    expect(radios.map((r) => r.checked)).toEqual([true, false, false, false])
    fireEvent.click(radios[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'Request the draw' }))
    const answer: DrawBillAnswer = await pending.answer
    expect(answer).toEqual({ go: true, pick: 'b3' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Nothing is written until the screen's own move has landed.
    expect(io.saveDrawBill).not.toHaveBeenCalled()
    await act(async () => h.tieAfterMove('s-1', answer))
    expect(io.saveDrawBill).toHaveBeenCalledWith(expect.anything(), 's-1', 'b3')
  })

  it('keeps Request the draw dead until a row is picked, and No bill is a pick', async () => {
    io.loadDrawTieSheet.mockResolvedValue(sheet([SENT, bill('b4', 3, 'billed', 900, '2026-11-02T17:00:00Z')]))
    const h = mount()
    const pending = await ask(() => h.askOnArrival('s-1', 'Harlan Pruitt'))
    const press = (await screen.findByRole('button', { name: 'Request the draw' })) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText(/^No bill/))
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    const answer = await pending.answer
    expect(answer).toEqual({ go: true, pick: null })
    await act(async () => h.tieAfterMove('s-1', answer))
    expect(io.saveDrawBill).toHaveBeenCalledWith(expect.anything(), 's-1', null)
  })

  it('Cancel and Escape stop the move', async () => {
    io.loadDrawTieSheet.mockResolvedValue(sheet([SENT, DRAFT]))
    const h = mount()
    let pending = await ask(() => h.askOnArrival('s-1', 'Harlan Pruitt'))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(await pending.answer).toEqual({ go: false })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    pending = await ask(() => h.askOnArrival('s-1', 'Harlan Pruitt'))
    await screen.findByRole('dialog')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(await pending.answer).toEqual({ go: false })
    await act(async () => h.tieAfterMove('s-1', { go: false }))
    expect(io.saveDrawBill).not.toHaveBeenCalled()
  })

  it('says the reason when the pick is refused after the move, and points at the sheet’s row', async () => {
    io.saveDrawBill.mockRejectedValue({ message: 'That bill is not on this sheet’s job' })
    const h = mount()
    await act(async () => h.tieAfterMove('s-1', { go: true, pick: 'b2' }))
    expect((await screen.findByText(/The draw is requested, but the bill was not tied/)).textContent).toContain('That bill is not on this sheet’s job')
  })
})

describe('the tie, changed from the sheet’s row', () => {
  it('opens on the bill the sheet rides on, even with one bill, and saves the change', async () => {
    io.loadDrawTieSheet.mockResolvedValue(sheet([SENT, DRAFT], { stage: 'customer_pay', drawInvoiceId: 'b2' }))
    const h = mount()
    const pending = await ask(() => h.change('s-1', 'Harlan Pruitt'))
    await screen.findByRole('dialog')
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((r) => r.checked)).toEqual([true, false, false])
    fireEvent.click(radios[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'Save the bill' }))
    expect(await pending.answer).toBe(true)
    expect(io.saveDrawBill).toHaveBeenCalledWith(expect.anything(), 's-1', 'b3')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByText('The sheet’s bill is saved.')).toBeTruthy()
  })

  it('clears the tie with No bill', async () => {
    io.loadDrawTieSheet.mockResolvedValue(sheet([SENT], { stage: 'customer_pay', drawInvoiceId: 'b2' }))
    const h = mount()
    const pending = await ask(() => h.change('s-1', 'Harlan Pruitt'))
    fireEvent.click(await screen.findByLabelText(/^No bill/))
    fireEvent.click(screen.getByRole('button', { name: 'Save the bill' }))
    expect(await pending.answer).toBe(true)
    expect(io.saveDrawBill).toHaveBeenCalledWith(expect.anything(), 's-1', null)
    expect(await screen.findByText('The sheet rides on no bill now.')).toBeTruthy()
  })

  it('says a job has no bill yet, and offers only No bill', async () => {
    io.loadDrawTieSheet.mockResolvedValue(sheet([], { stage: 'customer_pay' }))
    const h = mount()
    await ask(() => h.change('s-1', 'Harlan Pruitt'))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('This job has no bill yet. Make the bill first, then pick it here.')
    expect(screen.getAllByRole('radio')).toHaveLength(1)
  })

  it('stays open and says why when the save is refused', async () => {
    io.loadDrawTieSheet.mockResolvedValue(sheet([SENT, DRAFT], { stage: 'customer_pay' }))
    io.saveDrawBill.mockRejectedValue({ message: 'This sheet is not waiting on the customer' })
    const h = mount()
    await ask(() => h.change('s-1', 'Harlan Pruitt'))
    fireEvent.click((await screen.findAllByRole('radio'))[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Save the bill' }))
    expect((await screen.findByText(/Could not save the sheet’s bill/)).textContent).toContain('This sheet is not waiting on the customer')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('opens nothing when the sheet’s bills cannot be read', async () => {
    io.loadDrawTieSheet.mockResolvedValue(null)
    const h = mount()
    expect(await (await ask(() => h.change('s-1', 'Harlan Pruitt'))).answer).toBe(false)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText('Could not read this sheet’s bills. Try again in a moment.')).toBeTruthy()
  })
})
