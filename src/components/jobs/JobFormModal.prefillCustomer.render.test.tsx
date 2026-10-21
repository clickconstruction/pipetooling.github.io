// @vitest-environment jsdom
/**
 * Punch list #140 PR 8: a lead's Book a visit opens New Job with the customer's three fields and their words as the
 * job's name (`OpenNewJobOptions.prefillCustomer` → `newJobPrefillCustomer`), filled once after init and never over
 * what the person typed.
 */
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobFormModal from './JobFormModal'

describe('New Job · a lead’s doors fill the customer and the job’s name (punch list #140 PR 8)', () => {
  it('fills Customer Name, Customer Phone, Customer Email and the job’s name once init is done', async () => {
    renderWithProviders(
      <JobFormModal
        mode="new"
        editJobId={null}
        initialJob={null}
        newJobPrefillCustomer={{ name: 'Lena Ortiz', phone: '(830) 555-0101', email: 'lena@example.com', note: 'Can you come Thursday?' }}
        billingCustomerHighlightInitial={false}
        fixturesSectionHighlightInitial={false}
        jobPicturesLinkHighlightInitial={false}
        alsoOpenCreateCustomerModal={false}
        onClose={() => {}}
        onSaved={null}
      />,
    )
    await settle()
    expect((await screen.findByRole('textbox', { name: 'Customer Name' })) as HTMLInputElement).toHaveProperty('value', 'Lena Ortiz')
    expect((document.querySelector('input[type="tel"]') as HTMLInputElement).value).toBe('(830) 555-0101')
    expect((document.querySelector('input[type="email"]') as HTMLInputElement).value).toBe('lena@example.com')
    expect(screen.getByDisplayValue('Can you come Thursday?')).toBeTruthy()
  })

  it('leaves the fields empty with no prefill', async () => {
    renderWithProviders(
      <JobFormModal mode="new" editJobId={null} initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} alsoOpenCreateCustomerModal={false} onClose={() => {}} onSaved={null} />,
    )
    await settle()
    expect(((await screen.findByRole('textbox', { name: 'Customer Name' })) as HTMLInputElement).value).toBe('')
    expect(screen.queryByDisplayValue('Can you come Thursday?')).toBeNull()
  })
})
