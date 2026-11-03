// @vitest-environment jsdom
/**
 * The Dispatch inbox row of a check the crew could not answer (punch list #245, PR 1): the *Stage check* tag, Open the
 * job and Open the check, where each routes, and a closed row with neither press.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'

const openJobDetail = vi.fn()
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ role: 'dev', user: { id: 'u1' } }) }))
vi.mock('../contexts/JobFormModalContext', () => ({
  useJobFormModal: () => ({ isOpen: false, openNewJob: vi.fn(), openEditJob: vi.fn(), closeJobForm: vi.fn() }),
}))
vi.mock('../contexts/JobDetailModalContext', () => ({
  useJobDetailModal: () => ({ isOpen: false, openJobDetail, closeJobDetail: vi.fn() }),
}))
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

import { renderWithProviders, settle } from '../test/renderSmokeMocks'
import { DispatchInboxSection, type DispatchInboxRow } from './DispatchInboxSection'

function row(overrides: Partial<DispatchInboxRow>): DispatchInboxRow {
  return {
    id: 'r1',
    title: 'Trim Set · “Is the pan drain run to the hub?” · need a part: The caps are not on the truck. · JP1088 ZZ TEST Riders Walk',
    links: [],
    created_at: '2026-11-02T15:00:00Z',
    from_user_id: 'u2',
    reference_summary: 'JP1088 · ZZ TEST Riders Walk · 12925 FM 20, Kingsbury',
    location_lat: null,
    location_lng: null,
    sender: { name: 'Luis Ortega', email: null },
    status: 'open',
    closed_at: null,
    closed_by_user_id: null,
    closed_by: null,
    closed_note: null,
    pending_action: 'stage_check',
    pending_payload: { stage_check: { fixture_id: 'f3', question_id: 't3', reason: 'need_part', stage_name: 'Trim Set' } },
    job_ledger_id: 'job-1',
    bid_id: null,
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

afterEach(() => {
  cleanup()
  openJobDetail.mockReset()
})

describe('a stage check in the Dispatch inbox', () => {
  it('wears the tag and opens the job or the check', async () => {
    renderSection([row({})])
    await settle()
    expect(screen.getByText('Stage check')).toBeTruthy()
    expect(screen.getByText(/need a part: The caps are not on the truck/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Open the job:/ }))
    expect(openJobDetail).toHaveBeenLastCalledWith({ jobId: 'job-1' })

    fireEvent.click(screen.getByRole('button', { name: /^Open the check:/ }))
    expect(openJobDetail).toHaveBeenLastCalledWith({ jobId: 'job-1', openStageChecklist: { fixtureId: 'f3', questionId: 't3' } })
  })

  it('keeps the tag and drops the presses once closed, and draws neither on a plain request', async () => {
    renderSection([row({ status: 'closed', closed_at: '2026-11-02T16:00:00Z', closed_note: 'Answered on the sheet' }), row({ id: 'r2', title: 'Pick up the permit', pending_action: null, pending_payload: null })])
    await settle()
    expect(screen.getAllByText('Stage check')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /^Open the check:/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Open the job:/ })).toBeNull()
  })
})
