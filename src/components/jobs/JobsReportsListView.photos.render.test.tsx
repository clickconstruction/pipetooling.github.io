// @vitest-environment jsdom
/**
 * The Reports tab's rows show a report's photos (punch list #229, PR 3): one count read for the rows draws *📷 2* on
 * the feed card and the group row of a report with photos and nothing on one without, and an open group's row with
 * photos draws the strip under its words.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'

const countReads: string[][] = []

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & { from: (t: string) => unknown }
  const originalFrom = stub.from.bind(stub)
  stub.from = (t: string) => {
    if (t !== 'report_photos') return originalFrom(t)
    // One builder answers both reads: the count (`.in`) and the card's rows (`.eq` + `.order`).
    const b: Record<string, unknown> = {}
    let mode: 'count' | 'card' = 'card'
    b.select = () => b
    b.in = (_col: string, ids: string[]) => {
      mode = 'count'
      countReads.push(ids)
      return b
    }
    b.eq = () => b
    b.order = () => b
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) =>
      Promise.resolve(
        mode === 'count'
          ? { data: [{ report_id: 'r1' }, { report_id: 'r1' }], error: null }
          : {
              data: [
                { id: 'p1', job_id: 'j1', report_id: 'r1', fixture_id: null, stage_name: 'Rough In', caption: 'Rough In', by_name: 'Luis Ortega', taken_at: '2026-11-01T13:00:00Z', bytes: 310000, original_bytes: 4200000, storage_path: null, drive_file_id: 'drive-1', filed_at: '2026-11-01T13:05:00Z', fail_why: null },
                { id: 'p2', job_id: 'j1', report_id: 'r1', fixture_id: null, stage_name: 'Rough In', caption: 'Rough In', by_name: 'Luis Ortega', taken_at: '2026-11-01T13:01:00Z', bytes: 298000, original_bytes: 4100000, storage_path: 'j1/p2.jpg', drive_file_id: null, filed_at: null, fail_why: null },
              ],
              error: null,
            },
      ).then(ok, bad)
    return b
  }
  ;(stub.storage as { from: unknown }).from = () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'blob:signed-p2' }, error: null }) })
  return { supabase: stub }
})
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))

import { JobsReportsListView, type ReportsListRow } from './JobsReportsListView'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const rows: ReportsListRow[] = [
  { id: 'r1', template_name: 'Status Report', created_by_user_id: 'u1', created_by_name: 'Luis Ortega', created_at: new Date().toISOString(), field_values: { Notes: 'Drains in bath 2 done.' }, job_ledger_id: 'j1', project_id: null, job_display_name: 'Oak Hollow Building C', job_hcp_number: '1042' },
  { id: 'r2', template_name: 'Note', created_by_user_id: 'u1', created_by_name: 'Luis Ortega', created_at: new Date(Date.now() - 60_000).toISOString(), field_values: { Notes: 'Called the GC.' }, job_ledger_id: 'j1', project_id: null, job_display_name: 'Oak Hollow Building C', job_hcp_number: '1042' },
]

const noop = () => {}
const props = { authRole: 'assistant' as const, isDev: false, deletingId: null, onDelete: noop, onOpenFiles: noop, onOpenPictures: noop, onEditJob: noop, onPreviewJob: noop }

describe('JobsReportsListView, the photos on the rows (punch list #229, PR 3)', () => {
  it('reads the counts once for the rows and badges the card of the report with photos', async () => {
    countReads.length = 0
    renderWithProviders(<JobsReportsListView {...props} rows={rows} viewMode="newest" />)
    const badge = await screen.findByTestId('report-photo-count')
    expect(badge.textContent).toBe('📷 2')
    expect(badge.getAttribute('aria-label')).toBe('2 photos')
    // One read for both rows; the Note has no badge.
    expect(countReads).toEqual([['r1', 'r2']])
    expect(screen.getAllByTestId('report-photo-count')).toHaveLength(1)
    const noteCard = screen.getByRole('button', { name: /Read report — Note/ })
    expect(within(noteCard).queryByTestId('report-photo-count')).toBeNull()
  })

  it("an open group's row with photos draws the strip under its words", async () => {
    renderWithProviders(<JobsReportsListView {...props} rows={rows} viewMode="job" />)
    fireEvent.click(await screen.findByRole('button', { name: /Oak Hollow Building C/ }))
    const strip = await screen.findByTestId('report-photos-strip')
    expect(within(strip).getByText('Photos · 2 photos')).toBeTruthy()
    expect(within(strip).getByRole('button', { name: 'Open Rough In · Luis Ortega in Drive' })).toBeTruthy()
    await waitFor(() => expect(within(strip).getByRole('img')).toBeTruthy())
    expect(screen.getAllByTestId('report-photos-strip')).toHaveLength(1)
  })
})
