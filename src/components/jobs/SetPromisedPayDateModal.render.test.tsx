// @vitest-environment jsdom
/**
 * Render smoke for Write down their word (v2.5648): the sheet opens on the promise side as the Pipeline's chip
 * always did, the switch shows the paid side, the paid side's Save holds on a bad amount and writes through
 * add_job_payment_claim with the method, the day, the amount, who and how, and the record under the form reads a
 * claim in its own words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import SetPromisedPayDateModal, { parseClaimAmount } from './SetPromisedPayDateModal'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'

const rpc = vi.fn()
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

afterEach(() => {
  cleanup()
  rpc.mockReset()
})

const onRecord = [
  { id: 'w1', jobId: 'j1', customerId: 'c1', promisedYmd: '2026-10-20', saidBy: 'Dana', heardByName: 'Theo', channel: 'text', source: 'office', note: null, createdAt: '2026-10-21T14:40:00Z', kind: 'paid_claim', method: 'check_mailed', amount: null },
  { id: 'p1', jobId: 'j1', customerId: 'c1', promisedYmd: '2026-10-25', saidBy: 'Dana', heardByName: 'Theo', channel: 'text', source: 'office', note: null, createdAt: '2026-10-14T20:12:00Z', kind: 'promise', method: null, amount: null },
]

function mount() {
  rpc.mockImplementation(async (name: string) => (name === 'list_job_payment_promises_for' ? { data: onRecord, error: null } : { data: null, error: null }))
  const onSaved = vi.fn()
  const onClose = vi.fn()
  renderWithProviders(<SetPromisedPayDateModal jobId="j1" jobLabel="#1032 · Whitfield repipe" initialYmd="2026-10-25" onClose={onClose} onSaved={onSaved} />)
  return { onSaved, onClose }
}

describe('SetPromisedPayDateModal — Write down their word', () => {
  it('opens on the promise side, and the record reads both kinds', async () => {
    mount()
    await settle()
    expect(screen.getByRole('radio', { name: "They'll pay by…" }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByLabelText('Promised payment date')).toBeTruthy()
    await waitFor(() => expect(screen.getAllByTestId('promise-record-row')).toHaveLength(2))
    expect(screen.getByText(/Says paid Oct 20 · a check in the mail/)).toBeTruthy()
    expect(screen.getByText(/On record for this bill · 2 words/)).toBeTruthy()
  })
  it('the paid side writes the claim with its arguments, and holds on a bad amount', async () => {
    const { onSaved, onClose } = mount()
    await settle()
    fireEvent.click(screen.getByRole('radio', { name: 'They say they paid…' }))
    await settle()
    const write = screen.getByRole('button', { name: 'Write it down' }) as HTMLButtonElement
    expect(write.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Bank transfer' }))
    fireEvent.change(screen.getByLabelText('The day they say they paid'), { target: { value: '2026-10-20' } })
    fireEvent.change(screen.getByLabelText('How much they say they paid'), { target: { value: 'lots' } })
    await settle()
    expect(screen.getByText('An amount is a number over nothing, or blank.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Write it down' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('How much they say they paid'), { target: { value: '$1,500' } })
    fireEvent.change(screen.getByLabelText('Who said it'), { target: { value: 'Dana' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Text' }))
    fireEvent.change(screen.getByLabelText('A note'), { target: { value: 'Ref 4471' } })
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Write it down' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('add_job_payment_claim', { p_job_id: 'j1', p_date: '2026-10-20', p_method: 'bank_transfer', p_amount: 1500, p_said_by: 'Dana', p_channel: 'text', p_note: 'Ref 4471' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })
  it('parseClaimAmount: blank is all of it, a figure is a figure, anything else holds', () => {
    expect(parseClaimAmount('')).toBeNull()
    expect(parseClaimAmount('  ')).toBeNull()
    expect(parseClaimAmount('$1,500')).toBe(1500)
    expect(parseClaimAmount('99.555')).toBe(99.56)
    expect(Number.isNaN(parseClaimAmount('0'))).toBe(true)
    expect(Number.isNaN(parseClaimAmount('lots'))).toBe(true)
  })
})

describe('SetPromisedPayDateModal — the Money in pen (punch list #191)', () => {
  it('says where the date stands, and a quick day fills the date and saves as their word', async () => {
    rpc.mockImplementation(async (name: string) => (name === 'list_job_payment_promises_for' ? { data: [], error: null } : { data: null, error: null }))
    const onSaved = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(
      <SetPromisedPayDateModal
        jobId="j9"
        jobLabel="Juniper Hill Builders · $7,900 open"
        initialYmd={null}
        quickDays={[
          { ymd: '2026-10-28', label: 'Wed 28' },
          { ymd: '2026-10-30', label: 'Fri 30' },
        ]}
        contextLine="Now a guess from their usual pace: Thu Oct 29."
        onClose={onClose}
        onSaved={onSaved}
      />,
    )
    await settle()
    expect(screen.getByText('Now a guess from their usual pace: Thu Oct 29.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fri 30' }))
    expect(screen.getByRole('button', { name: 'Fri 30' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByLabelText('Promised payment date') as HTMLInputElement).value).toBe('2026-10-30')
    fireEvent.click(screen.getByRole('button', { name: 'Save promise' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    const call = rpc.mock.calls.find((c) => c[0] === 'add_job_payment_promise')!
    expect(call[1]).toMatchObject({ p_job_id: 'j9', p_date: '2026-10-30', p_channel: 'phone' })
    expect(onClose).toHaveBeenCalled()
  })
})
