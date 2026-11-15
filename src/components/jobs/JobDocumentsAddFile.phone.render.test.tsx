// @vitest-environment jsdom
/**
 * The folders' Add ▾ sheet on a phone (punch list #355 H, v2.7282): at 375 px a folder row's press reads Add ▾ and
 * opens a sheet of three rows, Take a photo first; Choose a file opens the picker as before; Open in Google Drive is
 * the folder's link.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import type { JobFolderAddFileIo } from '../../lib/jobs/jobFolderAddFileIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { JobDocumentsAddFile } from './JobDocumentsAddFile'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})

function phoneQueryMatches(query: string): boolean {
  const max = /\(max-width:\s*(\d+)px\)/.exec(query)
  const min = /\(min-width:\s*(\d+)px\)/.exec(query)
  if (!max && !min) return false
  return (!max || 375 <= Number(max[1])) && (!min || 375 >= Number(min[1]))
}
beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: phoneQueryMatches(query), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
})

const io: JobFolderAddFileIo = { put: vi.fn(async () => ({ url: 'https://drive.google.com/file/d/x/view', id: 'x' })) } as unknown as JobFolderAddFileIo

describe('JobDocumentsAddFile on a phone', () => {
  it('Add ▾ opens the sheet of three rows, Take a photo first, and Open in Google Drive is the folder', () => {
    renderWithProviders(<JobDocumentsAddFile jobId="job-1" folder={{ label: 'Plans', url: 'https://drive.google.com/drive/folders/plans' }} io={io} />)
    const add = screen.getByRole('button', { name: 'Add to Plans' })
    expect(add.textContent).toBe('Add ▾')
    expect(parseFloat(String(add.style.minHeight))).toBeGreaterThanOrEqual(40)
    fireEvent.click(add)
    const sheet = screen.getByRole('dialog', { name: 'Add to Plans' })
    const rows = within(sheet).getAllByRole('menuitem')
    expect(rows.map((r) => r.textContent ?? '')).toEqual([
      expect.stringMatching(/^📷 Take a photo/),
      expect.stringMatching(/^📎 Choose a file/),
      expect.stringMatching(/^▲ Open in Google Drive/),
    ])
    expect(rows[0]?.textContent).toContain('The camera. The shot goes into the folder by itself.')
    for (const r of rows) expect(parseFloat(String(r.style.minHeight))).toBeGreaterThanOrEqual(48)
    expect(rows[2]?.getAttribute('href')).toBe('https://drive.google.com/drive/folders/plans')
    // The camera input is there, asking the phone for its camera.
    expect(screen.getByLabelText('Take a photo: Plans').getAttribute('capture')).toBe('environment')
  })
})
