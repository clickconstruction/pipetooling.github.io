// @vitest-environment jsdom
/**
 * This notice's column is drawn where it says something (v2.8125, found on the live walk of the audit of punch list #361):
 * a month can be ticked, or one is ticked already. A missed notice with nothing due had neither, and the card still drew
 * a *This notice* column of empty locked boxes for a notice nobody is drafting. v2.8064 took the same column off a notice
 * that went. A notice past editing keeps its column, since it shows the months that notice carries.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienDeskMonths from './LienDeskMonths'
import type { LienGridPaper, LienGridRow, LienMonthGrid } from '../../lib/jobs/lienMonthGrid'

afterEach(cleanup)

const thisPaper: LienGridPaper = { key: 'this', letter: 'B', kind: 'this', sentOn: '', byHand: false, amount: 0, printedClaim: null, packetOthers: 0, months: [], method: '', documentUrl: '', documentNote: '', pile: 'missed' }
const paperA: LienGridPaper = { key: 'f1', letter: 'A', kind: 'filing', sentOn: '2026-10-14', byHand: false, amount: 2_650, printedClaim: null, packetOthers: 0, months: ['2026-08'], method: 'certified_mail', documentUrl: '', documentNote: '', pile: '' }

function row(month: string, thisNotice: LienGridRow['thisNotice'], cells: LienGridRow['cells'], window: Partial<LienGridRow['window']>): LienGridRow {
  return {
    month,
    hours: 40,
    crew: '',
    fromCreation: false,
    pendingOnly: false,
    cells,
    thisNotice,
    window: { state: 'closed', deadline: '2026-10-15', daysLeft: -36, noticed: false, noted: false, notedBy: '', notedAt: '', skipped: false, skipReason: '', skippedBy: '', ...window },
  }
}

/** The live notice of the walk: July closed and missed, August named in time by paper A, nothing due, nothing ticked. */
const missed = (): LienMonthGrid => ({
  papers: [paperA, thisPaper],
  rows: [
    row('2026-07', { on: false, locked: true, info: false, late: false }, { f1: 'blank', this: 'blank' }, {}),
    row('2026-08', { on: false, locked: true, info: false, late: false }, { f1: 'named', this: 'blank' }, { deadline: '2026-11-16', daysLeft: -4, noticed: true }),
  ],
  earliestOpen: null,
  lateUntil: null,
})

const mount = (grid: LienMonthGrid) => {
  renderWithProviders(<LienDeskMonths headless grid={grid} claim="$2,650" onToggle={vi.fn()} />)
  return document.querySelector('[data-lien-desk-months]') as HTMLElement
}

describe('LienDeskMonths, the column of this notice only where it says something (v2.8125)', () => {
  it('draws no column on a missed notice with nothing due and nothing ticked', () => {
    const card = mount(missed())
    expect(card.querySelector('[data-lien-grid-paper="this"]')).toBeNull()
    expect(card.querySelector('td[data-col="this"]')).toBeNull()
    expect(card.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect((card.querySelector('table') as HTMLElement).getAttribute('data-this')).toBe('no')
    // The earlier paper keeps its column and the lead keeps its sentence about a check.
    expect(card.querySelector('[data-lien-grid-paper="A"]')).not.toBeNull()
    expect((card.querySelector('[data-lien-ledger-lead]') as HTMLElement).textContent).toBe('A check is a paper that already names the month.')
  })

  it('draws the column when the late window lets a closed month be ticked', () => {
    const grid = missed()
    grid.rows[0] = { ...grid.rows[0]!, thisNotice: { on: true, locked: false, info: false, late: true }, cells: { f1: 'blank', this: 'named' } }
    const card = mount({ ...grid, lateUntil: '2026-12-15' })
    expect(card.querySelector('[data-lien-grid-paper="this"]')).not.toBeNull()
    expect((card.querySelector('table') as HTMLElement).getAttribute('data-this')).toBe('yes')
  })

  it('keeps the column on a notice past editing, which shows the months it carries', () => {
    const grid = missed()
    grid.rows[0] = { ...grid.rows[0]!, thisNotice: { on: true, locked: true, info: true, late: false }, cells: { f1: 'blank', this: 'info' } }
    const card = mount(grid)
    expect(card.querySelector('[data-lien-grid-paper="this"]')).not.toBeNull()
    expect((card.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(true)
    expect(card.textContent).not.toContain('Tick a month')
  })
})
