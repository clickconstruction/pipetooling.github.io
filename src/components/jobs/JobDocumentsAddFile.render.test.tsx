// @vitest-environment jsdom
/**
 * Add a file on the Documents tab's Job folders rows over a fake io (v2.6303): the press opens the picker, a chosen
 * file shows its name, size and where it goes, the confirm names the folder and sends it through the io, the line then
 * says it is there with Open in Drive; a file over 10 MB is told so with no press; a refusal shows its reason and keeps
 * the file; a row the press does not serve draws nothing. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobFolderAddFileIo } from '../../lib/jobs/jobFolderAddFileIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobDocumentsAddFile } from './JobDocumentsAddFile'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const PLANS = { label: 'Plans', url: 'https://drive.google.com/drive/folders/1PlansFolderIdAbCdEfGh' }
const FILE_URL = 'https://drive.google.com/file/d/1NewFileIdAbCdEfGhIjKl/view'

function fakeIo(over: Partial<JobFolderAddFileIo> = {}): JobFolderAddFileIo {
  return { put: vi.fn(async () => ({ driveFileId: '1NewFileIdAbCdEfGhIjKl', url: FILE_URL })), ...over }
}

function pick(name: string, bytes: number): File {
  const f = new File([new Uint8Array(Math.min(bytes, 64))], name, { type: 'application/pdf' })
  Object.defineProperty(f, 'size', { value: bytes })
  fireEvent.change(screen.getByLabelText('Add a file to Plans'), { target: { files: [f] } })
  return f
}

afterEach(() => cleanup())

describe('JobDocumentsAddFile', () => {
  it('a chosen file shows its name, size and where it goes; the confirm names the folder, sends it, and the line says it is there', async () => {
    const io = fakeIo()
    const onAdded = vi.fn()
    renderWithProviders(<JobDocumentsAddFile jobId="job-1" folder={PLANS} io={io} onAdded={onAdded} />)
    expect(screen.getByRole('button', { name: 'Add a file' })).toBeTruthy()
    const f = pick('Permit 2026-0412.pdf', 410 * 1024)
    expect(screen.getByText('Add a file to Plans')).toBeTruthy()
    expect(screen.getByText(/Permit 2026-0412\.pdf/)).toBeTruthy()
    expect(screen.getByText(/410 KB/)).toBeTruthy()
    expect(screen.getByText(/It goes into Plans\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add it to Plans' }))
    await waitFor(() => expect(screen.getByText(/Permit 2026-0412\.pdf is in Plans\./)).toBeTruthy())
    expect(io.put).toHaveBeenCalledWith('job-1', 'plans', f)
    expect(onAdded).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('link', { name: 'Open in Drive' }) as HTMLAnchorElement).href).toBe(FILE_URL)
    expect(screen.queryByRole('button', { name: 'Add it to Plans' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Add another' })).toBeTruthy()
  })

  it('a file over 10 MB is told so and gets no press', () => {
    const io = fakeIo()
    renderWithProviders(<JobDocumentsAddFile jobId="job-1" folder={PLANS} io={io} />)
    pick('Whole set.pdf', 10 * 1024 * 1024 + 1)
    expect(screen.getByText('Over 10 MB. Put it in the folder in Drive instead.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add it to Plans' })).toBeNull()
    expect(io.put).not.toHaveBeenCalled()
  })

  it('a refusal shows its reason and keeps the file picked', async () => {
    const io = fakeIo({ put: vi.fn(async () => { throw new Error('A training account cannot change Drive.') }) })
    renderWithProviders(<JobDocumentsAddFile jobId="job-1" folder={PLANS} io={io} />)
    pick('Permit 2026-0412.pdf', 2048)
    fireEvent.click(screen.getByRole('button', { name: 'Add it to Plans' }))
    await waitFor(() => expect(screen.getByText('A training account cannot change Drive.')).toBeTruthy())
    expect(screen.getByText(/Permit 2026-0412\.pdf/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add it to Plans' })).toBeTruthy()
  })

  it('a row the press does not serve draws nothing', () => {
    const { container } = renderWithProviders(<JobDocumentsAddFile jobId="job-1" folder={{ label: 'Bid folder', url: PLANS.url }} io={fakeIo()} />)
    expect(container.textContent).toBe('')
  })
})
