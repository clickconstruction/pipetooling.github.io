// @vitest-environment jsdom
/**
 * Render smoke for Look (punch list #298 PR 1b, v2.6819): the strip names the gap, the missing line typed in the
 * add row turns it green and names the Save press by its count, Save writes through the io, and Count it as read
 * anyway confirms with its own verb and accepts. The arithmetic is paperChecks.ts and the drafts paperRows.ts
 * (kernel-tested); this holds the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { LineSave, PaperRow, PaperSave } from '../../lib/materials/lines/paperRows'
import type { PaperLine } from '../../lib/materials/lines/paperChecks'
import { PaperLookModal } from './PaperLookModal'

vi.mock('../contracts/formStudio/PdfPageCanvas', () => ({ PdfPageCanvas: () => <div data-testid="pdf-page" /> }))

const line = (lineNo: number, houseCode: string, description: string, qty: number, price: number, ext: number): PaperLine => ({
  lineNo,
  lineKind: 'part',
  houseCode,
  mfrNumber: '',
  description,
  unit: 'EA',
  qtyOrdered: qty,
  qtyShipped: qty,
  qtyBackordered: null,
  unitPrice: price,
  pricingUnit: 'each',
  extendedCents: ext,
})

// Made up: five of six lines read; the wax ring's $12.40 is missing, so the lines are short of the subtotal.
const paper: PaperRow = {
  id: 'p1',
  invoiceId: 'inv1',
  kind: 'invoice',
  number: 'S-118342',
  datedOn: '2026-10-22',
  orderNumber: '',
  poText: '41207',
  filePath: 'bills/h/x/bill.pdf',
  driveFileId: null,
  subtotalCents: 66470,
  taxCents: 5484,
  freightCents: null,
  totalCents: 71954,
  readBy: 'form:claude-sonnet-5-5',
  readAt: '2026-10-22T15:00:00Z',
  checkState: 'off',
  checkNote: 'The lines are $12.40 short of the subtotal.',
  acceptedBy: null,
  acceptedAt: null,
  lines: [
    line(1, 'RS-40712', '3/4 COP 90 ELL CXC', 25, 4.7, 11750),
    line(2, 'RS-40718', '3/4 COP TEE CXCXC', 12, 7.85, 9420),
    line(3, 'RS-11204', '3/4 X 10 TYPE L COP TUBE', 8, 38.4, 30720),
    line(4, 'RS-55310', '3/4 FIP BALL VLV FP', 6, 21.15, 12690),
    line(5, 'FRT', 'FUEL SURCHARGE', 1, 6.5, 650),
  ],
}
const invoice = { id: 'inv1', invoice_number: 'S-118342', amount: 719.54, link: 'https://drive.example/x', invoice_date: '2026-10-22' }

function mount(over: Partial<PaperRow> = {}) {
  const io = { save: vi.fn(async () => 'p1'), accept: vi.fn(async () => undefined) }
  const onClose = vi.fn()
  const onChanged = vi.fn()
  const r = renderWithProviders(<PaperLookModal paper={{ ...paper, ...over }} invoice={invoice} io={io} fileBytes={new ArrayBuffer(8)} onClose={onClose} onChanged={onChanged} />)
  return { ...r, io, onClose, onChanged }
}

afterEach(() => cleanup())

describe('PaperLookModal', () => {
  it('names the gap and the missing-line hint, and the Save press is dead until something changes', () => {
    mount()
    const strip = screen.getByTestId('paper-look-strip')
    expect(strip.textContent).toMatch(/\$12\.40 short of the subtotal/)
    expect(strip.textContent).toMatch(/a line is missing/)
    expect((screen.getByRole('button', { name: 'Save 5 lines' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Count it as read anyway' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('pdf-page')).toBeTruthy()
  })

  it('the missing line typed in the add row turns the strip green, and Save 1 line writes six lines', async () => {
    const { io, onChanged, onClose } = mount()
    const add = screen.getByTestId('paper-look-add')
    fireEvent.change(within(add).getByLabelText('Line 6 code'), { target: { value: 'RS-90021' } })
    fireEvent.change(within(add).getByLabelText('Line 6 description'), { target: { value: 'WAX RING W/HORN' } })
    fireEvent.change(within(add).getByLabelText('Line 6 quantity shipped'), { target: { value: '4' } })
    fireEvent.change(within(add).getByLabelText('Line 6 unit price'), { target: { value: '3.10' } })
    await settle()
    expect(screen.getByTestId('paper-look-strip').textContent).toMatch(/The 6 lines add up/)
    const save = screen.getByRole('button', { name: 'Save 1 line' }) as HTMLButtonElement
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(io.save).toHaveBeenCalledTimes(1))
    const [invoiceId, p, lines] = io.save.mock.calls[0] as unknown as [string, PaperSave, LineSave[]]
    expect(invoiceId).toBe('inv1')
    expect(p.check_state).toBe('adds_up')
    expect(lines).toHaveLength(6)
    expect(lines[5]).toMatchObject({ line_no: 6, house_code: 'RS-90021', extended_cents: 1240 })
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it('a wrong extension marks its line', async () => {
    mount()
    fireEvent.change(screen.getByLabelText('Line 2 extension'), { target: { value: '92.40' } })
    await settle()
    expect(screen.getByTestId('paper-look-strip').textContent).toMatch(/Line 2/)
    expect(within(screen.getByTestId('paper-look-line-2')).getByLabelText("This line's own arithmetic fails")).toBeTruthy()
  })

  it('Count it as read anyway confirms with its verb and accepts with the gap', async () => {
    const { io, onChanged } = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Count it as read anyway' }))
    const confirm = await screen.findByRole('button', { name: 'Count it as read' })
    fireEvent.click(confirm)
    await waitFor(() => expect(io.accept).toHaveBeenCalledTimes(1))
    const [paperId, note] = io.accept.mock.calls[0] as unknown as [string, string]
    expect(paperId).toBe('p1')
    expect(note).toMatch(/\$12\.40 short/)
    expect(io.save).not.toHaveBeenCalled()
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it('an accepted paper is read-only and offers no accept press', () => {
    mount({ checkState: 'accepted', acceptedBy: 'u1', acceptedAt: '2026-10-23T10:00:00Z' })
    expect(screen.queryByRole('button', { name: 'Count it as read anyway' })).toBeNull()
    expect((screen.getByLabelText('Line 1 code') as HTMLInputElement).disabled).toBe(true)
  })
})
