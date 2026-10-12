// @vitest-environment jsdom
/** One person's flow where a window shows it (Messages cut 4): read through flowPersonIo, pressed through its presses. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { FlowPersonRead } from '../../lib/flows/flowPersonIo'
import { SEED_FLOWS } from '../../lib/flows/seed'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const io = vi.hoisted(() => ({
  read: null as unknown as FlowPersonRead,
  readPerson: vi.fn(async () => null as unknown as FlowPersonRead),
  find: vi.fn(async () => 'tom'),
  addNote: vi.fn(async () => 'n1'),
  holdUntil: vi.fn(async () => 'h1'),
  setOff: vi.fn(async () => null),
}))

vi.mock('../../lib/flows/flowPersonIo', () => ({
  findFlowContactId: io.find,
  readFlowPerson: io.readPerson,
  flowPresses: {
    addNote: io.addNote,
    skip: vi.fn(async () => 's1'),
    unskip: vi.fn(async () => null),
    holdUntil: io.holdUntil,
    letGo: vi.fn(async () => null),
    remindNow: vi.fn(async () => 'r1'),
    setOff: io.setOff,
    putBackOn: vi.fn(async () => null),
  },
}))

// The thread window's phone width, as the side reads it.
const media = vi.hoisted(() => ({ phone: false }))
vi.mock('../../hooks/useMatchMedia', () => ({ useMatchMedia: () => media.phone }))

import { openFlowStep, useFlowNow } from '../../hooks/useFlowNow'
import { FlowTab } from './FlowTab'

// Tom of Bexar Steel Erectors, as flow_rows would give him: invited, on his portal, his W-9 signed, no insurance yet.
const TOM: FlowPersonRead = {
  contact: { id: 'tom', kind: 'trade', name: 'Tom Riddle', goes_by: null },
  flow: SEED_FLOWS.trade,
  rows: {
    contact: { id: 'tom', kind: 'trade', off_since: null, off_why: null, off_by: null },
    userNames: { 'u-rosa': 'Rosa' },
    company: { id: 'bexar', portal_opened_on: '2026-09-28' },
    tradeMessages: [{ company_id: 'bexar', kind: 'invite', sent_on: '2026-09-25', sent_by: 'u-rosa' }],
    papers: [{ id: 'w9', company_id: 'bexar', doc_type: 'w9', status: 'signed', sent_at: null, signed_at: '2026-09-29', expires_at: null, created_at: '2026-09-29T15:00:00Z' }],
    previewPath: '/t/bexar-token?preview=1',
  },
  holds: [],
  sent: [],
  notes: [],
  lines: [],
}

beforeEach(() => {
  media.phone = false
  io.read = TOM
  io.readPerson.mockReset()
  io.readPerson.mockImplementation(async () => io.read)
  io.addNote.mockClear()
  io.holdUntil.mockClear()
  io.setOff.mockClear()
})

describe('FlowTab', () => {
  it('finds the company’s contact, reads their flow, and opens a step’s card beside the panel', async () => {
    renderWithProviders(<FlowTab at={{ gcCompanyId: 'bexar' }} />)
    const papers = await screen.findByRole('button', { name: /^Papers in: on now/ })
    expect(io.find).toHaveBeenCalledWith({ gcCompanyId: 'bexar', customerId: null })
    expect((screen.getByRole('link', { name: /See their page/ }) as HTMLAnchorElement).getAttribute('href')).toBe('/t/bexar-token?preview=1')
    fireEvent.click(papers)
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  it('adds a note through the flow’s press, as the step’s, on the person', async () => {
    renderWithProviders(<FlowTab at={{ contactId: 'tom' }} />)
    fireEvent.click(await screen.findByRole('button', { name: /^Papers in: on now/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '+ a note' }))
    fireEvent.change(screen.getByLabelText('The note, for the team'), { target: { value: 'Their broker renews Nov 1.' } })
    fireEvent.click(within(dialog).getAllByRole('button', { name: '+ a note' }).slice(-1)[0]!)
    await waitFor(() => expect(io.addNote).toHaveBeenCalledWith('tom', 'papers', { projectId: null }, 'Their broker renews Nov 1.'))
  })

  it('takes them off the flow with why', async () => {
    renderWithProviders(<FlowTab at={{ contactId: 'tom' }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Take off the flow' }))
    fireEvent.change(screen.getByLabelText('Why do they come off the flow?'), { target: { value: 'Closed the business.' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Take off the flow' }).slice(-1)[0]!)
    await waitFor(() => expect(io.setOff).toHaveBeenCalledWith('tom', 'Closed the business.'))
  })

  it('says so when there is nobody to read', async () => {
    io.find.mockResolvedValueOnce(null as never)
    renderWithProviders(<FlowTab at={{ customerId: 'nobody' }} />)
    expect(await screen.findByText('There is no thread for them yet, so there is no flow to show.')).toBeTruthy()
  })
})

describe('FlowTab in the thread window’s side', () => {
  const sideOf = (c: HTMLElement) => c.querySelector('[data-flow-side]')?.getAttribute('data-flow-side')

  it('at a desk: the rail opens to the panel, a step’s card covers the side, and Escape closes only the card', async () => {
    const { container } = renderWithProviders(<FlowTab at={{ contactId: 'tom' }} side />)
    fireEvent.click(await screen.findByRole('button', { name: /^Open the / }))
    expect(sideOf(container)).toBe('panel')
    fireEvent.click(screen.getByRole('button', { name: /^Papers in: on now/ }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    // The thread window listens after the card, and finds the Escape taken.
    const behind = vi.fn((e: KeyboardEvent) => e.defaultPrevented)
    document.addEventListener('keydown', behind)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    document.removeEventListener('keydown', behind)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(behind.mock.results[0]?.value).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'fold ›' }))
    expect(sideOf(container)).toBe('rail')
  })

  it('on a phone: the rail stays beside the thread, and the panel and the card open as sheets over it', async () => {
    media.phone = true
    const { container } = renderWithProviders(<FlowTab at={{ contactId: 'tom' }} side />)
    fireEvent.click(await screen.findByRole('button', { name: /^Open the / }))
    expect(sideOf(container)).toBe('rail')
    const sheet = screen.getByRole('dialog')
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    fireEvent.click(within(sheet).getByRole('button', { name: /^Papers in: on now/ }))
    expect(screen.getAllByRole('dialog')).toHaveLength(2)
    // Escape closes the card first, then folds the sheet.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    // A mark on the rail opens its card alone.
    fireEvent.click(container.querySelector('[data-flow-mark="papers"]')!)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
})

describe('where a person is, for cut 3 beside the thread', () => {
  function Now({ contactId }: { contactId: string }) {
    const now = useFlowNow(contactId)
    return <output aria-label="Where they are">{now === undefined ? 'reading' : now ? `${now.stepName} · ${now.who} · ${now.finishes}` : 'Nothing on now.'}</output>
  }

  it('reads the step on now, and reads again after a press in the side’s panel', async () => {
    const { container } = renderWithProviders(
      <>
        <Now contactId="tom" />
        <FlowTab at={{ contactId: 'tom' }} side />
      </>,
    )
    await waitFor(() => expect(screen.getByLabelText('Where they are').textContent).toMatch(/^Papers in · them · /))
    const reads = io.readPerson.mock.calls.length
    fireEvent.click(container.querySelector('[data-flow-mark="papers"]')!)
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Hold until Mon' }))
    await waitFor(() => expect(io.holdUntil).toHaveBeenCalled())
    // Both readers of Tom read again.
    await waitFor(() => expect(io.readPerson.mock.calls.length).toBeGreaterThanOrEqual(reads + 2))
  })

  it('opens a step’s card in the side when Find a reply asks', async () => {
    const { container } = renderWithProviders(<FlowTab at={{ contactId: 'tom' }} side />)
    await screen.findByRole('button', { name: /^Open the / })
    act(() => openFlowStep('tom', 'papers', null))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(container.querySelector('[data-flow-side]')?.getAttribute('data-flow-side')).toBe('panel')
    // Someone else's ask opens nothing here.
    fireEvent.keyDown(document.body, { key: 'Escape' })
    act(() => openFlowStep('greg', 'papers', null))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
