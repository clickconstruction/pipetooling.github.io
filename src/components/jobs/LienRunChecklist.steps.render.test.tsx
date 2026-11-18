// @vitest-environment jsdom
/**
 * The run row's four steps (v2.7695): Printed, Signed, In the envelope and Mailed, each a cell with its own press, a
 * Next line that names the one thing to do, and a receipt press beside each mail number.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienRunChecklist from './LienRunChecklist'
import type { LienRunRow } from '../../lib/jobs/lienRunChecklist'

vi.mock('../../lib/materials/photoShrink', () => ({ shrinkPhoto: async (file: File) => ({ blob: file, shrunk: false }) }))
vi.mock('../../lib/jobs/jobFolderAddFileIo', () => ({ putJobFolderFile: vi.fn(async () => ({ driveFileId: 'r1', url: 'https://drive.google.com/file/d/r1/view' })) }))
vi.mock('../../lib/jobs/lienReceiptReadIo', () => ({ readTrackingFromPhoto: async () => '9407111899560000000001' }))

afterEach(cleanup)

const cell = (key: 'owner' | 'original_contractor', over: Partial<LienRunRow['recipients'][number]> = {}): LienRunRow['recipients'][number] => ({ key, label: key === 'owner' ? 'Owner of record' : 'Original contractor', name: key === 'owner' ? 'Elwick Holdings LLC' : 'Lowbeck Contracting', method: 'certified_mail', tracking: '', mailed: false, needsNumber: true, receiptUrl: '', ...over })
const row = (over: Partial<LienRunRow> = {}): LienRunRow => ({
  itemId: 'it1',
  jobId: 'j650',
  jobNumber: '650',
  label: '650 · AXO Schertz',
  street: '',
  recipients: [cell('owner'), cell('original_contractor')],
  amount: 33_500,
  printed: { at: '2026-11-15T15:00:00.000Z', by: 'Taunya' },
  signed: { how: 'pen', at: '2026-11-15T16:00:00.000Z', by: 'Taunya' },
  mailed: null,
  waitsOn: 'mail',
  line: 'signed · not mailed',
  held: null,
  nothingToClaim: false,
  leader: { userId: 'u-rob', name: 'Robert Douglas' },
  paperless: false,
  mailedCopies: [],
  ...over,
})

function draw(r: LienRunRow, over: Partial<Parameters<typeof LienRunChecklist>[0]> = {}) {
  const props = {
    rows: [r],
    busy: false,
    viewer: { userId: 'u1', name: 'Taunya' },
    onMarkPrinted: vi.fn(),
    onOpenSign: vi.fn(),
    onTracking: vi.fn(),
    paneFor: () => null,
    mailedCopies: { onAdd: vi.fn(), addingItemId: null },
    receipts: { onSet: vi.fn(), todayYmd: '2026-11-17' },
    ...over,
  }
  renderWithProviders(<LienRunChecklist {...props} />)
  return props
}

describe('LienRunChecklist · the four steps (v2.7695)', () => {
  it('names the four steps in order, with the file press in a step of its own', () => {
    draw(row())
    const rowEl = screen.getByTestId('run-check-it1')
    const steps = [...rowEl.querySelectorAll('.lienRunCheckTick')] as HTMLElement[]
    expect(steps.map((s) => [s.dataset.tick, s.querySelector('.lienRunCheckTickName')?.textContent])).toEqual([
      ['printed', '1 · Printed'],
      ['signed', '2 · Signed'],
      ['envelope', '3 · In the envelope'],
      ['mailed', '4 · Mailed'],
    ])
    expect(within(steps[2]!).getByRole('button', { name: 'Add what was mailed' })).toBeTruthy()
    expect(screen.getByTestId('run-check-next-it1').textContent).toBe('Next: Scan what goes in the envelope and add the file.')
  })

  it('takes a receipt beside each number, fills an empty number from the photo, and hands the link to the host', async () => {
    const props = draw(row())
    const ownerReceipt = screen.getByTestId('run-check-receipt-it1-owner')
    expect(within(ownerReceipt).getByRole('button', { name: 'Add the receipt' })).toBeTruthy()
    fireEvent.change(ownerReceipt.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File([new Uint8Array([1, 2, 3])], 'IMG_1.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(props.receipts.onSet).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'it1' }), 'owner', 'https://drive.google.com/file/d/r1/view'))
    await waitFor(() => expect(props.onTracking).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'it1' }), 'owner', '9407111899560000000001'))
  })

  it('shows a saved receipt with Take off, and leaves a typed number alone', async () => {
    const props = draw(row({ recipients: [cell('owner', { tracking: '9407 1', receiptUrl: 'https://drive.google.com/file/d/r1/view' }), cell('original_contractor')] }))
    const ownerReceipt = screen.getByTestId('run-check-receipt-it1-owner')
    expect((within(ownerReceipt).getByRole('link', { name: 'Open the receipt' }) as HTMLAnchorElement).href).toBe('https://drive.google.com/file/d/r1/view')
    fireEvent.click(within(ownerReceipt).getByRole('button', { name: 'Take off' }))
    fireEvent.click(within(ownerReceipt).getByRole('button', { name: 'Take it off' }))
    expect(props.receipts.onSet).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'it1' }), 'owner', '')
    expect(props.onTracking).not.toHaveBeenCalled()
  })

  it('offers no receipt and no file before the paper prints, and says so', () => {
    draw(row({ printed: null, waitsOn: 'print', line: 'not printed' }))
    expect(screen.queryByTestId('run-check-receipt-it1-owner')).toBeNull()
    expect(screen.getByTestId('run-check-envelope-it1').textContent).toBe('print first')
    expect(screen.getByTestId('run-check-next-it1').textContent).toBe('Next: Print the notice.')
  })
})
