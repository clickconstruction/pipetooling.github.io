// @vitest-environment jsdom
/**
 * Waiting on them (v2.5704, punch list #139 PR 12) over a fake read: the quiet people longest first, our last words
 * and the day, the chip over Nudge and Call (v2.5790); Nudge opens the thread with the nudge asked and the name opens it as it is; Call dials; a
 * last text Quo could not deliver draws the row red with Call them and Send it as an email (#140 PR 4); the empty lane
 * and a failed read say so. Heard back ▾ (v2.6500): the menu's four ways, the row gone at once with Undo on the toast,
 * Undo bringing it back with nothing written, the line written once the time passes, a refused write putting the
 * row back with its reason.
 */
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
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
  { id: 'k1', contactId: 'c-kim', name: 'Kim Corl', kind: 'customer', direction: 'out', body: 'Kim, the water heater is on the truck for Tuesday.', atMs: Date.parse('2026-10-14T20:00:00Z'), number: null },
]

describe('WaitingOnThem', { timeout: 15_000 }, () => {
  it('lists the quiet people longest first with the chip over the presses, and Nudge or the name opens the thread, Call dials', async () => {
    const onOpenThread = vi.fn()
    renderWithProviders(<WaitingOnThem pill="all" onOpenThread={onOpenThread} io={vi.fn(async () => LINES)} now={() => NOW} />)
    const rows = await screen.findAllByTestId('waiting-row')
    expect(rows.map((r) => r.textContent)).toEqual(['Kim CorlUs · Kim, the water heater is on the truck for Tuesday. · Wed, Oct 14Their move · 6 dNudgeHeard back ▾', 'Dana WhitfieldUs · Dana, your estimate is ready, $4,860.00. · Sun, Oct 18Their move · 2 dNudgeHeard back ▾☎ Call'])
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
  it('counts nothing until a read lands: the band says … while it hangs and after it fails, and the bar hears no false 0 (punch list #183 PR 5)', async () => {
    const onCount = vi.fn()
    renderWithProviders(<WaitingOnThem pill="all" onOpenThread={vi.fn()} io={vi.fn(() => new Promise<WaitLine[]>(() => {}))} now={() => NOW} onCount={onCount} />)
    const band = () => document.querySelector('[data-testid="waiting-on-them"] .stagesBandCount')!.textContent
    expect(band()).toBe('…')
    expect(screen.getByRole('heading', { name: 'Waiting on them' })).toBeTruthy()
    expect(onCount).not.toHaveBeenCalled()
    cleanup()
    renderWithProviders(<WaitingOnThem pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => Promise.reject(new Error('down')))} now={() => NOW} onCount={onCount} />)
    await screen.findByText('Who went quiet could not be read.')
    expect(band()).toBe('…')
    expect(onCount).not.toHaveBeenCalled()
    cleanup()
    renderWithProviders(<WaitingOnThem pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => [])} now={() => NOW} onCount={onCount} />)
    await screen.findByTestId('waiting-empty')
    expect(band()).toBe('0')
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(0))
  })
  it('Heard back ▾ offers the four ways; a pick clears the row at once with Undo on the toast, and the line is written once the time passes (v2.6500)', async () => {
    const write = vi.fn(async () => {})
    const onCount = vi.fn()
    renderWithProviders(<WaitingOnThem pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => LINES)} write={write} undoMs={60} now={() => NOW} onCount={onCount} />)
    await screen.findAllByTestId('waiting-row')
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(2))
    fireEvent.click(screen.getAllByTestId('waiting-heard')[1]!)
    const menu = screen.getByRole('menu', { name: 'How you heard back from Dana Whitfield' })
    expect(Array.from(menu.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['By phone', 'By text from my phone', 'In person', 'No answer needed'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'By phone' }))
    expect(screen.getAllByTestId('waiting-row').map((r) => r.textContent?.slice(0, 7))).toEqual(['Kim Cor'])
    await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1))
    expect(screen.getByText('Heard back from Dana Whitfield by phone. The line lands on the thread in ten seconds.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy()
    expect(write).not.toHaveBeenCalled()
    await waitFor(() => expect(write).toHaveBeenCalledWith('c-dana', 'phone'))
    expect(screen.getAllByTestId('waiting-row')).toHaveLength(1)
  })
  it('Undo brings the row back and writes nothing; a refused write puts the row back with its reason', async () => {
    const write = vi.fn(async () => {})
    renderWithProviders(<WaitingOnThem pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => LINES)} write={write} undoMs={60} now={() => NOW} />)
    await screen.findAllByTestId('waiting-row')
    fireEvent.click(screen.getAllByTestId('waiting-heard')[0]!)
    fireEvent.click(screen.getByRole('menuitem', { name: 'No answer needed' }))
    expect(screen.getAllByTestId('waiting-row')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getAllByTestId('waiting-row')).toHaveLength(2)
    expect(screen.getByText('Undone. Kim Corl is back in Waiting on them.')).toBeTruthy()
    await act(() => new Promise((r) => setTimeout(r, 120)))
    expect(write).not.toHaveBeenCalled()
    cleanup()
    const refused = vi.fn(async () => {
      throw new Error('Could not write that you heard back.')
    })
    renderWithProviders(<WaitingOnThem pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => LINES)} write={refused} undoMs={20} now={() => NOW} />)
    await screen.findAllByTestId('waiting-row')
    fireEvent.click(screen.getAllByTestId('waiting-heard')[0]!)
    fireEvent.click(screen.getByRole('menuitem', { name: 'In person' }))
    expect(screen.getAllByTestId('waiting-row')).toHaveLength(1)
    await waitFor(() => expect(refused).toHaveBeenCalledWith('c-kim', 'person'))
    await waitFor(() => expect(screen.getAllByTestId('waiting-row')).toHaveLength(2))
    expect(screen.getByText('Could not write that you heard back.')).toBeTruthy()
  })
  it('leaving the page writes a Heard back still inside its Undo time', async () => {
    const write = vi.fn(async () => {})
    renderWithProviders(<WaitingOnThem pill="all" onOpenThread={vi.fn()} io={vi.fn(async () => LINES)} write={write} undoMs={10_000} now={() => NOW} />)
    await screen.findAllByTestId('waiting-row')
    fireEvent.click(screen.getAllByTestId('waiting-heard')[0]!)
    fireEvent.click(screen.getByRole('menuitem', { name: 'By text from my phone' }))
    expect(write).not.toHaveBeenCalled()
    cleanup()
    expect(write).toHaveBeenCalledWith('c-kim', 'text')
  })
})
