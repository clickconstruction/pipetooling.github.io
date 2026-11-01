// @vitest-environment jsdom
/**
 * The desk's New report form takes photos on a ledger job (punch list #229, PR 1): the same block as the per-job
 * form, under the report type. At a desk the input is the file picker (no `capture`), the tile is Add a photo, a shot
 * comes back as a tile that shrinks and sends, the chip under it puts it on its stage, Save names the photo and waits
 * while a shot is on its way, the saved report carries the photos' clause on Stage progress, and the save ties the
 * photo to the report. A report on a bid shows no tile and says why.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'

const inserted: Array<Record<string, unknown>> = []
const attached: Array<{ reportId: string; photos: unknown }> = []
const sent: Array<Record<string, unknown>> = []
const discarded: unknown[] = []
let releaseSend: (() => void) | null = null

/** A read that answers `rows`; with `filterKey`, an `.eq(filterKey, v)` keeps the rows whose key is v. */
function table(rows: () => unknown[], filterKey?: string) {
  let kept: unknown = undefined
  const pick = () => (filterKey && kept !== undefined ? rows().filter((r) => (r as Record<string, unknown>)[filterKey] === kept) : rows())
  const make = (single: boolean): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'in', 'is', 'not', 'gte', 'update', 'delete']) b[m] = () => b
    b.eq = (col: string, v: unknown) => {
      if (col === filterKey) kept = v
      return b
    }
    b.single = () => make(true)
    b.maybeSingle = () => make(true)
    b.insert = (row: Record<string, unknown>) => {
      inserted.push(row)
      return b
    }
    const result = () => Promise.resolve(single ? { data: pick()[0] ?? null, error: null } : { data: pick(), error: null, count: 0 })
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => result().then(ok, bad)
    return b
  }
  return make(false)
}

vi.mock('../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & { from: (t: string) => unknown; rpc: (fn: string, args: unknown) => unknown }
  const originalFrom = stub.from.bind(stub)
  stub.from = (t: string) => {
    if (t === 'report_templates') return table(() => [{ id: 't1', name: 'Status Report', sequence_order: 1 }, { id: 't2', name: 'Walk Report', sequence_order: 2 }])
    if (t === 'report_template_fields')
      return table(() => [
        { id: 'f1', template_id: 't1', label: 'How complete is the job?', input_type: 'percent_0_100', sequence_order: 1 },
        { id: 'f2', template_id: 't1', label: 'What is the status of the job?', input_type: 'long_text', sequence_order: 2 },
        { id: 'f4', template_id: 't2', label: 'What did you see on the walk?', input_type: 'long_text', sequence_order: 1 },
      ], 'template_id')
    if (t === 'jobs_ledger') return table(() => [{ pct_complete: 32, status: 'working', google_drive_link: 'https://drive.google.com/drive/folders/abc', job_pictures_link: null }])
    if (t === 'reports') return table(() => [])
    if (t === 'job_schedule_blocks') return table(() => [])
    if (t === 'stage_checklist_templates') return table(() => [])
    return originalFrom(t)
  }
  const originalRpc = stub.rpc.bind(stub)
  stub.rpc = (fn: string, args: unknown) => {
    if (fn === 'list_job_stage_progress')
      return Promise.resolve({
        data: [
          { fixture_id: 'r', name: 'Rough In', stage_kind: 'order', sequence_order: 1, weight_pct: '50', progress_pct: 35, draw_paid: false },
          { fixture_id: 't', name: 'Top Out', stage_kind: 'order', sequence_order: 2, weight_pct: '50', progress_pct: null, draw_paid: false },
        ],
        error: null,
      })
    if (fn === 'record_stage_progress') return Promise.resolve({ data: null, error: null })
    if (fn === 'set_job_pct_from_field') return Promise.resolve({ data: { ok: true }, error: null })
    if (fn === 'search_jobs_for_reports' || fn === 'get_jobs_ledger_by_ids') return Promise.resolve({ data: [], error: null })
    if (fn === 'land_field_press') {
      const a = args as { p_kind: string; p_payload: Record<string, unknown> }
      inserted.push({ kind: a.p_kind, ...a.p_payload })
      return Promise.resolve({ data: { report_id: 'r9', late: false }, error: null, status: 200 })
    }
    return originalRpc(fn, args)
  }
  ;(stub.auth as Record<string, unknown>).getUser = () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })
  return { supabase: stub }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ profileName: 'Carla Nguyen' })
})
vi.mock('../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
// A desk: the 640 px query does not match, so the input is the file picker and the tile reads Add a photo.
vi.mock('../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => false }))
vi.mock('../lib/photos/shrink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/photos/shrink')>()
  return {
    ...actual,
    shrinkReportPhoto: (file: File) => Promise.resolve({ blob: new Blob([new Uint8Array(310_000)], { type: 'image/jpeg' }), width: 1600, height: 1200, shrunk: true, original: file }),
  }
})
vi.mock('../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoSize: () => Promise.resolve('medium'),
  jobHasDriveFolder: () => Promise.resolve(true),
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
  discardReportPhotos: (photos: unknown) => {
    discarded.push(photos)
    return Promise.resolve()
  },
}))

import NewReportModal from './NewReportModal'
import { renderWithProviders } from '../test/renderSmokeMocks'

window.scrollTo = () => {}
let urls = 0
URL.createObjectURL = () => `blob:test-${++urls}`
URL.revokeObjectURL = () => {}

const job = { id: 'job-1', source: 'job_ledger' as const, display_name: 'Oak Hollow Building C', hcp_number: 'JP1042', address: '4410 Pecan Creek Rd' }
const props = { open: true, onClose: vi.fn(), onSaved: vi.fn(), authUserId: 'u1', userRole: 'assistant' as const }

describe('NewReportModal, photos on a job at a desk (punch list #229, PR 1)', () => {
  it('offers Add a photo under the report type, takes the shot as a tile on its stage, and saves the report with the photo on it', async () => {
    inserted.length = 0
    attached.length = 0
    sent.length = 0
    renderWithProviders(<NewReportModal {...props} initialJob={job} />)
    const input = (await screen.findByTestId('report-camera-input')) as HTMLInputElement
    // The file picker at a desk: no capture.
    expect(input.getAttribute('capture')).toBeNull()
    expect(input.getAttribute('accept')).toBe('image/*')
    await waitFor(() => expect(screen.getByText('How far along is each stage?')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Add a photo: open the camera' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save report' })).toBeTruthy()

    const file = new File([new Uint8Array(4_200_000)], 'IMG_0001.jpg', { type: 'image/jpeg' })
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sending'))
    // Save waits while the shot is on its way and says so.
    expect((screen.getByRole('button', { name: 'Sending 1 photo…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText("New photo · 4.2 MB → 310 KB · 1600 px · goes to the job's Drive folder")).toBeTruthy()
    // The chip under the tile asks which stage.
    const ask = screen.getByTestId('report-photo-stage-ask')
    expect(within(screen.getByTestId('report-photo-stage-chips')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Rough In', 'Top Out'])
    fireEvent.click(within(ask).getByRole('button', { name: 'This photo shows Rough In' }))
    expect(screen.queryByTestId('report-photo-stage-ask')).toBeNull()
    // The photo sits on its stage's row, which carries the camera for that stage.
    const rows = screen.getAllByTestId('stage-row-photos')
    expect(rows.map((r) => within(r).queryAllByRole('img').length)).toEqual([1, 0])

    await act(async () => {
      releaseSend?.()
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sent'))
    expect(sent[0]).toMatchObject({ id: expect.any(String), jobId: 'job-1', byUserId: 'u1', byName: 'Carla Nguyen', originalBytes: 4_200_000 })

    const save = screen.getByRole('button', { name: 'Save report · 1 photo' }) as HTMLButtonElement
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(inserted).toHaveLength(1))
    const fv = inserted[0]!.field_values as Record<string, string>
    expect(fv['Stage progress']).toContain('1 photo on Rough In')
    await waitFor(() => expect(attached).toHaveLength(1))
    expect(attached[0]).toEqual({ reportId: 'r9', photos: [{ id: sent[0]!.id, fixtureId: 'r', stageName: 'Rough In', caption: 'Rough In' }] })
  })

  it('a report on a bid takes no photo and says so', async () => {
    renderWithProviders(<NewReportModal {...props} initialJob={{ id: 'bid-1', source: 'bid', display_name: 'Pecan Creek Clinic', hcp_number: '482' }} />)
    await screen.findByText('Report type')
    expect(screen.queryByTestId('report-camera-input')).toBeNull()
    expect(screen.getByTestId('report-photos-job-only').textContent).toBe('Photos go on a job’s report. A report on a project or a bid takes none yet.')
  })

  it('closing with a sent shot asks first, and Discard report throws the shot away', async () => {
    discarded.length = 0
    const onClose = vi.fn()
    renderWithProviders(<NewReportModal {...props} initialJob={job} onClose={onClose} />)
    const input = (await screen.findByTestId('report-camera-input')) as HTMLInputElement
    await waitFor(() => expect(screen.getByText('How far along is each stage?')).toBeTruthy())
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([new Uint8Array(1000)], 'IMG_0002.jpg', { type: 'image/jpeg' })] } })
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sending'))
    await act(async () => {
      releaseSend?.()
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sent'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Discard report' }))
    expect(onClose).toHaveBeenCalled()
    expect(discarded).toHaveLength(1)
    expect((discarded[0] as Array<{ storagePath: string | null }>)[0]!.storagePath).toMatch(/^job-1\//)
  })
})
