// @vitest-environment jsdom
/**
 * Punch list #140 PR 7: the header's move chip takes what cut 2 knows through the `court` slot. A written promise's day
 * reads as *Their move · until …* on a thread whose last word is ours; what we owe reads as *Our move · we owe …*
 * whatever the lines say; with no facts the chip reads the lines as before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { ThreadWindow } from './ThreadWindow'
import type { MessagesWrites } from './messagesWrites'
import type { ThreadSlots } from './threadSlots'
import { renderWithProviders } from '../../../test/renderSmokeMocks'
import { DEMO_NOW } from '../../../lib/messages/messagesDemo'
import { spineMessagesView } from '../../../lib/messages/spineRows'
import { courtOf } from '../../../lib/messages/thread'
import type { JobTile } from '../../../lib/messages/jobTiles'

const writes = (): MessagesWrites => ({
  nameContact: vi.fn(() => Promise.resolve(null)),
  tieMessage: vi.fn(() => Promise.resolve()),
  setDefaultJob: vi.fn(() => Promise.resolve()),
  addJob: vi.fn(() => Promise.resolve()),
  removeJob: vi.fn(() => Promise.resolve()),
  searchRecords: vi.fn(() => Promise.resolve([])),
  searchJobs: vi.fn(() => Promise.resolve([] as JobTile[])),
})

const demo = spineMessagesView()
/** Greg's last word is his in the demo, so the chip reads our move. */
const ours = demo.contacts.find((c) => c.id === 'c-greg' && courtOf(demo.messages, c.id, DEMO_NOW).side === 'ours')!
/** The same thread with one more line of ours, a call we logged a minute before now, so the chip reads their move. */
const lastOut = [...demo.messages].reverse().find((m) => m.contactId === 'c-greg' && m.direction === 'out')!
const answered = {
  ...demo,
  messages: [...demo.messages, { ...lastOut, id: 'm-greg-call-logged', channel: 'call' as const, body: 'Called Greg. They said: Thursday works', at: new Date(Date.parse(DEMO_NOW) - 60_000).toISOString() }],
}

function open(contactId: string, view: typeof demo, slots?: ThreadSlots) {
  renderWithProviders(<ThreadWindow contactId={contactId} at={null} onClose={vi.fn()} slots={slots} view={view} nowIso={DEMO_NOW} writes={writes()} />)
  return screen.getByRole('dialog', { name: /: messages$/ }).querySelector('[data-thread-status]')!.textContent ?? ''
}

afterEach(cleanup)

describe('ThreadWindow: the move chip reads cut 2’s facts through the court slot', () => {
  it('a written promise’s day holds their move', () => {
    expect(ours).toBeTruthy()
    expect(courtOf(answered.messages, 'c-greg', DEMO_NOW).side).toBe('theirs')
    expect(open('c-greg', answered, { court: () => ({ promisedUntil: 'until Tue Oct 27 · their word' }) })).toContain('Their move · until Tue Oct 27 · their word')
  })

  it('what we owe makes it our move, whatever the lines say', () => {
    expect(open('c-greg', answered, { court: () => ({ owed: { what: 'the revised quote', by: 'Fri Oct 23' } }) })).toContain('Our move · we owe the revised quote · by Fri Oct 23')
  })

  it('with no facts, the chip reads the lines', () => {
    const plain = open('c-greg', demo)
    expect(plain).toContain('Our move')
    expect(plain).not.toContain('we owe')
  })

  it('a cut that gives no facts leaves the lines to speak', () => {
    expect(open('c-greg', answered, { court: () => null })).toContain('Their move')
  })
})
