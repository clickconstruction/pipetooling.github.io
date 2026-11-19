// @vitest-environment jsdom
/**
 * Render smoke for the Board's two column headings (the owner's pick of 2026-11-18): both the muted grey, on a
 * computer and on a phone, so that red on the Board only means a late day.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import LienBoard, { LIEN_BOARD_COLUMN_HEAD_COLOR } from './LienBoard'
import { buildLienBoard } from '../../lib/jobs/lienBoard'
import type { LienDeskEntry, LienDeskPile } from '../../lib/jobs/lienDesk'
import type { LienAffidavitEntry, LienAffidavitPile } from '../../lib/jobs/lienDeskAffidavits'

afterEach(cleanup)

function notice(jobId: string, pile: LienDeskPile, over: Partial<LienDeskEntry> = {}): LienDeskEntry {
  return { jobId, customerId: 'c1', gcCustomerId: 'gc1', openBalance: 1000, hasOwner: true, propertyKind: '', months: [], datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], affidavitDay: null, affidavitDaysLeft: null, earliestDeadline: '2026-11-16', daysLeft: 1, severity: 'red', item: null, policy: 'ask', pile, ...over }
}
function affidavit(jobId: string, pile: LienAffidavitPile, over: Partial<LienAffidavitEntry> = {}): LienAffidavitEntry {
  return { jobId, isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-12-15', daysLeft: 30, severity: 'quiet', openBalance: 1000, customerId: 'c1', gcCustomerId: 'gc1', propertyKind: '', gates: [{ key: 'owner', ok: true, label: 'owner' }], ready: true, item: null, pile, ...over }
}
const board = () =>
  buildLienBoard({
    todayYmd: '2026-11-15',
    // One notice a day late and one affidavit due tomorrow: red chips under both headings.
    notices: [notice('2104', 'to_draft', { earliestDeadline: '2026-11-14', daysLeft: -1 })],
    affidavits: [affidavit('2111', 'ready', { deadline: '2026-11-16', daysLeft: 1 })],
    retainage: [],
    jobNumber: (id) => id,
    jobName: (id) => `Job ${id}`,
    gcName: () => 'Alder Ridge Builders',
    leaderName: 'Sam',
  })

const headings = () => Array.from(document.querySelectorAll<HTMLElement>('[data-lien-board-heading] h3')).map((h) => [h.textContent, h.style.color])

describe('LienBoard · both column headings are grey (the owner’s pick of 2026-11-18)', () => {
  it('draws Monthly notices and Lien affidavits in the muted token, never blue or red', () => {
    render(<LienBoard board={board()} isMobile={false} columnsOnly />)
    expect(LIEN_BOARD_COLUMN_HEAD_COLOR).toBe('var(--text-muted)')
    expect(headings()).toEqual([
      ['Monthly notices', 'var(--text-muted)'],
      ['Lien affidavits', 'var(--text-muted)'],
    ])
  })

  it('leaves red to the late day: the late chip is still red under a grey heading', () => {
    render(<LienBoard board={board()} isMobile={false} columnsOnly />)
    const late = document.querySelector<HTMLElement>('[data-lien-board-chip="2104"]')!
    expect(late.getAttribute('data-urgency')).toBe('day')
    expect(late.style.color).toBe('var(--text-red-700)')
  })

  it('is the same on a phone with the bins opened', () => {
    render(<LienBoard board={board()} isMobile />)
    expect(headings().map(([, colour]) => colour)).toEqual(['var(--text-muted)', 'var(--text-muted)'])
  })
})
