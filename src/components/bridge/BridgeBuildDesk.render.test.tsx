// @vitest-environment jsdom
/**
 * Render smokes for the Build desk (punch list #192, v2.5929) on the shared
 * step frame (punch list #334, PR 1): the headline and its line,
 * the three lists with each one's first row and press, Show all, a row
 * opening to its why-line and doors, the percent window mounting from that
 * detail, the price door's path, the folds at the foot (what moved, every
 * open job with the verdict, the tiles and the ledger's rows, how this is
 * counted), the reading and the failed-read lines, and Esc closing.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & { from: (table: string) => unknown }
  const originalFrom = stub.from.bind(stub)
  stub.from = (table: string) => {
    if (table === 'jobs_ledger') {
      const builder: Record<string, unknown> = {}
      for (const m of ['select', 'eq']) builder[m] = () => builder
      builder.maybeSingle = () => Promise.resolve({ data: { pct_complete: 45, status: 'working' }, error: null })
      return builder
    }
    return originalFrom(table)
  }
  return { supabase: stub }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

import { BridgeBuildDesk } from './BridgeBuildDesk'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { buildBuildDesk, type BuildDeskInput } from '../../lib/bridge/build/buildDesk'
import type { BuildJob, PctPoint } from '../../lib/bridge/buildPace'
import type { VectorSession } from '../../lib/bridge/vectors'

const job = (id: string, name: string, revenueUsd: number | null, pctComplete: number | null): BuildJob => ({ id, label: `${id} · ${name}`, hcpNumber: id, jobName: name, revenueUsd, pctComplete, status: 'working', createdYmd: '2026-07-01' })
const pt = (jobId: string, atYmd: string, pct: number, source: PctPoint['source'] = 'hand'): PctPoint => ({ jobId, atYmd, pct, source })
const sess = (jobId: string, workDate: string, hours: number, userId = 'u1'): VectorSession => ({ userId, workDate, hours, jobId, onBid: false, officeJob: false, approved: true, pending: false })

/** Made-up jobs: three whose hours moved no percent, two with hours and no price, two sold and quiet, one moving, one finished. */
const input: BuildDeskInput = {
  openJobs: [
    job('2101', 'Ridgeway tower', 71_000, 45),
    job('2114', 'Pine Fork creekside', 20_000, 30),
    job('2120', 'Cedar Bend annex', 50_000, 10),
    job('2140', 'Walkthrough', null, null),
    job('2141', 'Sink swap', null, null),
    job('2087', 'Oak Hollow clubhouse', 124_000, 62),
    job('2090', 'Mill Road duplex', 30_000, 50),
    job('2150', 'Harbor View lofts', 170_000, 60),
    job('2160', 'Elm Street pretest', 32_000, 100),
  ],
  points: [pt('2101', '2026-09-28', 45), pt('2114', '2026-09-10', 30), pt('2120', '2026-09-12', 10), pt('2087', '2026-09-01', 62), pt('2090', '2026-08-01', 50), pt('2150', '2026-09-30', 48), pt('2150', '2026-10-20', 60, 'report'), pt('2160', '2026-10-01', 90), pt('2160', '2026-10-22', 100, 'report')],
  sessions: [sess('2101', '2026-10-14', 22), sess('2114', '2026-10-15', 9), sess('2120', '2026-10-16', 4), sess('2140', '2026-10-15', 7, 'u2'), sess('2141', '2026-10-19', 1, 'u2'), sess('2087', '2026-10-07', 8), sess('2150', '2026-10-13', 82, 'u3'), sess('2160', '2026-10-21', 14, 'u4')],
  todayYmd: '2026-10-26',
  reads: { blocks: [{ jobId: '2150', workDate: '2026-10-27', assigneeUserId: 'u3' }], names: new Map([['u3', 'Avery']]), lifetimeHours: new Map([['2150', 465]]) },
  paces: { byPercentUsd: 32_700, byHoursUsd: 52_900 },
  outPerWeekUsd: 52_900,
  weeks: 7.3,
}
const desk = buildBuildDesk(input)
const STAMP = 'Mon, Oct 26 · pay week Oct 25–31'
const rowTitles = (group: HTMLElement) => within(group).getAllByTestId('bridge-step-row').map((r) => r.textContent)

describe('BridgeBuildDesk on the step frame (punch list #334, PR 1)', () => {
  it('opens on the headline, its line and three short lists, each row one job and one press, and closes on Escape', () => {
    const onClose = vi.fn()
    renderWithProviders(<BridgeBuildDesk desk={desk} readsPending={false} readError={null} isLink readStamp={STAMP} onClose={onClose} onSavePct={() => {}} />)
    const overlay = screen.getByTestId('bridge-build-desk')
    const dialog = screen.getByRole('dialog', { name: 'Build, broken down' })
    expect(overlay.contains(dialog)).toBe(true)
    expect(dialog.textContent).toContain('Build · the work sold · last 14 days')
    const headline = screen.getByTestId('bridge-build-headline')
    expect(headline.textContent).toBe('The field put in 139 hours. Only $23.6k of work shows as done.')
    expect(headline.style.color).toBe('var(--text-red-700)')
    expect(dialog.textContent).toContain('Most of that gap is percents nobody updated.')
    expect(screen.queryByTestId('bridge-build-reading')).toBeNull()
    expect(screen.queryByTestId('bridge-build-read-error')).toBeNull()

    const percent = screen.getByTestId('bridge-step-group-percent')
    expect(percent.textContent).toContain('Hours went in, the percent did not move · 3 jobs')
    expect(rowTitles(percent)).toEqual(['2101 · Ridgeway tower22 hours. Still 45%.Set the percent', '2114 · Pine Fork creekside9 hours. Still 30%.Set the percent'])
    const price = screen.getByTestId('bridge-step-group-price')
    expect(price.textContent).toContain('Hours on a job with no price · 2 jobs')
    expect(rowTitles(price)).toEqual(['2140 · Walkthrough7 hours earn nothing until it has a price.Set a price'])
    const crew = screen.getByTestId('bridge-step-group-crew')
    expect(crew.textContent).toContain('Sold, and nobody on it · 2 jobs, $62.1k')
    expect(rowTitles(crew)).toEqual(['2087 · Oak Hollow clubhouse$47.1k left. 19 days quiet.Schedule it'])

    // One blue press in the window: the first row of the first list.
    const presses = [...dialog.querySelectorAll<HTMLElement>('[data-testid^="bridge-build-press-"]')]
    expect(presses.map((p) => p.style.background === 'rgb(37, 99, 235)')).toEqual([true, false, false, false])
    // Set a price is the job's own price door.
    expect(within(price).getByTestId('bridge-build-press-price').getAttribute('href')).toBe('/jobs?tab=stages&edit=2140')

    // Show all brings the rest of a list.
    fireEvent.click(screen.getByTestId('bridge-step-all-percent'))
    expect(rowTitles(percent)).toHaveLength(3)
    expect(rowTitles(percent)[2]).toBe('2120 · Cedar Bend annex4 hours. Still 10%.Set the percent')
    expect(screen.getByTestId('bridge-step-all-price').textContent).toBe('Show all 2 ›')
    expect(screen.getByTestId('bridge-step-all-crew').textContent).toBe('Show all 2 ›')

    // The moved jobs, the ledger and the footnote stay closed until pressed.
    expect(screen.queryByTestId('bridge-build-row')).toBeNull()
    expect(screen.queryByTestId('bridge-build-footnote')).toBeNull()
    expect([...dialog.querySelectorAll('a')].filter((a) => !a.dataset.testid).map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Open the Schedule ›', '/schedule-dispatch'],
      ['Open Stages ›', '/jobs?tab=stages'],
    ])
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('opens a job’s detail under its row: the why, the crew and the doors, one job at a time', () => {
    renderWithProviders(<BridgeBuildDesk desk={desk} readsPending={false} readError={null} isLink={false} readStamp={STAMP} onClose={() => {}} onSavePct={() => {}} />)
    expect(screen.getByTestId('bridge-build-headline').style.color).toBe('var(--text-strong)')
    expect(screen.queryByTestId('bridge-build-row-detail')).toBeNull()
    fireEvent.click(screen.getByTestId('bridge-build-press-crew'))
    const detail = screen.getByTestId('bridge-build-row-detail')
    expect(screen.getByTestId('bridge-step-group-crew').contains(detail)).toBe(true)
    expect(detail.textContent).toContain('$47.1k left of $124k · 62%')
    expect(detail.textContent).toContain('0h · 19 d quiet')
    expect(detail.textContent).toContain('stalled · biggest money idle')
    expect(detail.textContent).toContain('$47.1k of sold work has had nobody on it for 19 days. The Schedule shows nobody this week either. Crew it, or name why it waits.')
    expect(detail.textContent).toContain('Nobody scheduled, all week')
    expect([...detail.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Open the Schedule ›', '/schedule-dispatch'],
      ['Open the job ›', '/jobs?tab=stages&edit=2087'],
    ])
    // Another row's press moves the detail to that row.
    fireEvent.click(screen.getAllByTestId('bridge-build-press-percent')[0]!)
    const next = screen.getAllByTestId('bridge-build-row-detail')
    expect(next).toHaveLength(1)
    expect(screen.getByTestId('bridge-step-group-percent').contains(next[0]!)).toBe(true)
    expect(next[0]!.textContent).toContain('22h went on in the last 14 days.')
    // The same press closes it.
    fireEvent.click(screen.getAllByTestId('bridge-build-press-percent')[0]!)
    expect(screen.queryByTestId('bridge-build-row-detail')).toBeNull()
  })

  it('sets the percent from the row’s detail in the crews’ percent window, and Escape closes that window first', async () => {
    const onSavePct = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(<BridgeBuildDesk desk={desk} readsPending={false} readError={null} isLink={false} readStamp={STAMP} onClose={onClose} onSavePct={onSavePct} />)
    fireEvent.click(screen.getAllByTestId('bridge-build-press-percent')[0]!)
    const setPct = screen.getByTestId('bridge-build-set-pct')
    expect(setPct.textContent).toBe('Open the percent window ›')
    fireEvent.click(setPct)
    expect(screen.getByRole('dialog', { name: 'Update % done for 2101 · Ridgeway tower' })).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Save 45%')).toBeTruthy())
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Not now'))
    expect(screen.queryByRole('dialog', { name: 'Update % done for 2101 · Ridgeway tower' })).toBeNull()
    expect(onSavePct).not.toHaveBeenCalled()
  })

  it('keeps what moved, every open job and how this is counted behind the presses at the foot', () => {
    renderWithProviders(<BridgeBuildDesk desk={desk} readsPending={false} readError={null} isLink={false} readStamp={STAMP} onClose={() => {}} onSavePct={() => {}} />)
    const moved = screen.getByTestId('bridge-step-fold-moved')
    expect(moved.textContent).toBe('What moved (2) ›')
    fireEvent.click(moved)
    expect(moved.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('bridge-build-moved').textContent).toContain('2 jobs moved $23.6k in the last 14 days. The hours and the percent agree.')
    const movedRows = screen.getAllByTestId('bridge-build-row')
    expect(movedRows.map((r) => r.textContent?.slice(0, 24))).toEqual(['2150 · Harbor View lofts', '2160 · Elm Street pretes'])
    fireEvent.click(movedRows[0]!.querySelector('button[aria-expanded]')!)
    const detail = screen.getByTestId('bridge-build-row-detail')
    expect(detail.textContent).toContain('Hours and % agree.')
    expect(detail.textContent).toContain('Avery · 1 crew-day · Tue')

    const every = screen.getByTestId('bridge-step-fold-every')
    expect(every.textContent).toBe('Every open job (9) ›')
    fireEvent.click(every)
    expect(screen.queryByTestId('bridge-build-moved')).toBeNull()
    expect(screen.getByTestId('bridge-build-verdict').textContent).toBe('5 jobs ate 43 hours and moved nothing. 2 jobs hold $62.1k and saw nobody. That is the week.')
    expect(screen.getByTestId('bridge-build-every').textContent).toContain('by hours the field builds $52.9k a week. By the percents $32.7k.')
    expect(screen.getAllByTestId('bridge-build-tile').map((t) => t.textContent)).toEqual(['Moved$23.6k on 2 jobsThe hours and the % agree. The pace lives here.', 'Ate hours, moved nothing43h on 5 jobsA stale % or work going nowhere. One look each says which.', 'Stalled$62.1k, nobody on it2 jobs with no field hours in 14 days.'])
    const rows = screen.getAllByTestId('bridge-build-row')
    expect(rows.map((r) => r.textContent?.slice(0, 11))).toEqual(['2101 · Ridg', '2114 · Pine', '2140 · Walk', '2120 · Ceda', '2141 · Sink', '2087 · Oak ', '2090 · Mill', '2150 · Harb', '2160 · Elm '])
    // A no-price job's detail and a finished job's door are still here.
    fireEvent.click(rows[2]!.querySelector('button[aria-expanded]')!)
    expect(screen.getByTestId('bridge-build-row-detail').textContent).toContain('No price on the job. The 7 hours earned $0 on paper.')
    expect(screen.getByText('Price the job ›').getAttribute('href')).toBe('/jobs?tab=stages&edit=2140')
    expect(screen.queryByTestId('bridge-build-set-pct')).toBeNull()
    fireEvent.click(rows[8]!.querySelector('button[aria-expanded]')!)
    expect(screen.getByText('Bill it ›').getAttribute('href')).toBe('/jobs?tab=billing')

    const counted = screen.getByTestId('bridge-step-fold-counted')
    expect(counted.textContent).toBe('How this is counted ›')
    fireEvent.click(counted)
    const footnote = screen.getByTestId('bridge-build-footnote')
    expect(footnote.textContent).toContain('Hours are each job’s clock hours over the last 14 days.')
    expect(footnote.textContent).not.toContain('call is recorded')
    expect(footnote.textContent).toContain(`Read ${STAMP}`)
    expect(footnote.textContent).not.toContain('job_pct_events')
    expect(screen.queryByTestId('bridge-build-row')).toBeNull()
  })

  it('says it is still reading near the top and draws the rows meanwhile, and says why a read failed', () => {
    const pending = renderWithProviders(<BridgeBuildDesk desk={buildBuildDesk({ ...input, reads: null })} readsPending readError={null} isLink={false} readStamp={STAMP} onClose={() => {}} onSavePct={() => {}} />)
    expect(screen.getByTestId('bridge-build-reading').textContent).toBe('Reading the Schedule and the expected hours. Each job’s crew shows when they land.')
    expect(screen.getAllByTestId('bridge-step-row')).toHaveLength(4)
    pending.unmount()
    renderWithProviders(<BridgeBuildDesk desk={buildBuildDesk({ ...input, reads: null })} readsPending readError="permission denied" isLink={false} readStamp={STAMP} onClose={() => {}} onSavePct={() => {}} />)
    expect(screen.queryByTestId('bridge-build-reading')).toBeNull()
    expect(screen.getByTestId('bridge-build-read-error').textContent).toBe('The Schedule and the expected hours could not be read. The rows read without them. The reason given: permission denied')
    expect(screen.getAllByTestId('bridge-step-row')).toHaveLength(4)
  })

  it('says nothing waits when every job with hours moved', () => {
    const moving = buildBuildDesk({ ...input, openJobs: [job('2150', 'Harbor View lofts', 170_000, 60)], sessions: [sess('2150', '2026-10-13', 82, 'u3')] })
    renderWithProviders(<BridgeBuildDesk desk={moving} readsPending={false} readError={null} isLink={false} readStamp={STAMP} onClose={() => {}} onSavePct={() => {}} />)
    expect(screen.getByTestId('bridge-build-headline').textContent).toBe('The field put in 82 hours. $20.4k of work shows as done.')
    expect(screen.getByTestId('bridge-step-group-none').textContent).toBe('Do this weekNothing waiting on Build. Every job with hours moved its percent.')
    expect(screen.queryByTestId('bridge-step-row')).toBeNull()
    expect(screen.getByTestId('bridge-step-fold-moved').textContent).toBe('What moved (1) ›')
  })
})
