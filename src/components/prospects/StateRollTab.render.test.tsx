// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { PullRow } from '../../lib/licenseRoll/rollPulls'
import type { RollPullsRead } from '../../lib/licenseRoll/rollPullsIo'

/**
 * Prospects → State roll, the Pulls view (punch list #411). What is kept, a card a state file, the press that pulls
 * every file in turn and goes on past one that fails, and the first-run empty state. Every count here is made up,
 * and the view names no person.
 */
const io = vi.hoisted(() => ({ readRollPulls: vi.fn(), pullRollFile: vi.fn() }))
vi.mock('../../lib/licenseRoll/rollPullsIo', () => io)

import { StateRollTab } from './StateRollTab'

function pull(file: string, over: Partial<PullRow> = {}): PullRow {
  return { id: `p-${file}`, file, started_at: '2026-11-16T12:40:00Z', finished_at: '2026-11-16T12:40:03Z', rows_seen: 1000, rows_kept: 120, added: 4, changed: 31, gone: 9, error: '', ...over }
}
function read(over: Partial<RollPullsRead> = {}): RollPullsRead {
  return {
    pulls: [pull('RMP'), pull('MP'), pull('JP', { rows_seen: 26000, rows_kept: 4010 }), pull('TP', { added: 0, changed: 0, gone: 0 })],
    kept: { journeyman: 4010, master: 1825, tradesman: 672 },
    lapsed: 818,
    counties: ['TRAVIS', 'BEXAR', 'HAYS', 'COMAL', 'GUADALUPE'],
    ...over,
  }
}
const file = (key: string) => document.querySelector(`[data-roll-file="${key}"]`) as HTMLElement

describe('StateRollTab · Pulls', () => {
  beforeEach(() => {
    io.readRollPulls.mockReset().mockResolvedValue(read())
    io.pullRollFile.mockReset().mockResolvedValue({ ok: true, added: 0, changed: 0, gone: 0, kept: 1 })
  })
  afterEach(cleanup)

  it('says what is kept and for which counties, and that the state gives no way to reach a person', async () => {
    renderWithProviders(<StateRollTab />)
    await screen.findByText('Bexar, Comal, Guadalupe, Hays and Travis')
    expect(screen.getByText(/The state gives no phone, street address or email for a person/)).toBeTruthy()
    // The journeymen's tile and the journeyman file's card both carry the count, each as a value.
    expect(screen.getAllByText('4,010').every((el) => el.getAttribute('data-value') === 'worked-out')).toBe(true)
    expect(screen.getByText('journeymen kept')).toBeTruthy()
    expect(screen.getByText('1,825')).toBeTruthy()
    expect(screen.getByText('818')).toBeTruthy()
  })

  it('draws a card a state file, each value apart from its words', async () => {
    renderWithProviders(<StateRollTab />)
    await screen.findByText('Plumbing · journeyman')
    expect(['RMP', 'MP', 'JP', 'TP'].every((k) => file(k))).toBe(true)
    const jp = file('JP')
    expect(jp.textContent).toContain('4,010 of the 26,000 in the state’s file'.replace('’', "'"))
    expect(jp.textContent).toContain('4 new · 31 changed · 9 gone')
    expect(jp.querySelectorAll('[data-value="worked-out"]').length).toBeGreaterThanOrEqual(5)
    expect(file('TP').textContent).toContain('Nothing changed')
  })

  it('keeps the last clean read on a file whose newest read failed, and gives the reason', async () => {
    io.readRollPulls.mockResolvedValue(read({ pulls: [pull('JP', { id: 'bad', started_at: '2026-11-23T12:40:00Z', error: 'The board answered 503 for its JP file.' }), pull('JP')] }))
    renderWithProviders(<StateRollTab />)
    await screen.findByText('Plumbing · journeyman')
    expect(file('JP').textContent).toContain('4 new · 31 changed · 9 gone')
    expect(file('JP').textContent).toContain('The board answered 503 for its JP file.')
    expect(file('MP').textContent).toContain('Not read yet.')
  })

  it('pulls every file in turn, goes on past one that fails, and names it with its reason', async () => {
    io.pullRollFile.mockImplementation(async (key: string) => (key === 'MP' ? { ok: false, why: 'The board answered 503 for its MP file.' } : { ok: true, added: 1, changed: 0, gone: 0, kept: 1 }))
    renderWithProviders(<StateRollTab />)
    fireEvent.click(await screen.findByRole('button', { name: 'Pull 4 files' }))
    await waitFor(() => expect(io.pullRollFile).toHaveBeenCalledTimes(4))
    expect(io.pullRollFile.mock.calls.map((c) => c[0])).toEqual(['RMP', 'MP', 'JP', 'TP'])
    await screen.findByText('Pulled 3 files. 1 did not pull.')
    expect(screen.getByText(/1 file did not pull/)).toBeTruthy()
    expect(screen.getAllByText(/The board answered 503 for its MP file\./).length).toBeGreaterThan(0)
    await waitFor(() => expect(io.readRollPulls).toHaveBeenCalledTimes(2))
  })

  it('before any pull, says what fills the page and offers the press', async () => {
    io.readRollPulls.mockResolvedValue(read({ pulls: [], kept: {}, lapsed: 0 }))
    renderWithProviders(<StateRollTab />)
    const press = await screen.findByRole('button', { name: 'Pull 4 files' })
    expect(document.querySelector('[data-roll-file]')).toBeNull()
    expect(screen.queryByText('journeymen kept')).toBeNull()
    fireEvent.click(press)
    await waitFor(() => expect(io.pullRollFile).toHaveBeenCalledTimes(4))
  })

  it('says why when the roll cannot be read, and reads again on the press', async () => {
    io.readRollPulls.mockRejectedValueOnce(new Error('Could not read the pulls: permission denied for table license_roll_pulls'))
    renderWithProviders(<StateRollTab />)
    await screen.findByText('The state roll could not be read.')
    expect(screen.getByText(/permission denied for table license_roll_pulls/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Read it again' }))
    await screen.findByText('Plumbing · journeyman')
  })
})
