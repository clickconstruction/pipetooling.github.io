// @vitest-environment jsdom
/**
 * The Months card's Window column on a closed month a paper names (v2.8063). The words follow the
 * paper's cell: a paper that went on or before the deadline named the month in time, and only one that
 * went after named it as information. Before, every such month read "named after the window —
 * information", beside a green check that said in time.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienDeskMonths from './LienDeskMonths'
import type { LienGridPaper, LienGridRow, LienMonthGrid } from '../../lib/jobs/lienMonthGrid'

afterEach(cleanup)

function row(month: string, over: Omit<Partial<LienGridRow>, 'window'> & { window?: Partial<LienGridRow['window']> } = {}): LienGridRow {
  const { window: w, ...rest } = over
  return {
    month,
    hours: 40,
    crew: '3 people · 4 days',
    fromCreation: false,
    pendingOnly: false,
    cells: { this: 'blank' },
    thisNotice: { on: false, locked: true, info: false, late: false },
    ...rest,
    window: { state: 'closed', deadline: '2026-10-15', daysLeft: -36, noticed: true, noted: false, notedBy: '', notedAt: '', skipped: false, skipReason: '', skippedBy: '', ...w },
  }
}

// The live case: a paper sent Sep 22 names July (closed Sep 15, so as information) and August (closed Oct 15, so in time).
const paperA: LienGridPaper = { key: 'f1', letter: 'A', kind: 'filing', sentOn: '2026-09-22', byHand: true, amount: 17_585, printedClaim: null, packetOthers: 0, months: ['2026-07', '2026-08'], method: 'mail', documentUrl: '', documentNote: '', pile: '' }
const thisPaper: LienGridPaper = { key: 'this', letter: 'B', kind: 'this', sentOn: '', byHand: false, amount: 0, printedClaim: null, packetOthers: 0, months: [], method: '', documentUrl: '', documentNote: '', pile: 'to_draft' }

function mount(rows: LienGridRow[]) {
  const grid: LienMonthGrid = { papers: [paperA, thisPaper], rows, earliestOpen: null, lateUntil: null }
  renderWithProviders(<LienDeskMonths headless grid={grid} claim="$1,000" onToggle={vi.fn()} />)
  const card = document.querySelector('[data-lien-desk-months]') as HTMLElement
  return (month: string) => card.querySelector(`[data-lien-grid-row="${month}"]`) as HTMLElement
}

describe('LienDeskMonths · a closed month a paper names says whether it was in time (v2.8063)', () => {
  it('a month the paper named before its deadline reads named in time, beside its plain check', () => {
    const at = mount([row('2026-08', { cells: { f1: 'named', this: 'blank' } })])
    const aug = at('2026-08')
    expect((aug.querySelector('td[data-col="paper"]') as HTMLElement).getAttribute('data-cell')).toBe('named')
    const win = aug.querySelector('.lienMonthClosed') as HTMLElement
    expect(win.textContent).toBe('closed Oct 15named in time')
    expect(win.textContent).not.toContain('after the window')
    expect(win.textContent).not.toContain('information')
    expect((win.querySelector('.lienMonthClosedTail') as HTMLElement).getAttribute('title')).toBe('named in time')
    // Not a missed month: no red row.
    expect(aug.getAttribute('data-missed')).toBeNull()
  })

  it('a month the paper named after its deadline keeps named after the window — information', () => {
    const at = mount([row('2026-07', { cells: { f1: 'info', this: 'blank' }, window: { deadline: '2026-09-15', daysLeft: -66 } })])
    const jul = at('2026-07')
    expect((jul.querySelector('td[data-col="paper"]') as HTMLElement).getAttribute('data-cell')).toBe('info')
    const win = jul.querySelector('.lienMonthClosed') as HTMLElement
    expect(win.textContent).toBe('closed Sep 15named after the window — information')
    expect(win.textContent).not.toContain('in time')
    expect((win.querySelector('.lienMonthClosedTail') as HTMLElement).getAttribute('title')).toBe('named after the window — information')
  })

  it('the two stand side by side on one card, each with its own words, and a month no loaded paper names claims neither', () => {
    const at = mount([
      row('2026-06', { cells: { f1: 'blank', this: 'blank' }, window: { deadline: '2026-08-17', daysLeft: -95 } }),
      row('2026-07', { cells: { f1: 'info', this: 'blank' }, window: { deadline: '2026-09-15', daysLeft: -66 } }),
      row('2026-08', { cells: { f1: 'named', this: 'blank' } }),
    ])
    expect((at('2026-06').querySelector('.lienMonthClosedTail') as HTMLElement).textContent).toBe('a notice names it')
    expect((at('2026-07').querySelector('.lienMonthClosedTail') as HTMLElement).textContent).toBe('named after the window — information')
    expect((at('2026-08').querySelector('.lienMonthClosedTail') as HTMLElement).textContent).toBe('named in time')
  })
})
