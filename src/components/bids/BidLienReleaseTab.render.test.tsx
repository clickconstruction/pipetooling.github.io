// @vitest-environment jsdom
/**
 * Render smokes for the modernized Bids → Lien Release tab (v2.5893): the four § 53.284 forms
 * with the kernel's own words on the paper; every route into Unconditional asks the Release of
 * Lien window's warning (Stay conditional stays); an estimator's unconditional outputs hold with
 * the leader line while a leader keeps them; final forms drop the through-date box.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { BidLienReleaseTab } from './BidLienReleaseTab'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

const authState = vi.hoisted(() => ({ role: 'estimator' as string }))
// v2.5958: the tab reads the bid's recorded waivers and the leaders; here there are none of either.
vi.mock('../../lib/bids/bidLienReleaseIo', () => ({
  loadBidLienReleases: async () => ({ rows: [], deviceNames: {} }),
  loadBidLienWaiverLeaders: async () => [],
  mintBidLienRelease: async () => ({ ok: false, message: 'not in this smoke' }),
  stampBidLienReleaseSent: async () => {},
}))
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const base = useAuthModuleMock()
  return { ...base, useAuth: () => ({ ...(base.useAuth() as Record<string, unknown>), role: authState.role }) }
})

function bid(p: Partial<BidWithBuilder> = {}): BidWithBuilder {
  return {
    id: 'bid-1',
    bid_number: '482',
    project_name: 'Take 5 Seguin',
    address: '380 TX-123, Seguin, TX 78155',
    agreed_value: 38625,
    customers: null,
    bids_gc_builders: { name: 'Southern Post Construction' },
    ...p,
  } as unknown as BidWithBuilder
}

function renderTab(selected: BidWithBuilder | null = bid()) {
  return renderWithProviders(
    <BidLienReleaseTab
      bids={selected ? [selected] : []}
      onlyMyBids={false}
      setOnlyMyBids={() => {}}
      isMyBid={() => true}
      selectedBid={selected}
      onSelectBid={() => {}}
      onClose={() => {}}
      onEditBid={() => {}}
    />,
  )
}

beforeEach(() => {
  authState.role = 'estimator'
})

describe('BidLienReleaseTab', () => {
  it('opens on the conditional progress form with the statutory words and live outputs', () => {
    renderTab()
    expect(screen.getByText(/§ 53\.284\(b\)/)).toBeTruthy()
    expect(screen.getByText(/conditional upon actual receipt and clearance/)).toBeTruthy()
    expect(screen.getByText(/check from Southern Post Construction in the sum of \$38,625\.00/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy for email' })).toBeTruthy()
    expect(screen.queryByTestId('bid-lien-waiver-hold')).toBeNull()
  })

  it('asks the warning on the way into Unconditional; Stay conditional stays put', async () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Unconditional' }))
    await screen.findByText('Are you sure you meant to choose Unconditional?')
    fireEvent.click(screen.getByRole('button', { name: 'Stay conditional' }))
    await waitFor(() => expect(screen.queryByText('Are you sure you meant to choose Unconditional?')).toBeNull())
    expect(screen.getByText(/§ 53\.284\(b\)/)).toBeTruthy()
  })

  it("acknowledged, the unconditional form holds an estimator's outputs with the leader line", async () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Unconditional' }))
    await screen.findByText('Are you sure you meant to choose Unconditional?')
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge and choose Unconditional' }))
    await screen.findByText(/§ 53\.284\(c\)/)
    expect(screen.getByText(/does not affect any retainage/)).toBeTruthy()
    expect(screen.getByTestId('bid-lien-waiver-hold')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Copy for email' })).toBeNull()
  })

  it('a leader keeps the outputs on an unconditional form', async () => {
    authState.role = 'master_technician'
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Unconditional' }))
    await screen.findByText('Are you sure you meant to choose Unconditional?')
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge and choose Unconditional' }))
    await screen.findByText(/§ 53\.284\(c\)/)
    expect(screen.queryByTestId('bid-lien-waiver-hold')).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy for email' })).toBeTruthy()
  })

  it('the final form drops the through-date box and titles the paper Final Payment', async () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Final' }))
    await screen.findByText(/§ 53\.284\(d\)/)
    expect(screen.queryByLabelText('Progress payments through')).toBeNull()
    expect(screen.getByText('Conditional Waiver and Release on Final Payment')).toBeTruthy()
  })
})
