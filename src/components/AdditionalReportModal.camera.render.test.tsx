// @vitest-environment jsdom
/**
 * The camera-first report (punch list #189, PR 5b) on a phone, for a helper: the press opens the camera through the
 * file input, a shot comes back as a tile that shrinks and sends, the chip under it puts it on its stage, the stage
 * row shows it, Save names the job's number and the photo and waits while a shot is on its way, and the save ties
 * the photo to the report with the stage and writes the photos' clause on Stage progress. The save goes through the
 * outbox's RPC (punch list #163 PR 3), and a report with photos is never kept on the phone: with no signal the form
 * stays open with its shots and Retry.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'

const inserted: Array<Record<string, unknown>> = []
const attached: Array<{ reportId: string; photos: unknown }> = []
const sent: Array<Record<string, unknown>> = []
const discarded: unknown[] = []
/** Resolves the send on demand, so the test can read Save while a shot is on its way. */
let releaseSend: (() => void) | null = null
/** When set, the report's send fails at the fetch layer, as it does with no signal. */
const signal = { lost: false }

/** A read that answers `rows`; with `filterKey`, an `.eq(filterKey, v)` keeps the rows whose key is v (a template's own fields). */
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
    const result = () => Promise.resolve(single ? { data: pick()[0] ?? null, error: null } : { data: pick(), error: null })
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
        { id: 'f3', template_id: 't1', label: 'What needs to be done to get to the next stage?', input_type: 'long_text', sequence_order: 3 },
        { id: 'f4', template_id: 't2', label: 'What did you see on the walk?', input_type: 'long_text', sequence_order: 1 },
      ], 'template_id')
    if (t === 'jobs_ledger') return table(() => [{ pct_complete: 32, status: 'working', google_drive_link: 'https://drive.google.com/drive/folders/abc', job_pictures_link: null }])
    if (t === 'reports') return table(() => [{ id: 'r1' }])
    return originalFrom(t)
  }
  const originalRpc = stub.rpc.bind(stub)
  stub.rpc = (fn: string, args: unknown) => {
    if (fn === 'list_job_stage_progress')
      return Promise.resolve({
        data: [
          { fixture_id: 'u', name: 'Underground', stage_kind: 'order', sequence_order: 1, weight_pct: '20', progress_pct: 100, draw_paid: true },
          { fixture_id: 'r', name: 'Rough In', stage_kind: 'order', sequence_order: 2, weight_pct: '35', progress_pct: 35, draw_paid: false },
          { fixture_id: 't', name: 'Top Out', stage_kind: 'order', sequence_order: 3, weight_pct: '45', progress_pct: null, draw_paid: false },
        ],
        error: null,
      })
    if (fn === 'record_stage_progress') return Promise.resolve({ data: null, error: null })
    if (fn === 'set_job_pct_from_field') return Promise.resolve({ data: { ok: true }, error: null })
    if (fn === 'land_field_press') {
      if (signal.lost) return Promise.reject(new TypeError('Failed to fetch'))
      // The report lands through the outbox's RPC; its payload carries the row's columns.
      const a = args as { p_kind: string; p_payload: Record<string, unknown> }
      inserted.push({ kind: a.p_kind, ...a.p_payload })
      return Promise.resolve({ data: { report_id: 'r1', late: false }, error: null, status: 200 })
    }
    return originalRpc(fn, args)
  }
  ;(stub.auth as Record<string, unknown>).getUser = () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })
  return { supabase: stub }
})
vi.mock('../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../test/renderSmokeMocks')
  return useAuthModuleMock({ profileName: 'Luis Ortega' })
})
vi.mock('../utils/errorHandling', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/errorHandling')>()
  return { ...actual, withSupabaseRetry: ((op: never, name: string) => actual.withSupabaseRetry(op, name, { maxRetries: 0, logRetries: false })) as typeof actual.withSupabaseRetry }
})
vi.mock('../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
// A phone: the 640 px query matches, so the form is camera-first.
vi.mock('../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => true }))
vi.mock('../lib/photos/shrink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/photos/shrink')>()
  return {
    ...actual,
    shrinkReportPhoto: (file: File) => Promise.resolve({ blob: new Blob([new Uint8Array(310_000)], { type: 'image/jpeg' }), width: 1600, height: 1200, shrunk: true, original: file }),
  }
})
vi.mock('../lib/photos/reportPhotosIo', () => ({
  loadReportPhotoSize: () => Promise.resolve('medium'),
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

import AdditionalReportModal from './AdditionalReportModal'
import { renderWithProviders } from '../test/renderSmokeMocks'
import { outbox } from '../lib/offline/outboxState'

window.scrollTo = () => {}
// jsdom has no object URLs; the thumbnail only needs a string.
let urls = 0
URL.createObjectURL = () => `blob:test-${++urls}`
URL.revokeObjectURL = () => {}

const props = { open: true, onClose: vi.fn(), onSaved: vi.fn(), authUserId: 'u1', userRole: 'helpers' as const, jobId: 'job-1', hcpNumber: 'PLUM 530', jobName: 'Ridgeway Lot 14', jobAddress: 'Lot 14 Cedar Bend Dr' }

describe('AdditionalReportModal, camera first on a phone', () => {
  it('opens the camera, takes the shot as a tile, puts it on its stage, and saves the report with the photo on it', async () => {
    inserted.length = 0
    attached.length = 0
    sent.length = 0
    renderWithProviders(<AdditionalReportModal {...props} />)
    const input = (await screen.findByTestId('report-camera-input')) as HTMLInputElement
    // The back camera, clicked on open (jsdom's click opens nothing; the attribute is the proof).
    expect(input.getAttribute('capture')).toBe('environment')
    expect(input.getAttribute('accept')).toBe('image/*')
    await waitFor(() => expect(screen.getByText('How far along is each stage?')).toBeTruthy())
    // The typed parts fold: one optional box, the rest under links; the first tile is Take a photo.
    expect(screen.getByText('What got done?')).toBeTruthy()
    expect(screen.getByTestId('report-fold-next').textContent).toContain('What is next')
    expect(screen.getByTestId('report-fold-types').textContent).toContain('Walk, Note or EOD instead')
    expect(screen.getByRole('button', { name: 'Take a photo: open the camera' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save · job 32%' })).toBeTruthy()

    // The shot comes back.
    const file = new File([new Uint8Array(4_200_000)], 'IMG_0001.jpg', { type: 'image/jpeg' })
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sending'))
    // Save waits while the shot is on its way.
    expect((screen.getByRole('button', { name: 'Sending 1 photo…' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('New photo · 4.2 MB → 310 KB · 1600 px · goes to the job\'s Drive folder')).toBeTruthy()
    // The chip under the tile asks which stage, with the unpaid stages only.
    const ask = screen.getByTestId('report-photo-stage-ask')
    expect(within(ask).getAllByRole('button').map((b) => b.textContent)).toEqual(['Rough In', 'Top Out'])
    fireEvent.click(within(ask).getByRole('button', { name: 'This photo shows Rough In' }))
    expect(screen.queryByTestId('report-photo-stage-ask')).toBeNull()
    // The photo sits on its stage's row, which also carries the camera for that stage.
    const rows = screen.getAllByTestId('stage-row-photos')
    expect(rows.map((r) => within(r).queryAllByRole('img').length)).toEqual([1, 0])
    expect(within(rows[1]!).getByRole('button', { name: 'Take a photo of this stage: Top Out' })).toBeTruthy()

    await act(async () => {
      releaseSend?.()
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sent'))
    expect(screen.getByText('4.2 MB → 310 KB · 1600 px')).toBeTruthy()
    expect(sent[0]).toMatchObject({ id: expect.any(String), jobId: 'job-1', byUserId: 'u1', byName: 'Luis Ortega', originalBytes: 4_200_000, width: 1600, height: 1200 })

    // Move the stage, then save: the button names the job's number and the photo.
    fireEvent.click(screen.getByRole('button', { name: 'Set Rough In to 50 percent' }))
    const save = screen.getByRole('button', { name: 'Save · job 38% · 1 photo' }) as HTMLButtonElement
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(inserted).toHaveLength(1))
    const fv = inserted[0]!.field_values as Record<string, string>
    expect(fv['How complete is the job?']).toBe('38')
    expect(fv['Stage progress']).toBe('Rough In 35% → 50% · job 32% → 38% · 1 photo on Rough In')
    await waitFor(() => expect(attached).toHaveLength(1))
    expect(attached[0]).toEqual({ reportId: 'r1', photos: [{ id: sent[0]!.id, fixtureId: 'r', stageName: 'Rough In', caption: 'Rough In' }] })
  })

  it('a report type with no percent field names no job percent on Save and files none (v2.6126)', async () => {
    inserted.length = 0
    attached.length = 0
    sent.length = 0
    renderWithProviders(<AdditionalReportModal {...props} />)
    const input = (await screen.findByTestId('report-camera-input')) as HTMLInputElement
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save · job 32%' })).toBeTruthy())

    // The job keeps its stage lines, but a Walk has no percent field, so its Save names none.
    fireEvent.click(screen.getByTestId('report-fold-types'))
    fireEvent.click(screen.getByRole('button', { name: 'Walk' }))
    // The Walk's own fields have loaded: its one box, and no stages.
    await screen.findByRole('textbox', { name: 'What did you see on the walk?' })
    expect(screen.queryByText('How far along is each stage?')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save report' })).toBeTruthy()

    const file = new File([new Uint8Array(4_200_000)], 'IMG_0002.jpg', { type: 'image/jpeg' })
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sending'))
    await act(async () => {
      releaseSend?.()
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sent'))

    fireEvent.click(screen.getByRole('button', { name: 'Save report · 1 photo' }))
    await waitFor(() => expect(inserted).toHaveLength(1))
    const fv = inserted[0]!.field_values as Record<string, string>
    expect(fv['How complete is the job?']).toBeUndefined()
    expect(fv['Stage progress']).toBe('1 photo')
  })

  it('Not now discards a sent shot that no report holds', async () => {
    discarded.length = 0
    const onClose = vi.fn()
    renderWithProviders(<AdditionalReportModal {...props} onClose={onClose} />)
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
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onClose).toHaveBeenCalled()
    expect(discarded).toHaveLength(1)
    expect((discarded[0] as Array<{ id: string; storagePath: string | null }>)[0]!.storagePath).toMatch(/^job-1\//)
  })

  it('a report with photos is never kept on the phone: with no signal the form stays open with its shot and Retry', async () => {
    inserted.length = 0
    attached.length = 0
    discarded.length = 0
    const onSaved = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(<AdditionalReportModal {...props} onSaved={onSaved} onClose={onClose} />)
    const input = (await screen.findByTestId('report-camera-input')) as HTMLInputElement
    await waitFor(() => expect(screen.getByText('How far along is each stage?')).toBeTruthy())
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([new Uint8Array(1000)], 'IMG_0003.jpg', { type: 'image/jpeg' })] } })
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sending'))
    await act(async () => {
      releaseSend?.()
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sent'))
    // The signal drops after the shot went: the report's send is tried, never kept.
    signal.lost = true
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false })
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Save · job 32% · 1 photo' }))
      const panel = await screen.findByRole('alert')
      expect(within(panel).getByRole('button', { name: 'Retry' })).toBeTruthy()
      expect(outbox.presses()).toHaveLength(0)
      expect(onSaved).not.toHaveBeenCalled()
      expect(onClose).not.toHaveBeenCalled()
      // The shot stays on the form, neither attached nor thrown away.
      expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sent')
      expect(attached).toHaveLength(0)
      expect(discarded).toHaveLength(0)
    } finally {
      signal.lost = false
      delete (window.navigator as { onLine?: boolean }).onLine
      for (const p of outbox.presses()) outbox.remove(p.id)
    }
  })
})
