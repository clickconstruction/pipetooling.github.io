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
    expect(rows.map((r) => r.textContent)).toEqual(['Dana WhitfieldDana, your estimate is ready.1:31 PM · Taunya', 'Pete AlvarezPete, Thursday still works.9:00 AM'])
    expect(screen.getByRole('heading', { name: 'Went out today (2)' })).toBeTruthy()
    fireEvent.click(rows[0]!)
    expect(onOpenThread).toHaveBeenCalledWith('c-dana')
  })
  it('a pill narrows the lane, the empty lane says so, and a failed read says so', async () => {
    renderWithProviders(<WentOutToday pill="sub" onOpenThread={vi.fn()} io={vi.fn(async () => LINES)} />)
    const rows = await screen.findAllByTestId('went-out-row')
    expect(rows.map((r) => r.textContent?.startsWith('Pete'))).toEqual([true])
    cleanup()
    renderWithProviders(<WentOutToday pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => [])} />)
    expect((await screen.findByTestId('went-out-empty')).textContent).toBe('Nothing has gone out today.')
    cleanup()
    renderWithProviders(<WentOutToday pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => Promise.reject(new Error('down')))} />)
    expect((await screen.findByText('What went out could not be read.')).textContent).toBeTruthy()
  })
})
