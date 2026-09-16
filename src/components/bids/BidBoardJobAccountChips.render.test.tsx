// @vitest-environment jsdom
/**
 * Render smoke for the won row's job-account chips (v2.3520): the words per
 * house, an open chip is not a button, a not-open chip is, and a won bid with
 * no job reads "after the job is opened". The "…" door needs the job-form
 * context, which this smoke does not mount, so it is absent here by design.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { BidBoardJobAccountChips } from './BidBoardJobAccountChips'
import type { BidJobAccountRow } from '../../hooks/useBidJobAccountStrip'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(() => cleanup())

function row(over: Partial<BidJobAccountRow>): BidJobAccountRow {
  return {
    bid_id: 'b398', job_id: 'j1018', job_hcp_number: '1018', job_click_number: null, job_name: 'Pondhill Building 2', job_address: null,
    supply_house_id: 'h-ferg', house_name: 'Ferguson', policy: 'per_property', quoted: false, status: null, account_ref: null,
    opened_via: null, opened_at: null, requested_at: null, rep_contact_id: null, rep_name: null, rep_phone: null, rep_email: null,
    ...over,
  }
}

describe('BidBoardJobAccountChips', () => {
  it('draws one chip per house with the state in its words', () => {
    render(
      <BidBoardJobAccountChips
        bidId="b398"
        loaded
        rows={[row({ status: 'open' }), row({ supply_house_id: 'h-moore', house_name: 'Moore Supply', status: 'requested' }), row({ supply_house_id: 'h-reece', house_name: 'Reece', quoted: true })]}
        onChanged={() => {}}
      />,
    )
    expect(screen.getByText('Ferguson ✓').tagName).toBe('SPAN')
    expect(screen.getByRole('button', { name: 'Moore Supply · asked' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reece · quoted' })).toBeTruthy()
  })

  it('says "after the job is opened" for a won bid with no job, and nothing before the read answers', () => {
    const { container, rerender } = render(<BidBoardJobAccountChips bidId="b401" loaded={false} rows={[]} onChanged={() => {}} />)
    expect(container.textContent).toBe('')
    rerender(<BidBoardJobAccountChips bidId="b401" loaded rows={[]} onChanged={() => {}} />)
    expect(screen.getByText('after the job is opened')).toBeTruthy()
  })
})
