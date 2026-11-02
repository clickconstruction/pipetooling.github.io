// @vitest-environment jsdom
/**
 * Find a file on the Documents page over a fake io (v2.6305): two letters search once the typing pauses, hits group
 * under their job with Open in Drive and Open the job, nothing found says so, a refusal shows its reason with Try again,
 * one letter searches nothing, and no jobs root says where to set it. Made-up names only.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FindAFileRead, FoundFile } from '../../lib/documents/findAFile'
import type { FindAFileIo } from '../../lib/documents/findAFileIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { FindAFile } from './FindAFile'

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const hit = (over: Partial<FoundFile>): FoundFile => ({
  id: '1AbCdEfGhIjKlMnOpQrSt',
  name: 'Permit 2026-0412.pdf',
  mime: 'application/pdf',
  bytes: 410 * 1024,
  modified: '2026-10-14T15:00:00Z',
  url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view',
  home: { kind: 'job', id: 'job-1', hcpNumber: '1187', clickNumber: null, name: 'Maple Court townhomes' },
  path: 'Plans',
  excerpt: null,
  excerptWhy: null,
  ...over,
})

function fakeIo(read: Partial<FindAFileRead> = {}, over: Partial<FindAFileIo> = {}): FindAFileIo {
  const full: FindAFileRead = {
    hits: [hit({}), hit({ id: '2BcDeFgHiJkLmNoPqRsTu', name: 'Rock clause letter.pdf', path: '' }), hit({ id: '3CdEfGhIjKlMnOpQrStUv', name: 'Loose scan.pdf', home: null, path: 'Click Customers › Example Builders' })],
    more: false,
    noRoot: false,
    source: 'drive',
    ...read,
  }
  return { search: vi.fn(async () => full), ...over }
}

function type(words: string) {
  fireEvent.change(screen.getByLabelText('Find a file by its words'), { target: { value: words } })
}

afterEach(() => cleanup())

describe('FindAFile', () => {
  it('searches once the typing pauses and lists the hits under their job with Open in Drive and Open the job', async () => {
    const io = fakeIo()
    renderWithProviders(<FindAFile io={io} debounceMs={0} />)
    type('rock clause')
    await screen.findByText(/^Job .*1187 · Maple Court townhomes$/)
    expect(io.search).toHaveBeenCalledTimes(1)
    expect(io.search).toHaveBeenCalledWith('rock clause')
    expect(screen.getByText('3 files say “rock clause”, from Drive.')).toBeTruthy()
    expect((screen.getByRole('link', { name: 'Permit 2026-0412.pdf' }) as HTMLAnchorElement).href).toBe('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrSt/view')
    expect(screen.getByText('Plans · Oct 14 · 410 KB')).toBeTruthy()
    expect(screen.getByText('the job’s folder · Oct 14 · 410 KB')).toBeTruthy()
    expect(screen.getByText('Not under a job')).toBeTruthy()
    expect(screen.getByText('Click Customers › Example Builders · Oct 14 · 410 KB')).toBeTruthy()
    // No job window provider in this tree: Open the job is the Jobs page's own door.
    expect((screen.getByRole('link', { name: 'Open the job' }) as HTMLAnchorElement).getAttribute('href')).toBe('/jobs?edit=job-1')
  })

  it('draws the line where the words appear with the words bold, a note for a scan, and nothing for a plain hit (v2.6306)', async () => {
    const io = fakeIo({
      hits: [
        hit({ excerpt: { text: '…agreed to the rock clause as written…', marks: [[15, 26]] } }),
        hit({ id: '2BcDeFgHiJkLmNoPqRsTu', name: 'Scan.pdf', excerptWhy: 'scan' }),
        hit({ id: '3CdEfGhIjKlMnOpQrStUv', name: 'Plain.pdf' }),
      ],
    })
    renderWithProviders(<FindAFile io={io} debounceMs={0} />)
    type('rock clause')
    await screen.findByText('3 files say “rock clause”, from Drive.')
    const mark = screen.getByText('rock clause', { selector: 'mark' })
    expect(mark.closest('[data-excerpt]')!.textContent).toBe('…agreed to the rock clause as written…')
    expect(screen.getByText('Matched inside the scan.')).toBeTruthy()
    expect(screen.queryByText('Too big to read here.')).toBeNull()
    expect(document.querySelectorAll('[data-excerpt]')).toHaveLength(1)
  })

  it('says when our own index answered (punch list #240, PR 1)', async () => {
    const io = fakeIo({ hits: [hit({ excerpt: { text: 'the rock clause as written', marks: [[4, 15]] } })], source: 'index' })
    renderWithProviders(<FindAFile io={io} debounceMs={0} />)
    type('rock clause')
    await screen.findByText('1 file says “rock clause”, from our index.')
    expect(document.querySelector('[data-find-source="index"]')).toBeTruthy()
  })

  it('one letter searches nothing', async () => {
    const io = fakeIo()
    renderWithProviders(<FindAFile io={io} debounceMs={0} />)
    type('r')
    await new Promise((r) => setTimeout(r, 20))
    expect(io.search).not.toHaveBeenCalled()
    expect(screen.queryByText('Searching…')).toBeNull()
  })

  it('nothing found says so, and says when Drive has more than it shows', async () => {
    const io = fakeIo({ hits: [] })
    renderWithProviders(<FindAFile io={io} debounceMs={0} />)
    type('xyzzy')
    await screen.findByText('Nothing in the job folders says “xyzzy”. Try other words, or Drive’s own search.')
    cleanup()
    renderWithProviders(<FindAFile io={fakeIo({ hits: [hit({}), hit({ id: '2BcDeFgHiJkLmNoPqRsTu' })], more: true })} debounceMs={0} />)
    type('permit')
    await screen.findByText('2 files say “permit”, from Drive. Drive has more. Add a word to narrow it.')
  })

  it('a refusal shows its reason with Try again, and no jobs root says where to set it', async () => {
    const search = vi.fn(async (): Promise<FindAFileRead> => { throw new Error('Office only.') })
    renderWithProviders(<FindAFile io={{ search }} debounceMs={0} />)
    type('permit')
    await screen.findByText('The search did not run. Office only.')
    search.mockResolvedValueOnce({ hits: [], more: false, noRoot: true, source: 'drive' })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.getByText(/The jobs root is not set yet/)).toBeTruthy())
    expect(search).toHaveBeenCalledTimes(2)
  })
})
