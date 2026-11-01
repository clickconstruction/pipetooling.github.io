// @vitest-environment jsdom
/**
 * Edit report shows the photos and takes more (punch list #229, PR 4): the saved photos as the card draws them with
 * the line that they stay, the Add a photo tile on a job's report, Save naming the photos added and tying them to
 * the report after the fields save; a report on a project shows its photos and no tile.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'

const updated: Array<Record<string, unknown>> = []
const attached: Array<{ reportId: string; photos: unknown }> = []
const sent: Array<Record<string, unknown>> = []
let releaseSend: (() => void) | null = null

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & { from: (t: string) => unknown }
  const originalFrom = stub.from.bind(stub)
  stub.from = (t: string) => {
    if (t === 'report_template_fields') {
      const b: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'order']) b[m] = () => b
      b.then = (ok?: (v: unknown) => unknown) =>
        Promise.resolve({ data: [{ id: 'f1', template_id: 't1', label: 'Notes', input_type: 'long_text', sequence_order: 1 }], error: null }).then(ok)
      return b
    }
    if (t === 'reports') {
      const b: Record<string, unknown> = {}
      b.update = (row: Record<string, unknown>) => {
        updated.push(row)
        return b
      }
      b.eq = () => Promise.resolve({ data: null, error: null })
      return b
    }
    return originalFrom(t)
  }
  return { supabase: stub }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ profileName: 'Luis Ortega', role: 'helpers' })
})
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => false }))
vi.mock('../lib/photos/shrink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/photos/shrink')>()
  return {
    ...actual,
    shrinkReportPhoto: (file: File) => Promise.resolve({ blob: new Blob([new Uint8Array(300_000)], { type: 'image/jpeg' }), width: 1600, height: 1200, shrunk: true, original: file }),
  }
})
vi.mock('../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoSize: () => Promise.resolve('medium'),
  jobHasDriveFolder: () => Promise.resolve(true),
  loadReportPhotos: () =>
    Promise.resolve([
      { id: 'p1', job_id: 'job-1', report_id: 'r1', fixture_id: null, stage_name: 'Rough In', caption: 'Rough In', by_name: 'Luis Ortega', taken_at: '2026-11-01T13:00:00Z', bytes: 310000, original_bytes: 4200000, storage_path: null, drive_file_id: 'drive-1', filed_at: '2026-11-01T13:05:00Z', fail_why: null, previewUrl: null },
    ]),
  sendReportPhoto: (input: Record<string, unknown>) =>
    new Promise<{ storagePath: string }>((resolve) => {
      releaseSend = () => {
        sent.push(input)
        resolve({ storagePath: `${String(input.jobId)}/${String(input.id)}.jpg` })
      }
    }),
  attachReportPhotos: (reportId: string, photos: unknown) => {
    attached.push({ reportId, photos })
    return Promise.resolve({ attached: 1, failed: [] })
  },
  discardReportPhotos: () => Promise.resolve(),
}))

import ReportEditModal from './ReportEditModal'
import { renderWithProviders } from '../test/renderSmokeMocks'

let urls = 0
URL.createObjectURL = () => `blob:test-${++urls}`
URL.revokeObjectURL = () => {}

const report = { id: 'r1', template_id: 't1', template_name: 'Status Report', job_display_name: 'Oak Hollow Building C', created_at: '2026-11-01T13:00:00Z', field_values: { Notes: 'Drains done.' }, job_ledger_id: 'job-1' }

describe('ReportEditModal, the photos (punch list #229, PR 4)', () => {
  it('shows the saved photos with the line that they stay, takes one more, and ties it to the report after Save', async () => {
    updated.length = 0
    attached.length = 0
    sent.length = 0
    const onSaved = vi.fn()
    renderWithProviders(<ReportEditModal open report={report} onClose={vi.fn()} onSaved={onSaved} viewerRole="helpers" />)
    const strip = await screen.findByTestId('report-photos-strip')
    expect(within(strip).getByRole('button', { name: 'Open Rough In · Luis Ortega in Drive' })).toBeTruthy()
    expect(within(strip).getByText('A photo already on the report stays. Take one back in the job’s Drive folder.')).toBeTruthy()
    const input = screen.getByTestId('report-camera-input') as HTMLInputElement
    expect(input.getAttribute('capture')).toBeNull()
    expect(screen.getByRole('button', { name: 'Add a photo: open the camera' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()

    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([new Uint8Array(4_000_000)], 'IMG_0009.jpg', { type: 'image/jpeg' })] } })
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sending'))
    expect((screen.getByRole('button', { name: 'Sending 1 photo…' }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => {
      releaseSend?.()
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sent'))

    await screen.findByDisplayValue('Drains done.')
    fireEvent.click(screen.getByRole('button', { name: 'Save · 1 photo added' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(updated[0]).toMatchObject({ field_values: { Notes: 'Drains done.' } })
    expect(attached).toEqual([{ reportId: 'r1', photos: [{ id: sent[0]!.id, fixtureId: null, stageName: null, caption: 'Drains done.' }] }])
  })

  it("a project's report shows its photos and no tile", async () => {
    renderWithProviders(<ReportEditModal open report={{ ...report, id: 'r2', job_ledger_id: null }} onClose={vi.fn()} onSaved={vi.fn()} viewerRole="helpers" />)
    await screen.findByTestId('report-photos-strip')
    expect(screen.queryByTestId('report-camera-input')).toBeNull()
    expect(screen.queryByText('A photo already on the report stays. Take one back in the job’s Drive folder.')).toBeNull()
  })
})
