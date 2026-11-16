// @vitest-environment jsdom
/**
 * The Plans look's By date view: the four figures, the key, a mark's line on a hover, a focus and a press,
 * the dated list with its fold, the print, and the reading and empty states. Made-up site only.
 */
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import { buildPlansByDate, type PlansByDateInput } from '../../lib/plans/plansByDate'
import { DevelopmentPlansByDate, PLANS_BY_DATE_LIST_FOLD } from './DevelopmentPlansByDate'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
// The print window: captured, never opened.
const printed = vi.hoisted(() => ({ html: [] as string[], open: true }))
vi.mock('../../lib/jobsDocuments/printWindow', () => ({
  openHtmlPrintWindow: (html: string) => {
    printed.html.push(html)
    return printed.open
  },
}))

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  printed.html.length = 0
  printed.open = true
})

const toYmd = (raw: string | null | undefined) => (raw && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null)

function site(over: Partial<PlansByDateInput> = {}): PlansByDateInput {
  return {
    parts: [
      { id: 'pA', name: 'ZZ Building A', position: 1, created_at: '2025-05-01T00:00:00Z', current_set_id: 'a2' },
      { id: 'pB', name: 'ZZ Building B', position: 2, created_at: '2025-05-02T00:00:00Z', current_set_id: null },
    ],
    sets: [
      { id: 'a1', part_id: 'pA', name: 'Issued set', kind: 'issued', source: 'gc', dated: '2025-05-20', came_at: '2025-05-22T15:00:00Z', replaces_set_id: null },
      { id: 'a2', part_id: 'pA', name: 'Permit set', kind: 'permit', source: 'gc', dated: '2026-05-08', came_at: '2026-05-12T15:00:00Z', replaces_set_id: null },
    ],
    bids: [{ id: 'bid1', label: 'B9001', sent: '2025-06-12', plansDated: '2025-05-20', outcome: 'won', outcomeAt: '2025-07-30' }],
    jobs: [{ id: 'j1', label: 'J9101', days: ['2025-09-08', '2025-09-09'], firstWorkDay: null, lastWorkDay: '2025-09-09' }],
    history: [{ id: 'h1', happenedAt: '2026-07-14T16:00:00Z', source: 'letter', body: 'Notice of delay sent to the GC.' }],
    clock: 'read',
    today: '2026-11-16',
    toYmd,
    ...over,
  }
}
const print = { siteName: 'ZZ Test Ridge', customerName: 'ZZ Test Builders', printedBy: 'ZZ Test Person' }

describe('DevelopmentPlansByDate', () => {
  it('draws the four figures, the key for the marks on the chart, and a lane name for each lane', () => {
    renderWithProviders(<DevelopmentPlansByDate model={buildPlansByDate(site())} phone={false} print={print} />)
    expect(within(screen.getByTestId('pbd-figure-since')).getByText('1')).toBeTruthy()
    expect(screen.getByTestId('pbd-figure-since').textContent).toContain('of 2, since B9001 was sent Jun 12, 2025')
    expect(screen.getByTestId('pbd-figure-crew').textContent).toContain('Days on site2by the clock')
    const key = screen.getByTestId('pbd-legend').textContent ?? ''
    expect(key).toContain('the set a part builds from')
    expect(key).toContain('a letter')
    expect(key).not.toContain('ours, an as-built')
    const chart = screen.getByTestId('pbd-chart')
    for (const lane of ['Bids', 'ZZ Building A', 'ZZ Building B', 'Crews on site', 'History']) expect(within(chart).getByText(lane)).toBeTruthy()
    expect(within(chart).getByText('no set yet')).toBeTruthy()
    expect(within(chart).getByText('Today · Nov 16')).toBeTruthy()
    // The set being built from keeps its name on the chart.
    expect(within(chart).getByText('Permit set')).toBeTruthy()
  })

  it('shows a mark’s line on a hover and a focus, and puts it away', () => {
    renderWithProviders(<DevelopmentPlansByDate model={buildPlansByDate(site())} phone={false} print={print} />)
    expect(screen.queryByTestId('pbd-tip')).toBeNull()
    const mark = screen.getByTestId('pbd-mark-set-a2')
    expect(mark.getAttribute('aria-label')).toBe('Permit set · the GC · dated May 8, 2026 · came May 12 · ZZ Building A builds from it')
    fireEvent.mouseEnter(mark)
    expect(screen.getByTestId('pbd-tip').textContent).toBe('Permit set · the GC · dated May 8, 2026 · came May 12 · ZZ Building A builds from it')
    fireEvent.mouseLeave(mark)
    expect(screen.queryByTestId('pbd-tip')).toBeNull()
    fireEvent.focus(screen.getByTestId('pbd-mark-bid-bid1'))
    expect(screen.getByTestId('pbd-tip').textContent).toContain('B9001 sent Jun 12, 2025')
    fireEvent.blur(screen.getByTestId('pbd-mark-bid-bid1'))
    expect(screen.queryByTestId('pbd-tip')).toBeNull()
  })

  it('on a phone a press opens the line and a press on the chart’s ground closes it', () => {
    renderWithProviders(<DevelopmentPlansByDate model={buildPlansByDate(site())} phone print={print} />)
    fireEvent.click(screen.getByTestId('pbd-mark-crew-' + String(Math.round(Date.UTC(2025, 8, 8) / 86_400_000))))
    expect(screen.getByTestId('pbd-tip').textContent).toBe('Crews on site Sep 8 to Sep 9, 2025 · 2 days · J9101')
    fireEvent.click(screen.getByTestId('pbd-chart'))
    expect(screen.queryByTestId('pbd-tip')).toBeNull()
    expect(screen.getByTestId('pbd-note').textContent).toContain('Press a mark for its line.')
  })

  it('lists every mark as a dated line, oldest first, with the bid tinted and today last', () => {
    renderWithProviders(<DevelopmentPlansByDate model={buildPlansByDate(site())} phone={false} notes={['1 bid has no sent day, so it is not on the chart: B9050.']} print={print} />)
    const rows = [...screen.getByTestId('pbd-list').children].map((r) => r.textContent)
    expect(rows[0]).toBe('May 20, 2025ZZ Building AIssued set · the GC')
    expect(rows[rows.length - 1]).toBe('Nov 16, 2026Today')
    expect(screen.getByTestId('pbd-row-bid-bid1').textContent).toBe('Jun 12, 2025BidsB9001 sent · priced from plans dated May 20, 2025')
    expect(screen.getByTestId('pbd-row-bid-bid1').style.background).toContain('--bid-mark-wash')
    expect(screen.getByText(/Every dated line on the chart/).parentElement?.textContent).toContain('6 lines · oldest first')
    expect(screen.getByTestId('pbd-note').textContent).toContain('1 bid has no sent day')
  })

  it('opens a long list on its newest lines and shows the older ones on a press', () => {
    const history = Array.from({ length: 60 }, (_, i) => ({ id: `h${i}`, happenedAt: `2026-0${1 + (i % 9)}-${String(1 + (i % 27)).padStart(2, '0')}T12:00:00Z`, source: 'email' as const, body: `Line ${i}` }))
    const model = buildPlansByDate(site({ history }))
    renderWithProviders(<DevelopmentPlansByDate model={model} phone={false} print={print} />)
    const older = model.rows.length - PLANS_BY_DATE_LIST_FOLD
    const press = screen.getByRole('button', { name: `Show the ${older} older lines` })
    // The press and the newest lines.
    expect(screen.getByTestId('pbd-list').children).toHaveLength(PLANS_BY_DATE_LIST_FOLD + 1)
    fireEvent.click(press)
    expect(screen.getByTestId('pbd-list').children).toHaveLength(model.rows.length)
  })

  it('prints the chart, the figures and the list on one page, and says so when the window is blocked', () => {
    renderWithProviders(<DevelopmentPlansByDate model={buildPlansByDate(site())} phone print={print} />)
    fireEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    expect(printed.html).toHaveLength(1)
    expect(printed.html[0]).toContain('<h1>ZZ Test Ridge · plans by date</h1>')
    // Paper is the desktop chart, whatever the screen.
    expect(printed.html[0]).toContain('viewBox="0 0 980 ')
    expect(printed.html[0]).toContain('by ZZ Test Person')
    expect(screen.queryByTestId('pbd-print-note')).toBeNull()
    printed.open = false
    fireEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    expect(screen.getByTestId('pbd-print-note').textContent).toContain('The print window was blocked.')
  })

  it('says it is reading until the sets are in, and names what fills an empty site', () => {
    const { unmount } = renderWithProviders(<DevelopmentPlansByDate model={null} phone={false} print={print} />)
    expect(screen.getByTestId('pbd-reading').textContent).toBe('Reading the site’s sets…')
    unmount()
    renderWithProviders(<DevelopmentPlansByDate model={buildPlansByDate(site({ sets: [], bids: [], jobs: [], history: [] }))} phone={false} print={print} />)
    expect(screen.getByText('Nothing on this site has a date yet.')).toBeTruthy()
    expect(screen.queryByTestId('pbd-chart')).toBeNull()
  })
})
