// @vitest-environment jsdom
/**
 * The lien month on the Dashboard (punch list #235, PR 3): nothing without a month; the strip's five
 * zones by their days with today marked; the zone now, what slipped and next month's queue; the door
 * to the desk.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DashboardLienMonthCard } from './DashboardLienMonthCard'
import { buildLienMonth } from '../../lib/jobs/lienMonthRhythm'
import type { LienDeskEntry } from '../../lib/jobs/lienDesk'
import type { CourtesyStatus } from '../../lib/jobs/lienCourtesyNotice'

afterEach(cleanup)

const notice = (over: Partial<LienDeskEntry> & { jobId: string }): LienDeskEntry => ({
  customerId: null, gcCustomerId: 'gc1', openBalance: 1000, hasOwner: true, propertyKind: 'non_residential',
  months: [{ key: '2026-08', approvedHours: 10, deadline: '2026-11-16', daysLeft: 9, noticed: false, fromCreation: false }],
  datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], earliestDeadline: '2026-11-16', daysLeft: 9, severity: 'amber', item: null, policy: 'ask', pile: 'to_draft', ...over,
})
const courtesy = (over: Partial<CourtesyStatus> = {}): CourtesyStatus => ({ state: 'due', day: 21, words: 'day 21', reason: '', lastSentAt: null, waitingForAnswer: false, lienDay: '2026-11-16', records: [], ...over })
const titles: Record<string, string> = { a: 'Ridgeway Builders · 650', b: 'Caldwell Mechanical · 890' }
const month = (todayYmd: string) =>
  buildLienMonth({ todayYmd, notices: [notice({ jobId: 'a' }), notice({ jobId: 'b', earliestDeadline: '2026-12-15' })], affidavits: [], courtesyByJob: { a: courtesy() }, serveDue: [{ jobId: 'a' }], jobTitle: (id) => titles[id] ?? id })

const draw = (m: ReturnType<typeof month> | null) => render(<MemoryRouter><DashboardLienMonthCard month={m} /></MemoryRouter>)

describe('DashboardLienMonthCard', () => {
  it('renders nothing without a month', () => {
    const { container } = draw(null)
    expect(container.querySelector('[data-testid="lien-month-card"]')).toBeNull()
  })

  it('in notices week: the strip by days with today marked, the zone now with its counts, nothing slipped, the copies, next month, and the door to the desk', () => {
    draw(month('2026-11-07'))
    const card = screen.getByTestId('lien-month-card')
    expect(card.textContent).toContain('The lien month')
    expect(card.textContent).toContain('November 2026 · day 7')
    expect(screen.getByTestId('lien-month-card-today').style.left).toBe('21.7%')
    expect(['reminders', 'notices', 'liens', 'catch_up', 'quiet'].map((k) => screen.getByTestId(`lien-month-card-zone-${k}`).getAttribute('data-tone'))).toEqual(['slipped', 'now', 'ahead', 'slipped', 'quiet'])
    expect(screen.getByTestId('lien-month-card-now').textContent).toBe('Noticesdays 6 to 91 to send · 0 sent1 to draft')
    expect(screen.getByTestId('lien-month-card-slipped').textContent).toBe('1 slippedRidgeway Builders · 650· 1 copy to mail')
    expect(screen.getByTestId('lien-month-card-next').textContent).toBe('Next month1 notice')
    expect(screen.getByTestId('lien-month-card-desk').getAttribute('href')).toBe('/lien-desk')
  })

  it('a clean quiet zone reads green', () => {
    draw(buildLienMonth({ todayYmd: '2026-11-20', notices: [], affidavits: [], courtesyByJob: {}, jobTitle: (id) => id }))
    expect(screen.getByTestId('lien-month-card-slipped').textContent).toBe('nothing slipped')
    expect(screen.getByTestId('lien-month-card-now').textContent).toContain('Nothing scheduled')
    expect(screen.getByTestId('lien-month-card-next').textContent).toBe('Next monthnothing queuing yet')
  })
})
