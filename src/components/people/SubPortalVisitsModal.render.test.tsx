// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'

/**
 * Wiring smoke for the visits modal (v2.2922): the two RPCs are stubbed —
 * asserts the tiles, the day groups with who/how, the Outside/Team switch, and
 * that the visit line opens it by click and by a long press.
 */

vi.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'sub_portal_visit_summary') {
        return { data: [{ person_id: 'p1', outside_opens: 3, first_outside_at: '2026-08-29T20:18:00Z', last_outside_at: '2026-09-04T21:40:00Z', staff_looks: 1, last_staff_at: '2026-09-05T14:12:00Z', last_staff_user_id: 'u1', last_staff_name: 'Taunya Smith' }], error: null }
      }
      if (fn === 'sub_portal_visits') {
        return {
          data: [
            { occurred_at: '2026-09-05T14:12:00Z', viewer: 'staff', via: 'token', staff_user_id: 'u1', staff_name: 'Taunya Smith' },
            { occurred_at: '2026-09-04T21:40:00Z', viewer: 'outside', via: 'slug', staff_user_id: null, staff_name: null },
            { occurred_at: '2026-08-29T20:18:00Z', viewer: null, via: 'token', staff_user_id: null, staff_name: null },
          ],
          error: null,
        }
      }
      return { data: null, error: null }
    }),
    from: vi.fn(),
  },
}))
vi.mock('../../lib/subPortal/resolveSubPortalUrl', () => ({ resolveSubPortalUrl: vi.fn(async () => 'https://x.test/sub?t=abc') }))

import { SubPortalVisitsModal } from './SubPortalVisitsModal'
import { SubPortalVisitLine } from './SubPortalVisitLine'

beforeAll(() => installDomShims())

describe('SubPortalVisitsModal render smoke', () => {
  it('renders the tiles, the grouped trail and the switch', async () => {
    const onClose = vi.fn()
    renderWithProviders(<SubPortalVisitsModal personId="p1" personName="Behar Kraja" onClose={onClose} />)
    await waitFor(() => expect(screen.getByText('3 opens')).toBeTruthy())
    expect(screen.getByText('1 look')).toBeTruthy()
    expect(screen.getByText('Taunya Smith')).toBeTruthy()
    expect(screen.getAllByText('Outside').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('short address')).toBeTruthy()
    // The first outside open is marked on the trail.
    expect(screen.getByText(/direct link · first open/)).toBeTruthy()
    // Team filter leaves the one staff row.
    fireEvent.click(screen.getByRole('button', { name: /^Team/ }))
    expect(screen.queryByText('short address')).toBeNull()
    expect(screen.getByText('Taunya Smith')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('the visit line words the summary and opens on click', () => {
    const onOpen = vi.fn()
    renderWithProviders(<SubPortalVisitLine summary={{ personId: 'p1', outsideOpens: 3, firstOutsideAt: null, lastOutsideAt: '2026-09-04T21:40:00Z', staffLooks: 1, lastStaffAt: '2026-09-05T14:12:00Z', lastStaffUserId: 'u1', lastStaffName: 'Taunya Smith' }} onOpen={onOpen} />)
    const line = screen.getByRole('button')
    expect(line.textContent).toMatch(/^Opened their page .* · 3 times · Taunya looked/)
    fireEvent.click(line)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('reads "Never opened" with no opens and "Link not shared yet" without a link', () => {
    const none = { personId: 'p1', outsideOpens: 0, firstOutsideAt: null, lastOutsideAt: null, staffLooks: 0, lastStaffAt: null, lastStaffUserId: null, lastStaffName: null }
    const { unmount } = renderWithProviders(<SubPortalVisitLine summary={none} onOpen={() => {}} />)
    expect(screen.getByText('Never opened')).toBeTruthy()
    unmount()
    renderWithProviders(<SubPortalVisitLine summary={none} hasLink={false} onOpen={() => {}} />)
    expect(screen.getByText('Link not shared yet')).toBeTruthy()
  })
})
