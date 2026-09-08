// @vitest-environment jsdom
/** Render smoke for the Dispatch inbox's "open the job" to-do (v2.3143): the one button and where it routes. */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'

const openNewJob = vi.fn()
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ role: 'dev', user: { id: 'u1' } }) }))
vi.mock('../contexts/JobFormModalContext', () => ({
  useJobFormModal: () => ({ isOpen: false, openNewJob, openEditJob: vi.fn(), closeJobForm: vi.fn() }),
}))
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { renderWithProviders } from '../test/renderSmokeMocks'
import { DispatchInboxSection, type DispatchInboxRow } from './DispatchInboxSection'
import { OPEN_JOB_FROM_BID_ACTION } from '../lib/bids/wonDispatchHandoff'

function row(overrides: Partial<DispatchInboxRow>): DispatchInboxRow {
  return {
    id: 'r1',
    title: 'Open the job for B398 · ZZ Test — won with Southern Post Construction',
    links: [],
    created_at: '2026-09-07T20:00:00Z',
    from_user_id: 'u2',
    reference_summary: 'B398 · ZZ Test — 12925 FM 20',
    location_lat: null,
    location_lng: null,
    sender: { name: 'Wendi', email: null },
    status: 'open',
    closed_at: null,
    closed_by_user_id: null,
    closed_by: null,
    closed_note: null,
    pending_action: OPEN_JOB_FROM_BID_ACTION,
    job_ledger_id: null,
    bid_id: 'bid-1',
    ...overrides,
  }
}

function renderSection(requests: DispatchInboxRow[]) {
  return renderWithProviders(
    <DispatchInboxSection
      sectionOpen
      onToggleSection={vi.fn()}
      requests={requests}
      loading={false}
      expandedRequestId={null}
      onToggleExpandRequest={vi.fn()}
      notesByRequestId={{}}
      notesLoadingRequestId={null}
      noteSubmitRequestId={null}
      canAddNotes
      dispatchRequestDismissingId={null}
      noteDraft=""
      onNoteDraftChange={vi.fn()}
      onSubmitNote={vi.fn()}
      onSubmitNoteAndClose={vi.fn()}
      onDismiss={vi.fn()}
    />,
  )
}

describe('DispatchInboxSection — open_job_from_bid (v2.3143)', () => {
  it('an open to-do carries one "Open the job" button that prefills New Job from the bid', () => {
    renderSection([row({})])
    const btn = screen.getByRole('button', { name: 'Open the job from this bid' })
    fireEvent.click(btn)
    expect(openNewJob).toHaveBeenCalledWith({ prefillBidId: 'bid-1' })
  })
  it('a closed to-do has no button', () => {
    renderSection([row({ id: 'r2', status: 'closed', closed_at: '2026-09-07T21:00:00Z', closed_note: 'J1007 opened from B398 · ZZ Test', closed_by: { name: 'Taunya' } })])
    expect(screen.queryByRole('button', { name: 'Open the job from this bid' })).toBeNull()
  })
})
