// @vitest-environment jsdom
/**
 * The Dispatch inbox row's doors at phone width (punch list #414, v2.8362): Open the list and Open the job are 44 px
 * tall and share the row, so two sit side by side when they fit and stack when they do not; in the window a row
 * opens, Lower priority and Open the job › are 44 px tall. A desk keeps its sizes. The row and window fixtures are the
 * stage check test's, with made-up names.
 */
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

const viewport = { phone: false }
vi.mock('../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => viewport.phone }))
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => viewport.phone }))
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
import type { StageCheckWindowIo } from './stageChecklists/StageCheckWindow'

/** A No on arrival that waits at the top of the inbox: its doors are Open the list and Open the job. */
function noRow(overrides: Partial<DispatchInboxRow> = {}): DispatchInboxRow {
  return {
    id: 'r1',
    title: 'Rough In · Not as told on arrival · 2 of 5 not as told · JP1088 ZZ TEST Riders Walk',
    links: [],
    created_at: new Date(Date.now() - 4 * 60_000).toISOString(),
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
    priority: 'high',
    pending_action: 'stage_check',
    pending_payload: { stage_check: { fixture_id: 'f1', question_id: null, reason: 'other', stage_name: 'Rough In', words: 'Not as told on arrival', start_check_arrival_id: 'a1', not_as_told: ['b1', 'b2'], told_by: 'Ray Ortiz' } },
    job_ledger_id: 'job-1',
    bid_id: null,
    ...overrides,
  }
}

const liveIo: StageCheckWindowIo = {
  stages: vi.fn(async () => [{ fixtureId: 'f1', name: 'Rough In', sequenceOrder: 1 }]),
  questions: vi.fn(async () => []),
  answers: vi.fn(async () => []),
}

function renderSection(requests: DispatchInboxRow[], extra: Partial<ComponentProps<typeof DispatchInboxSection>> = {}) {
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
      stageCheckWindowIo={liveIo}
      onSetPriority={vi.fn(async () => true)}
      {...extra}
    />,
  )
}

const windowEl = () => (document.querySelector('[data-stage-check-window]')?.closest('[role="dialog"]') as HTMLElement | null) ?? null
const doorsBox = () => screen.getByRole('button', { name: /^Open the list:/ }).parentElement as HTMLElement

afterEach(() => {
  cleanup()
  openJobDetail.mockReset()
  viewport.phone = false
})

describe('the Dispatch inbox row’s doors on a phone (punch list #414)', () => {
  it('draws each door 44 px tall, sharing a wrapping row, so two sit side by side when they fit and stack when they do not', async () => {
    viewport.phone = true
    renderSection([noRow()])
    await settle()
    const list = screen.getByRole('button', { name: /^Open the list:/ })
    const job = screen.getByRole('button', { name: /^Open the job:/ })
    for (const door of [list, job]) {
      expect(door.style.minHeight).toBe('44px')
      // jsdom reads the flex shorthand's parts, so read them.
      expect(door.style.flexGrow).toBe('1')
      expect(door.style.flexBasis).toBe('10rem')
      expect(door.style.justifyContent).toBe('center')
    }
    const box = doorsBox()
    expect(box.style.display).toBe('flex')
    expect(box.style.flexWrap).toBe('wrap')
    expect(box.style.flexDirection).toBe('')
    expect(box.style.width).toBe('100%')
    // The doors still open what they did.
    fireEvent.click(list)
    expect(openJobDetail).toHaveBeenLastCalledWith({ jobId: 'job-1', initialTab: 'documents' })
    fireEvent.click(job)
    expect(openJobDetail).toHaveBeenLastCalledWith({ jobId: 'job-1' })
  })

  it('in the window a row opens, Lower priority and Open the job › are 44 px tall', async () => {
    viewport.phone = true
    renderSection([noRow()])
    await settle()
    fireEvent.click(screen.getByText(/Not as told on arrival/))
    const win = await waitFor(() => {
      const el = windowEl()
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    const lower = within(win).getByRole('button', { name: 'Lower priority' })
    expect(lower.style.minHeight).toBe('44px')
    const openJob = win.querySelector('[data-stage-check-window-open-job]') as HTMLElement
    expect(openJob.style.minHeight).toBe('44px')
    expect(openJob.style.display).toBe('inline-flex')
    // The link's words keep their size and colour.
    expect(openJob.style.fontSize).toBe('0.8125rem')
    expect(openJob.style.color).toBe('var(--text-link)')
  })

  it('a desk keeps the doors in their right-hand column at their size, and the window’s small doors as they were', async () => {
    renderSection([noRow()])
    await settle()
    const list = screen.getByRole('button', { name: /^Open the list:/ })
    expect(list.style.minHeight).toBe('')
    expect(list.style.flexGrow).toBe('')
    const box = doorsBox()
    expect(box.style.flexDirection).toBe('column')
    expect(box.style.maxWidth).toBe('min(220px, 45%)')
    fireEvent.click(screen.getByText(/Not as told on arrival/))
    const win = await waitFor(() => {
      const el = windowEl()
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    expect(within(win).getByRole('button', { name: 'Lower priority' }).style.minHeight).toBe('')
    expect((win.querySelector('[data-stage-check-window-open-job]') as HTMLElement).style.minHeight).toBe('')
  })
})
