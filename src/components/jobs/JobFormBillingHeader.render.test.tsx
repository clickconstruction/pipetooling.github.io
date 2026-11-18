// @vitest-environment jsdom
/**
 * The top of the Job form's Bill region, by itself (the Job form map's second pass, cut 2): the "Billing" title,
 * the billing slice's autosave line in its two places, and the New Job money bar. Props only, so no stand-ins.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { buildEditJobBillingBar } from '../../lib/jobs/editJobBillingBar'
import { JobFormBillingHeader, type JobFormBillingHeaderProps } from './JobFormBillingHeader'

const bar = buildEditJobBillingBar({ total: 2_000, payments: [{ amount: 500 }], invoices: [] })

function draw(over: Partial<JobFormBillingHeaderProps> = {}) {
  return render(
    <JobFormBillingHeader embedded={false} editingId="job-1" isEditing billingAutosaveStatus="idle" billingBar={bar} billingBarMarks={[]} pctSaving={false} {...over} />,
  )
}

describe('JobFormBillingHeader', () => {
  it('the standalone form titles the section Billing, with no autosave line while nothing is wrong', () => {
    draw()
    expect(screen.getByText('Billing')).toBeTruthy()
    expect(screen.queryByText('Saving…')).toBeNull()
    expect(screen.queryByText(/Autosave failed/)).toBeNull()
  })

  it('a save in flight says Saving… beside the title, muted', () => {
    draw({ billingAutosaveStatus: 'saving' })
    const line = screen.getByText('Saving…')
    expect(line.getAttribute('aria-live')).toBe('polite')
    expect(line.style.color).toBe('var(--text-muted)')
    expect(line.parentElement?.textContent).toBe('BillingSaving…')
  })

  it('a failed save says so in red', () => {
    draw({ billingAutosaveStatus: 'error' })
    expect(screen.getByText('Autosave failed — edit again to retry').style.color).toBe('var(--text-red-600)')
  })

  it('in the Job window there is no title, and the autosave line shows only while saving or failed', () => {
    const { container, rerender } = draw({ embedded: true })
    expect(screen.queryByText('Billing')).toBeNull()
    expect(container.textContent).toBe('')
    rerender(<JobFormBillingHeader embedded editingId="job-1" isEditing billingAutosaveStatus="error" billingBar={bar} billingBarMarks={[]} pctSaving={false} />)
    const line = screen.getByText('Autosave failed — edit again to retry')
    expect(line.style.textAlign).toBe('right')
    expect(line.style.color).toBe('var(--text-red-600)')
  })

  it('in the Job window the block is pulled up under the Job Total; standalone it is not', () => {
    const embedded = draw({ embedded: true })
    expect((embedded.container.firstElementChild as HTMLElement).style.marginTop).toBe('-1.15rem')
    embedded.unmount()
    const standalone = draw()
    expect((standalone.container.firstElementChild as HTMLElement).style.marginTop).toBe('')
  })

  it('an open job draws no money bar here: its money is the ② card', () => {
    draw()
    expect(screen.queryByText('Remaining to bill')).toBeNull()
    expect(screen.queryByText('25% Paid')).toBeNull()
  })

  it('New Job draws the bar: each slice with its share, and what remains to bill', () => {
    draw({ editingId: null, isEditing: false })
    expect(screen.getByText('25% Paid')).toBeTruthy()
    expect(screen.getByText('0% Billed')).toBeTruthy()
    expect(screen.queryByText(/Draft \(not sent\)/)).toBeNull()
    expect(screen.getByText('Remaining to bill')).toBeTruthy()
  })

  it('New Job has no autosave line, whatever the slice reports', () => {
    draw({ editingId: null, isEditing: false, billingAutosaveStatus: 'saving' })
    expect(screen.queryByText('Saving…')).toBeNull()
  })

  it('a draft holding money adds its row to the bar', () => {
    const withDraft = buildEditJobBillingBar({ total: 2_000, payments: [], invoices: [{ id: 'inv-1', status: 'ready_to_bill', amount: 800 }] })
    draw({ editingId: null, isEditing: false, billingBar: withDraft })
    expect(screen.getByText('40% Draft (not sent)')).toBeTruthy()
  })
})
