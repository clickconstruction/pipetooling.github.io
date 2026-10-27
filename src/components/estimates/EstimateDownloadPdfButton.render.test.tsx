// @vitest-environment jsdom
/**
 * Download PDF (v2.5993, punch list #206 PR 3): the press draws, saves and files a copy as a
 * download; a draw that fails says so and files nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import EstimateDownloadPdfButton from './EstimateDownloadPdfButton'

const { saveBlobAs, fileSentCopy } = vi.hoisted(() => ({ saveBlobAs: vi.fn(), fileSentCopy: vi.fn(async () => true) }))
vi.mock('../../lib/storageSave', () => ({ saveBlobAs }))
vi.mock('../../lib/sent/sentCopiesIo', () => ({ fileSentCopy }))
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const filing = { kind: 'estimate_pdf', title: 'Estimate 175 · ZZ Test City', customerId: 'cust-zz' }

afterEach(() => {
  cleanup()
  saveBlobAs.mockClear()
  fileSentCopy.mockClear()
})

describe('EstimateDownloadPdfButton', () => {
  it('draws, saves the file under the paper’s name and files a download', async () => {
    const blob = new Blob(['%PDF'], { type: 'application/pdf' })
    const build = vi.fn(async () => ({ blob, fileName: 'Estimate 175 - ZZ Test City.pdf' }))
    renderWithProviders(<EstimateDownloadPdfButton build={build} filing={filing} />)
    const btn = screen.getByRole('button', { name: 'Download PDF' })
    fireEvent.click(btn)
    await waitFor(() => expect(saveBlobAs).toHaveBeenCalledWith(blob, 'Estimate 175 - ZZ Test City.pdf'))
    expect(fileSentCopy).toHaveBeenCalledWith({ ...filing, how: 'download' }, { blob, fileName: 'Estimate 175 - ZZ Test City.pdf', contentType: 'application/pdf' })
    await waitFor(() => expect((screen.getByTestId('estimate-download-pdf') as HTMLButtonElement).disabled).toBe(false))
  })

  it('a draw that fails files nothing and the button comes back', async () => {
    const build = vi.fn(async () => {
      throw new Error('no font')
    })
    renderWithProviders(<EstimateDownloadPdfButton build={build} filing={filing} />)
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    await waitFor(() => expect(build).toHaveBeenCalled())
    await waitFor(() => expect((screen.getByTestId('estimate-download-pdf') as HTMLButtonElement).disabled).toBe(false))
    expect(saveBlobAs).not.toHaveBeenCalled()
    expect(fileSentCopy).not.toHaveBeenCalled()
  })

  it('disabled holds the press', () => {
    const build = vi.fn()
    renderWithProviders(<EstimateDownloadPdfButton build={build} filing={filing} disabled />)
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    expect(build).not.toHaveBeenCalled()
  })
})
