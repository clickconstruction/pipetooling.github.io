// @vitest-environment jsdom
/**
 * Pays in kind on the customer's page (punch list #301): the card says the deal, what is paid and what is left; a
 * customer with no deal gets the one press that sets one up, only when the page says so; a failed read says why and
 * offers to read again; the ledger opens from the card.
 */
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import CustomerInKindCard from './CustomerInKindCard'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { concreteDeal, rentDeal } from './inKindTestData'

describe('CustomerInKindCard', () => {
  it('says a monthly deal, what it has paid and what is left', async () => {
    renderWithProviders(<CustomerInKindCard customerId="c1" customerName="Calloway Holdings" userId="u1" canSetUp io={{ load: () => Promise.resolve([rentDeal()]) }} />)
    await settle()
    expect(await screen.findByText('Pays in kind')).toBeTruthy()
    expect(screen.getByText('Every month')).toBeTruthy()
    expect(screen.getByText('Rent credit, the shop. $1,500.00 a month since September 2026. A month with nothing paid credits $3,000.00.')).toBeTruthy()
    expect(screen.getByText('$2,939.50')).toBeTruthy() // paid in kind: by the line and by hand
    expect(screen.getByText('$2,592.90')).toBeTruthy() // still to come
    expect(screen.getByText('on 2 bills, scheduled, not late')).toBeTruthy()
    expect(screen.getByText('Last credit')).toBeTruthy()
    expect(screen.queryByTestId('customer-in-kind-set-up')).toBeNull() // one open deal: no second set-up press
  })

  it('says a deal with no schedule and offers Add a line', async () => {
    renderWithProviders(<CustomerInKindCard customerId="c2" customerName="Lone Oak Concrete" userId="u1" canSetUp io={{ load: () => Promise.resolve([concreteDeal()]) }} />)
    await settle()
    expect(await screen.findByText('As it comes')).toBeTruthy()
    expect(screen.getByText('Concrete, as delivered. A line is added when something is given.')).toBeTruthy()
    expect(screen.queryByText('Last credit')).toBeNull()
    expect(screen.getByTestId('customer-in-kind-add-line').textContent).toBe('Add a line')
  })

  it('offers the set-up press to a customer with no deal, only when the page allows it', async () => {
    const io = { load: () => Promise.resolve([]) }
    const first = renderWithProviders(<CustomerInKindCard customerId="c3" customerName="Pecan Creek Gravel" userId="u1" canSetUp io={io} />)
    await settle()
    expect((await screen.findByTestId('customer-in-kind-set-up')).textContent).toBe('Set up paying in kind')
    first.unmount()
    renderWithProviders(<CustomerInKindCard customerId="c3" customerName="Pecan Creek Gravel" userId="u1" canSetUp={false} io={io} />)
    await settle()
    expect(screen.queryByTestId('customer-in-kind-set-up')).toBeNull()
    expect(screen.queryByText('Pays in kind')).toBeNull()
  })

  it('says why a read failed and reads again on the press', async () => {
    const load = vi.fn().mockRejectedValueOnce({ message: 'permission denied for table in_kind_arrangements' }).mockResolvedValueOnce([concreteDeal()])
    renderWithProviders(<CustomerInKindCard customerId="c2" customerName="Lone Oak Concrete" userId="u1" canSetUp io={{ load }} />)
    await settle()
    expect((await screen.findByRole('alert')).textContent).toContain('permission denied')
    fireEvent.click(screen.getByText('Read it again'))
    await settle()
    expect(await screen.findByText('Pays in kind')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('opens the ledger from the card', async () => {
    renderWithProviders(<CustomerInKindCard customerId="c2" customerName="Lone Oak Concrete" userId="u1" canSetUp io={{ load: () => Promise.resolve([concreteDeal()]) }} />)
    await settle()
    fireEvent.click(await screen.findByText('Open the ledger →'))
    await settle()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('What was given')).toBeTruthy()
    expect(screen.getAllByTestId('in-kind-line')).toHaveLength(3)
  })
})
