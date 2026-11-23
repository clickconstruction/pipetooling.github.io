// @vitest-environment jsdom
/**
 * Render-smoke tests for the merge window's plan (v2.8324): what moves, folded after six kinds, what the rules do,
 * the jobs that name both, and the legal matter that stops a merge. Every name here is made up.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { parseMergePlan } from '../../lib/customers/customerMergePlan'
import { CustomerMergePlan } from './CustomerMergePlan'

installDomShims()

const holds = {
  'jobs_ledger.customer_id': 9,
  'jobs_ledger.gc_customer_id': 8,
  'bids.customer_id': 7,
  'file_index.customer_id': 6,
  'customer_addresses.customer_id': 5,
  'public_page_views.entity_id': 4,
  'estimates.customer_id': 3,
  'gc_difficulty_ratings.customer_id': 2,
}

describe('CustomerMergePlan', () => {
  it('lists what moves, the largest first, and folds after six kinds', () => {
    renderWithProviders(<CustomerMergePlan plan={parseMergePlan({ holds, left_behind: {}, same_job: 0, legal_blocked: false })!} />)
    const items = () => within(screen.getByTestId('customer-merge-plan')).getAllByRole('listitem').map((li) => li.textContent)
    expect(items()).toEqual(['9 jobs', '8 jobs they are the GC on', '7 bids', '6 files in the file index', '5 properties', '4 portal visits'])
    fireEvent.click(screen.getByRole('button', { name: 'See 2 more kinds ›' }))
    expect(items()).toHaveLength(8)
    expect(items()).toContain('2 difficulty ratings')
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }))
    expect(items()).toHaveLength(6)
    expect(screen.queryByText('Where only one can stand')).toBeNull()
  })

  it('says what the rules do, that anything dropped is kept, and the jobs that name both', () => {
    renderWithProviders(
      <CustomerMergePlan plan={parseMergePlan({ holds: { 'bids.customer_id': 1 }, left_behind: { portal_address: 1, property: 1 }, portal_address_lost: 'sample-builders', same_job: 1, legal_blocked: false })!} />,
    )
    const text = screen.getByTestId('customer-merge-plan').textContent ?? ''
    expect(text).toContain('Where only one can stand')
    expect(text).toContain('Their portal address sample-builders stops working.')
    expect(text).toContain('It folds into this customer’s.')
    expect(text).toContain('Anything dropped is kept in the deleted records')
    expect(text).toContain('One job names one of them as the customer and the other as the GC.')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says when nothing is linked, and when a legal matter on each stops the merge', () => {
    renderWithProviders(<CustomerMergePlan plan={parseMergePlan({ holds: {}, left_behind: {}, same_job: 0, legal_blocked: true })!} />)
    expect(screen.getByRole('alert').textContent).toContain('one payer can hold only one')
    expect(screen.getByTestId('customer-merge-plan').textContent).toContain('Nothing is linked to the other customer.')
  })
})
