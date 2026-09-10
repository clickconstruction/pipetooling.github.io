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

describe('DispatchInboxSection — customer waiting (v2.3247)', () => {
  const waitingRow = row({
    id: 'w1',
    title: 'Customer waiting — Jane Doe asks for a visit: Water heater leaking',
    pending_action: null,
    bid_id: null,
    priority: 'high',
    created_at: new Date(Date.now() - 14 * 60_000).toISOString(),
    reference_summary: 'J812 · 1418 Bluebonnet Ln',
    pending_payload: {
      source: 'portal',
      kind: 'visit',
      customerName: 'Jane Doe',
      description: 'Water heater in the garage is leaking',
      availability: 'Today after 3',
      phone: '5125550142',
      phoneSource: 'typed',
    },
  })

  it('an open high row renders the card: name, the words, the number, one Call target, and Lower priority opens the sheet', async () => {
    const onSetPriority = vi.fn(async () => true)
    const onLogCall = vi.fn()
    renderWithProviders(
      <DispatchInboxSection
        sectionOpen
        onToggleSection={vi.fn()}
        requests={[waitingRow, row({ id: 'n1', pending_action: null, bid_id: null, title: 'Find the property owner for 2207 Alamo Dr' })]}
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
        onSetPriority={onSetPriority}
        onLogCall={onLogCall}
      />,
    )
    const card = screen.getByTestId('customer-waiting-card')
    expect(card.textContent).toContain('Jane Doe')
    expect(card.textContent).toContain('Water heater in the garage is leaking')
    expect(card.textContent).toContain('Today after 3')
    expect(card.textContent).toContain('Nobody has called yet.')
    // jsdom has no coarse pointer → the desktop copy button (one Call, one Text).
    // (The whole row is also role=button, named by its text — match the exact label.)
    expect(screen.getByRole('button', { name: 'Call (512) 555-0142 — copies the number' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Text (512) 555-0142 — copies the number' })).toBeTruthy()
    // The normal row keeps its plain title.
    expect(screen.getByText('Find the property owner for 2207 Alamo Dr')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Lower priority ▾' }))
    expect(screen.getByRole('dialog', { name: 'Lower priority' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Lower priority' }))
    await vi.waitFor(() => expect(onSetPriority).toHaveBeenCalledWith('w1', 'normal', 'Scheduled'))
  })

  it('a row that was called shows who and that it is still open; a closed high row is a plain row', () => {
    renderWithProviders(
      <DispatchInboxSection
        sectionOpen
        onToggleSection={vi.fn()}
        requests={[
          { ...waitingRow, last_called_at: new Date().toISOString(), last_called_by: { name: 'Sam Rivera' } },
          { ...waitingRow, id: 'w2', status: 'closed', closed_at: new Date().toISOString(), closed_by: { name: 'Taunya' }, closed_note: 'Booked' },
        ]}
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
    const cards = screen.getAllByTestId('customer-waiting-card')
    expect(cards).toHaveLength(1)
    expect(cards[0]!.textContent).toMatch(/Sam called/)
  })
})
