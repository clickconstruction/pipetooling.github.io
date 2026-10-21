// @vitest-environment jsdom
/**
 * Went out today (v2.5686, punch list #133 PR 3) over a fake read: the rows newest first with the time and who
 * pressed, a row opens the thread, the empty lane says so, and a read that fails says so instead of hiding.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { WentOutToday } from './WentOutToday'
import type { WentOutLine } from '../../lib/messages/wentOut'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

afterEach(cleanup)

const LINES: WentOutLine[] = [
  { id: 'm1', contactId: 'c-dana', name: 'Dana Whitfield', kind: 'customer', body: 'Dana, your estimate is ready.', atMs: Date.parse('2026-10-20T18:31:00Z'), who: 'Taunya' },
  { id: 'm2', contactId: 'c-pete', name: 'Pete Alvarez', kind: 'sub', body: 'Pete, Thursday still works.', atMs: Date.parse('2026-10-20T14:00:00Z'), who: '' },
]

describe('WentOutToday', { timeout: 15_000 }, () => {
  it('reads the rows newest first and a press opens the thread', async () => {
    const onOpenThread = vi.fn()
    renderWithProviders(<WentOutToday pill="all" onOpenThread={onOpenThread} io={vi.fn(async () => LINES)} />)
    const rows = await screen.findAllByTestId('went-out-row')
    expect(rows.map((r) => r.textContent)).toEqual(['💬Dana WhitfieldDana, your estimate is ready.1:31 PM · Taunya', '💬Pete AlvarezPete, Thursday still works.9:00 AM'])
    expect(screen.getByRole('heading', { name: 'Went out (2)' })).toBeTruthy()
    // Both texts went Tue Oct 20; mounted with no `now`, the day reads by its date unless the test runs that day.
    expect(screen.getAllByTestId('went-out-day-label').map((d) => d.textContent)).toEqual([expect.stringMatching(/^(Today|Yesterday|Tue Oct 20)$/)])
    fireEvent.click(rows[0]!)
    expect(onOpenThread).toHaveBeenCalledWith('c-dana')
  })
  it('an email we sent draws beside the texts with its chip, and the lane’s filter narrows to either (v2.5707)', async () => {
    const lines: WentOutLine[] = [
      LINES[0]!,
      { ...LINES[1]!, id: 'e1', channel: 'email', subject: 'Estimate #212 — Estimate for Dana Whitfield — $4,860', body: '', estimate: { number: 212, opened: true, accepted: false } },
    ]
    renderWithProviders(<WentOutToday pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => lines)} />)
    const rows = await screen.findAllByTestId('went-out-row')
    expect(rows.map((r) => r.getAttribute('data-channel'))).toEqual(['text', 'email'])
    expect(screen.getByTestId('went-out-did').textContent).toBe('opened')
    fireEvent.click(screen.getByRole('button', { name: 'Emails' }))
    expect(screen.getAllByTestId('went-out-row').map((r) => r.getAttribute('data-channel'))).toEqual(['email'])
    expect(screen.getByRole('heading', { name: 'Went out (1)' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Texts' }))
    expect(screen.getAllByTestId('went-out-row').map((r) => r.getAttribute('data-channel'))).toEqual(['text'])
  })
  it('a text Quo could not deliver reads red with the call to make; a delivered one reads so beside its time (v2.5703)', async () => {
    const lines: WentOutLine[] = [
      { ...LINES[0]!, delivery: 'delivered', number: '(830) 555-0121' },
      { ...LINES[1]!, delivery: 'undelivered', number: '(830) 555-0164' },
    ]
    renderWithProviders(<WentOutToday pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => lines)} />)
    const rows = await screen.findAllByTestId('went-out-row')
    expect(rows.map((r) => r.getAttribute('data-delivery'))).toEqual(['ok', 'bad'])
    expect(screen.getAllByTestId('went-out-mark').map((m) => m.textContent)).toEqual(['✓ delivered', '⚠ not delivered'])
    const call = screen.getByTestId('went-out-call') as HTMLAnchorElement
    expect(call.getAttribute('href')).toBe('tel:+18305550164')
    expect(call.textContent).toContain('Call them')
  })
  it('a pill narrows the lane, the empty lane says so, and a failed read says so', async () => {
    renderWithProviders(<WentOutToday pill="sub" onOpenThread={vi.fn()} io={vi.fn(async () => LINES)} />)
    const rows = await screen.findAllByTestId('went-out-row')
    expect(rows.map((r) => r.textContent?.startsWith('💬Pete'))).toEqual([true])
    cleanup()
    renderWithProviders(<WentOutToday pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => [])} />)
    expect((await screen.findByTestId('went-out-empty')).textContent).toBe('Nothing has gone out in the last 7 days.')
    cleanup()
    renderWithProviders(<WentOutToday pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => Promise.reject(new Error('down')))} />)
    expect((await screen.findByText('What went out could not be read.')).textContent).toBeTruthy()
  })
})
