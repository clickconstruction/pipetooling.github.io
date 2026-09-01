// @vitest-environment jsdom
/**
 * Render smokes for the View Bill + PDF tail split control (v2.2329):
 * View Bill still opens the modal, the tail opens the invoice PDF with the
 * exact invoice the row targets.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ViewBillWithPdfTail from './ViewBillWithPdfTail'

const openPdf = vi.fn(async (_invoice: unknown, _cb: unknown) => true)
vi.mock('../../lib/openBilledInvoicePdf', () => ({
  openBilledInvoicePdfInNewTab: (invoice: unknown, cb: unknown) => openPdf(invoice, cb),
}))
vi.mock('../../contexts/ToastContext', () => ({
  useToastContext: () => ({ showToast: vi.fn() }),
}))

describe('ViewBillWithPdfTail', () => {
  it('View Bill opens the modal; the tail opens the PDF for the same invoice', async () => {
    const onViewBill = vi.fn()
    render(<ViewBillWithPdfTail onViewBill={onViewBill} invoice={{ id: 'inv-1', job_id: 'job-1' }} />)
    fireEvent.click(screen.getByText('View Bill'))
    expect(onViewBill).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('Open invoice PDF in a new tab'))
    await waitFor(() => expect(openPdf).toHaveBeenCalledTimes(1))
    expect(openPdf.mock.calls[0]?.[0]).toEqual({ id: 'inv-1', job_id: 'job-1' })
    expect(onViewBill).toHaveBeenCalledTimes(1)
  })

  it('label prop relabels the head button and keeps both actions wired (Who-owes-what cards)', async () => {
    const onViewBill = vi.fn()
    render(
      <ViewBillWithPdfTail label="View on board" compact onViewBill={onViewBill} invoice={{ id: 'inv-2', job_id: 'job-2' }} />,
    )
    expect(screen.queryByText('View Bill')).toBeNull()
    fireEvent.click(screen.getByText('View on board'))
    expect(onViewBill).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByLabelText('Open invoice PDF in a new tab'))
    await waitFor(() => expect(openPdf).toHaveBeenLastCalledWith({ id: 'inv-2', job_id: 'job-2' }, expect.anything()))
  })
})
