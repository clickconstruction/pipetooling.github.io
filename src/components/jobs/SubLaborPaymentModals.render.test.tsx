// @vitest-environment jsdom
/**
 * Render-smoke tests for the SubLaborPaymentModals trio (extracted from Jobs.tsx
 * in v2.824). Crash-on-mount / handle-wiring coverage; not a behavior suite.
 */
import { act, createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import SubLaborPaymentModals, {
  type SubLaborPaymentModalsHandle,
  type SubLaborPaymentModalsProps,
} from './SubLaborPaymentModals'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { SubLaborBackchargeTarget, SubLaborPaymentTarget } from '../../types/laborJob'

function makeProps(overrides: Partial<SubLaborPaymentModalsProps> = {}): SubLaborPaymentModalsProps {
  return {
    recordLaborJobPayment: vi.fn(async () => {}),
    recordLaborJobBackcharge: vi.fn(async () => {}),
    deleteLaborJobPayment: vi.fn(async () => {}),
    updateLaborJobPayment: vi.fn(async () => {}),
    ...overrides,
  }
}

const paymentTarget: SubLaborPaymentTarget = {
  id: 'labor-1',
  contractor: 'Sub Sam',
  hcp: 'HCP-77',
  totalCost: 500,
  paid: 100,
  outstanding: 400,
}

const backchargeTarget: SubLaborBackchargeTarget = {
  id: 'labor-1',
  contractor: 'Sub Sam',
  hcp: 'HCP-77',
  totalCost: 500,
  paid: 100,
}

function mountWithRef(props = makeProps()) {
  const ref = createRef<SubLaborPaymentModalsHandle>()
  const view = renderWithProviders(<SubLaborPaymentModals ref={ref} {...props} />)
  return { ref, view }
}

describe('SubLaborPaymentModals render smoke', () => {
  it('renders nothing while closed', () => {
    mountWithRef()
    expect(screen.queryByText('Make Payment')).toBeNull()
    expect(screen.queryByText('Backcharge')).toBeNull()
    expect(screen.queryByText('Edit Payment')).toBeNull()
  })

  it('openMakePayment shows the modal with the seeded amount; cancel closes it', () => {
    const { ref } = mountWithRef()
    act(() => ref.current!.openMakePayment(paymentTarget, '400'))
    expect(screen.getByText('Make Payment')).toBeTruthy()
    expect(screen.getByText('Sub Sam · HCP-77')).toBeTruthy()
    expect((screen.getByPlaceholderText('0') as HTMLInputElement).value).toBe('400')
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Make Payment')).toBeNull()
  })

  it('openBackcharge shows the modal with an empty amount; cancel closes it', () => {
    const { ref } = mountWithRef()
    act(() => ref.current!.openBackcharge(backchargeTarget))
    expect(screen.getByText('Backcharge')).toBeTruthy()
    expect((screen.getByPlaceholderText('0') as HTMLInputElement).value).toBe('')
    expect(screen.getByPlaceholderText('Required for backcharges')).toBeTruthy()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Backcharge')).toBeNull()
  })

  it('openEditPayment seeds amount and memo; cancel closes it', () => {
    const { ref } = mountWithRef()
    act(() =>
      ref.current!.openEditPayment(
        { id: 'pay-1', jobId: 'labor-1', amount: 50, memo: 'first draw', isBackcharge: false },
        '50',
        'first draw',
      ),
    )
    expect(screen.getByText('Edit Payment')).toBeTruthy()
    expect((screen.getByPlaceholderText('0') as HTMLInputElement).value).toBe('50')
    expect((screen.getByPlaceholderText('Optional note') as HTMLTextAreaElement).value).toBe('first draw')
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Edit Payment')).toBeNull()
  })

  it('openEditPayment for a backcharge titles the modal Edit Backcharge; clearEditPayment closes it', () => {
    const { ref } = mountWithRef()
    act(() =>
      ref.current!.openEditPayment(
        { id: 'pay-2', jobId: 'labor-1', amount: 25, memo: 'damage', isBackcharge: true },
        '25',
        'damage',
      ),
    )
    expect(screen.getByText('Edit Backcharge')).toBeTruthy()
    act(() => ref.current!.clearEditPayment())
    expect(screen.queryByText('Edit Backcharge')).toBeNull()
  })
})
