// @vitest-environment jsdom
/**
 * Render tests for the "Started as a prospect?" typeahead in Add customer
 * (v2.2879, journey-map J34-F4): the form mounts from Customers, Bids
 * (BidFormModal / BidsBuilderReviewTab), Estimates and /customers/new, so the
 * prospect search must honour the same gate as Prospects → Follow Up — an
 * estimator sees it only with `estimatorProspectsAccess`, and the Convert tab
 * (onSubmitForConvert) never shows it because it has its own picker.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'

const authState = vi.hoisted(() => ({ current: {} as Record<string, unknown> }))

vi.mock('../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue(authState.current),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  }
})

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import NewCustomerForm from './NewCustomerForm'
import { renderWithProviders } from '../test/renderSmokeMocks'

afterEach(() => {
  cleanup()
  authState.current = {}
})

function mount(props: Partial<React.ComponentProps<typeof NewCustomerForm>> = {}) {
  return renderWithProviders(<NewCustomerForm mode="modal" showQuickFill={false} {...props} />)
}

describe('NewCustomerForm — "Started as a prospect?" gate', () => {
  it('estimator WITHOUT estimatorProspectsAccess: no prospect search', () => {
    authState.current = { role: 'estimator', estimatorProspectsAccess: false }
    mount()
    expect(screen.getByLabelText('Name *')).toBeTruthy()
    expect(screen.queryByTestId('ncf-prospect-search')).toBeNull()
    expect(screen.queryByLabelText('Started as a prospect?')).toBeNull()
  })

  it('estimator WITH estimatorProspectsAccess: prospect search shows', () => {
    authState.current = { role: 'estimator', estimatorProspectsAccess: true }
    mount()
    expect(screen.getByLabelText('Started as a prospect?')).toBeTruthy()
  })

  it('assistant (pipeline role): prospect search shows', () => {
    authState.current = { role: 'assistant', estimatorProspectsAccess: false }
    mount()
    expect(screen.getByLabelText('Started as a prospect?')).toBeTruthy()
  })

  it('subcontractor / helpers: no prospect search', () => {
    authState.current = { role: 'subcontractor', estimatorProspectsAccess: false }
    mount()
    expect(screen.queryByTestId('ncf-prospect-search')).toBeNull()
  })

  it('Convert-tab mount (onSubmitForConvert) hides it even for a dev', () => {
    authState.current = { role: 'dev' }
    mount({ mode: 'page', onSubmitForConvert: async () => {} })
    expect(screen.queryByTestId('ncf-prospect-search')).toBeNull()
  })

  it('a pre-linked prospect (Follow Up lane) renders as a chip that can be unlinked', () => {
    authState.current = { role: 'assistant' }
    mount({
      sourceProspect: {
        id: 'p-1',
        company_name: 'Acme Plumbing Supply',
        contact_name: 'Dana Reyes',
        phone_number: null,
        email: null,
        address: null,
        prospect_fit_status: null,
      },
      conversionLane: 'follow-up',
    })
    expect(screen.getByText('Acme Plumbing Supply — Dana Reyes')).toBeTruthy()
    expect(screen.getByLabelText('Unlink prospect')).toBeTruthy()
  })
})
