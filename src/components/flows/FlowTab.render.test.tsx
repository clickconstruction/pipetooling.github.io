// @vitest-environment jsdom
/** One person's flow where a window shows it (Messages cut 4): read through flowPersonIo, pressed through its presses. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { FlowPersonRead } from '../../lib/flows/flowPersonIo'
import { SEED_FLOWS } from '../../lib/flows/seed'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const io = vi.hoisted(() => ({
  read: null as unknown as FlowPersonRead,
  find: vi.fn(async () => 'tom'),
  addNote: vi.fn(async () => 'n1'),
  holdUntil: vi.fn(async () => 'h1'),
  setOff: vi.fn(async () => null),
}))

vi.mock('../../lib/flows/flowPersonIo', () => ({
  findFlowContactId: io.find,
  readFlowPerson: vi.fn(async () => io.read),
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
  io.read = TOM
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
