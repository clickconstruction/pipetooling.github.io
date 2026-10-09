// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

function setup(emailed: Record<string, { to: string; on: string }[]> = {}) {
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
  const writes = { onDraft: vi.fn(), onSend: vi.fn(), onAnswer: vi.fn(), onSetPct: vi.fn(), onDelete: vi.fn(), onDraftFromRequest: vi.fn(), onTurnDown: vi.fn(), onTell: vi.fn() }
  render(<GcChangeOrdersWindow state={state} project={project} today="2026-10-02" writes={writes} emailed={emailed} onClose={() => undefined} />)
  return { project, writes }
}

describe('GcChangeOrdersWindow', () => {
  it('says an answer came from their portal, and a decline’s reason (O7c)', () => {
    const state = initialGcState()
    const fairOaks = state.projects.find((p) => p.id === 'fairoaksd')!
    const project = {
      ...fairOaks,
      changeOrders: [
        { ...base, id: 'co-4', number: 4, status: 'declined' as const, sentOn: '2026-10-01', answeredOn: '2026-10-02', answeredInPortal: true, declinedNote: 'Over our budget this year' },
        { ...base, id: 'co-5', number: 5, status: 'signed' as const, sentOn: '2026-10-01', answeredOn: '2026-10-02', answeredInPortal: true },
        { ...base, id: 'co-6', number: 6, status: 'declined' as const, sentOn: '2026-10-01', answeredOn: '2026-10-02' },
      ],
    }
    const writes = { onDraft: vi.fn(), onSend: vi.fn(), onAnswer: vi.fn(), onSetPct: vi.fn(), onDelete: vi.fn(), onDraftFromRequest: vi.fn(), onTurnDown: vi.fn(), onTell: vi.fn() }
    render(<GcChangeOrdersWindow state={state} project={project} today="2026-10-02" writes={writes} emailed={{}} onClose={() => undefined} />)
    expect(screen.getAllByText('declined Oct 2 in their portal')).toHaveLength(1)
    expect(screen.getByText('Their reason: Over our budget this year')).toBeTruthy()
    expect(screen.getByText('signed Oct 2 in their portal')).toBeTruthy()
    expect(screen.getByText('declined Oct 2')).toBeTruthy()
    cleanup()
  })

  it('sends or deletes a draft, records the answer to a sent one, and marks how much of a signed one is done', () => {
    const { writes } = setup()
    expect(screen.getByText('+$1,100 signed')).toBeTruthy()
    expect(screen.getByText('1 waiting on Cibolo Creek Partners')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send for signature' }))
    // The email starts off: an untouched Send emails no one.
    expect(writes.onSend).toHaveBeenCalledWith('co-1', false)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Email it to the customer now' }))
    fireEvent.click(screen.getByRole('button', { name: 'Send for signature' }))
    expect(writes.onSend).toHaveBeenLastCalledWith('co-1', true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete the draft' }))
    expect(writes.onDelete).toHaveBeenCalledWith('co-1')
    expect(document.body.textContent).toContain('It went without an email. Send these words from your own email.')
    expect(document.body.textContent).toContain('Change order 2 for Fair Oaks Shops, Building D: Add a coffee bar cabinet, per the customer. It adds $1,100 to the price. It adds 3 days to the job.')
    fireEvent.click(screen.getByRole('button', { name: 'They signed' }))
    expect(writes.onAnswer).toHaveBeenCalledWith('co-2', true, '2026-10-02')
    fireEvent.change(screen.getByLabelText('How much of change order 3 is done'), { target: { value: '40' } })
    expect(writes.onSetPct).toHaveBeenCalledWith('co-3', 40)
  })

  it('says who an emailed one went to, in place of the words to send yourself', () => {
    setup({ 'co-2': [{ to: 'Cibolo Creek Partners', on: '2026-10-01' }] })
    expect(document.body.textContent).toContain('Emailed to Cibolo Creek Partners on Oct 1.')
    expect(document.body.textContent).not.toContain('Send these words from your own email.')
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

  it('makes a trade’s ask a change order at the price it shows, or turns it down with why (O3b)', () => {
    const { project, writes } = setup()
    // Tri-County's ask on Fair Oaks D, open: its own row above the change orders, counted in the header.
    expect(screen.getByText('1 asked by the trades')).toBeTruthy()
    expect(screen.getByText('asked by the trade')).toBeTruthy()
    expect(document.body.textContent).toContain('Rock at the north footings, about 390 cubic yards to break out and haul off')
    expect(document.body.textContent).toContain('Field condition · adds 2 days to the job')
    fireEvent.click(screen.getByRole('button', { name: 'Make a change order' }))
    expect((screen.getByLabelText('What it costs us') as HTMLInputElement).value).toBe('14820')
    expect((screen.getByLabelText('Days it adds to the job') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('What it adds to their price') as HTMLInputElement).placeholder).toBe(String(changeOrderPrice(project, 14820)))
    expect(document.body.textContent).toContain('Their ask is our cost. The price starts at the cost plus our 10% fee. Tri-County Site only ever sees the cost.')
    fireEvent.click(screen.getByRole('button', { name: 'Save the draft' }))
    expect(writes.onDraftFromRequest).toHaveBeenCalledWith('fairoaksd-cr-1', {
      description: 'Rock at the north footings, about 390 cubic yards to break out and haul off',
      cost: 14820,
      price: changeOrderPrice(project, 14820),
      days: 2,
    })
    // A typed price stands over the cost plus our fee.
    fireEvent.click(screen.getByRole('button', { name: 'Make a change order' }))
    fireEvent.change(screen.getByLabelText('What it adds to their price'), { target: { value: '17500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the draft' }))
    expect(writes.onDraftFromRequest).toHaveBeenLastCalledWith('fairoaksd-cr-1', expect.objectContaining({ price: 17500 }))
    // Turning it down needs why, in words the company reads.
    fireEvent.click(screen.getByRole('button', { name: 'Turn down' }))
    expect(document.body.textContent).toContain('Tri-County Site gets an email with why.')
    const turnDown = screen.getByRole('button', { name: 'Turn it down' }) as HTMLButtonElement
    expect(turnDown.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why, for Tri-County Site'), { target: { value: '  The rock was in the geotech report.  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Turn it down' }))
    expect(writes.onTurnDown).toHaveBeenCalledWith('fairoaksd-cr-1', 'The rock was in the geotech report.')
  })

  it('names who asked for a change order made of an ask, and offers Tell only while that email has not gone (O3b)', () => {
    const state = initialGcState()
    const fairOaks = state.projects.find((p) => p.id === 'fairoaksd')!
    const ask = fairOaks.changeRequests![0]!
    const project = {
      ...fairOaks,
      changeOrders: [
        { ...base, id: 'co-7', number: 7, status: 'draft' as const, sentOn: null, answeredOn: null },
        { ...base, id: 'co-8', number: 8, status: 'sent' as const, sentOn: '2026-10-01', answeredOn: null },
        { ...base, id: 'co-9', number: 9, status: 'declined' as const, sentOn: '2026-10-01', answeredOn: '2026-10-02' },
      ],
      changeRequests: [
        { ...ask, id: 'r-7', changeOrderId: 'co-7' },
        { ...ask, id: 'r-8', changeOrderId: 'co-8' },
        { ...ask, id: 'r-9', changeOrderId: 'co-9' },
      ],
    }
    const writes = { onDraft: vi.fn(), onSend: vi.fn(), onAnswer: vi.fn(), onSetPct: vi.fn(), onDelete: vi.fn(), onDraftFromRequest: vi.fn(), onTurnDown: vi.fn(), onTell: vi.fn() }
    render(
      <GcChangeOrdersWindow state={state} project={project} today="2026-10-05" writes={writes} askEmailed={{ 'r-8:sent': '2026-10-01' }} onClose={() => undefined} />,
    )
    // Every ask has its change order, so none waits on us.
    expect(screen.queryByText('asked by the trade')).toBeNull()
    expect(screen.getAllByText('Asked for by Tri-County Site on Sep 30: $14,820.')).toHaveLength(3)
    expect(document.body.textContent).toContain('Deleting it puts Tri-County Site’s ask back on the list.')
    expect(document.body.textContent).toContain('Told Tri-County Site Oct 1.')
    // The customer said no and the company has not heard it: one Tell, for that one.
    expect(document.body.textContent).toContain('Tri-County Site has not heard the customer said no.')
    expect(screen.getAllByRole('button', { name: 'Tell Tri-County Site' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Tell Tri-County Site' }))
    expect(writes.onTell).toHaveBeenCalledWith('r-9', 'no')
    cleanup()
  })
})
