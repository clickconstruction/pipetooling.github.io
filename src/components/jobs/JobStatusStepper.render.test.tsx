// @vitest-environment jsdom
/**
 * Render smokes for the Edit Job status rail (v2.3240): three states with
 * three looks, a locked stage explains itself on tap, and Collections is a
 * switch armed only on Billed jobs. Moves themselves are the kernel's and the
 * RPC's business (jobStatusStepper.test.ts); nothing here writes.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import JobStatusStepper from './JobStatusStepper'

vi.mock('../../lib/supabase', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../contexts/ToastContext', () => ({ useToastContext: () => ({ showToast: vi.fn() }) }))

const job = (status: string, collections_at: string | null = null) => ({
  id: 'j1',
  status,
  collections_at,
  hcp_number: '523',
  click_number: null,
  job_name: 'Mission Hills',
  revenue: 1000,
  payments_made: 0,
})

const stateOf = (name: string) => screen.getByRole('button', { name: new RegExp(`^(←|→|\\d)?\\s*${name}$`) }).getAttribute('data-state')

describe('JobStatusStepper (rail)', () => {
  it('a Working job: Waiting and Ready to bill are reachable, Billed and Paid are locked, Working is current', () => {
    render(<JobStatusStepper job={job('working')} authRole="dev" onChanged={() => {}} />)
    expect(screen.getByText('Status')).toBeTruthy()
    expect(stateOf('Waiting')).toBe('reachable')
    expect(stateOf('Working')).toBe('current')
    expect(stateOf('Ready to bill')).toBe('reachable')
    expect(stateOf('Billed')).toBe('locked')
    expect(stateOf('Paid')).toBe('locked')
    // A locked stage explains itself under the rail instead of only in a tooltip.
    fireEvent.click(screen.getByRole('button', { name: /Billed$/ }))
    expect(screen.getByRole('status').textContent).toBe('Mark the job Ready to bill first')
    // Collections is a switch, off and disabled until Billed, and says so.
    const sw = screen.getByRole('switch')
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect((sw as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/applies once the job is Billed/)).toBeTruthy()
  })

  it('a Billed job in Collections: the switch is on and enabled; Paid is one tap away; Waiting is locked', () => {
    render(<JobStatusStepper job={job('billed', '2026-09-01T00:00:00Z')} authRole="dev" onChanged={() => {}} />)
    const sw = screen.getByRole('switch')
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect((sw as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByText('In Collections')).toBeTruthy()
    expect(stateOf('Paid')).toBe('reachable')
    expect(stateOf('Billed')).toBe('current')
    expect(stateOf('Waiting')).toBe('locked')
  })
})
