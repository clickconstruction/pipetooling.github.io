// @vitest-environment jsdom
/**
 * v2.4009: the Workflow page's Projections & Ledger panel as a component. Pins the seam — the
 * summary bar's three figures and their colours; what a stage manager who is not dev or master
 * is and is not shown; the table opening and closing on Details; a row per pairing with its
 * actions; the three projection actions handed back to the page.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import { WorkflowFinancialsPanel, type WorkflowFinancialsPanelProps } from './WorkflowFinancialsPanel'

type Projection = WorkflowFinancialsPanelProps['projections'][number]
type LineItem = WorkflowFinancialsPanelProps['lineItems'][string][number]

function projection(id: string, stage_name: string, amount: number, extra: Partial<Projection> = {}): Projection {
  return {
    id,
    workflow_id: 'w1',
    stage_name,
    memo: `${stage_name} draw`,
    amount,
    sequence_order: 1,
    step_id: null,
    placement: null,
    collected: false,
    created_at: null,
    updated_at: null,
    ...extra,
  }
}

function lineItem(id: string, step_id: string, amount: number, extra: Partial<LineItem> = {}): LineItem {
  return {
    id,
    step_id,
    memo: `item ${id}`,
    amount,
    item_date: null,
    link: null,
    sequence_order: 1,
    purchase_order_id: null,
    supply_house_invoice_id: null,
    created_at: null,
    updated_at: null,
    ...extra,
  }
}

const steps = [
  { id: 's1', name: 'Rough' },
  { id: 's2', name: 'Top Out' },
]

function props(over: Partial<WorkflowFinancialsPanelProps> = {}): WorkflowFinancialsPanelProps {
  return {
    projections: [projection('p1', 'Rough', 42000), projection('p2', 'Top Out', 18500)],
    steps,
    lineItems: { s1: [lineItem('i1', 's1', 38120), lineItem('i2', 's1', 880)], s2: [] },
    isDevOrMaster: true,
    canManageStages: true,
    onAddProjection: vi.fn(),
    onEditProjection: vi.fn(),
    onDeleteProjection: vi.fn(),
    ...over,
  }
}

afterEach(() => {
  cleanup()
})

describe('WorkflowFinancialsPanel', () => {
  it('shows the three figures — what is left in green — and keeps the table shut until Details', async () => {
    await renderSettled(<WorkflowFinancialsPanel {...props()} />, { loaded: () => screen.findByText('Projections: $60,500.00') })
    expect(screen.getByText('Ledger: $39,000.00')).toBeTruthy()
    const left = screen.getByText('Left: $21,500.00')
    expect(left.style.color).toBe('rgb(4, 120, 87)')
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByRole('button', { name: /Details/ })).toBeTruthy()
  })

  it('prints an overspend in parentheses, in red', async () => {
    const p = props({ projections: [projection('p1', 'Rough', 30000)] })
    await renderSettled(<WorkflowFinancialsPanel {...p} />, { loaded: () => screen.findByText('Projections: $30,000.00') })
    const left = screen.getByText('Left: ($9,000.00)')
    expect(left.style.color).toBe('rgb(185, 28, 28)')
  })

  it('shows a stage manager who is not dev or master the Ledger alone', async () => {
    const p = props({ isDevOrMaster: false, projections: [] })
    await renderSettled(<WorkflowFinancialsPanel {...p} />, { loaded: () => screen.findByText('Ledger: $39,000.00') })
    expect(screen.queryByText(/^Projections:/)).toBeNull()
    expect(screen.queryByText(/^Left:/)).toBeNull()
    expect(screen.queryByRole('button', { name: '+ Add Projection' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Details/ }))
    const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual(['Step', 'Memo', 'Ledger'])
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })

  it('opens the table on Details and shuts it again', async () => {
    await renderSettled(<WorkflowFinancialsPanel {...props()} />, { loaded: () => screen.findByText('Projections: $60,500.00') })
    fireEvent.click(screen.getByRole('button', { name: /Details/ }))
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Step',
      'Memo',
      'Projections',
      'Ledger',
      'Actions',
    ])
    // Rough: one projection beside two line items — the second row is padded. Top Out: a projection, nothing spent.
    const rows = within(table).getAllByRole('row')
    const body = rows.slice(1, -1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))
    expect(body).toEqual([
      ['Rough', 'Rough draw / item i1', '$42,000.00', '$38,120.00', 'EditDelete'],
      [' ', 'item i2', '—', '$880.00', ' '],
      ['Top Out', 'Top Out draw', '$18,500.00', '—', 'EditDelete'],
    ])
    const foot = rows[rows.length - 1]!
    expect(within(foot).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Total', '$60,500.00', '$39,000.00', ''])
    fireEvent.click(screen.getByRole('button', { name: /Hide details/ }))
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('says so when there is nothing to list, and offers to add a projection', async () => {
    const p = props({ projections: [], lineItems: { s1: [], s2: [] } })
    await renderSettled(<WorkflowFinancialsPanel {...p} />, { loaded: () => screen.findByText('Projections: $0.00') })
    fireEvent.click(screen.getByRole('button', { name: /Details/ }))
    expect(screen.getByText(/No projections or ledger items\./)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add Projection' }))
    expect(p.onAddProjection).toHaveBeenCalledTimes(1)
  })

  it('hands Add, Edit and Delete back to the page with the projection', async () => {
    const p = props()
    await renderSettled(<WorkflowFinancialsPanel {...p} />, { loaded: () => screen.findByText('Projections: $60,500.00') })
    fireEvent.click(screen.getByRole('button', { name: '+ Add Projection' }))
    expect(p.onAddProjection).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: /Details/ }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1]!)
    expect(p.onEditProjection).toHaveBeenCalledTimes(1)
    expect((p.onEditProjection as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toBe(p.projections[1])
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]!)
    expect(p.onDeleteProjection).toHaveBeenCalledWith('p1')
  })

  it('links a line item’s receipt with its scheme repaired', async () => {
    const p = props({ lineItems: { s1: [lineItem('i1', 's1', 10, { link: 'files.test/r.pdf' })], s2: [] } })
    await renderSettled(<WorkflowFinancialsPanel {...p} />, { loaded: () => screen.findByText('Ledger: $10.00') })
    fireEvent.click(screen.getByRole('button', { name: /Details/ }))
    const link = screen.getByTitle('files.test/r.pdf')
    expect(link.getAttribute('href')).toBe('https://files.test/r.pdf')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
