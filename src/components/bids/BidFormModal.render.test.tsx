// @vitest-environment jsdom
/**
 * Render smoke for the bid form's footer (v2.3130): New Bid keeps a dedicated "Create bid"
 * button; the Edit tab autosaves — no Save button, a status line, "Open Counts", and the
 * close-guard strip with its three ways out.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { BidEditForm, BidEditFormSetters, BidEditFormValues } from '../../lib/bids/useBidEditForm'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: 'dev', user: { id: 'u1' }, profileName: 'Dev' }) }))
vi.mock('../../contexts/JobFormModalContext', () => ({ useJobFormModal: () => null }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { renderWithProviders } from '../../test/renderSmokeMocks'
import { BidFormModal, type BidFormAutosaveProps, type BidFormModalProps } from './BidFormModal'

const values: BidEditFormValues = {
  driveLink: '',
  plansLink: '',
  countToolingPlansLink: '',
  bidSubmissionLink: '',
  itbLinks: [],
  projectName: 'Kingsbury Clinic',
  projectId: '',
  bidNumber: '403',
  address: '',
  gcContactName: '',
  gcContactPhone: '',
  gcContactEmail: '',
  projectContactExpanded: true,
  estimatorId: '',
  accountManagerId: '',
  formServiceTypeId: 'st-1',
  bidDueDate: '',
  bidDueTime: '',
  estimatedJobStartDate: '',
  designDrawingPlanDate: '',
  submittedTo: '',
  outcome: '',
  lossReason: '',
  lossCategory: null,
  bidValue: '',
  agreedValue: '',
  profit: '',
  distanceFromOffice: '',
  robotOptOut: false,
  lastContact: '',
  notes: '',
  gcCustomerId: '',
  gcCustomerSearch: '',
}

const setterNames: Array<keyof BidEditFormSetters> = [
  'setDriveLink', 'setPlansLink', 'setCountToolingPlansLink', 'setBidSubmissionLink', 'setItbLinks', 'setProjectName', 'setProjectId',
  'setBidNumber', 'setAddress', 'setGcContactName', 'setGcContactPhone', 'setGcContactEmail', 'setProjectContactExpanded', 'setEstimatorId',
  'setAccountManagerId', 'setFormServiceTypeId', 'setBidDueDate', 'setBidDueTime', 'setEstimatedJobStartDate', 'setDesignDrawingPlanDate',
  'setSubmittedTo', 'setOutcome', 'setLossReason', 'setLossCategory', 'setBidValue', 'setAgreedValue', 'setProfit', 'setDistanceFromOffice',
  'setLastContact', 'setNotes', 'setGcCustomerId', 'setGcCustomerSearch',
]

function makeForm(): BidEditForm {
  const setters = Object.fromEntries(setterNames.map((n) => [n, vi.fn()])) as unknown as BidEditFormSetters
  return { values, setters, reset: vi.fn(), loadFromBid: vi.fn(), initialValues: values, markSaved: vi.fn(), missingFields: [], canSubmit: true }
}

const savedBid = {
  id: 'bid-1',
  project_name: 'Kingsbury Clinic',
  bid_number: '403',
  customer_id: null,
  gc_builder_id: null,
  bid_date_sent: null,
  outcome: null,
  service_type_id: 'st-1',
  working_board_archived_at: null,
  customers: null,
  bids_gc_builders: null,
} as unknown as BidWithBuilder

function makeAutosave(overrides: Partial<BidFormAutosaveProps> = {}): BidFormAutosaveProps {
  return {
    status: 'saved',
    dirty: false,
    retry: vi.fn(),
    closeFlushState: 'idle',
    retryClose: vi.fn(),
    keepEditing: vi.fn(),
    closeWithoutSaving: vi.fn(),
    ...overrides,
  }
}

function baseProps(overrides: Partial<BidFormModalProps> = {}): BidFormModalProps {
  return {
    open: true,
    editingBid: null,
    closeBidForm: vi.fn(),
    saveBid: vi.fn((e) => e.preventDefault()),
    form: makeForm(),
    projects: [],
    estimatorUsers: [],
    myRole: 'dev',
    visibleServiceTypes: [{ id: 'st-1', name: 'Plumbing', color: null }],
    bidDateSent: '',
    handleBidDateSentInputChange: vi.fn(),
    handleBidDateSentBlur: vi.fn(),
    onGcRollupDateChanged: vi.fn(),
    pendingAttestationForDate: null,
    pendingBidDateSentAttestation: null,
    gcCustomerDropdownOpen: false,
    setGcCustomerDropdownOpen: vi.fn(),
    customers: [],
    loadCustomers: vi.fn(),
    getCustomerDisplay: (c) => c.name,
    getGcBuilderPhone: () => '',
    getGcBuilderEmail: () => '',
    saveBidAndOpenCounts: vi.fn(),
    savingBid: false,
    setDeleteBidModalOpen: vi.fn(),
    setDeleteConfirmProjectName: vi.fn(),
    setError: vi.fn(),
    ...overrides,
  }
}

describe('BidFormModal footer (v2.3130)', () => {
  it('New Bid keeps a dedicated Create bid button and Create and open counts', () => {
    const props = baseProps()
    renderWithProviders(<BidFormModal {...props} />)
    expect(screen.getByRole('button', { name: 'Create bid' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create and open counts' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Create bid' }))
    expect(props.saveBid).toHaveBeenCalledTimes(1)
  })

  it('Edit tab: no Save button, a status line, Open Counts, and Enter submits nothing', () => {
    const props = baseProps({ editingBid: savedBid, embedded: true, autosave: makeAutosave() })
    const { container } = renderWithProviders(<BidFormModal {...props} />)
    expect(screen.queryByRole('button', { name: 'Create bid' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Open Counts' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Saved')
    const form = container.querySelector('form')
    expect(form).toBeTruthy()
    fireEvent.submit(form!)
    expect(props.saveBid).not.toHaveBeenCalled()
  })

  it('a failed autosave says so and offers Retry', () => {
    const autosave = makeAutosave({ status: 'error', dirty: true })
    renderWithProviders(<BidFormModal {...baseProps({ editingBid: savedBid, embedded: true, autosave })} />)
    expect(screen.getByRole('status').textContent).toContain('Couldn’t save your latest change')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(autosave.retry).toHaveBeenCalledTimes(1)
  })

  it('a failed close-flush keeps the window open with Retry / Keep editing / Close without saving', () => {
    const autosave = makeAutosave({ closeFlushState: 'error' })
    renderWithProviders(<BidFormModal {...baseProps({ editingBid: savedBid, embedded: true, autosave })} />)
    const strip = screen.getByRole('alert')
    expect(strip.textContent).toContain('the window stays open')
    fireEvent.click(screen.getByRole('button', { name: 'Close without saving' }))
    expect(autosave.closeWithoutSaving).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(autosave.keepEditing).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(autosave.retryClose).toHaveBeenCalledTimes(1)
  })
})
