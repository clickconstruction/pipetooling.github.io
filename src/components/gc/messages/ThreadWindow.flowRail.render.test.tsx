// @vitest-environment jsdom
/**
 * Messages, punch list #149 PR 3 (v2.5797): the flow rail at the thread's side waits until the sender is named. A
 * number or an address nobody has named has only the placeholder flow whose one step asks *Who is this?*, which the pill
 * beside the name and the sort card already ask, so the window draws no rail for them; a named person gets theirs. The
 * people are the spine's demo rows; nothing is real.
 */
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NewLaneCardIo } from '../../../lib/followUp/newLaneCardIo'
import type { JobTile } from '../../../lib/messages/jobTiles'
import { DEMO_NOW } from '../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import type { MessagesWrites } from './messagesWrites'
import { ThreadWindow } from './ThreadWindow'

vi.mock('../../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
// The sort card's reads for the unnamed sender: nothing to sort, so the card stays out of the way of this smoke.
const fakeCardIo = vi.hoisted(() => ({
  loadCard: vi.fn(async () => ({ contact: null, lines: [], tiles: {}, active: new Set<string>(), seats: { customer: null, trade: null, arch: null }, team: [] })),
  loadKnown: vi.fn(async () => ({})),
  name: vi.fn(async (contactId: string) => contactId),
  makeCustomer: vi.fn(async (contactId: string) => contactId),
  tie: vi.fn(async () => undefined),
  takeIt: vi.fn(async () => undefined),
  handTo: vi.fn(async () => undefined),
}))
vi.mock('../../../lib/followUp/newLaneCardIo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/followUp/newLaneCardIo')>()
  return { ...actual, supabaseNewLaneCardIo: (): NewLaneCardIo => fakeCardIo as unknown as NewLaneCardIo }
})

function writes(): MessagesWrites {
  return {
    nameContact: vi.fn(() => Promise.resolve(null)),
    tieMessage: vi.fn(() => Promise.resolve()),
    setDefaultJob: vi.fn(() => Promise.resolve()),
    addJob: vi.fn(() => Promise.resolve()),
    removeJob: vi.fn(() => Promise.resolve()),
    searchRecords: vi.fn(() => Promise.resolve([])),
    searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
  }
}

afterEach(cleanup)

const rail = () => document.querySelector('[data-flow-rail], [data-flow-side]')

describe('ThreadWindow: the flow rail and the sender’s kind (punch list #149 PR 3)', () => {
  it('draws no rail for a number nobody has named', async () => {
    const view = spineMessagesView()
    const unknown = view.contacts.find((c) => c.kind === 'unknown')!
    renderWithProviders(<ThreadWindow contactId={unknown.id} onClose={vi.fn()} view={view} nowIso={DEMO_NOW} writes={writes()} />)
    await screen.findByRole('dialog')
    expect(rail()).toBeNull()
  })

  it('draws the rail for a named person', async () => {
    const view = spineMessagesView()
    const named = view.contacts.find((c) => c.kind !== 'unknown')!
    renderWithProviders(<ThreadWindow contactId={named.id} onClose={vi.fn()} view={view} nowIso={DEMO_NOW} writes={writes()} />)
    await screen.findByRole('dialog')
    expect(rail()).not.toBeNull()
  })
})
