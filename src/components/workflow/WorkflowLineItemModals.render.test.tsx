// @vitest-environment jsdom
/**
 * v2.3975: the Workflow page's six line-item windows as a component. Pins the seam — nothing is
 * drawn while every window is closed; each window draws what the page hands it and hands every
 * action back with the ids the page needs; the invoice picker's search and the clipboard
 * import's busy flag live in the windows and start fresh each time one opens.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderSettled, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import {
  WorkflowLineItemModals,
  type EditingLineItem,
  type WorkflowLineItemModalsProps,
} from './WorkflowLineItemModals'

type LineItem = NonNullable<EditingLineItem['item']>

const lineItem = {
  id: 'li1',
  step_id: 's1',
  memo: 'Pipe and fittings',
  amount: -1234.5,
  item_date: '2026-09-07',
  link: null,
  sequence_order: 1,
  purchase_order_id: null,
  supply_house_invoice_id: null,
  created_at: null,
  updated_at: null,
} as LineItem

const invoices = [
  { id: 'i1', invoice_number: 'INV-1001', supply_house_name: 'Ferguson', amount: 1250.5, invoice_date: '2026-09-07', due_date: '2026-10-07', is_paid: true, purchase_order_number: 'PO-77' },
  { id: 'i2', invoice_number: 'S-2040', supply_house_name: 'Moore Supply', amount: 85, invoice_date: '2026-08-15', due_date: null, is_paid: false, purchase_order_number: null },
]

function closed(): WorkflowLineItemModalsProps {
  return {
    confirmDeleteLineItem: null,
    onDeleteLineItem: vi.fn(async () => {}),
    onCloseDeleteLineItem: vi.fn(),
    editingLineItem: null,
    onChangeEditingLineItem: vi.fn(),
    onSaveLineItem: vi.fn(),
    onImportPastedLineItems: vi.fn(async () => {}),
    onError: vi.fn(),
    addingPOToStep: null,
    availablePOs: [],
    onAddPOToStep: vi.fn(),
    onCloseAddPO: vi.fn(),
    addingInvoiceToStep: null,
    availableInvoices: [],
    onAddInvoiceToStep: vi.fn(),
    onCloseAddInvoice: vi.fn(),
    viewingPO: null,
    onCloseViewPO: vi.fn(),
    viewingInvoice: null,
    onCloseViewInvoice: vi.fn(),
  }
}

const blankEdit: EditingLineItem = { stepId: 's1', item: null, link: '', memo: '', amount: '', itemDate: '' }

function stubClipboard(readText: () => Promise<string>) {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText } })
}

afterEach(() => {
  cleanup()
})

describe('WorkflowLineItemModals', () => {
  it('draws nothing while every window is closed', () => {
    const { container } = renderWithProviders(<WorkflowLineItemModals {...closed()} />)
    // first paint
    expect(container.textContent).toBe('')
  })

  it('delete confirm: shows the memo, the amount in parentheses and the date; Delete writes, then closes', async () => {
    const props = { ...closed(), confirmDeleteLineItem: { item: lineItem, stepName: 'Rough' } }
    await renderSettled(<WorkflowLineItemModals {...props} />, { loaded: () => screen.findByText('Delete line item?') })
    expect(screen.getByText(/Pipe and fittings/)).toBeTruthy()
    expect(screen.getByText(/\(\$1,234\.50\)/)).toBeTruthy()
    expect(screen.getByText(/Date: Sep 7, 2026/)).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    })
    expect(props.onDeleteLineItem).toHaveBeenCalledWith('li1')
    expect(props.onCloseDeleteLineItem).toHaveBeenCalledTimes(1)
  })

  it('delete confirm: Cancel closes without writing', async () => {
    const props = { ...closed(), confirmDeleteLineItem: { item: lineItem, stepName: 'Rough' } }
    await renderSettled(<WorkflowLineItemModals {...props} />, { loaded: () => screen.findByText('Delete line item?') })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onCloseDeleteLineItem).toHaveBeenCalledTimes(1)
    expect(props.onDeleteLineItem).not.toHaveBeenCalled()
  })

  it('add line item: typing hands back the fields, Save hands back all six values, Cancel closes', async () => {
    const editing: EditingLineItem = { stepId: 's1', item: null, link: 'https://x.test/r', memo: 'Permit', amount: '85', itemDate: '2026-09-07' }
    const props = { ...closed(), editingLineItem: editing }
    await renderSettled(<WorkflowLineItemModals {...props} />, { loaded: () => screen.findByText('Add Line Item') })
    fireEvent.change(screen.getByLabelText('Memo *'), { target: { value: 'Permit fee' } })
    expect(props.onChangeEditingLineItem).toHaveBeenLastCalledWith({ ...editing, memo: 'Permit fee' })
    fireEvent.submit(screen.getByLabelText('Memo *').closest('form')!)
    expect(props.onSaveLineItem).toHaveBeenCalledWith('s1', null, 'https://x.test/r', 'Permit', '85', '2026-09-07')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onChangeEditingLineItem).toHaveBeenLastCalledWith(null)
  })

  it('edit line item: says Edit, has no clipboard import, and warns about a link without a scheme', async () => {
    const props = { ...closed(), editingLineItem: { ...blankEdit, item: lineItem, link: 'x.test/r', memo: 'Pipe' } }
    await renderSettled(<WorkflowLineItemModals {...props} />, { loaded: () => screen.findByText('Edit Line Item') })
    expect(screen.queryByLabelText('Import line items from clipboard')).toBeNull()
    expect(screen.getByText('Link should start with http:// or https://')).toBeTruthy()
  })

  it('clipboard import: clears the error, hands the pasted text to the page with the step', async () => {
    stubClipboard(async () => '3/23/2026\tPipe\t12')
    const props = { ...closed(), editingLineItem: blankEdit }
    await renderSettled(<WorkflowLineItemModals {...props} />, { loaded: () => screen.findByText('Add Line Item') })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Import line items from clipboard'))
    })
    await settle()
    expect(props.onError).toHaveBeenCalledWith(null)
    expect(props.onImportPastedLineItems).toHaveBeenCalledWith('s1', '3/23/2026\tPipe\t12')
    expect((screen.getByLabelText('Import line items from clipboard') as HTMLButtonElement).disabled).toBe(false)
  })

  it('clipboard import: a refused clipboard goes to the page’s error line', async () => {
    stubClipboard(async () => {
      throw new Error('Read permission denied.')
    })
    const props = { ...closed(), editingLineItem: blankEdit }
    await renderSettled(<WorkflowLineItemModals {...props} />, { loaded: () => screen.findByText('Add Line Item') })
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Import line items from clipboard'))
    })
    await settle()
    expect(props.onError).toHaveBeenLastCalledWith('Read permission denied.')
    expect(props.onImportPastedLineItems).not.toHaveBeenCalled()
  })

  it('PO picker: lists the finalized POs with totals and attaches the one clicked to the step', async () => {
    const props = { ...closed(), addingPOToStep: 's1', availablePOs: [{ id: 'po1', name: 'Rough-in order', total: 4210.5 }] }
    await renderSettled(<WorkflowLineItemModals {...props} />, { loaded: () => screen.findByText('Add Purchase Order to Step') })
    expect(screen.getByText('$4210.50')).toBeTruthy()
    fireEvent.click(screen.getByText('Rough-in order'))
    expect(props.onAddPOToStep).toHaveBeenCalledWith('s1', 'po1')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onCloseAddPO).toHaveBeenCalledTimes(1)
  })

  it('PO picker: says where to make one when there are none', async () => {
    await renderSettled(<WorkflowLineItemModals {...closed()} addingPOToStep="s1" />, {
      loaded: () => screen.findByText(/No finalized purchase orders available/),
    })
  })

  it('invoice picker: the search narrows the list, a click attaches, and the search is blank on the next open', async () => {
    const props = { ...closed(), addingInvoiceToStep: 's1', availableInvoices: invoices }
    const { rerender } = await renderSettled(<WorkflowLineItemModals {...props} />, {
      loaded: () => screen.findByText('Add Supply House Invoice to Step'),
    })
    expect(screen.getByText('Ferguson')).toBeTruthy()
    expect(screen.getByText('Moore Supply')).toBeTruthy()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'unpaid' } })
    expect(screen.queryByText('Ferguson')).toBeNull()
    fireEvent.click(screen.getByText('Moore Supply'))
    expect(props.onAddInvoiceToStep).toHaveBeenCalledWith('s1', 'i2')
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(screen.getByText('No matching invoices.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(props.onCloseAddInvoice).toHaveBeenCalledTimes(1)
    rerender(<WorkflowLineItemModals {...props} addingInvoiceToStep={null} />)
    rerender(<WorkflowLineItemModals {...props} addingInvoiceToStep="s2" />)
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('')
    expect(screen.getByText('Ferguson')).toBeTruthy()
  })

  it('PO detail: a row per item, each line’s total and the grand total', async () => {
    const props = {
      ...closed(),
      viewingPO: {
        id: 'po1',
        name: 'Rough-in order',
        items: [
          { part: { name: '2" PVC' }, quantity: 10, supply_house: { name: 'Ferguson' }, price_at_time: 4.25 },
          { part: { name: 'Wax ring' }, quantity: 3, supply_house: null, price_at_time: 2 },
        ],
      },
    }
    await renderSettled(<WorkflowLineItemModals {...props} />, { loaded: () => screen.findByText('Rough-in order') })
    expect(screen.getByText('$42.50')).toBeTruthy()
    expect(screen.getByText('$6.00')).toBeTruthy()
    expect(screen.getByText('$48.50')).toBeTruthy()
    expect(screen.getByText('-')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onCloseViewPO).toHaveBeenCalledTimes(1)
  })

  it('invoice detail: the supply house, the amount, and the link with its scheme repaired', async () => {
    const props = {
      ...closed(),
      viewingInvoice: { id: 'i1', invoice_number: 'INV-1001', supply_house_name: 'Ferguson', amount: 1250.5, link: 'files.test/inv.pdf' },
    }
    await renderSettled(<WorkflowLineItemModals {...props} />, { loaded: () => screen.findByText('Invoice #INV-1001') })
    expect(screen.getByText('$1,250.50')).toBeTruthy()
    const link = screen.getByRole('link', { name: 'View invoice link' })
    expect(link.getAttribute('href')).toBe('https://files.test/inv.pdf')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(props.onCloseViewInvoice).toHaveBeenCalledTimes(1)
  })
})
