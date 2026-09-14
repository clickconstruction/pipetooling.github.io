// @vitest-environment jsdom
/**
 * Render smoke for Found in Drive (the Contract sweep's Drive pass): the scan
 * result is matched to the jobs, grouped by confidence, and "File the N
 * confident" files one link per job through the paper-record write.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobWithDetails } from '../../types/jobWithDetails'
import DriveContractsFoundModal from './DriveContractsFoundModal'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, role: 'dev' }) }))

let mockScan: { data: unknown; error: unknown } = { data: null, error: null }
vi.mock('../../lib/supabase', () => ({
  supabase: { functions: { invoke: () => Promise.resolve(mockScan) } },
}))

const fileSpy = vi.fn((input: { jobId: string; link: string; signedOn: string; signerName: string }) => Promise.resolve({ row: { id: 'r-' + input.jobId }, uploadError: null }))
vi.mock('../../lib/jobs/jobContractFileWrite', () => ({
  fileSignedJobContract: (input: { jobId: string; link: string; signedOn: string; signerName: string }) => fileSpy(input),
}))

function job(p: Partial<JobWithDetails> & { id: string; hcp_number: string }): JobWithDetails {
  return { click_number: '', job_name: 'Mission Hills', job_address: '2100 Independence Dr, New Braunfels, TX', customer_name: 'TF Harper', revenue: 123600, gcCustomer: null, ...p } as unknown as JobWithDetails
}
const JOBS = [
  job({ id: 'j523', hcp_number: '523' }),
  job({ id: 'j651', hcp_number: '651', job_name: 'Dudley Mason', job_address: '233 Palomino Trail, Natalia, TX', customer_name: 'RMC- Dudley Mason', revenue: 21950 }),
  job({ id: 'j683', hcp_number: '683', job_name: 'Job', job_address: '15054 State Hwy 71, Bee Cave, TX', customer_name: 'The Learning Experience', revenue: null }),
]

describe('DriveContractsFoundModal', () => {
  it('matches the scan to the jobs, groups by confidence, and files the confident ones with the Drive link', async () => {
    mockScan = {
      data: {
        ok: true,
        job_folders: 38,
        scanned: 41,
        files: [
          { id: 'f1', name: 'TF Harper – Mission Hills – Subcontract (signed).pdf', mimeType: 'application/pdf', modifiedTime: '2026-06-14T15:00:00.000Z', webViewLink: 'https://drive.google.com/file/d/f1/view', size: 100, folderId: 'a', folderName: '2100 Independence Dr' },
          { id: 'f2', name: 'Palomino Trail service agreement', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-08-03T15:00:00.000Z', webViewLink: 'https://docs.google.com/document/d/f2', size: null, folderId: 'b', folderName: 'Dudley Mason – Palomino' },
          { id: 'f3', name: 'Plans A-1.pdf', mimeType: 'application/pdf', modifiedTime: null, webViewLink: 'https://drive.google.com/file/d/f3/view', size: 1, folderId: 'c', folderName: 'TLE Bee Cave' },
        ],
      },
      error: null,
    }
    const onFiled = vi.fn()
    renderWithProviders(<DriveContractsFoundModal open onClose={() => undefined} jobs={JOBS} onFiled={onFiled} />)
    await waitFor(() => expect(screen.getByTestId('drive-summary').textContent).toContain('3 contract-looking files in 38 job folders'))
    expect(screen.getByRole('button', { name: /^Confident · 1$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Check · 1$/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^No match · 1$/ })).toBeTruthy()
    expect(screen.getAllByTestId('drive-row')[0]!.textContent).toContain('folder names 2100 Independence Dr · signed subcontract')
    fireEvent.click(screen.getByTestId('drive-file-confident'))
    await waitFor(() => expect(onFiled).toHaveBeenCalledWith(['j523']))
    expect(fileSpy).toHaveBeenCalledTimes(1)
    expect(fileSpy.mock.calls[0]![0]).toMatchObject({ jobId: 'j523', link: 'https://drive.google.com/file/d/f1/view', signedOn: '2026-06-14', signerName: 'TF Harper' })
    await waitFor(() => expect(screen.getByTestId('drive-summary').textContent).toContain('1 filed'))
  })

  it('says plainly when Drive is not connected', async () => {
    mockScan = { data: { error: 'Drive is not connected yet: set GOOGLE_SERVICE_ACCOUNT_JSON and DRIVE_JOBS_FOLDER_ID' }, error: null }
    renderWithProviders(<DriveContractsFoundModal open onClose={() => undefined} jobs={JOBS} onFiled={() => undefined} />)
    await waitFor(() => expect(screen.getByTestId('drive-scan-error').textContent).toContain('Drive is not connected yet'))
  })
})
