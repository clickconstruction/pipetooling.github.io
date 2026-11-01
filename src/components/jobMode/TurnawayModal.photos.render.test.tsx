// @vitest-environment jsdom
/**
 * Turnaway takes a photo (punch list #229, PR 2): the field report's tiles under the reason, the camera on a phone
 * for a helper, the press named by what it files, held while a shot is on its way, the shot tied to the report
 * captioned by the reason, and the dispatch title counting it.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'

const inserted: Array<Record<string, unknown>> = []
const attached: Array<{ reportId: string; photos: unknown }> = []
const dispatched: Array<Record<string, unknown>> = []
const sent: Array<Record<string, unknown>> = []
let releaseSend: (() => void) | null = null

function table(rows: () => unknown[]) {
  const make = (single: boolean): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'in', 'is', 'not', 'gte', 'update', 'delete', 'eq']) b[m] = () => b
    b.single = () => make(true)
    b.maybeSingle = () => make(true)
    b.insert = (row: Record<string, unknown>) => {
      inserted.push(row)
      return b
    }
    const result = () => Promise.resolve(single ? { data: rows()[0] ?? null, error: null } : { data: rows(), error: null })
    b.then = (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => result().then(ok, bad)
    return b
  }
  return make(false)
}

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  const stub = makeSupabaseStub() as Record<string, unknown> & { from: (t: string) => unknown }
  const originalFrom = stub.from.bind(stub)
  stub.from = (t: string) => {
    if (t === 'report_templates') return table(() => [{ id: 'tw' }])
    if (t === 'reports') return table(() => [{ id: 'r-tw' }])
    if (t === 'stage_checklist_templates') return table(() => [])
    return originalFrom(t)
  }
  ;(stub.auth as Record<string, unknown>).getUser = () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null })
  return { supabase: stub }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ profileName: 'Mateo Ruiz' })
})
vi.mock('../../lib/dispatchRequestHelpers', () => ({
  createDispatchRequest: (args: Record<string, unknown>) => {
    dispatched.push(args)
    return Promise.resolve({ id: 'd1', created: true })
  },
}))
vi.mock('../../lib/navClickTelemetry', () => ({ recordNavClick: () => {} }))
vi.mock('../../hooks/useNarrowViewport640', () => ({ useNarrowViewport640: () => true }))
vi.mock('../../lib/photos/shrink', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/photos/shrink')>()
  return {
    ...actual,
    shrinkReportPhoto: (file: File) => Promise.resolve({ blob: new Blob([new Uint8Array(290_000)], { type: 'image/jpeg' }), width: 1600, height: 1200, shrunk: true, original: file }),
  }
})
vi.mock('../../lib/photos/reportPhotosIo', () => ({
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
  discardReportPhotos: () => Promise.resolve(),
}))

import TurnawayModal from './TurnawayModal'
import { renderWithProviders } from '../../test/renderSmokeMocks'

let urls = 0
URL.createObjectURL = () => `blob:test-${++urls}`
URL.revokeObjectURL = () => {}

const props = { open: true, onClose: vi.fn(), onSubmitted: vi.fn(), authUserId: 'u1', userRole: 'helpers' as const, jobId: 'job-1', hcpNumber: 'J1042', jobName: 'Oak Hollow Building C', jobAddress: '4410 Pecan Creek Rd' }

describe('TurnawayModal takes a photo (punch list #229, PR 2)', () => {
  it('offers the camera under the reason, names the press by what it files, and ties the shot to the report captioned by the reason', async () => {
    inserted.length = 0
    attached.length = 0
    dispatched.length = 0
    sent.length = 0
    const onSubmitted = vi.fn()
    renderWithProviders(<TurnawayModal {...props} onSubmitted={onSubmitted} />)
    const input = (await screen.findByTestId('report-camera-input')) as HTMLInputElement
    expect(input.getAttribute('capture')).toBe('environment')
    expect(screen.getByRole('button', { name: 'Take a photo: open the camera' })).toBeTruthy()
    await waitFor(() => expect((screen.getByRole('button', { name: 'File Turnaway' }) as HTMLButtonElement).disabled).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Site not ready' }))
    expect((screen.getByRole('button', { name: 'File Turnaway' }) as HTMLButtonElement).disabled).toBe(false)

    await act(async () => {
      fireEvent.change(input, { target: { files: [new File([new Uint8Array(3_800_000)], 'IMG_0007.jpg', { type: 'image/jpeg' })] } })
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sending'))
    // No stages: no chip asks which one. The press waits while the shot is on its way.
    expect(screen.queryByTestId('report-photo-stage-ask')).toBeNull()
    expect((screen.getByRole('button', { name: 'Sending 1 photo…' }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => {
      releaseSend?.()
    })
    await waitFor(() => expect(screen.getByTestId('report-photo-tile').getAttribute('data-status')).toBe('sent'))
    expect(screen.getByRole('button', { name: 'Take another: open the camera' })).toBeTruthy()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Gate chained at 7:05.' } })
    fireEvent.click(screen.getByRole('button', { name: 'File Turnaway · 1 photo' }))
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled())
    expect(inserted[0]).toMatchObject({ template_id: 'tw', job_ledger_id: 'job-1', field_values: { Reason: 'Site not ready', Note: 'Gate chained at 7:05.' } })
    expect(attached).toEqual([{ reportId: 'r-tw', photos: [{ id: sent[0]!.id, fixtureId: null, stageName: null, caption: 'Site not ready' }] }])
    expect(dispatched[0]!.title).toBe('Turnaway: J1042 Oak Hollow Building C — Site not ready. Gate chained at 7:05. · 1 photo on the report')
  })
})
