// @vitest-environment jsdom
/**
 * Render smoke for the Won section's option question (v2.4728): on a won bid whose letter carried
 * two options, "Which option did they take?" lists them with their sent values; a pick records the
 * option and fills Agreed value with its sent value; with one base version nothing is asked.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidEditForm, BidEditFormSetters, BidEditFormValues } from '../../lib/bids/useBidEditForm'

const smoke = vi.hoisted(() => ({
  versions: [] as Array<Record<string, unknown>>,
  sends: [] as Array<Record<string, unknown>>,
}))

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: 'dev', user: { id: 'u1' }, profileName: 'Dev' }) }))
vi.mock('../../contexts/JobFormModalContext', () => ({ useJobFormModal: () => null }))
vi.mock('../../lib/bids/wonOptionWrite', () => ({ recordWonOption: vi.fn(async () => ({ sentValue: 366998.23 })) }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const generic = makeSupabaseStub()
  const table = (rows: () => Array<Record<string, unknown>>) => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'in', 'order', 'limit', 'is', 'neq']) b[m] = () => b
    b.then = (f?: (v: unknown) => unknown, r?: (e: unknown) => unknown) => Promise.resolve({ data: rows(), error: null, count: rows().length }).then(f, r)
    return b
  }
  return {
    supabase: {
      ...generic,
      from: (name: string) => (name === 'bid_versions' ? table(() => smoke.versions) : name === 'bid_version_sends' ? table(() => smoke.sends) : (generic.from as (t: string) => unknown)(name)),
    },
  }
})

import { recordWonOption } from '../../lib/bids/wonOptionWrite'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { BidFormModal, type BidFormAutosaveProps, type BidFormModalProps } from './BidFormModal'

const values: BidEditFormValues = {
  driveLink: '', plansLink: '', countToolingPlansLink: '', bidSubmissionLink: '', itbLinks: [], projectName: 'Emergency Animal Hospital Buda', projectId: '', bidNumber: '503', address: '',
  gcContactName: '', gcContactPhone: '', gcContactEmail: '', projectContactExpanded: true, estimatorId: '', accountManagerId: '', formServiceTypeId: 'st-1', bidDueDate: '', bidDueTime: '',
  estimatedJobStartDate: '', designDrawingPlanDate: '', submittedTo: '', outcome: 'won', lossReason: '', lossCategory: null, bidValue: '922196.69', agreedValue: '', acceptedAlternateTags: [],
  declinedAlternateTags: [], profit: '', distanceFromOffice: '', robotOptOut: false, lastContact: '', notes: '', gcCustomerId: '', gcCustomerSearch: '',
}
const setterNames: Array<keyof BidEditFormSetters> = [
  'setDriveLink', 'setPlansLink', 'setCountToolingPlansLink', 'setBidSubmissionLink', 'setItbLinks', 'setProjectName', 'setProjectId', 'setBidNumber', 'setAddress', 'setGcContactName',
  'setGcContactPhone', 'setGcContactEmail', 'setProjectContactExpanded', 'setEstimatorId', 'setAccountManagerId', 'setFormServiceTypeId', 'setBidDueDate', 'setBidDueTime', 'setEstimatedJobStartDate',
  'setDesignDrawingPlanDate', 'setSubmittedTo', 'setOutcome', 'setLossReason', 'setLossCategory', 'setBidValue', 'setAgreedValue', 'setProfit', 'setDistanceFromOffice', 'setLastContact', 'setNotes',
  'setGcCustomerId', 'setGcCustomerSearch',
]
function makeForm(): BidEditForm {
  const setters = Object.fromEntries(setterNames.map((n) => [n, vi.fn()])) as unknown as BidEditFormSetters
  return { values, setters, reset: vi.fn(), loadFromBid: vi.fn(), initialValues: values, markSaved: vi.fn(), missingFields: [], canSubmit: true }
}
const bid = { id: 'bid-1', project_name: 'Emergency Animal Hospital Buda', bid_number: '503', customer_id: null, gc_builder_id: null, bid_date_sent: '2026-10-06', outcome: 'won', service_type_id: 'st-1', working_board_archived_at: null, customers: null, bids_gc_builders: null, alternate_group_tags: [], accepted_alternate_tags: [], declined_alternate_tags: [] } as unknown as BidWithBuilder
const autosave: BidFormAutosaveProps = { status: 'saved', dirty: false, retry: vi.fn(), closeFlushState: 'idle', retryClose: vi.fn(), keepEditing: vi.fn(), closeWithoutSaving: vi.fn() }
function props(): BidFormModalProps {
  return {
    open: true, editingBid: bid, closeBidForm: vi.fn(), saveBid: vi.fn((e) => e.preventDefault()), form: makeForm(), projects: [], estimatorUsers: [], myRole: 'dev',
    visibleServiceTypes: [{ id: 'st-1', name: 'Plumbing', color: null }], bidDateSent: '', handleBidDateSentInputChange: vi.fn(), handleBidDateSentBlur: vi.fn(), onGcRollupDateChanged: vi.fn(),
    pendingAttestationForDate: null, pendingBidDateSentAttestation: null, gcCustomerDropdownOpen: false, setGcCustomerDropdownOpen: vi.fn(), customers: [], loadCustomers: vi.fn(),
    getCustomerDisplay: (c) => c.name, getGcBuilderPhone: () => '', getGcBuilderEmail: () => '', saveBidAndOpenCounts: vi.fn(), savingBid: false, setDeleteBidModalOpen: vi.fn(),
    setDeleteConfirmProjectName: vi.fn(), setError: vi.fn(), autosave,
  } as unknown as BidFormModalProps
}

describe('Edit Bid → Won: which option did they take? (v2.4728)', () => {
  it('lists the letter’s options with their sent values; a pick records it and fills the agreed value', async () => {
    smoke.versions = [
      { id: 'tp', name: 'To Plans', sort_order: 1, include_in_submission: true, is_alternate: false, outcome: null, customer_id: null },
      { id: 've', name: 'Value Engineered', sort_order: 2, include_in_submission: true, is_alternate: false, outcome: null, customer_id: null },
    ]
    smoke.sends = [
      { bid_version_id: 'tp', sent_on: '2026-10-06', value: 922196.69, is_alternate: false, created_at: '2026-10-06T10:00:00Z' },
      { bid_version_id: 've', sent_on: '2026-10-06', value: 366998.23, is_alternate: false, created_at: '2026-10-06T10:00:00Z' },
    ]
    const p = props()
    renderWithProviders(<BidFormModal {...p} />)
    const box = await screen.findByTestId('bid-won-option')
    expect(box.textContent).toContain('Which option did they take?')
    const radios = screen.getAllByRole('radio')
    expect(radios.map((r) => r.textContent)).toEqual(['○ Option 1 — To Planssent $922,196.69', '○ Option 2 — Value Engineeredsent $366,998.23'])
    fireEvent.click(radios[1]!)
    await waitFor(() => expect(recordWonOption).toHaveBeenCalledWith({ bidId: 'bid-1', chosenVersionId: 've' }))
    await waitFor(() => expect(p.form.setters.setAgreedValue).toHaveBeenCalledWith('366998.23'))
    expect((await screen.findByTestId('bid-won-option')).textContent).toContain('Value Engineered is the active version now')
    expect(screen.getByRole('radio', { name: /Option 2/ }).getAttribute('aria-checked')).toBe('true')
    await settle()
  })

  it('one base version in the letter asks nothing', async () => {
    smoke.versions = [{ id: 'tp', name: 'To Plans', sort_order: 1, include_in_submission: true, is_alternate: false, outcome: null, customer_id: null }]
    smoke.sends = []
    renderWithProviders(<BidFormModal {...props()} />)
    await settle()
    expect(screen.queryByTestId('bid-won-option')).toBeNull()
  })
})
