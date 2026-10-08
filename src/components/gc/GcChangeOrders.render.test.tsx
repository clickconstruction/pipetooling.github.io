// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GcChangeOrdersWindow } from './GcChangeOrders'
import { changeOrderPrice } from '../../lib/gc/ownerBilling'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { ChangeOrder } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

const base: Omit<ChangeOrder, 'id' | 'number' | 'status' | 'sentOn' | 'answeredOn'> = {
  description: 'Add a coffee bar cabinet, per the customer',
  reason: 'owner',
  schedule: '+3 days',
  packageId: null,
  cost: 1000,
  price: 1100,
  pctDone: 0,
  days: 3,
}

function setup() {
  const state = initialGcState()
  const fairOaks = state.projects.find((p) => p.id === 'fairoaksd')!
  const project = {
    ...fairOaks,
    changeOrders: [
      { ...base, id: 'co-1', number: 1, status: 'draft' as const, sentOn: null, answeredOn: null },
      { ...base, id: 'co-2', number: 2, status: 'sent' as const, sentOn: '2026-10-01', answeredOn: null },
      { ...base, id: 'co-3', number: 3, status: 'signed' as const, sentOn: '2026-09-25', answeredOn: '2026-09-28' },
    ],
  }
  const writes = { onDraft: vi.fn(), onSend: vi.fn(), onAnswer: vi.fn(), onSetPct: vi.fn(), onDelete: vi.fn() }
  render(<GcChangeOrdersWindow state={state} project={project} today="2026-10-02" writes={writes} onClose={() => undefined} />)
  return { project, writes }
}

describe('GcChangeOrdersWindow', () => {
  it('sends or deletes a draft, records the answer to a sent one, and marks how much of a signed one is done', () => {
    const { writes } = setup()
    expect(screen.getByText('+$1,100 signed')).toBeTruthy()
    expect(screen.getByText('1 waiting on Cibolo Creek Partners')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send for signature' }))
    expect(writes.onSend).toHaveBeenCalledWith('co-1')
    fireEvent.click(screen.getByRole('button', { name: 'Delete the draft' }))
    expect(writes.onDelete).toHaveBeenCalledWith('co-1')
    expect(document.body.textContent).toContain('Send these words from your own email.')
    expect(document.body.textContent).toContain('Change order 2 for Fair Oaks Shops, Building D: Add a coffee bar cabinet, per the customer. It adds $1,100 to the price. It adds 3 days to the job.')
    fireEvent.click(screen.getByRole('button', { name: 'They signed' }))
    expect(writes.onAnswer).toHaveBeenCalledWith('co-2', true, '2026-10-02')
    fireEvent.change(screen.getByLabelText('How much of change order 3 is done'), { target: { value: '40' } })
    expect(writes.onSetPct).toHaveBeenCalledWith('co-3', 40)
  })

  it('drafts a new one at the cost plus the job’s fee unless the office types a price', () => {
    const { project, writes } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'New change order' }))
    fireEvent.change(screen.getByLabelText('Description of change'), { target: { value: 'Move the panel to the north wall' } })
    fireEvent.change(screen.getByLabelText('What it costs us'), { target: { value: '2000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the draft' }))
    expect(writes.onDraft).toHaveBeenCalledWith({
      description: 'Move the panel to the north wall',
      reason: 'owner',
      schedule: '',
      packageId: project.packages[0]!.id,
      cost: 2000,
      price: changeOrderPrice(project, 2000),
      days: 0,
    })
  })
})
