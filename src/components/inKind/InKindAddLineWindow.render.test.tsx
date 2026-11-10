// @vitest-environment jsdom
/**
 * Add a line (punch list #301): three boxes and what it counts as; the press is dead until the line is whole and says
 * its amount; where it goes is the database's own dry run; a bill on Stripe is named; a refusal shows its reason.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import InKindAddLineWindow, { type InKindAddLineIo } from './InKindAddLineWindow'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { parseInKindAddResult } from '../../lib/inKind/inKindLedger'
import { concreteDeal } from './inKindTestData'

const plan = parseInKindAddResult({
  ok: true,
  dry_run: true,
  applied: [{ job_id: 'j9', invoice_id: 'inv-j9', hcp_number: '1171', click_number: null, job_name: 'Batch plant wash rack', amount: 885, left_after: 2375, pays_off: false }],
  held: [{ job_id: 'j8', invoice_id: 'inv-j8', hcp_number: '1113', click_number: null, job_name: 'Kitchen repipe', open: 500, why: 'stripe' }],
  unapplied: 0,
})

function makeIo(over: Partial<InKindAddLineIo> = {}): InKindAddLineIo {
  return {
    addLine: vi.fn((_input, dryRun: boolean) => Promise.resolve(dryRun ? plan : parseInKindAddResult({ ok: true, line_id: 'new', applied: plan.applied, held: [], unapplied: 0 }))),
    searchJobs: vi.fn(() => Promise.resolve([{ id: 'oak', hcp_number: '1158', click_number: null, job_name: 'Oak Hollow Building C', job_address: '12 Oak Hollow Rd' }])),
    ...over,
  }
}

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('InKindAddLineWindow', () => {
  it('keeps the press dead until the amount and the memo are in, then names the amount', async () => {
    renderWithProviders(<InKindAddLineWindow data={concreteDeal()} onClose={() => undefined} onAdded={() => undefined} io={makeIo()} />)
    await settle()
    const press = screen.getByTestId('in-kind-add-line-save') as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.textContent).toBe('Add the line')
    type('Amount', '885')
    expect(press.disabled).toBe(true) // no memo yet
    expect(press.textContent).toBe('Add the line for $885.00')
    type('What was given instead of money', '6 yards of 3000 psi')
    expect(press.disabled).toBe(false)
  })

  it('shows where the line goes from the dry run, and names a bill on Stripe', async () => {
    const io = makeIo()
    renderWithProviders(<InKindAddLineWindow data={concreteDeal()} onClose={() => undefined} onAdded={() => undefined} io={io} />)
    await settle()
    type('Amount', '885')
    await waitFor(() => expect(screen.getByTestId('in-kind-where-it-goes')).toBeTruthy(), { timeout: 2000 })
    expect(screen.getByText('1171 Batch plant wash rack')).toBeTruthy()
    expect(screen.getByText('$2,375.00 is left on it after.')).toBeTruthy()
    expect(screen.getByText('1113 is on Stripe, so this line passes it over. Record its payment from the bill itself.')).toBeTruthy()
    expect(io.addLine).toHaveBeenCalledWith(expect.objectContaining({ arrangementId: 'a2', amount: 885 }), true)
  })

  it('saves the line as overhead and says it is added', async () => {
    const io = makeIo()
    const onAdded = vi.fn()
    renderWithProviders(<InKindAddLineWindow data={concreteDeal()} onClose={() => undefined} onAdded={onAdded} io={io} />)
    await settle()
    type('Amount', '885.00')
    type('Date', '2026-11-04')
    type('What was given instead of money', '  6 yards of 3000 psi  ')
    fireEvent.click(screen.getByTestId('in-kind-add-line-save'))
    await settle()
    expect(io.addLine).toHaveBeenLastCalledWith({ arrangementId: 'a2', givenOn: '2026-11-04', amount: 885, memo: '6 yards of 3000 psi', costJobId: null, forMonth: null }, false)
    expect(onAdded).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('The line for $885.00 is added.')).toBeTruthy()
  })

  it('counts the line on a job once the job is picked', async () => {
    const io = makeIo()
    renderWithProviders(<InKindAddLineWindow data={concreteDeal()} onClose={() => undefined} onAdded={() => undefined} io={io} />)
    await settle()
    type('Amount', '1475')
    type('What was given instead of money', '10 yards, the slab patch')
    fireEvent.click(screen.getByText('A job'))
    const press = screen.getByTestId('in-kind-add-line-save') as HTMLButtonElement
    expect(press.disabled).toBe(true) // a job is asked for and none is picked
    type('Find the job by its number, name or address', 'oak')
    fireEvent.click(await screen.findByText('1158 Oak Hollow Building C', {}, { timeout: 2000 }))
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await settle()
    expect(io.addLine).toHaveBeenLastCalledWith(expect.objectContaining({ costJobId: 'oak', amount: 1475 }), false)
  })

  it('shows the reason when the save is refused, and keeps what was typed', async () => {
    const io = makeIo({ addLine: vi.fn((_i, dryRun: boolean) => (dryRun ? Promise.resolve(plan) : Promise.reject(new Error('This arrangement has ended.')))) })
    const onAdded = vi.fn()
    renderWithProviders(<InKindAddLineWindow data={concreteDeal()} onClose={() => undefined} onAdded={onAdded} io={io} />)
    await settle()
    type('Amount', '885')
    type('What was given instead of money', '6 yards')
    fireEvent.click(screen.getByTestId('in-kind-add-line-save'))
    await settle()
    expect((await screen.findByRole('alert')).textContent).toBe('This arrangement has ended.')
    expect(onAdded).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('885')
  })

  it('refuses an amount that is not money', async () => {
    renderWithProviders(<InKindAddLineWindow data={concreteDeal()} onClose={() => undefined} onAdded={() => undefined} io={makeIo()} />)
    await settle()
    type('Amount', 'twelve')
    type('What was given instead of money', '6 yards')
    expect((screen.getByTestId('in-kind-add-line-save') as HTMLButtonElement).disabled).toBe(true)
  })
})
