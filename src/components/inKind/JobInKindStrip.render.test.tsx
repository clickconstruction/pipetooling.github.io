// @vitest-environment jsdom
/**
 * A job whose customer pays in kind while the job is not on the deal (punch list #301, mock-up 2): the strip says
 * so, one press puts the job on the deal, a refusal shows its reason, and two open deals send the person to pick.
 * Bill Customer asks the same thing as a question with nothing picked.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import JobInKindStrip from './JobInKindStrip'
import InKindBillQuestion from './InKindBillQuestion'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { InKindStanding } from '../../lib/inKind/inKindChip'

const standing = (o: Partial<InKindStanding> = {}): InKindStanding => ({ customerId: 'c1', arrangementIds: ['a1'], left: 9375.4, ahead: 0, paidInKind: 10500, dueMonth: null, dueCount: 0, ...o })

describe('JobInKindStrip', () => {
  it('says the job is not on the deal and puts it there in one press', async () => {
    const add = vi.fn(() => Promise.resolve())
    const onAdded = vi.fn()
    renderWithProviders(<JobInKindStrip jobId="j9" customerName="Calloway Holdings" standing={standing()} onAdded={onAdded} add={add} />)
    expect(screen.getByTestId('job-in-kind-strip').textContent).toContain('Calloway Holdings pays in kind. This job is not on that arrangement. Its bill will be sent and chased as money.')
    fireEvent.click(screen.getByText('Put it on the arrangement'))
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('a1'))
    expect(add).toHaveBeenCalledWith('a1', 'j9')
  })
  it('shows the reason when the job is refused, and leaves the job as it was', async () => {
    const onAdded = vi.fn()
    renderWithProviders(<JobInKindStrip jobId="j9" customerName="Calloway Holdings" standing={standing()} onAdded={onAdded} add={() => Promise.reject(new Error('This arrangement has ended.'))} />)
    fireEvent.click(screen.getByText('Put it on the arrangement'))
    await settle()
    expect(screen.getByText('This arrangement has ended.')).toBeTruthy()
    expect(onAdded).not.toHaveBeenCalled()
  })
  it('sends a person to pick when the customer has two open deals', () => {
    renderWithProviders(<JobInKindStrip jobId="j9" customerName="Calloway Holdings" standing={standing({ arrangementIds: ['a1', 'a2'] })} onAdded={() => undefined} />)
    expect(screen.queryByText('Put it on the arrangement')).toBeNull()
    expect(screen.getByText('Open the arrangements').getAttribute('href')).toBe('/customers/c1')
  })
})

describe('InKindBillQuestion', () => {
  it('asks with nothing picked, and says to pick first', () => {
    const onAnswer = vi.fn()
    renderWithProviders(<InKindBillQuestion customerName="Calloway Holdings" answer={null} onAnswer={onAnswer} />)
    expect(screen.getByText('Calloway Holdings pays in kind. How is this bill paid?')).toBeTruthy()
    expect(screen.getByText('Pick how this bill is paid first.')).toBeTruthy()
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'false'])
    fireEvent.click(screen.getByText('In kind, on the arrangement'))
    expect(onAnswer).toHaveBeenCalledWith('in_kind')
  })
  it('marks the answer and drops the reminder', () => {
    renderWithProviders(<InKindBillQuestion customerName="Calloway Holdings" answer="money" onAnswer={() => undefined} />)
    expect(screen.getByTestId('in-kind-bill-money').getAttribute('aria-checked')).toBe('true')
    expect(screen.queryByText('Pick how this bill is paid first.')).toBeNull()
  })
})
