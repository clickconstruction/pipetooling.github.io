// @vitest-environment jsdom
/**
 * Waiting on them (v2.5704, punch list #139 PR 12) over a fake read: the quiet people longest first, our last words
 * and the day, the chip over Nudge and Call (v2.5790); Nudge opens the thread with the nudge asked and the name opens it as it is; Call dials; a
 * last text Quo could not deliver draws the row red with Call them and Send it as an email (#140 PR 4); the empty lane
 * and a failed read say so.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { WaitingOnThem } from './WaitingOnThem'
import type { WaitLine } from '../../lib/messages/waitingOnThem'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const NOW = Date.parse('2026-10-21T05:10:00Z')
const LINES: WaitLine[] = [
  { id: 'd1', contactId: 'c-dana', name: 'Dana Whitfield', kind: 'customer', direction: 'out', body: 'Dana, your estimate is ready, $4,860.00.', atMs: Date.parse('2026-10-18T18:31:00Z'), number: '(830) 555-0121' },
  { id: 'k1', contactId: 'c-kim', name: 'Kim Coe', kind: 'customer', direction: 'out', body: 'Kim, the water heater is on the truck for Tuesday.', atMs: Date.parse('2026-10-14T20:00:00Z'), number: null },
]

describe('WaitingOnThem', { timeout: 15_000 }, () => {
  it('lists the quiet people longest first with the chip over the presses, and Nudge or the name opens the thread, Call dials', async () => {
    const onOpenThread = vi.fn()
    renderWithProviders(<WaitingOnThem pill="all" onOpenThread={onOpenThread} io={vi.fn(async () => LINES)} now={() => NOW} />)
    const rows = await screen.findAllByTestId('waiting-row')
    expect(rows.map((r) => r.textContent)).toEqual(['Kim CoeUs · Kim, the water heater is on the truck for Tuesday. · Wed, Oct 14Their move · 6 dNudge', 'Dana WhitfieldUs · Dana, your estimate is ready, $4,860.00. · Sun, Oct 18Their move · 2 dNudge☎ Call'])
    expect(screen.getByRole('heading', { name: 'Waiting on them (2)' })).toBeTruthy()
    fireEvent.click(screen.getAllByTestId('waiting-nudge')[0]!)
    expect(onOpenThread).toHaveBeenCalledWith('c-kim', { nudge: 'text' })
    fireEvent.click(screen.getAllByTestId('waiting-name')[1]!)
    expect(onOpenThread).toHaveBeenCalledWith('c-dana')
    expect((screen.getByTestId('waiting-call') as HTMLAnchorElement).getAttribute('href')).toBe('tel:+18305550121')
  })
  it('a last text Quo could not deliver draws the row red, with Call them and the same words as an email in the nudge’s place', async () => {
    const onOpenThread = vi.fn()
    const failed: WaitLine = { ...LINES[0]!, channel: 'text', delivery: 'failed' }
    renderWithProviders(<WaitingOnThem pill="all" onOpenThread={onOpenThread} io={vi.fn(async () => [failed])} now={() => NOW} />)
    const row = await screen.findByTestId('waiting-row')
    expect(row.getAttribute('data-delivery')).toBe('bad')
    expect(screen.getByTestId('waiting-mark').textContent).toBe('⚠ not sent')
    expect(screen.queryByTestId('waiting-nudge')).toBeNull()
    expect(screen.getByTestId('waiting-call').textContent).toBe('☎ Call them')
    fireEvent.click(screen.getByTestId('waiting-email'))
    expect(onOpenThread).toHaveBeenCalledWith('c-dana', { nudge: 'email' })
  })
  it('the empty lane says so, and a failed read says so', async () => {
    renderWithProviders(<WaitingOnThem pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => [])} now={() => NOW} />)
    expect((await screen.findByTestId('waiting-empty')).textContent).toBe('Nobody has gone quiet on us.')
    cleanup()
    renderWithProviders(<WaitingOnThem pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => Promise.reject(new Error('down')))} now={() => NOW} />)
    expect(await screen.findByText('Who went quiet could not be read.')).toBeTruthy()
  })
})
