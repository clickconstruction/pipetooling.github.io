// @vitest-environment jsdom
/**
 * Render smokes for the Build desk (punch list #192, v2.5929): the headline,
 * the verdict, the three tiles, the rows in the kernel's order, a row opening
 * to its why-line and doors, the Schedule door's path, Set the % mounting the
 * crews' percent window, the moved fold, and Esc closing.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

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

const job = (id: string, name: string, revenueUsd: number | null, pctComplete: number | null): BuildJob => ({ id, label: `J${id} · ${name}`, hcpNumber: `J${id}`, jobName: name, revenueUsd, pctComplete, status: 'working', createdYmd: '2026-07-01' })
const pt = (jobId: string, atYmd: string, pct: number, source: PctPoint['source'] = 'hand'): PctPoint => ({ jobId, atYmd, pct, source })
const sess = (jobId: string, workDate: string, hours: number, userId = 'u1'): VectorSession => ({ userId, workDate, hours, jobId, onBid: false, officeJob: false, approved: true, pending: false })

const input: BuildDeskInput = {
  openJobs: [job('977', 'Springtown', 71_000, 45), job('1017', 'Terrell', null, null), job('878', 'Take 5- Seguin', 124_000, 62), job('1007', 'SPACEX BA-02N Architectural', 170_000, 60), job('1081', 'Adams Pretest', 32_000, 100)],
  points: [pt('977', '2026-09-28', 45), pt('878', '2026-09-01', 62), pt('1007', '2026-09-30', 48), pt('1007', '2026-10-20', 60, 'report'), pt('1081', '2026-10-01', 90), pt('1081', '2026-10-22', 100, 'report')],
  sessions: [sess('977', '2026-10-14', 22), sess('1017', '2026-10-15', 31, 'u2'), sess('878', '2026-10-07', 8), sess('1007', '2026-10-13', 82, 'u3'), sess('1081', '2026-10-21', 14, 'u4')],
  todayYmd: '2026-10-26',
  reads: { blocks: [{ jobId: '1007', workDate: '2026-10-27', assigneeUserId: 'u3' }], names: new Map([['u3', 'Malachi']]), lifetimeHours: new Map([['1007', 465]]) },
  paces: { byPercentUsd: 32_700, byHoursUsd: 52_900 },
  outPerWeekUsd: 52_900,
  weeks: 7.3,
}
const desk = buildBuildDesk(input)

describe('BridgeBuildDesk (v2.5929)', () => {
  it('draws the headline, the verdict, the tiles and the rows in order, opens a row to its why and doors, and closes on Escape', () => {
    const onClose = vi.fn()
    renderWithProviders(<BridgeBuildDesk desk={desk} readsPending={false} readError={null} isLink readStamp="Mon, Oct 26 · pay week Oct 25–31" onClose={onClose} onSavePct={() => {}} />)
    expect(screen.getByTestId('bridge-build-headline').textContent).toBe('149h went in. $23.6k of work came out.')
    expect(screen.getByTestId('bridge-build-verdict').textContent).toBe('2 jobs ate 53 hours and moved nothing. 1 job holds $47.1k and saw nobody. That is the week.')
    const tiles = screen.getAllByTestId('bridge-build-tile')
    expect(tiles.map((t) => t.textContent)).toEqual(['Moved$23.6k on 2 jobsThe hours and the % agree. The pace lives here.', 'Ate hours, moved nothing53h on 2 jobsA stale % or work going nowhere. One look each says which.', 'Stalled$47.1k, nobody on it1 job with no field hours in 14 days.'])
    const rows = screen.getAllByTestId('bridge-build-row')
    expect(rows.map((r) => r.textContent?.slice(0, 20))).toEqual(['J1017 · Terrellno co', 'J977 · Springtown$39', 'J878 · Take 5- Segui', 'J1007 · SPACEX BA-02', 'J1081 · Adams Pretes'])
    expect(screen.queryByTestId('bridge-build-row-detail')).toBeNull()
    const stalledHead = rows[2]!.querySelector('button[aria-expanded]')!
    fireEvent.click(stalledHead)
    expect(stalledHead.getAttribute('aria-expanded')).toBe('true')
    const detail = screen.getByTestId('bridge-build-row-detail')
    expect(detail.textContent).toContain('$47.1k of sold work has had nobody on it for 19 days. The Schedule shows nobody this week either. Crew it, or name why it waits.')
    expect(detail.textContent).toContain('Nobody scheduled, all week')
    const doors = [...detail.querySelectorAll('a')].map((a) => [a.textContent, a.getAttribute('href')])
    expect(doors).toEqual([
      ['Open the Schedule ›', '/schedule-dispatch'],
      ['Open the job ›', '/jobs?tab=stages&edit=878'],
    ])
    expect(screen.getByTestId('bridge-build-set-pct').textContent).toBe('Set the % ›')
    expect(screen.getByTestId('bridge-build-footnote').textContent).toContain('The week’s call is recorded on the link desk above, not here.')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('offers no Set the % on a job with no price, and mounts the crews’ percent window on a priced one', async () => {
    const onSavePct = vi.fn()
    renderWithProviders(<BridgeBuildDesk desk={desk} readsPending={false} readError={null} isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} onSavePct={onSavePct} />)
    const rows = screen.getAllByTestId('bridge-build-row')
    fireEvent.click(rows[0]!.querySelector('button[aria-expanded]')!)
    expect(screen.getByText('Price the job ›').getAttribute('href')).toBe('/jobs?tab=stages&edit=1017')
    expect(screen.queryByTestId('bridge-build-set-pct')).toBeNull()
    fireEvent.click(rows[1]!.querySelector('button[aria-expanded]')!)
    fireEvent.click(screen.getByTestId('bridge-build-set-pct'))
    expect(screen.getByRole('dialog', { name: 'Update % done for J977 · Springtown' })).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Save 45%')).toBeTruthy())
    fireEvent.click(screen.getByText('Not now'))
    expect(screen.queryByRole('dialog', { name: 'Update % done for J977 · Springtown' })).toBeNull()
    expect(onSavePct).not.toHaveBeenCalled()
  })

  it('says it is reading while the desk’s reads are in flight, and folds the moved rows past the first three', () => {
    renderWithProviders(<BridgeBuildDesk desk={buildBuildDesk({ ...input, reads: null })} readsPending readError={null} isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} onSavePct={() => {}} />)
    expect(screen.getByTestId('bridge-build-reading').textContent).toBe('Reading the Build desk…')
    expect(screen.queryAllByTestId('bridge-build-row')).toHaveLength(0)
    const moving = ['a', 'b', 'c', 'd', 'e'].map((id, i) => job(id, `Job ${id}`, 100_000, 20 + i))
    const folded = buildBuildDesk({ ...input, openJobs: moving, points: moving.map((j) => pt(j.id, '2026-09-01', 10)), sessions: moving.map((j) => sess(j.id, '2026-10-20', 10)), reads: null })
    const { unmount } = renderWithProviders(<BridgeBuildDesk desk={folded} readsPending={false} readError={null} isLink={false} readStamp="Mon, Oct 26" onClose={() => {}} onSavePct={() => {}} />)
    expect(screen.getAllByTestId('bridge-build-row')).toHaveLength(3)
    const fold = screen.getByTestId('bridge-build-moved-fold')
    expect(fold.textContent).toBe('2 more jobs moving, $21k · show')
    fireEvent.click(fold)
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByTestId('bridge-build-row')).toHaveLength(5)
    unmount()
  })
})
