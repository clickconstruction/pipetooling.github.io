// @vitest-environment jsdom
/**
 * The page bar's export presses (v2.7432): Open ↗ shows the page alone in a new tab, PDF ↓ saves the same file. A
 * download of an approved notice files a copy as a download, a draft's files nothing, and opening never files.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import LienPageExportPresses from './LienPageExportPresses'

const { saveBlobAs, fileSentCopy, openPdfInNewTab } = vi.hoisted(() => ({
  saveBlobAs: vi.fn(),
  fileSentCopy: vi.fn(async () => true),
  openPdfInNewTab: vi.fn(async (build: () => Promise<Blob>, _building: string): Promise<'opened' | 'blocked'> => {
    await build()
    return 'opened'
  }),
}))
vi.mock('../../lib/storageSave', () => ({ saveBlobAs }))
vi.mock('../../lib/sent/sentCopiesIo', () => ({ fileSentCopy }))
vi.mock('../../lib/jobs/lienPageExportIo', () => ({ openPdfInNewTab }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const blob = new Blob(['%PDF'], { type: 'application/pdf' })
const filing = { kind: 'lien_notice_page', title: 'ZZ1 ZZ Test Walk Project, cover letter', jobIds: ['11111111-2222-4333-8444-555555555555'], recipientName: null }
const FILE = 'ZZ1 ZZ Test Walk Project, cover letter.pdf'

const openBtn = () => document.querySelector('[data-lien-page-open]') as HTMLButtonElement
const pdfBtn = () => document.querySelector('[data-lien-page-pdf]') as HTMLButtonElement

afterEach(() => {
  cleanup()
  saveBlobAs.mockClear()
  fileSentCopy.mockClear()
  openPdfInNewTab.mockClear()
})

describe('LienPageExportPresses', () => {
  it('draws Open ↗ and PDF ↓ with their titles, each named with its page for a screen reader', () => {
    renderWithProviders(<LienPageExportPresses pageKey="cover" phone={false} build={async () => blob} fileName={FILE} filing={null} />)
    expect(openBtn().textContent).toBe('Open ↗')
    expect(pdfBtn().textContent).toBe('PDF ↓')
    expect(openBtn().title).toBe('Open this page alone in a new tab, as it prints')
    expect(pdfBtn().title).toBe('Save this page as a PDF')
    expect(screen.getByRole('button', { name: 'Open the cover letter in a new tab' })).toBe(openBtn())
    expect(screen.getByRole('button', { name: 'Save the cover letter as a PDF' })).toBe(pdfBtn())
    expect(document.querySelector('.lienPageExportSep')).toBeTruthy()
  })

  it('on a phone draws the arrows alone, and keeps each name', () => {
    renderWithProviders(<LienPageExportPresses pageKey="pay" phone build={async () => blob} fileName={FILE} filing={null} />)
    expect(openBtn().textContent).toBe('↗')
    expect(pdfBtn().textContent).toBe('↓')
    expect(openBtn().getAttribute('aria-label')).toBe('Open the pay codes in a new tab')
    expect(pdfBtn().getAttribute('aria-label')).toBe('Save the pay codes as a PDF')
    expect((document.querySelector('[data-lien-page-export]') as HTMLElement).getAttribute('data-phone')).toBe('yes')
    expect(document.querySelector('.lienPageExportSep')).toBeNull()
  })

  it('PDF ↓ reads Making the PDF… while the file is made, cannot be pressed twice, then saves it', async () => {
    let land: (b: Blob) => void = () => {}
    const build = vi.fn(() => new Promise<Blob>((resolve) => (land = resolve)))
    renderWithProviders(<LienPageExportPresses pageKey="cover" phone={false} build={build} fileName={FILE} filing={null} />)
    fireEvent.click(pdfBtn())
    await waitFor(() => expect(pdfBtn().textContent).toBe('Making the PDF…'))
    expect(pdfBtn().disabled).toBe(true)
    expect(openBtn().disabled).toBe(true)
    expect(openBtn().textContent).toBe('Open ↗')
    fireEvent.click(pdfBtn())
    fireEvent.click(openBtn())
    expect(build).toHaveBeenCalledTimes(1)
    expect(openPdfInNewTab).not.toHaveBeenCalled()
    land(blob)
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(blob, FILE))
    await waitFor(() => expect(pdfBtn().textContent).toBe('PDF ↓'))
    expect(pdfBtn().disabled).toBe(false)
  })

  it("a draft's download is not filed", async () => {
    renderWithProviders(<LienPageExportPresses pageKey="cover" phone={false} build={async () => blob} fileName={FILE} filing={null} />)
    fireEvent.click(pdfBtn())
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalled())
    expect(fileSentCopy).not.toHaveBeenCalled()
  })

  it("an approved notice's download is filed as a download, with the file", async () => {
    renderWithProviders(<LienPageExportPresses pageKey="cover" phone={false} build={async () => blob} fileName={FILE} filing={filing} />)
    fireEvent.click(pdfBtn())
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(blob, FILE))
    expect(fileSentCopy).toHaveBeenCalledWith({ ...filing, how: 'download' }, { blob, fileName: FILE, contentType: 'application/pdf' })
  })

  it('Open ↗ opens the page in a new tab and files nothing, even on an approved notice', async () => {
    const build = vi.fn(async () => blob)
    renderWithProviders(<LienPageExportPresses pageKey="notice" phone={false} build={build} fileName={FILE} filing={filing} />)
    fireEvent.click(openBtn())
    await waitFor(() => expect(openPdfInNewTab).toHaveBeenCalledWith(build, 'Making the PDF…'))
    await waitFor(() => expect(openBtn().disabled).toBe(false))
    expect(saveBlobAs).not.toHaveBeenCalled()
    expect(fileSentCopy).not.toHaveBeenCalled()
  })

  it('a blocked popup says so', async () => {
    openPdfInNewTab.mockResolvedValueOnce('blocked')
    renderWithProviders(<LienPageExportPresses pageKey="cover" phone={false} build={async () => blob} fileName={FILE} filing={null} />)
    fireEvent.click(openBtn())
    await waitFor(() => expect(screen.getByText('Popup blocked. Allow popups to open this page in a new tab.')).toBeTruthy())
  })

  it('a page that cannot be made says why, saves nothing and files nothing', async () => {
    renderWithProviders(
      <LienPageExportPresses
        pageKey="release"
        phone={false}
        build={async () => {
          throw new Error('This notice has no conditional release.')
        }}
        fileName={FILE}
        filing={filing}
      />,
    )
    fireEvent.click(pdfBtn())
    await waitFor(() => expect(screen.getByText('Could not make the PDF: This notice has no conditional release.')).toBeTruthy())
    expect(saveBlobAs).not.toHaveBeenCalled()
    expect(fileSentCopy).not.toHaveBeenCalled()
    expect(pdfBtn().disabled).toBe(false)
  })
})
