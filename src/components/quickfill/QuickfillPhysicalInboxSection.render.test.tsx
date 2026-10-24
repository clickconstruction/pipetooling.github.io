// @vitest-environment jsdom
/**
 * Render smokes for the Quickfill Physical inbox deck (punch list #158, v2.5818): the empty
 * deck, the papers oldest first with their ages, the add line, Done leaving a line with
 * Undo and Undo putting the paper back, File it with a place, Task opening the header's Task
 * window with the title and the paper leaving once the task is saved, Ask hidden for a role
 * without the doors, and a read that fails naming the reason with Retry.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QuickfillPhysicalInboxSection } from './QuickfillPhysicalInboxSection'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import { ChecklistAddModalProvider, useChecklistAddModal } from '../../contexts/ChecklistAddModalContext'
import type { OfficeInboxIo } from '../../hooks/useOfficeInboxPapers'
import type { InboxPaper } from '../../lib/quickfill/physicalInbox'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const authRole = { role: 'assistant' }
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  const mod = useAuthModuleMock()
  return { ...mod, useAuth: () => ({ ...mod.useAuth(), role: authRole.role }) }
})

const TODAY = '2026-10-24'

function paper(p: Partial<InboxPaper> & { id: string; title: string; came_on: string }): InboxPaper {
  return { detail: null, created_by: 'u1', created_by_name: 'Marisol', created_at: `${p.came_on}T15:00:00.000Z`, state: 'open', outcome: null, outcome_detail: null, follow_up_on: null, outcome_at: null, outcome_by: null, checklist_item_id: null, dispatch_request_id: null, estimator_request_id: null, ...p }
}

function fakeIo(initial: InboxPaper[]): OfficeInboxIo & { rows: InboxPaper[]; updates: Array<{ id: string; patch: Partial<InboxPaper> }> } {
  const io = {
    rows: initial.map((p) => ({ ...p })),
    updates: [] as Array<{ id: string; patch: Partial<InboxPaper> }>,
    async list() {
      return io.rows.map((p) => ({ ...p }))
    },
    async insert(row: { title: string; came_on: string; created_by: string | null }) {
      const p = paper({ id: `new-${io.rows.length + 1}`, title: row.title, came_on: row.came_on, created_by: row.created_by, created_by_name: 'Smoke Dev' })
      io.rows.push(p)
      return p
    },
    async update(id: string, patch: Partial<InboxPaper>) {
      io.updates.push({ id, patch })
      io.rows = io.rows.map((p) => (p.id === id ? { ...p, ...patch } : p))
    },
  }
  return io
}

const phones = paper({ id: 'a', title: 'Two old iPhones in a box', came_on: '2026-08-19' })
const cards = paper({ id: 'b', title: 'New insurance cards, 6 trucks', came_on: '2026-10-19' })
const letter = paper({ id: 'c', title: 'Letter from the firm', came_on: '2026-10-24' })

function TaskProbe() {
  const ctx = useChecklistAddModal()
  return (
    <div>
      <span data-testid="task-probe">{ctx?.isOpen ? `open:${ctx.initialPreset?.title ?? ''}` : 'closed'}</span>
      <button type="button" onClick={() => ctx?.onSaved?.('ci-9')}>
        saved
      </button>
    </div>
  )
}

describe('QuickfillPhysicalInboxSection', () => {
  beforeEach(() => {
    authRole.role = 'assistant'
  })

  it('reads clear when nothing is undecided', async () => {
    renderWithProviders(<QuickfillPhysicalInboxSection io={fakeIo([])} todayYmd={TODAY} />)
    await waitFor(() => expect(screen.getByTestId('physical-inbox-line').textContent).toContain('Nothing undecided'))
    expect(screen.getByTestId('physical-inbox-line').textContent).toContain('The tray is clear.')
    expect(screen.getByLabelText('A paper for the deck')).toBeTruthy()
    expect(screen.queryAllByTestId('physical-inbox-paper').length).toBe(0)
  })

  it('lists the papers oldest first with their ages and counts them', async () => {
    renderWithProviders(<QuickfillPhysicalInboxSection io={fakeIo([letter, cards, phones])} todayYmd={TODAY} />)
    await waitFor(() => expect(screen.getAllByTestId('physical-inbox-paper').length).toBe(3))
    expect(screen.getByTestId('physical-inbox-line').textContent).toBe('3 undecided · oldest 66 d')
    const rows = screen.getAllByTestId('physical-inbox-paper')
    expect(rows[0]!.textContent).toContain('Two old iPhones in a box')
    expect(rows[0]!.textContent).toContain('66 d · Aug 19')
    expect(rows[0]!.getAttribute('data-age-state')).toBe('red')
    expect(rows[1]!.getAttribute('data-age-state')).toBe('amber')
    expect(rows[2]!.textContent).toContain('today')
    expect(rows[2]!.getAttribute('data-age-state')).toBe('fresh')
    expect(rows[0]!.textContent).toContain('Marisol')
  })

  it('adds a paper dated today from the add line on Enter', async () => {
    const io = fakeIo([])
    renderWithProviders(<QuickfillPhysicalInboxSection io={io} todayYmd={TODAY} />)
    await waitFor(() => expect(screen.getByTestId('physical-inbox-line').textContent).toContain('Nothing undecided'))
    const box = screen.getByLabelText('A paper for the deck') as HTMLInputElement
    fireEvent.change(box, { target: { value: '  Toll bill,   NTTA ' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(screen.getAllByTestId('physical-inbox-paper').length).toBe(1))
    expect(io.rows[0]!.title).toBe('Toll bill, NTTA')
    expect(io.rows[0]!.came_on).toBe(TODAY)
    expect(screen.getByTestId('physical-inbox-line').textContent).toBe('1 undecided · oldest today')
    expect(box.value).toBe('')
  })

  it('Done takes the paper off the deck and leaves a line; Undo puts it back', async () => {
    const io = fakeIo([cards])
    renderWithProviders(<QuickfillPhysicalInboxSection io={io} todayYmd={TODAY} />)
    await waitFor(() => expect(screen.getAllByTestId('physical-inbox-paper').length).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryAllByTestId('physical-inbox-paper').length).toBe(0))
    expect(io.updates[0]!.patch.state).toBe('closed')
    expect(io.updates[0]!.patch.outcome).toBe('done')
    expect(screen.getByTestId('physical-inbox-decided').textContent).toContain('Done · New insurance cards, 6 trucks')
    expect(screen.getByTestId('physical-inbox-line').textContent).toContain('Nothing undecided')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => expect(screen.getAllByTestId('physical-inbox-paper').length).toBe(1))
    expect(io.updates[1]!.patch.state).toBe('open')
    expect(io.updates[1]!.patch.outcome).toBeNull()
    expect(screen.queryAllByTestId('physical-inbox-decided').length).toBe(0)
  })

  it('File it asks where, and a place files the paper', async () => {
    const io = fakeIo([phones])
    renderWithProviders(<QuickfillPhysicalInboxSection io={io} todayYmd={TODAY} />)
    await waitFor(() => expect(screen.getAllByTestId('physical-inbox-paper').length).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'File it ▾' }))
    await settle()
    expect(screen.getByTestId('physical-inbox-file-form')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'The cabinet' }))
    await waitFor(() => expect(screen.queryAllByTestId('physical-inbox-paper').length).toBe(0))
    expect(io.updates[0]!.patch.outcome).toBe('filed')
    expect(io.updates[0]!.patch.outcome_detail).toBe('The cabinet')
    expect(screen.getByTestId('physical-inbox-decided').textContent).toContain('Filed · The cabinet')
  })

  it('Task opens the header Task window with the title, and the paper leaves once the task is saved', async () => {
    const io = fakeIo([cards])
    renderWithProviders(
      <ChecklistAddModalProvider>
        <TaskProbe />
        <QuickfillPhysicalInboxSection io={io} todayYmd={TODAY} />
      </ChecklistAddModalProvider>,
    )
    await waitFor(() => expect(screen.getAllByTestId('physical-inbox-paper').length).toBe(1))
    fireEvent.click(screen.getByRole('button', { name: 'Task' }))
    await waitFor(() => expect(screen.getByTestId('task-probe').textContent).toBe('open:New insurance cards, 6 trucks'))
    expect(screen.getAllByTestId('physical-inbox-paper').length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'saved' }))
    await waitFor(() => expect(screen.queryAllByTestId('physical-inbox-paper').length).toBe(0))
    expect(io.updates[0]!.patch.outcome).toBe('task')
    expect(io.updates[0]!.patch.checklist_item_id).toBe('ci-9')
    expect(screen.getByTestId('physical-inbox-decided').textContent).toContain('Task made')
  })

  it('hides Ask for a primary and keeps Task', async () => {
    authRole.role = 'primary'
    renderWithProviders(<QuickfillPhysicalInboxSection io={fakeIo([cards])} todayYmd={TODAY} />)
    await waitFor(() => expect(screen.getAllByTestId('physical-inbox-paper').length).toBe(1))
    expect(screen.queryByRole('button', { name: 'Ask ▾' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Task' })).toBeTruthy()
  })

  it('names the reason when the read fails and offers Retry', async () => {
    const io = fakeIo([cards])
    let fail = true
    io.list = async () => {
      if (fail) throw new Error('relation does not exist')
      return [cards]
    }
    renderWithProviders(<QuickfillPhysicalInboxSection io={io} todayYmd={TODAY} />)
    await waitFor(() => expect(screen.getByTestId('physical-inbox-error').textContent).toContain('relation does not exist'))
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getAllByTestId('physical-inbox-paper').length).toBe(1))
  })
})
