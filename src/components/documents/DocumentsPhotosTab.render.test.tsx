// @vitest-environment jsdom
/**
 * Documents → Photos over a fake io (punch list #232, PR 2): the rows by day, newest first, with the source, the
 * person and the Drive line; the chips and the typed words asked of the server; the empty state's two sentences; a
 * read that fails with Retry; a thumbnail opening the viewer with its doors. Made-up names only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { UploadedPhotoRow, UploadedPhotosQuery } from '../../lib/photos/uploadedPhotos'
import type { UploadedPhotosIo } from '../../lib/photos/uploadedPhotosIo'
import { DocumentsPhotosTab } from './DocumentsPhotosTab'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const auth = vi.hoisted(() => ({ role: 'assistant' as string }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: auth.role, user: { id: 'u-office' } }), useOptionalAuth: () => ({ role: auth.role, user: { id: 'u-office' } }) }))

const io = vi.hoisted(() => ({ rows: [] as UploadedPhotoRow[], asks: [] as UploadedPhotosQuery[], fail: null as Error | null }))

function row(over: Partial<UploadedPhotoRow> = {}): UploadedPhotoRow {
  return {
    source: 'report',
    id: 'p1',
    job_id: 'j1',
    bid_id: null,
    project_id: null,
    report_id: 'r1',
    container_id: null,
    question_id: null,
    message_id: null,
    contact_id: null,
    caption: 'Rough In',
    stage_name: 'Rough In',
    by_user_id: 'u1',
    by_name: 'Mateo Ruiz',
    direction: null,
    channel: null,
    taken_at: '2026-11-01T20:14:00Z',
    bytes: 310_000,
    original_bytes: 4_200_000,
    bucket: 'report-photos',
    storage_path: 'j1/p1.jpg',
    drive_file_id: null,
    filed_at: null,
    fail_why: null,
    status: null,
    job_hcp_number: '1042',
    job_click_number: null,
    job_name: 'Oak Hollow Apartments Building C',
    customer_name: 'Ridgeway Builders',
    bid_number: null,
    ...over,
  }
}

function fakeIo(): UploadedPhotosIo {
  return {
    list: vi.fn(async (q: UploadedPhotosQuery) => {
      io.asks.push(q)
      if (io.fail) throw io.fail
      return { rows: io.rows, more: io.rows.length >= q.limit }
    }),
    waiting: vi.fn(async () => io.rows.filter((r) => !r.drive_file_id).length),
    thumb: vi.fn(async () => null),
    full: vi.fn(async () => null),
  }
}

const lastAsk = () => io.asks[io.asks.length - 1]

beforeEach(() => {
  io.rows = []
  io.asks = []
  io.fail = null
  auth.role = 'assistant'
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DocumentsPhotosTab', () => {
  it('lists every photo by day with its source, its person and where it is', async () => {
    io.rows = [
      row({}),
      row({ id: 'p2', source: 'box', caption: 'A1 after Count', stage_name: 'A1', by_name: 'Jordan Pike', taken_at: '2026-11-01T16:52:00Z', drive_file_id: 'd2', filed_at: '2026-11-01T16:56:00Z', storage_path: null, container_id: 'k1' }),
      row({ id: 'p3', source: 'checklist', caption: 'Did the water test hold', by_name: 'Mateo Ruiz', taken_at: '2026-10-31T21:31:00Z', fail_why: 'That job has no Drive folder yet.', job_hcp_number: '1051', job_name: 'Maple Row Townhomes', customer_name: 'Vista Ridge Homes' }),
    ]
    renderWithProviders(<DocumentsPhotosTab io={fakeIo()} />)
    const rows = await screen.findAllByTestId('documents-photos-row')
    expect(rows).toHaveLength(3)
    expect(io.asks[0]).toEqual({ source: 'all', where: 'everywhere', typed: '', limit: 100 })
    expect(screen.getByText('Today · Sun, Nov 1')).toBeTruthy()
    expect(screen.getByText('Yesterday · Sat, Oct 31')).toBeTruthy()
    expect(rows[0]!.textContent).toContain('Rough In')
    expect(rows[0]!.textContent).toContain('J1042 · Oak Hollow Apartments Building C · Ridgeway Builders')
    expect(rows[0]!.textContent).toContain('On its way to Drive')
    expect(rows[1]!.textContent).toContain('Tally box')
    expect(rows[1]!.textContent).toContain('Jordan Pike')
    expect(rows[1]!.textContent).toContain('In Drive')
    expect(rows[2]!.textContent).toContain('Not in Drive yet')
    expect(rows[2]!.textContent).toContain('That job has no Drive folder yet.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Not in Drive yet · 2' })).toBeTruthy())
  })

  it('shows the Texts & email chip to the office and not to a primary', async () => {
    renderWithProviders(<DocumentsPhotosTab io={fakeIo()} />)
    await screen.findByTestId('documents-photos-empty')
    expect(screen.getByRole('button', { name: 'Texts & email' })).toBeTruthy()
    cleanup()
    auth.role = 'primary'
    renderWithProviders(<DocumentsPhotosTab io={fakeIo()} />)
    await screen.findByTestId('documents-photos-empty')
    expect(screen.queryByRole('button', { name: 'Texts & email' })).toBeNull()
  })

  it('asks again for a chip at once, and for typed words once the typing rests', async () => {
    renderWithProviders(<DocumentsPhotosTab io={fakeIo()} />)
    await screen.findByTestId('documents-photos-empty')
    expect(screen.getByText('Nothing uploaded yet.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tally boxes' }))
    await waitFor(() => expect(lastAsk()).toEqual({ source: 'box', where: 'everywhere', typed: '', limit: 100 }))
    fireEvent.click(screen.getByRole('button', { name: 'In Drive' }))
    await waitFor(() => expect(lastAsk()).toEqual({ source: 'box', where: 'drive', typed: '', limit: 100 }))
    expect(screen.getByText('No photo matches.')).toBeTruthy()

    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('Find a photo'), { target: { value: 'Oak' } })
    const before = io.asks.length
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(io.asks.length).toBe(before)
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    vi.useRealTimers()
    await waitFor(() => expect(lastAsk()).toEqual({ source: 'box', where: 'drive', typed: 'Oak', limit: 100 }))
  })

  it('says why a read was refused, and offers Retry on a lost signal, reading again', async () => {
    io.fail = new Error('This job is not one you can see.')
    renderWithProviders(<DocumentsPhotosTab io={fakeIo()} />)
    await screen.findByText(/This job is not one you can see\./)
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
    cleanup()

    io.fail = new TypeError('Failed to fetch')
    renderWithProviders(<DocumentsPhotosTab io={fakeIo()} />)
    const retry = await screen.findByRole('button', { name: 'Retry' })
    io.fail = null
    io.rows = [row({})]
    fireEvent.click(retry)
    await screen.findAllByTestId('documents-photos-row')
  })

  it('opens the viewer from a thumbnail, with the doors, and narrows to one person from it', async () => {
    io.rows = [row({ drive_file_id: 'd1', filed_at: '2026-11-01T20:20:00Z', storage_path: null }), row({ id: 'p2', by_name: 'Jordan Pike', taken_at: '2026-11-01T16:52:00Z' })]
    const fake = fakeIo()
    renderWithProviders(<DocumentsPhotosTab io={fake} />)
    await screen.findAllByTestId('documents-photos-row')
    fireEvent.click(screen.getAllByRole('button', { name: 'Open Rough In' })[0]!)
    await waitFor(() => expect(document.querySelector('[data-uploaded-photo-open="p1"]')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Open in Drive' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open the report' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Open the job' })).toBeTruthy()
    expect(fake.full).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
    await waitFor(() => expect(document.querySelector('[data-uploaded-photo-open="p2"]')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Only Jordan’s photos' }))
    await waitFor(() => expect(document.querySelector('[data-uploaded-photo-open]')).toBeNull())
    expect((screen.getByLabelText('Find a photo') as HTMLInputElement).value).toBe('Jordan Pike')
  })
})
