// @vitest-environment jsdom
/**
 * Render smoke for Bill Customer's edit-dates dialog, cut out of `SendRecordInvoiceModal` as a pure move
 * (`BillCustomerEditDatesDialog`). The drafts and the dates are the window's state: the harness holds them, and each
 * test reads what the dialog writes back.
 */
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BillCustomerEditDatesDialog, type BillCustomerEditDatesDialogProps } from './BillCustomerEditDatesDialog'

function Harness({ tab }: { tab: BillCustomerEditDatesDialogProps['tab'] }) {
  const [open, setOpen] = useState(true)
  const [draftServiceYmd, setDraftServiceYmd] = useState('2026-11-17')
  const [draftDueYmd, setDraftDueYmd] = useState('2026-11-30')
  const [sentDate, setSentDate] = useState('2026-11-17')
  const [stripeDueDate, setStripeDueDate] = useState('2026-11-30')
  return (
    <>
      {open ? (
        <BillCustomerEditDatesDialog
          tab={tab}
          overlayZIndex={760}
          draftServiceYmd={draftServiceYmd}
          setDraftServiceYmd={setDraftServiceYmd}
          draftDueYmd={draftDueYmd}
          setDraftDueYmd={setDraftDueYmd}
          setEditDueDateOpen={setOpen}
          setSentDate={setSentDate}
          setStripeDueDate={setStripeDueDate}
        />
      ) : null}
      <output data-testid="state">{JSON.stringify({ open, sentDate, stripeDueDate })}</output>
    </>
  )
}

const state = () => JSON.parse(screen.getByTestId('state').textContent ?? '{}') as { open: boolean; sentDate: string; stripeDueDate: string }
const due = () => document.getElementById('bill-customer-edit-due-date') as HTMLInputElement
const service = () => document.getElementById('bill-customer-edit-service-date') as HTMLInputElement | null

describe('BillCustomerEditDatesDialog', () => {
  it('from the Stripe bill: one date, under the name Edit Due Date, and Save writes the due date alone', () => {
    render(<Harness tab="stripe" />)
    const dialog = screen.getByRole('dialog', { name: 'Edit Due Date' })
    expect(service()).toBeNull()
    expect(due().value).toBe('2026-11-30')
    // The dialog sits 20 above the window that opened it.
    expect((dialog.parentElement as HTMLElement).style.zIndex).toBe('780')
    fireEvent.change(due(), { target: { value: '2026-12-05' } })
    // Typing is a draft: nothing is written until Save.
    expect(state()).toEqual({ open: true, sentDate: '2026-11-17', stripeDueDate: '2026-11-30' })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(state()).toEqual({ open: false, sentDate: '2026-11-17', stripeDueDate: '2026-12-05' })
  })

  it('from the physical invoice: both dates, under the name Edit dates, and Save writes both', () => {
    render(<Harness tab="physical" />)
    expect(screen.getByRole('dialog', { name: 'Edit dates' })).toBeTruthy()
    expect(service()?.value).toBe('2026-11-17')
    fireEvent.change(service() as HTMLInputElement, { target: { value: '2026-11-10' } })
    fireEvent.change(due(), { target: { value: '2026-12-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(state()).toEqual({ open: false, sentDate: '2026-11-10', stripeDueDate: '2026-12-20' })
  })

  it('Cancel closes it and writes nothing', () => {
    render(<Harness tab="physical" />)
    fireEvent.change(service() as HTMLInputElement, { target: { value: '2026-11-10' } })
    fireEvent.change(due(), { target: { value: '2026-12-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(state()).toEqual({ open: false, sentDate: '2026-11-17', stripeDueDate: '2026-11-30' })
  })

  it('a press on the backdrop closes it, a press inside the dialog does not', () => {
    render(<Harness tab="stripe" />)
    const dialog = screen.getByRole('dialog', { name: 'Edit Due Date' })
    fireEvent.click(dialog)
    fireEvent.click(due())
    expect(state().open).toBe(true)
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(state()).toEqual({ open: false, sentDate: '2026-11-17', stripeDueDate: '2026-11-30' })
  })
})
