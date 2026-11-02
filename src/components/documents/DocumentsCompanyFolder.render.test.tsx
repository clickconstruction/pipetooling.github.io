// @vitest-environment jsdom
/**
 * Render smoke for Documents → Company's folder (the Documents spike of 2026-11-01): the list read from `list_company`'s
 * documented answer with Open the folder and Upload a file for the office, the empty folder's press, the no-folder state
 * that names Where files go, an upload that lands and reads again, and a held file that never leaves the browser.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { DocumentsCompanyFolder } from './DocumentsCompanyFolder'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const io = vi.hoisted(() => ({
  files: [] as unknown[],
  noFolder: false,
  puts: [] as string[],
  role: 'assistant' as string,
}))

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: io.role, user: { id: 'u1' } }) }))

vi.mock('../../lib/documents/companyFilesIo', () => {
  class CompanyFolderRefused extends Error {
    why: string | null
    constructor(message: string, why: string | null) {
      super(message)
      this.why = why
    }
  }
  return {
    CompanyFolderRefused,
    loadCompanyFiles: async () => {
      if (io.noFolder) throw new CompanyFolderRefused('No company folder yet. Set it on Documents → Where files go.', 'no_company_folder')
      return { folder: { id: '1Company000000000000000', url: 'https://drive.google.com/drive/folders/1Company000000000000000' }, files: io.files, capped: false }
    },
    putCompanyFile: async (file: File) => {
      io.puts.push(file.name)
      io.files = [{ id: 'new', name: file.name, bytes: file.size, mime: file.type, half: 'team_only', url: 'https://drive.google.com/file/d/new/view', modified: '2026-11-01T16:00:00Z' }, ...io.files]
      return { driveFileId: 'new', url: 'https://drive.google.com/file/d/new/view' }
    },
  }
})

const opened = vi.hoisted(() => [] as string[])
vi.mock('../../lib/openInExternalBrowser', () => ({ openInExternalBrowser: (url: string) => opened.push(url) }))

beforeEach(() => {
  io.files = [
    { id: 'w9', name: 'W-9 2026.pdf', bytes: 120_000, mime: 'application/pdf', half: 'team_only', url: 'https://drive.google.com/file/d/w9/view', modified: '2026-01-05T15:00:00Z' },
    { id: 'coi', name: 'COI 2026.pdf', bytes: 80_000, mime: 'application/pdf', half: 'team_only', url: 'https://drive.google.com/file/d/coi/view', modified: '2026-03-02T15:00:00Z' },
  ]
  io.noFolder = false
  io.puts = []
  io.role = 'assistant'
  opened.length = 0
})
afterEach(() => cleanup())

describe('DocumentsCompanyFolder', () => {
  it('lists the folder newest first, opens a file and the folder, and offers Upload a file to the office', async () => {
    renderWithProviders(<DocumentsCompanyFolder />)
    await waitFor(() => expect(screen.getByText('COI 2026.pdf')).toBeTruthy())
    const names = screen.getAllByRole('button').map((b) => b.textContent).filter((t) => t?.endsWith('.pdf'))
    expect(names).toEqual(['COI 2026.pdf', 'W-9 2026.pdf'])
    expect(screen.getByText('2 files in the company folder.')).toBeTruthy()
    fireEvent.click(screen.getByText('W-9 2026.pdf'))
    fireEvent.click(screen.getByText('Open the folder'))
    expect(opened).toEqual(['https://drive.google.com/file/d/w9/view', 'https://drive.google.com/drive/folders/1Company000000000000000'])
    expect(screen.getByText('Upload a file')).toBeTruthy()
  })

  it('keeps the Upload press from an estimator, who reads', async () => {
    io.role = 'estimator'
    renderWithProviders(<DocumentsCompanyFolder />)
    await waitFor(() => expect(screen.getByText('COI 2026.pdf')).toBeTruthy())
    expect(screen.queryByText('Upload a file')).toBeNull()
    expect(screen.getByText('Open the folder')).toBeTruthy()
  })

  it('puts a picked file in the folder and reads the list again', async () => {
    renderWithProviders(<DocumentsCompanyFolder />)
    await waitFor(() => expect(screen.getByText('COI 2026.pdf')).toBeTruthy())
    const input = screen.getByLabelText('A file from this computer for the company folder') as HTMLInputElement
    const file = new File(['%PDF-1.4'], 'Plumbing license 2026.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(screen.getByText('Plumbing license 2026.pdf')).toBeTruthy())
    expect(io.puts).toEqual(['Plumbing license 2026.pdf'])
    expect(screen.getByText('3 files in the company folder.')).toBeTruthy()
  })

  it('holds an empty file before it leaves the browser', async () => {
    renderWithProviders(<DocumentsCompanyFolder />)
    await waitFor(() => expect(screen.getByText('COI 2026.pdf')).toBeTruthy())
    const input = screen.getByLabelText('A file from this computer for the company folder') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File([], 'empty.pdf', { type: 'application/pdf' })] } })
    await waitFor(() => expect(screen.getByText('That file is empty.')).toBeTruthy())
    expect(io.puts).toEqual([])
  })

  it('says what fills an empty folder, and names Where files go while no folder is set', async () => {
    io.files = []
    const { unmount } = renderWithProviders(<DocumentsCompanyFolder />)
    await waitFor(() => expect(screen.getByText('No company papers yet.')).toBeTruthy())
    unmount()
    io.noFolder = true
    renderWithProviders(<DocumentsCompanyFolder />)
    await waitFor(() => expect(screen.getByText('No company folder yet.')).toBeTruthy())
    expect(screen.getByText('Where files go').getAttribute('href')).toBe('/documents?tab=where-files-go')
  })
})
