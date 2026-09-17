// @vitest-environment jsdom
/**
 * Render smokes for the three small Pipeline confirms (Stages tab decomposition PR 5): the
 * Ready-to-Bill double checkbox gate, the plain send-back wording per target stage, and the
 * Collections confirm's note box vs the existing-note line.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StagesReadyForBillingConfirmModal } from './StagesReadyForBillingConfirmModal'
import { StagesSendBackSimpleConfirmModal } from './StagesSendBackSimpleConfirmModal'
import { StagesCollectionsConfirmModal } from './StagesCollectionsConfirmModal'
import type { JobWithDetails } from '../../types/jobWithDetails'

describe('StagesReadyForBillingConfirmModal', () => {
  it('enables Confirm only with both boxes ticked and nothing in flight', () => {
    const onConfirm = vi.fn()
    const onChecked1Change = vi.fn()
    const { rerender } = render(
      <StagesReadyForBillingConfirmModal job={{ id: 'j1', hcpNumber: '878', jobName: 'Acme' }} checked1={false} checked2={false} onChecked1Change={onChecked1Change} onChecked2Change={vi.fn()} busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />,
    )
    expect(screen.getByText('878 · Acme')).toBeTruthy()
    const confirm = screen.getByText('Confirm') as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.click(screen.getAllByRole('checkbox')[0]!)
    expect(onChecked1Change).toHaveBeenCalledWith(true)
    rerender(
      <StagesReadyForBillingConfirmModal job={{ id: 'j1', hcpNumber: '878', jobName: 'Acme' }} checked1 checked2 onChecked1Change={onChecked1Change} onChecked2Change={vi.fn()} busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />,
    )
    expect((screen.getByText('Confirm') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    rerender(
      <StagesReadyForBillingConfirmModal job={{ id: 'j1', hcpNumber: '878', jobName: 'Acme' }} checked1 checked2 onChecked1Change={onChecked1Change} onChecked2Change={vi.fn()} busy onCancel={vi.fn()} onConfirm={onConfirm} />,
    )
    expect((screen.getByText('…') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('StagesSendBackSimpleConfirmModal', () => {
  it('words the move by target stage and wires Cancel / Confirm', () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const { rerender } = render(<StagesSendBackSimpleConfirmModal target={{ id: 'j1', toStatus: 'waiting' }} busy={false} onCancel={onCancel} onConfirm={onConfirm} />)
    expect(screen.getByText('This will move the job back to Waiting.')).toBeTruthy()
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    rerender(<StagesSendBackSimpleConfirmModal target={{ id: 'j1', toStatus: 'ready_to_bill' }} busy={false} onCancel={onCancel} onConfirm={onConfirm} />)
    expect(screen.getByText('This will move the job back to Ready to Bill.')).toBeTruthy()
    rerender(<StagesSendBackSimpleConfirmModal target={{ id: 'j1', toStatus: 'billed' }} busy onCancel={onCancel} onConfirm={onConfirm} />)
    expect(screen.getByText('This will move the job back to Billed Awaiting Payment.')).toBeTruthy()
    expect((screen.getByText('…') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('StagesCollectionsConfirmModal', () => {
  const job = { id: 'j1', hcp_number: '878', click_number: '', job_name: 'Acme Plaza', collections_note: 'disputing' } as unknown as JobWithDetails

  it('"to" asks for a note and names the job; "from" shows the existing note instead', () => {
    const onNoteDraftChange = vi.fn()
    const onConfirm = vi.fn()
    const { rerender } = render(<StagesCollectionsConfirmModal confirm={{ job, direction: 'to' }} noteDraft="" onNoteDraftChange={onNoteDraftChange} saving={false} onCancel={vi.fn()} onConfirm={onConfirm} />)
    expect(screen.getByText('Move to Collections?')).toBeTruthy()
    expect(screen.getByText(/Flag 878 · Acme Plaza as difficult to collect\?/)).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(/customer disputing invoice/), { target: { value: 'no reply' } })
    expect(onNoteDraftChange).toHaveBeenCalledWith('no reply')
    fireEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    rerender(<StagesCollectionsConfirmModal confirm={{ job, direction: 'from' }} noteDraft="" onNoteDraftChange={onNoteDraftChange} saving onCancel={vi.fn()} onConfirm={onConfirm} />)
    expect(screen.getByText('Send back to Billed?')).toBeTruthy()
    expect(screen.getByText('Collections note: disputing')).toBeTruthy()
    expect(screen.queryByPlaceholderText(/customer disputing invoice/)).toBeNull()
    expect((screen.getByText('…') as HTMLButtonElement).disabled).toBe(true)
  })
})
