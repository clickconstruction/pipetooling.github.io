// @vitest-environment jsdom
/**
 * This notice's column stays in reach (v2.8116, the owner's pick of 2026-11-20 on the audit of punch list #361). With two
 * or more earlier papers the grid is wider than the card and slides inside its frame, and the column with the ticks was
 * the part that left. It is pinned to the frame's right edge now, and the frame says when it slides so the column can
 * draw its edge. jsdom lays nothing out, so this holds what the layout rests on: the frame's `data-slides` read from its
 * own widths, and the rules in `index.css`. The widths were measured in a browser.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienDeskMonths from './LienDeskMonths'
import type { LienMonthGrid } from '../../lib/jobs/lienMonthGrid'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const grid: LienMonthGrid = {
  papers: [{ key: 'this', letter: 'A', kind: 'this', sentOn: '', byHand: false, amount: 0, printedClaim: null, packetOthers: 0, months: [], method: '', documentUrl: '', documentNote: '', pile: 'to_draft' }],
  rows: [
    {
      month: '2026-10',
      hours: 40,
      crew: '3 people · 4 days',
      fromCreation: false,
      pendingOnly: false,
      cells: { this: 'blank' },
      thisNotice: { on: false, locked: false, info: false, late: false },
      window: { state: 'open', deadline: '2027-01-15', daysLeft: 56, noticed: false, noted: false, notedBy: '', notedAt: '', skipped: false, skipReason: '', skippedBy: '' },
    },
  ],
  earliestOpen: null,
  lateUntil: null,
}

const frame = () => document.querySelector('.lienLedgerGridFrame') as HTMLElement

describe('LienDeskMonths, the pinned column of this notice (v2.8116)', () => {
  it('says nothing on the frame while the grid fits it', () => {
    renderWithProviders(<LienDeskMonths headless grid={grid} claim="$1,000" onToggle={vi.fn()} />)
    expect(frame().hasAttribute('data-slides')).toBe(false)
  })

  it('marks the frame when the grid is wider than it', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(785)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(655)
    renderWithProviders(<LienDeskMonths headless grid={grid} claim="$1,000" onToggle={vi.fn()} />)
    expect(frame().getAttribute('data-slides')).toBe('yes')
  })

  it('pins the column at a desk, opaque under its tints, and lets a stacked row keep its own grid', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    expect(css).toMatch(/\n\.lienLedgerGrid th\[data-col='this'\], \.lienLedgerGrid td\[data-col='this'\] \{ position: sticky; right: 0; z-index: 1; \}/)
    expect(css).toMatch(/\n\.lienLedgerGrid td\[data-col='this'\] \{ background: var\(--surface\); \}/)
    expect(css).toMatch(/\.lienLedgerGridFrame\[data-slides='yes'\] \.lienLedgerGrid th\[data-col='this'\][^{]*\{ box-shadow: inset 1px 0 0 var\(--border-strong\); \}/)
    const narrow = css.slice(css.indexOf('@container lien-months (max-width: 560px)'))
    const block = narrow.slice(0, narrow.indexOf('\n}\n'))
    expect(block).toMatch(/\.lienLedgerGrid th\[data-col='this'\], \.lienLedgerGrid td\[data-col='this'\] \{ position: static; \}/)
  })
})
