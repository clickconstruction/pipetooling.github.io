// @vitest-environment jsdom
/**
 * New Job's terms bar reads the GC the job bills (v2.5015, the owner's call of 2026-10-09): J1002's
 * shape — nobody as the customer, Heron Construction Group billed and given up on — so picking Heron
 * as the GC shows the Deposit required? nudge. The read is a stand-in that answers the given-up
 * read only when it asks for the GC's bills; the amount is made up.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

const HERON = { id: 'gc-heron', name: 'Heron Construction Group', address: '1 Commerce St', contact_info: null, billing_email: null, gc_pays_by_default: true, sees_customer_bills: false, date_met: null, date_met_source: null, master_user_id: 'u1', customer_type: 'commercial', archived_at: null }

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as unknown as Record<string, unknown> & { from: (table: string) => Record<string, unknown> }
  const stubFrom = stub.from.bind(stub)
  const answer = (b: Record<string, unknown>, data: () => unknown) => {
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ data: data(), error: null }).then(ok, bad)
    return b
  }
  return {
    supabase: {
      ...stub,
      from: (table: string) => {
        const b = stubFrom(table)
        if (table === 'customers') return answer(b, () => [HERON])
        if (table !== 'jobs_ledger') return b
        // The terms bar's given-up read: J1002's open $2,500, only when the read asks for the GC's bills.
        let asksForGc = false
        let givenUpRead = false
        const or = b.or as (...a: unknown[]) => unknown
        b.or = (expr: string) => {
          asksForGc = expr.includes('and(gc_customer_id.eq.gc-heron,bill_to_party.eq.gc)')
          or(expr)
          return b
        }
        const not = b.not as (...a: unknown[]) => unknown
        b.not = (col: string, ...rest: unknown[]) => {
          if (col === 'uncollectible_at') givenUpRead = true
          not(col, ...rest)
          return b
        }
        return answer(b, () => (givenUpRead && asksForGc ? [{ revenue: 4000, payments_made: 1500 }] : []))
      },
    },
  }
})

import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import JobFormModal from './JobFormModal'

describe('New Job · the terms bar reads the GC the job bills (the owner’s call of 2026-10-09)', () => {
  it('J1002’s shape: picking Heron Construction Group as the GC shows the Deposit required? nudge', async () => {
    renderWithProviders(
      <JobFormModal mode="new" editJobId={null} initialJob={null} billingCustomerHighlightInitial={false} fixturesSectionHighlightInitial={false} jobPicturesLinkHighlightInitial={false} alsoOpenCreateCustomerModal={false} onClose={() => {}} onSaved={null} />,
    )
    await settle()
    expect(screen.queryByText(/The office gave up on/)).toBeNull()
    const gcSearch = screen.getByRole('textbox', { name: "Search customers to set as this job's GC/Builder" })
    fireEvent.focus(gcSearch)
    fireEvent.change(gcSearch, { target: { value: 'Heron' } })
    fireEvent.click(await screen.findByText('Heron Construction Group'))
    await settle()
    expect(await screen.findByText('The office gave up on 1 bill from this customer ($2,500) — set Deposit required?')).toBeTruthy()
  })
})
