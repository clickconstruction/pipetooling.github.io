// @vitest-environment jsdom
/**
 * The lien month across the top of Do now (punch list #235, PR 2): five zones sized by their days,
 * today marked, each zone's counts and press, a pressed zone's Showing line and Show all, the rows
 * on a phone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LienMonthBar } from './LienMonthBar'
import { buildLienMonth } from '../../lib/jobs/lienMonthRhythm'
import type { LienDeskEntry } from '../../lib/jobs/lienDesk'
import type { LienAffidavitEntry } from '../../lib/jobs/lienDeskAffidavits'
import type { CourtesyStatus } from '../../lib/jobs/lienCourtesyNotice'

afterEach(cleanup)

const notice = (over: Partial<LienDeskEntry> & { jobId: string }): LienDeskEntry => ({
  customerId: null, gcCustomerId: 'gc1', openBalance: 1000, hasOwner: true, propertyKind: 'non_residential',
  months: [{ key: '2026-08', approvedHours: 10, deadline: '2026-11-16', daysLeft: 9, noticed: false, fromCreation: false }],
  datedFromCreation: false, dueMonths: ['2026-08'], missedMonths: [], missedUnrecorded: [], earliestDeadline: '2026-11-16', daysLeft: 9, severity: 'amber', item: null, policy: 'ask', pile: 'to_draft', ...over,
})
const affidavit = (over: Partial<LienAffidavitEntry> & { jobId: string }): LienAffidavitEntry => ({
  isSub: true, lastMonth: '2026-07', lastMonthFromCreation: false, deadline: '2026-11-16', daysLeft: 9, severity: 'amber', openBalance: 1000, customerId: null, gcCustomerId: 'gc1', propertyKind: 'non_residential', gates: [], ready: true, item: null, pile: 'ready', ...over,
})
const courtesy = (over: Partial<CourtesyStatus> = {}): CourtesyStatus => ({ state: 'due', day: 21, words: 'day 21', reason: '', lastSentAt: null, waitingForAnswer: false, lienDay: '2026-11-16', records: [], ...over })
const titles: Record<string, string> = { a: 'Ridgeway Builders · 650', b: 'Caldwell Mechanical · 890' }

const month = (todayYmd: string) =>
  buildLienMonth({
    todayYmd,
    notices: [notice({ jobId: 'a' }), notice({ jobId: 'b', pile: 'awaiting' })],
    affidavits: [affidavit({ jobId: 'a' })],
    courtesyByJob: { a: courtesy(), b: courtesy({ state: 'sent', lastSentAt: '2026-11-03T16:00:00Z' }) },
    serveDue: [],
    jobTitle: (id) => titles[id] ?? id,
  })

describe('LienMonthBar', () => {
  it('at 1,400 wide: five zones sized by their days, today marked, the zone now tinted with its counts and press, the rest ahead', () => {
    const onPick = vi.fn()
    render(<LienMonthBar month={month('2026-11-03')} on={null} onPick={onPick} isMobile={false} />)
    const bar = screen.getByTestId('lien-month-bar')
    expect(bar.textContent).toContain('The lien month')
    expect(bar.textContent).toContain('November 2026 · day 3')
    const group = screen.getByRole('group', { name: 'The lien month’s five zones' })
    expect(group.style.gridTemplateColumns).toBe('minmax(120px, 5fr) minmax(120px, 4fr) minmax(120px, 4fr) minmax(104px, 2fr) minmax(120px, 15fr)')
    expect(screen.getByTestId('lien-month-today').style.left).toBe('8.3%')
    expect(['reminders', 'notices', 'liens', 'catch_up', 'quiet'].map((k) => screen.getByTestId(`lien-month-zone-${k}`).getAttribute('data-state'))).toEqual(['now', 'ahead', 'ahead', 'ahead', 'ahead'])
    expect(screen.getByTestId('lien-month-zone-head-reminders').textContent).toBe('1 to send · 1 sent')
    expect(screen.getByTestId('lien-month-zone-press-reminders').textContent).toBe('Show 1 reminder ›')
    expect(screen.getByTestId('lien-month-zone-head-notices').textContent).toBe('2 coming')
    expect(screen.getByTestId('lien-month-zone-sub-notices').textContent).toBe('1 to draft, 1 to approve')
    expect(screen.getByTestId('lien-month-zone-head-catch_up').textContent).toBe('nothing slipped yet')
    expect(screen.getByTestId('lien-month-zone-head-quiet').textContent).toBe('nothing queuing yet')
    // The quiet zone has no press: a plain box, dashed.
    expect(screen.getByTestId('lien-month-zone-quiet').tagName).toBe('DIV')
    expect(screen.getByTestId('lien-month-zone-quiet').style.border).toContain('dashed')
    fireEvent.click(screen.getByTestId('lien-month-zone-reminders'))
    expect(onPick).toHaveBeenCalledWith('reminders')
    expect(screen.queryByTestId('lien-month-showing')).toBeNull()
  })

  it('a pressed zone reads pressed, says what the list shows, and Show all or a second press clears it', () => {
    const onPick = vi.fn()
    render(<LienMonthBar month={month('2026-11-03')} on="reminders" onPick={onPick} isMobile={false} shown={1} total={4} />)
    const zone = screen.getByTestId('lien-month-zone-reminders')
    expect(zone.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('lien-month-zone-press-reminders').textContent).toBe('Show all ›')
    expect(screen.getByTestId('lien-month-showing').textContent).toContain('Showing 1 of 4 · Reminders, days 1 to 5')
    fireEvent.click(screen.getByTestId('lien-month-show-all'))
    expect(onPick).toHaveBeenLastCalledWith(null)
    fireEvent.click(zone)
    expect(onPick).toHaveBeenLastCalledWith(null)
  })

  it('with no row of the zone on the list the line says so', () => {
    render(<LienMonthBar month={month('2026-11-03')} on="liens" onPick={() => {}} isMobile={false} shown={0} total={4} />)
    expect(screen.getByTestId('lien-month-showing').textContent).toContain('Nothing on the list is Liens’s work right now')
  })

  it('in liens week what slipped reads red and is named, and Catch-up carries it', () => {
    render(<LienMonthBar month={month('2026-11-11')} on={null} onPick={() => {}} isMobile={false} />)
    expect(screen.getByTestId('lien-month-zone-reminders').getAttribute('data-tone')).toBe('slipped')
    expect(screen.getByTestId('lien-month-zone-head-reminders').textContent).toBe('1 slipped · 1 sent')
    expect(screen.getByTestId('lien-month-zone-sub-reminders').textContent).toBe('Ridgeway Builders · 650')
    expect(screen.getByTestId('lien-month-zone-head-catch_up').textContent).toBe('3 slipped so far')
    expect(screen.getByTestId('lien-month-zone-press-catch_up').textContent).toBe('Show 3 slips ›')
    expect(screen.getByTestId('lien-month-zone-liens').getAttribute('data-state')).toBe('now')
  })

  it('at 375 wide the zones stack as rows, the zone today is in says so, and there is no today mark', () => {
    render(<LienMonthBar month={month('2026-11-03')} on={null} onPick={() => {}} isMobile />)
    const group = screen.getByRole('group', { name: 'The lien month’s five zones' })
    expect(group.style.gridTemplateColumns).toBe('1fr')
    expect(screen.queryByTestId('lien-month-today')).toBeNull()
    expect(screen.getByTestId('lien-month-zone-reminders').textContent).toContain('today · 1 to 5')
    expect(screen.getByTestId('lien-month-zone-notices').textContent).not.toContain('today')
  })
})
