// @vitest-environment jsdom
/**
 * Render smokes for the two Pipeline send-back confirms (Stages tab decomposition PR 6): the
 * invoice dialog's delete vs revert wording, its attestation gate and the Stripe explainer;
 * the job dialog's framing per target stage, the attestation box, the reason chips and the
 * reason gate.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StagesSendBackInvoiceModal } from './StagesSendBackInvoiceModal'
import { StagesSendBackJobModal } from './StagesSendBackJobModal'
import { makeInvoice, makeJob } from '../../test/renderSmokeMocks'
import type { InvoiceWithJob } from '../../lib/jobsStagesBoard'

const inv = (p: Record<string, unknown> = {}): InvoiceWithJob =>
  ({ ...makeInvoice({ id: 'inv-1', amount: 1250, status: 'billed', ...p }), job: makeJob({ hcp_number: '878', job_name: 'Acme' }) }) as InvoiceWithJob

describe('StagesSendBackInvoiceModal', () => {
  it('delete: names the draft-bill action, gates Confirm on the attestation, and wires both buttons', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const onCheckedChange = vi.fn()
    const { rerender } = render(<StagesSendBackInvoiceModal target={{ inv: inv(), action: 'delete' }} checked={false} onCheckedChange={onCheckedChange} showStripeExplainer={false} busy={false} onCancel={onCancel} onConfirm={onConfirm} />)
    expect(screen.getByText('This will remove the invoice from Ready to Bill.')).toBeTruthy()
    expect(screen.getByText(/Job 878 · Acme · \$1,250\.00/)).toBeTruthy()
    const buttons = screen.getAllByRole('button')
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    rerender(<StagesSendBackInvoiceModal target={{ inv: inv(), action: 'delete' }} checked onCheckedChange={onCheckedChange} showStripeExplainer={false} busy={false} onCancel={onCancel} onConfirm={onConfirm} />)
    fireEvent.click(screen.getAllByRole('button')[1]!)
    expect(onConfirm).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('revert: says "Send back", and shows the Stripe explainer only after the tab raises it on a Stripe-sent bill', () => {
    const stripeInv = inv({ stripe_invoice_id: 'in_123' })
    const { rerender } = render(<StagesSendBackInvoiceModal target={{ inv: stripeInv, action: 'revert' }} checked onCheckedChange={vi.fn()} showStripeExplainer={false} busy={false} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Send back' })).toBeTruthy()
    expect(screen.queryByText(/This bill was sent via Stripe/)).toBeNull()
    rerender(<StagesSendBackInvoiceModal target={{ inv: stripeInv, action: 'revert' }} checked onCheckedChange={vi.fn()} showStripeExplainer busy={false} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText(/This bill was sent via Stripe/)).toBeTruthy()
    rerender(<StagesSendBackInvoiceModal target={{ inv: inv(), action: 'revert' }} checked onCheckedChange={vi.fn()} showStripeExplainer busy onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.queryByText(/This bill was sent via Stripe/)).toBeNull()
    expect((screen.getByText('…') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('StagesSendBackJobModal', () => {
  const base = { id: 'j1', hcpNumber: '878', jobName: 'Acme', rtbDraftCount: 0 }

  it('RTB → Working with a stage still billed: the framing, the reason chips, and the reason gate', () => {
    const onReasonChange = vi.fn()
    const onConfirm = vi.fn()
    const target = { ...base, toStatus: 'working' as const, rtbDraftCount: 1, billing: { rtbDraftCount: 1, rtbNonPrimaryDraftCount: 0, billedCount: 2, billedTotalDollars: 4200, stageBilledContinues: true } }
    const { rerender } = render(<StagesSendBackJobModal target={target} checked={false} onCheckedChange={vi.fn()} needsAttestation={false} collectPaymentNotice={null} statusEventLine="Moved into Ready to Bill by Taunya on Sep 12" reason="" onReasonChange={onReasonChange} busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />)
    expect(screen.getByRole('heading', { name: 'Send Job Back' })).toBeTruthy()
    expect(screen.getByText(/Its 2 billed lines stay billed \(\$4,200\.00\)\. The unsent remainder draft is removed/)).toBeTruthy()
    expect(screen.getByText('Moved into Ready to Bill by Taunya on Sep 12')).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.click(screen.getByText('Rework needed'))
    expect(onReasonChange).toHaveBeenCalledWith('Rework needed')
    expect((screen.getByRole('button', { name: 'Send Job Back' }) as HTMLButtonElement).disabled).toBe(true)
    rerender(<StagesSendBackJobModal target={target} checked={false} onCheckedChange={vi.fn()} needsAttestation={false} collectPaymentNotice={null} statusEventLine={null} reason="Rework — the trim set" onReasonChange={onReasonChange} busy={false} onCancel={vi.fn()} onConfirm={onConfirm} />)
    expect((screen.getByRole('button', { name: 'Send Job Back' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Send Job Back' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('Billed → Ready to Bill: the Stripe warning, the attestation box gating Confirm, and the collect-payment notice only on Working', () => {
    const onCheckedChange = vi.fn()
    const target = { ...base, toStatus: 'ready_to_bill' as const }
    const { rerender } = render(<StagesSendBackJobModal target={target} checked={false} onCheckedChange={onCheckedChange} needsAttestation collectPaymentNotice="Collect first" statusEventLine={null} reason="" onReasonChange={vi.fn()} busy={false} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText('This will move the job back to Ready to Bill.')).toBeTruthy()
    expect(screen.getByText(/Billed lines on this job will be removed/)).toBeTruthy()
    expect(screen.queryByText('Collect first')).toBeNull()
    expect((screen.getByRole('button', { name: 'Send back' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
    rerender(<StagesSendBackJobModal target={target} checked onCheckedChange={onCheckedChange} needsAttestation collectPaymentNotice="Collect first" statusEventLine={null} reason="" onReasonChange={vi.fn()} busy={false} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect((screen.getByRole('button', { name: 'Send back' }) as HTMLButtonElement).disabled).toBe(false)
    rerender(<StagesSendBackJobModal target={{ ...base, toStatus: 'working', rtbDraftCount: 2 }} checked={false} onCheckedChange={onCheckedChange} needsAttestation={false} collectPaymentNotice="Collect first" statusEventLine={null} reason="" onReasonChange={vi.fn()} busy={false} onCancel={vi.fn()} onConfirm={vi.fn()} />)
    expect(screen.getByText('Collect first')).toBeTruthy()
    expect(screen.getByText(/This will also remove 2 Ready to Bill draft bills/)).toBeTruthy()
  })
})
