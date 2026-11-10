// @vitest-environment jsdom
/**
 * The chip beside a customer's name (punch list #301, mock-up 2): its words by standing, the door to the ledger, and
 * the plain form with no press for a spot that is already a press.
 */
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import InKindChip from './InKindChip'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { InKindStanding } from '../../lib/inKind/inKindChip'

const standing = (o: Partial<InKindStanding> = {}): InKindStanding => ({ customerId: 'c1', arrangementIds: ['a1'], left: 9375.4, ahead: 0, paidInKind: 10500, dueMonth: null, dueCount: 0, ...o })

describe('InKindChip', () => {
  it('says what is to come and opens the deal’s ledger', () => {
    renderWithProviders(<InKindChip standing={standing()} />)
    const chip = screen.getByTestId('in-kind-chip')
    expect(chip.textContent).toBe('🤝In kind · $9,375.40 to come')
    expect(chip.getAttribute('href')).toBe('/customers/c1?inKind=a1')
    expect(chip.getAttribute('title')).toBe('Pays in kind. $9,375.40 is still to come on its bills. Opens the ledger.')
  })
  it('names the month that is due', () => {
    renderWithProviders(<InKindChip standing={standing({ dueMonth: '2026-11-01', dueCount: 1 })} />)
    expect(screen.getByTestId('in-kind-chip').textContent).toBe('🤝In kind · November due')
  })
  it('is words with no press in the plain short form', () => {
    renderWithProviders(<InKindChip standing={standing()} form="short" plain />)
    const chip = screen.getByTestId('in-kind-chip')
    expect(chip.textContent).toBe('🤝In kind')
    expect(chip.tagName).toBe('SPAN')
  })
})
