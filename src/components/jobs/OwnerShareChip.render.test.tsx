// @vitest-environment jsdom
/**
 * Render smoke for the owner-sees eye (v2.5770): the glyph carries the state and the tone, its
 * name is the card's fact, hover opens the card after a beat with the figure and the door, the
 * door opens the switch's window (which leads with the same fact), Esc closes it, and the list
 * variant draws the short words beside the eye. The role gate still hides it from the field.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import OwnerShareChip from './OwnerShareChip'
import { navButtonName } from '../../lib/navClickTelemetry'
import type { OwnerShareInvoice } from '../../lib/jobs/ownerBillShare'

vi.mock('../../lib/jobs/ownerBillShareIo', () => ({
  loadOwnerShareProperty: vi.fn(() => Promise.resolve({ jobs: [JOB], invoices: BILLS })),
  applyOwnerShare: vi.fn(() => Promise.resolve()),
}))

const JOB = { id: 'j1', customer_id: 'nia', gc_customer_id: 'ridgeway', bill_to_party: 'gc', customer_address_id: 'pecan', show_bills_to_other_party: false, hcp_number: '874', click_number: null, job_name: 'Okafor remodel', job_address: '212 Pecan Bend, Blanco TX', revenue: 19100, payments_made: 6700 }
const BILLS: OwnerShareInvoice[] = [{ id: 'i1', job_id: 'j1', status: 'billed', bill_to_party: null, bill_to_email: null, shown_to_party: null }]

describe('OwnerShareChip', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('off with an open bill: an amber crossed eye named by the fact; hover opens the card with the figure and the door', async () => {
    render(<OwnerShareChip job={JOB} invoices={BILLS} ownerName="Nia Okafor" gcName="Ridgeway Builders" role="dev" />)
    const eye = screen.getByRole('button', { name: "Nia Okafor's page shows $0 of this job." })
    expect(eye.getAttribute('data-owner-share-chip')).toBe('off')
    expect(eye.getAttribute('data-owner-sees-tone')).toBe('amber')
    expect(document.querySelector('[data-owner-sees-card]')).toBeNull()
    fireEvent.mouseEnter(eye)
    await act(async () => {
      vi.advanceTimersByTime(200)
    })
    const card = document.querySelector('[data-owner-sees-card]')
    expect(card).not.toBeNull()
    expect(card!.textContent).toContain('Open to Ridgeway Builders')
    expect(card!.textContent).toContain('$12,400')
    const door = screen.getByRole('button', { name: /Show Nia the bills/ })
    fireEvent.click(door)
    await act(async () => {
      await Promise.resolve()
    })
    expect(document.querySelector('[data-owner-sees-card]')).toBeNull()
    const dialog = screen.getByRole('dialog', { name: 'What Nia Okafor sees' })
    expect(dialog.textContent).toContain("Nia Okafor's page shows $0 of this job.")
    expect(dialog.textContent).toContain('Show Nia Okafor the bills at 212 Pecan Bend, Blanco TX?')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('names itself for the ledger without the owner (v2.5904)', () => {
    render(<OwnerShareChip job={JOB} invoices={BILLS} ownerName="Nia Okafor" gcName="Ridgeway Builders" role="dev" />)
    expect(navButtonName(screen.getByRole('button', { name: /page shows \$0/ }))).toBe('owner-sees')
  })

  it('leaving the eye closes the card after a beat; focus opens it at once', async () => {
    render(<OwnerShareChip job={JOB} invoices={BILLS} ownerName="Nia Okafor" gcName="Ridgeway Builders" role="assistant" />)
    const eye = screen.getByRole('button', { name: /page shows \$0/ })
    fireEvent.focus(eye)
    expect(document.querySelector('[data-owner-sees-card]')).not.toBeNull()
    fireEvent.mouseLeave(eye)
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    expect(document.querySelector('[data-owner-sees-card]')).toBeNull()
  })

  it('on: a blue open eye; the list variant draws its words beside it', () => {
    render(<OwnerShareChip words job={{ ...JOB, show_bills_to_other_party: true }} invoices={[{ ...BILLS[0]!, shown_to_party: 'customer' }]} ownerName="Nia Okafor" gcName="Ridgeway Builders" role="dev" />)
    const eye = screen.getByRole('button', { name: "Nia Okafor sees this job's bills on their page." })
    expect(eye.getAttribute('data-owner-share-chip')).toBe('on')
    expect(eye.getAttribute('data-owner-sees-tone')).toBe('blue')
    expect(eye.textContent).toBe('on their page')
  })

  it('nothing billed yet: a grey crossed eye; a field role sees nothing; a direct job draws nothing', () => {
    const { unmount } = render(<OwnerShareChip job={JOB} invoices={[]} ownerName="Nia Okafor" gcName="Ridgeway Builders" role="dev" />)
    expect(screen.getByRole('button').getAttribute('data-owner-sees-tone')).toBe('grey')
    unmount()
    render(<OwnerShareChip job={JOB} invoices={BILLS} ownerName="Nia Okafor" gcName="Ridgeway Builders" role="technician" />)
    expect(screen.queryByRole('button')).toBeNull()
    render(<OwnerShareChip job={{ ...JOB, gc_customer_id: null }} invoices={BILLS} ownerName="Nia Okafor" gcName="" role="dev" />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
