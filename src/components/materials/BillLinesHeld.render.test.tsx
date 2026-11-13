// @vitest-environment jsdom
/**
 * Render smoke for the bills that need a person (punch list #298 PR 3, v2.7110): the tab's one line and its press,
 * the window's reasons with their counts and doors, a reason opening to its bills, Look reading the bill's paper
 * and opening the Look window, Open the bill closing the window and handing the bill to the tab, and a read that
 * fails showing its reason. The counts and words are heldBills.ts (kernel-tested); this holds the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { HeldBillsData, HeldBillsIo } from '../../lib/materials/lines/heldBillsIo'
import type { PaperRow } from '../../lib/materials/lines/paperRows'
import { BillLinesHeld } from './BillLinesHeld'

vi.mock('../contracts/formStudio/PdfPageCanvas', () => ({ PdfPageCanvas: () => <div data-testid="pdf-page" /> }))
// The retry panel reads who is signed in for its telemetry.
vi.mock('../../hooks/useAuth', async () => {
  const m = await import('../../test/renderSmokeMocks')
  return m.useAuthModuleMock({ role: 'assistant' })
})

// Made up: a house, five bills. One adds up, one is short of its subtotal, one is not in its file, one is a statement, one has no PDF.
const DRIVE = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view'
const data: HeldBillsData = {
  invoices: [
    { id: 'a', supplyHouseId: 'h1', number: 'S-100', dateYmd: '2026-10-01', amountCents: 11260, link: DRIVE },
    { id: 'b', supplyHouseId: 'h1', number: 'S-101', dateYmd: '2026-10-02', amountCents: 71954, link: DRIVE },
    { id: 'c', supplyHouseId: 'h1', number: 'S-102', dateYmd: '2026-10-03', amountCents: 4810, link: DRIVE },
    { id: 'd', supplyHouseId: 'h1', number: 'S-103', dateYmd: '2026-10-04', amountCents: 9000, link: DRIVE },
    { id: 'e', supplyHouseId: 'h1', number: 'S-104', dateYmd: '2026-10-05', amountCents: 1200, link: null },
  ],
  papers: [
    { id: 'pa', invoiceId: 'a', checkState: 'adds_up', checkNote: '' },
    { id: 'pb', invoiceId: 'b', checkState: 'off', checkNote: 'The lines are $12.40 short of the subtotal' },
  ],
  holds: [
    { invoiceId: 'c', why: 'number_not_in_file', note: 'The file holds S-900.' },
    { invoiceId: 'd', why: 'statement', note: 'The file is a statement that lists this bill.' },
  ],
  houseNames: new Map([['h1', 'Ridgeway Supply']]),
}

const paperB: PaperRow = {
  id: 'pb',
  invoiceId: 'b',
  kind: 'invoice',
  number: 'S-101',
  datedOn: '2026-10-02',
  orderNumber: '',
  poText: '',
  filePath: null,
  driveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345',
  subtotalCents: 66470,
  taxCents: 5484,
  freightCents: null,
  totalCents: 71954,
  readBy: 'sweep:claude-sonnet-5-5',
  readAt: '2026-10-22T15:00:00Z',
  checkState: 'off',
  checkNote: 'The lines are $12.40 short of the subtotal',
  acceptedBy: null,
  acceptedAt: null,
  lines: [{ lineNo: 1, lineKind: 'part', houseCode: 'RS-40712', mfrNumber: '', description: '3/4 COP 90 ELL CXC', unit: 'EA', qtyOrdered: 139, qtyShipped: 139, qtyBackordered: null, unitPrice: 4.7, pricingUnit: 'each', extendedCents: 65330 }],
}

function mount(io: HeldBillsIo = { load: vi.fn(async () => data) }) {
  const paperIo = { loadForInvoices: vi.fn(async () => new Map([['b', paperB]])), save: vi.fn(async () => 'pb'), accept: vi.fn(async () => undefined) }
  const onOpenBill = vi.fn()
  const r = renderWithProviders(<BillLinesHeld io={io} paperIo={paperIo} onOpenBill={onOpenBill} />)
  return { ...r, io, paperIo, onOpenBill }
}

afterEach(() => cleanup())

describe('BillLinesHeld', () => {
  it('says where the lines stand in one line, and its press names its count', async () => {
    mount()
    const strip = await screen.findByTestId('bill-lines-strip')
    expect(strip.textContent).toMatch(/Lines read on 2 of 5 bills · 1 adds up · 2 need a person · 1 with no PDF/)
    expect(within(strip).getByRole('button', { name: 'Show the 2' })).toBeTruthy()
    expect(screen.queryByTestId('bill-lines-held')).toBeNull()
  })

  it('opens the window on each reason with its count and its door', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Show the 2' }))
    const win = await screen.findByTestId('bill-lines-held')
    expect(within(win).getByRole('heading', { name: 'Bill lines' })).toBeTruthy()
    const sums = within(win).getByTestId('bill-lines-group-sums')
    expect(sums.textContent).toMatch(/The lines read do not add up to the paper\./)
    expect(sums.textContent).toMatch(/Look, to fix a line or count it as read\./)
    expect(within(win).getByTestId('bill-lines-group-number_not_in_file').textContent).toMatch(/The bill’s number is not in its file\./)
    expect(within(win).getByTestId('bill-lines-group-statement').textContent).toMatch(/Nothing to do\./)
    expect(within(win).getByTestId('bill-lines-group-no_pdf').textContent).toMatch(/Open the bill, to add the link to its PDF\./)
    // No bill is listed until its reason is opened.
    expect(within(win).queryByText('S-101')).toBeNull()
  })

  it('a reason opens to its bills, and Look reads the paper and opens the Look window', async () => {
    const { paperIo } = mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Show the 2' }))
    const sums = await screen.findByTestId('bill-lines-group-sums')
    fireEvent.click(within(sums).getByRole('button', { name: 'Show the 1' }))
    const bills = await screen.findByTestId('bill-lines-bills-sums')
    expect(bills.textContent).toMatch(/Ridgeway Supply/)
    expect(bills.textContent).toMatch(/S-101/)
    expect(bills.textContent).toMatch(/\$719\.54/)
    expect(bills.textContent).toMatch(/\$12\.40 short of the subtotal/)
    expect(within(sums).getByRole('button', { name: 'Hide the 1' })).toBeTruthy()
    fireEvent.click(within(bills).getByRole('button', { name: 'Look: S-101' }))
    await waitFor(() => expect(paperIo.loadForInvoices).toHaveBeenCalledWith(['b']))
    const look = await screen.findByTestId('paper-look')
    expect(within(look).getByTestId('paper-look-strip').textContent).toMatch(/short of the subtotal/)
  })

  it('Open the bill closes the window and hands the bill to the tab', async () => {
    const { onOpenBill } = mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Show the 2' }))
    const group = await screen.findByTestId('bill-lines-group-number_not_in_file')
    fireEvent.click(within(group).getByRole('button', { name: 'Show the 1' }))
    const bills = await screen.findByTestId('bill-lines-bills-number_not_in_file')
    expect(bills.textContent).toMatch(/The file holds S-900\./)
    fireEvent.click(within(bills).getByRole('button', { name: 'Open the bill: S-102' }))
    await settle()
    expect(onOpenBill).toHaveBeenCalledWith({ invoiceId: 'c', houseId: 'h1' })
    expect(screen.queryByTestId('bill-lines-held')).toBeNull()
  })

  it('a statement offers no press: there is nothing to do', async () => {
    mount()
    fireEvent.click(await screen.findByRole('button', { name: 'Show the 2' }))
    const group = await screen.findByTestId('bill-lines-group-statement')
    fireEvent.click(within(group).getByRole('button', { name: 'Show the 1' }))
    const bills = await screen.findByTestId('bill-lines-bills-statement')
    expect(within(bills).queryByRole('button')).toBeNull()
    expect(within(bills).getByRole('link', { name: 'Open in Drive' })).toBeTruthy()
  })

  it('draws nothing when no bill is on file, and a failed read says its reason', async () => {
    const empty = mount({ load: vi.fn(async () => ({ invoices: [], papers: [], holds: [], houseNames: new Map() })) })
    await settle()
    expect(screen.queryByTestId('bill-lines-strip')).toBeNull()
    empty.unmount()
    mount({ load: vi.fn(async () => Promise.reject(new Error('permission denied for table supply_papers'))) })
    expect(await screen.findByText(/permission denied for table supply_papers/)).toBeTruthy()
    expect(screen.queryByTestId('bill-lines-strip')).toBeNull()
  })
})
