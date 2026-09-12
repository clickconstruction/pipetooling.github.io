// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { todayYmdInAppTz } from '../../utils/dateUtils'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { LienWaiverSendModal, type LienWaiverSendTarget } from './LienWaiverSendModal'

const target = (over: Partial<LienWaiverSendTarget> = {}): LienWaiverSendTarget => ({
  sheetId: 'sheet-1',
  personId: 'person-1',
  subName: 'Texas R & A',
  sheetLabel: 'HCP 977',
  jobNumber: '977',
  clickNumber: 'J1042',
  project: 'Mission Pet Health',
  owner: 'Mission Pet Health',
  location: '415 Springtown Way, San Marcos, TX 78666',
  // "Fresh" is relative to today — the picker presumes a payment settled after
  // LIEN_WAIVER_SETTLE_DAYS, so a fixed date here rots on the calendar (it did).
  payments: [{ amount: 17752.65, payment_date: todayYmdInAppTz(), created_at: `${todayYmdInAppTz()}T15:00:00Z` }],
  balance: 22247.35,
  ...over,
})

describe('LienWaiverSendModal', () => {
  it('a fresh progress payment picks the conditional progress waiver and explains it', () => {
    renderWithProviders(<LienWaiverSendModal target={target()} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: /Send a lien waiver · Texas R & A/ })).toBeTruthy()
    expect(screen.getByText('Conditional Waiver and Release on Progress Payment')).toBeTruthy()
    expect(screen.getByText(/§ 53\.284\(b\)/)).toBeTruthy()
    expect(screen.getByText('Not settled yet')).toBeTruthy()
    expect(screen.queryByRole('note')).toBeNull()
    expect(screen.getByRole('button', { name: 'Send with the check' })).toBeTruthy()
  })

  it('a settled final payment picks the unconditional final waiver with the statutory warning', () => {
    renderWithProviders(<LienWaiverSendModal target={target({ payments: [{ amount: 4500, payment_date: '2026-08-01', created_at: '2026-08-01T15:00:00Z' }], balance: 0 })} onClose={() => {}} />)
    expect(screen.getByText('Unconditional Waiver and Release on Final Payment')).toBeTruthy()
    expect(screen.getByRole('note').textContent).toMatch(/Only after the money has landed/)
    expect(screen.getByRole('button', { name: 'Send now' })).toBeTruthy()
  })

  it('the other three are one click away', () => {
    renderWithProviders(<LienWaiverSendModal target={target()} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Not this one/ }))
    expect(screen.getAllByRole('button', { name: 'Use this instead' })).toHaveLength(3)
  })
})
