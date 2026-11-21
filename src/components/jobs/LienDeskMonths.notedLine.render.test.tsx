// @vitest-environment jsdom
/**
 * The line that says who noted a closed window, on a phone (v2.8074, from the audit of punch list #361). It was held
 * to one line by an inline style, which beats the narrow card's container rule, so a full name ran out of the month's
 * column into the tick's: under the tick itself at 320 px. The one line is a class now and the narrow card lets it wrap.
 * jsdom lays nothing out, so this holds the two facts the layout rests on: no inline `white-space` on the line, and the
 * rule that lets it wrap inside the narrow card's block of `index.css`. The widths were measured in a browser.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienDeskMonths from './LienDeskMonths'
import type { LienMonthGrid } from '../../lib/jobs/lienMonthGrid'

afterEach(cleanup)

const grid: LienMonthGrid = {
  papers: [{ key: 'this', letter: 'A', kind: 'this', sentOn: '', byHand: false, amount: 0, printedClaim: null, packetOthers: 0, months: [], method: '', documentUrl: '', documentNote: '', pile: 'missed' }],
  rows: [
    {
      month: '2026-07',
      hours: 40,
      crew: '3 people · 4 days',
      fromCreation: false,
      pendingOnly: false,
      cells: { this: 'blank' },
      thisNotice: { on: false, locked: true, info: false, late: false },
      window: { state: 'closed', deadline: '2026-10-15', daysLeft: -36, noticed: false, noted: true, notedBy: 'Christopher Montgomery', notedAt: '2026-11-17T16:00:00Z', skipped: false, skipReason: '', skippedBy: '' },
    },
  ],
  earliestOpen: null,
  lateUntil: null,
}

describe('LienDeskMonths, the noted line on a narrow card (v2.8074)', () => {
  it('keeps the noted line to one line by a class, never an inline style, so the narrow card can let it wrap', () => {
    renderWithProviders(<LienDeskMonths headless grid={grid} claim="$1,000" onToggle={vi.fn()} />)
    const line = document.querySelector('[data-lien-grid-row="2026-07"] .lienLedgerNoted') as HTMLElement
    expect(line.textContent).toBe('noted by Christopher Montgomery Nov 17')
    expect(line.style.whiteSpace).toBe('')
  })

  it('lets it wrap inside the month’s column in the narrow card’s rules', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    expect(css).toMatch(/\n\.lienLedgerNoted \{ white-space: nowrap; \}/)
    const narrow = css.slice(css.indexOf('@container lien-months (max-width: 560px)'))
    const block = narrow.slice(0, narrow.indexOf('\n}\n'))
    expect(block).toMatch(/\.lienMonthClosed > \.lienLedgerNoted \{[^}]*min-width: 0;[^}]*white-space: normal;[^}]*\}/)
  })
})
