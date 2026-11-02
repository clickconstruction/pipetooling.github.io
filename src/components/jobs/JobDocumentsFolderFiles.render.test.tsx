// @vitest-environment jsdom
/**
 * The job window's Documents tab In the folders section over a fake io (v2.6299): a job with no link draws nothing and
 * reads nothing; the five folders list their newest rows with where each file came from, an empty folder says what
 * fills it and a folder not made yet says when the app makes it; a held job shows the hold's words; a read that fails
 * says why with Try again. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { JobFolderFile, JobFolderFilesRead, JobFolderSection } from '../../lib/jobs/jobFolderFiles'
import type { JobFolderFilesIo } from '../../lib/jobs/jobFolderFilesIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobDocumentsFolderFiles } from './JobDocumentsFolderFiles'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const FOLDER = 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv'
const file = (id: string, over: Partial<JobFolderFile> = {}): JobFolderFile => ({ id, name: `${id}.pdf`, mime: 'application/pdf', bytes: 2_200_000, modified: '2026-11-01T20:00:00Z', by: 'Dana Example', url: `https://drive.google.com/file/d/${id}/view`, from: null, ...over })
const section = (key: JobFolderSection['key'], name: string, files: JobFolderFile[], over: Partial<JobFolderSection> = {}): JobFolderSection => ({ key, name, folderId: `1${key}`, url: `${FOLDER}-${key}`, files, more: false, ...over })

function read(over: Partial<JobFolderFilesRead> = {}): JobFolderFilesRead {
  return {
    job: { folderId: '1job', url: FOLDER, hold: null },
    sections: [
      section('pictures', 'Customer Pictures', [file('p1', { name: 'before.jpg', mime: 'image/jpeg', from: { kind: 'photo', source: 'report' } })]),
      section('plans', 'Plans', [], { folderId: null, url: null }),
      section('photos', 'Team only › Photos', []),
      section('sentByUs', 'Team only › Sent by us', Array.from({ length: 7 }, (_, i) => file(`s${i}`, { name: `Invoice ${i + 1}.pdf` }))),
      section('job', 'Job folder', [file('loose', { name: 'permit.pdf' })]),
    ],
    ...over,
  }
}

function fakeIo(r: JobFolderFilesRead = read(), over: Partial<JobFolderFilesIo> = {}): JobFolderFilesIo {
  return { list: vi.fn(async () => r), ...over }
}

const job = (over: Partial<{ google_drive_link: string | null; job_pictures_link: string | null; job_plans_link: string | null }> = {}) => ({ id: 'job-1', google_drive_link: FOLDER, job_pictures_link: null, job_plans_link: null, ...over })

afterEach(() => cleanup())

describe('JobDocumentsFolderFiles', () => {
  it('draws nothing and reads nothing on a job with no folder link', () => {
    const io = fakeIo()
    const { container } = renderWithProviders(<JobDocumentsFolderFiles job={job({ google_drive_link: null })} io={io} />)
    expect(container.querySelector('[data-job-documents-folder-files]')).toBeNull()
    expect(io.list).not.toHaveBeenCalled()
  })

  it('lists the five folders with their newest rows and where each file came from', async () => {
    renderWithProviders(<JobDocumentsFolderFiles job={job()} io={fakeIo()} />)
    expect(await screen.findByText('In the folders')).toBeTruthy()
    expect(screen.getByText('Customer Pictures')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'before.jpg' }).getAttribute('href')).toContain('/file/d/p1/')
    expect(screen.getByText('From the app · a report photo')).toBeTruthy()
    expect(screen.getByText('permit.pdf')).toBeTruthy()
    expect(screen.getAllByText('Added in Drive').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nov 1 · 2.1 MB · Dana Example').length).toBeGreaterThan(0)
    // Plans is not made yet; Team only › Photos is made and empty.
    expect(screen.getByText('Plans is not made yet.')).toBeTruthy()
    expect(screen.getByText('Nothing in Team only › Photos yet.')).toBeTruthy()
    // Seven sent files: five rows and the more line with the folder's door.
    expect(screen.getByText('7 files')).toBeTruthy()
    expect(screen.getByText('Invoice 5.pdf')).toBeTruthy()
    expect(screen.queryByText('Invoice 6.pdf')).toBeNull()
    expect(screen.getByText(/and 2 more in Drive/)).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Open in Drive ↗' }).length).toBe(4)
  })

  it('shows the hold’s words on a held job instead of a listing', async () => {
    const hold = 'This folder is in Dana’s My Drive, where the app can make folders but cannot save a file.'
    renderWithProviders(<JobDocumentsFolderFiles job={job()} io={fakeIo(read({ job: { folderId: '1job', url: FOLDER, hold } }))} />)
    expect(await screen.findByText(hold)).toBeTruthy()
    expect(screen.queryByText('Customer Pictures')).toBeNull()
  })

  it('says why a read failed and reads again on Try again', async () => {
    const list = vi.fn<JobFolderFilesIo['list']>().mockRejectedValueOnce(new Error('Drive did not answer.')).mockResolvedValueOnce(read())
    renderWithProviders(<JobDocumentsFolderFiles job={job()} io={fakeIo(read(), { list })} />)
    expect(await screen.findByText(/The folders did not read\. Drive did not answer\./)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByText('Customer Pictures')).toBeTruthy())
    expect(list).toHaveBeenCalledTimes(2)
  })
})
