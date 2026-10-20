// @vitest-environment jsdom
/**
 * v2.5635: the Pipeline's waiting dot lights without a reload of the board. A board of two rows, each with the real
 * speech bubble, holds one Messages channel however many rows draw; when the customer's text lands and her contact
 * turns to waiting, the board reads its dots again and her row's bubble shows the dot while the other row's does not.
 * Dana is the mockups' made-up customer.
 */
import { cleanup, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BoardDotRows } from '../lib/messages/boardDotsIo'

const fake = vi.hoisted(() => {
  const listeners: Array<{ table: string; fn: () => void }> = []
  let made = 0
  const channel = () => {
    made += 1
    const ch: Record<string, unknown> = {}
    ch.on = (_kind: string, spec: { table: string }, fn: () => void) => {
      listeners.push({ table: spec.table, fn })
      return ch
    }
    ch.subscribe = () => ch
    return ch
  }
  return { listeners, channel, count: () => made }
})
vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  return { supabase: { ...makeSupabaseStub(), channel: fake.channel, removeChannel: () => {} } }
})
vi.mock('./useAuth', () => ({ useOptionalAuth: () => ({ role: 'assistant' }) }))

import { MessagesButton } from '../components/messages/MessagesButton'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { useBoardDots } from './useBoardDots'

afterEach(cleanup)

const NOBODY_WAITS: BoardDotRows = { contacts: [], lines: [] }
const DANA_WAITS: BoardDotRows = {
  contacts: [{ id: 'c-dana', kind: 'customer', name: 'Dana Whitfield', goesBy: null, company: null, state: 'waiting', snoozedUntil: null, has: null, hasUserId: null, hasSince: null, hasHow: null, phone: null }],
  lines: [
    {
      id: 'm-ask',
      contactId: 'c-dana',
      jobId: 'job-1312',
      channel: 'text',
      direction: 'in',
      at: '2026-10-12T14:05:00Z',
      subject: null,
      body: 'Can you do Thursday?',
      who: 'Dana Whitfield',
      backOn: null,
      backBy: null,
      mailbox: null,
      tiedByHand: false,
    },
  ],
}

const ROWS = [
  { jobId: 'job-1312', customerId: 'cust-dana', name: 'Dana Whitfield' },
  { jobId: 'job-1400', customerId: 'cust-marco', name: 'Marco Ibarra' },
]

function Board({ load }: { load: () => Promise<BoardDotRows> }) {
  const { dotByJobId } = useBoardDots({ enabled: true, load, todayYmd: '2026-10-12', nowIso: '2026-10-12T20:00:00Z' })
  return (
    <ul>
      {ROWS.map((r) => (
        <li key={r.jobId}>
          <MessagesButton customerId={r.customerId} customerName={r.name} dot={dotByJobId.get(r.jobId) ?? null} onPressInstead={() => {}} />
        </li>
      ))}
    </ul>
  )
}

const bubble = (customerId: string) => document.querySelector(`[data-messages-button="${customerId}"]`) as HTMLElement

describe('the board’s waiting dot is live (v2.5635)', () => {
  it('lights the waiting customer’s row when her text lands, on one channel for the board', async () => {
    const load = vi.fn(() => Promise.resolve(NOBODY_WAITS))
    renderWithProviders(<Board load={load} />)
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(bubble('cust-dana').querySelector('[data-messages-dot]')).toBeNull()
    expect(fake.count()).toBe(1)

    load.mockImplementation(() => Promise.resolve(DANA_WAITS))
    // Her text and her contact's turn to waiting land together and settle into one read.
    fake.listeners.find((l) => l.table === 'messages')!.fn()
    fake.listeners.find((l) => l.table === 'contacts')!.fn()
    await waitFor(() => expect(bubble('cust-dana').querySelector('[data-messages-dot]')).toBeTruthy(), { timeout: 3000 })
    expect(load).toHaveBeenCalledTimes(2)
    expect(bubble('cust-dana').getAttribute('aria-label')).toContain('Dana')
    expect(bubble('cust-marco').querySelector('[data-messages-dot]')).toBeNull()
    expect(fake.count()).toBe(1)
  })
})
