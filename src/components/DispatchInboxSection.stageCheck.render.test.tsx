// @vitest-environment jsdom
/**
 * The Dispatch inbox row of a check the crew could not answer (punch list #245, PR 1): the *Stage check* tag, Open the
 * job and Open the check, where each routes, and a closed row with neither press. A check that leads the inbox at
 * high priority keeps that row under a red reason-and-wait line, never the portal's Customer waiting card (v2.6462).
 * PR 2b: the row press opens the context window, with the card from the request and the live read, the crew's words as
 * the thread's first line, Reply, Reply and close (never for the sender), Lower priority on a waiting check, Not now,
 * and the two doors; a closed row keeps its inline thread.
 */
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'

const openJobDetail = vi.fn()
const auth = vi.hoisted(() => ({ userId: 'u1' }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ role: 'dev', user: { id: auth.userId } }) }))
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

/** The live read the window makes: the stage, two questions and one answer on the job. */
const liveIo: StageCheckWindowIo = {
  stages: vi.fn(async () => [{ fixtureId: 'f3', name: 'Trim Set', sequenceOrder: 3 }]),
  questions: vi.fn(async () => [
    { id: 't2', kind: 'trim_set' as const, order: 2, words: 'Are the cleanouts capped?', asksPhoto: false },
    { id: 't3', kind: 'trim_set' as const, order: 3, words: 'Is the pan drain run to the hub?', asksPhoto: false, sheet: 'P-201' },
  ]),
  answers: vi.fn(async () => [{ id: 'a2', fixtureId: 'f3', questionId: 't2', pick: 'yes' as const, note: '', photo: null, answeredBy: 'Luis Ortega', answeredAt: '2026-11-02T14:00:00Z', storagePath: null, reportPhotoId: null }]),
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
      {...extra}
    />,
  )
}

/** The window is the modal dialog named by its title: the shell draws the heading and the footer outside the body div. */
const windowEl = () => (document.querySelector('[data-stage-check-window]')?.closest('[role="dialog"]') as HTMLElement | null) ?? null
const pressRow = () => fireEvent.click(screen.getByText(/need a part: The caps are not on the truck/))

afterEach(() => {
  cleanup()
  openJobDetail.mockReset()
  auth.userId = 'u1'
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

  it("leads the inbox as its own row when it waits: the red reason and wait, the tag, the doors, never the customer's card, and Lower priority in its window", async () => {
    const onSetPriority = vi.fn(async () => true)
    renderSection(
      [
        row({
          priority: 'high',
          created_at: new Date(Date.now() - 4 * 60_000).toISOString(),
          title: "Trim Set · “Is the pan drain run to the hub?” · can't do it · JP1088 ZZ TEST Riders Walk",
          pending_payload: { stage_check: { fixture_id: 'f3', question_id: 't3', reason: 'cant_do', stage_name: 'Trim Set' } },
        }),
      ],
      { onSetPriority },
    )
    await settle()
    expect(screen.queryByTestId('customer-waiting-card')).toBeNull()
    expect(screen.queryByText(/A customer/)).toBeNull()
    expect(document.querySelector('[data-dispatch-stage-check-waiting="r1"]')?.textContent).toMatch(/^Can't do it · waiting \d+ min$/)
    expect(screen.getByText('Stage check')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^Open the check:/ }))
    expect(openJobDetail).toHaveBeenLastCalledWith({ jobId: 'job-1', openStageChecklist: { fixtureId: 'f3', questionId: 't3' } })
    expect(screen.getByRole('button', { name: /^Open the job:/ })).toBeTruthy()

    // The window carries the red line and Lower priority where the thread's header held it.
    fireEvent.click(screen.getByText(/can't do it/))
    const win = await waitFor(() => {
      const el = windowEl()
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    expect(within(win).getByRole('heading', { name: "Stage check · Can't do it" })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Raise priority' })).toBeNull()
    fireEvent.click(within(win).getByRole('button', { name: 'Lower priority' }))
    expect(screen.getByText('Lower priority — why?')).toBeTruthy()
  })

  it('draws no red line on a stage check at normal priority, and keeps Raise priority for a plain request', async () => {
    renderSection([row({ priority: 'normal' }), row({ id: 'r2', title: 'Pick up the permit', pending_action: null, pending_payload: null })], { expandedRequestId: 'r2', onSetPriority: vi.fn() })
    await settle()
    expect(document.querySelector('[data-dispatch-stage-check-waiting]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Raise priority' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Lower priority' })).toBeNull()
  })
})

describe('the context window (PR 2b)', () => {
  it('opens on the row press with the context, the live count and the thread, loads the notes, and Not now closes it', async () => {
    const onToggleExpandRequest = vi.fn()
    renderSection([row({})], { onToggleExpandRequest, notesByRequestId: { r1: [{ id: 'n1', body: 'Ferguson has them, Pat is picking up at 1.', created_at: '2026-11-02T15:40:00Z', author: { name: 'Jo Office' } }] } })
    await settle()
    expect(windowEl()).toBeNull()
    pressRow()
    expect(onToggleExpandRequest).toHaveBeenCalledWith('r1')
    const win = await waitFor(() => {
      const el = windowEl()
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    expect(within(win).getByRole('heading', { name: 'Stage check · Need a part' })).toBeTruthy()
    // The card: the job, the address with the stage and its live count, the check with its plan sheet, the live meta.
    expect(within(win).getByText('JP1088 · ZZ TEST Riders Walk')).toBeTruthy()
    expect(await within(win).findByText('12925 FM 20, Kingsbury · Trim Set · 1 of 2 answered · 1 left')).toBeTruthy()
    expect(within(win).getByText('Is the pan drain run to the hub?')).toBeTruthy()
    expect(within(win).getByText('P-201')).toBeTruthy()
    expect(within(win).getByText("the company's question · not answered yet")).toBeTruthy()
    // The thread: the crew's words first, then Dispatch's note.
    expect(within(win).getByText('The caps are not on the truck.')).toBeTruthy()
    expect(within(win).getByText('Ferguson has them, Pat is picking up at 1.')).toBeTruthy()
    expect(within(win).getByText('1 reply')).toBeTruthy()
    expect(within(win).getByPlaceholderText('Reply to Luis…')).toBeTruthy()

    fireEvent.click(within(win).getByRole('button', { name: 'Not now' }))
    await waitFor(() => expect(windowEl()).toBeNull())
    // The row's thread was opened for the notes and is folded with the window.
    expect(onToggleExpandRequest).toHaveBeenCalledTimes(1)
  })

  it('replies and closes with the words typed, and routes its two doors', async () => {
    const onSubmitNote = vi.fn()
    const onSubmitNoteAndClose = vi.fn()
    const onNoteDraftChange = vi.fn()
    const { rerender } = renderSection([row({})], { onSubmitNote, onSubmitNoteAndClose, onNoteDraftChange })
    await settle()
    pressRow()
    const win = await waitFor(() => {
      const el = windowEl()
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    // Dead until there are words.
    expect((within(win).getByRole('button', { name: 'Reply' }) as HTMLButtonElement).disabled).toBe(true)
    expect((within(win).getByRole('button', { name: 'Reply and close' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(within(win).getByLabelText('Reply'), { target: { value: 'Hub pours Thursday.' } })
    expect(onNoteDraftChange).toHaveBeenCalledWith('Hub pours Thursday.')
    rerender(
      <DispatchInboxSection
        sectionOpen
        onToggleSection={vi.fn()}
        requests={[row({})]}
        loading={false}
        expandedRequestId="r1"
        onToggleExpandRequest={vi.fn()}
        notesByRequestId={{}}
        notesLoadingRequestId={null}
        noteSubmitRequestId={null}
        canAddNotes
        dispatchRequestDismissingId={null}
        noteDraft="Hub pours Thursday."
        onNoteDraftChange={onNoteDraftChange}
        onSubmitNote={onSubmitNote}
        onSubmitNoteAndClose={onSubmitNoteAndClose}
        onDismiss={vi.fn()}
        stageCheckWindowIo={liveIo}
      />,
    )
    const win2 = windowEl() as HTMLElement
    fireEvent.click(within(win2).getByRole('button', { name: 'Reply' }))
    expect(onSubmitNote).toHaveBeenCalledWith('r1')
    fireEvent.click(within(win2).getByRole('button', { name: 'Reply and close' }))
    expect(onSubmitNoteAndClose).toHaveBeenCalledWith('r1')

    fireEvent.click(within(win2).getByRole('button', { name: 'Open the job ›' }))
    expect(openJobDetail).toHaveBeenLastCalledWith({ jobId: 'job-1' })
    await waitFor(() => expect(windowEl()).toBeNull())
  })

  it('never lets the sender close their own, and says why', async () => {
    auth.userId = 'u2'
    renderSection([row({})])
    await settle()
    pressRow()
    const win = await waitFor(() => {
      const el = windowEl()
      expect(el).toBeTruthy()
      return el as HTMLElement
    })
    expect(within(win).getByRole('button', { name: 'Reply' })).toBeTruthy()
    expect(within(win).queryByRole('button', { name: 'Reply and close' })).toBeNull()
    expect(within(win).getByText('You sent this check. Answer it on the sheet and it closes itself.')).toBeTruthy()
  })

  it('keeps the inline thread on a closed stage check and opens no window', async () => {
    const onToggleExpandRequest = vi.fn()
    renderSection([row({ status: 'closed', closed_at: '2026-11-02T16:00:00Z', closed_note: 'Answered on the sheet by Luis Ortega · Yes' })], { onToggleExpandRequest, expandedRequestId: 'r1' })
    await settle()
    expect(screen.getByText('Marked closed (final)')).toBeTruthy()
    fireEvent.click(screen.getByText(/need a part: The caps are not on the truck/))
    expect(onToggleExpandRequest).toHaveBeenCalledWith('r1')
    expect(windowEl()).toBeNull()
  })
})
