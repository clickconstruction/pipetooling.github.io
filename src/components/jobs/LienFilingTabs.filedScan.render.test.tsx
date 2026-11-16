// @vitest-environment jsdom
/**
 * Upload the scanned PDF on a filed lien affidavit (punch list #366, the owner's ask of 2026-11-16): the county
 * clerk's stamped copy picked from this computer, beside the photo press. It fills the filing's saved copy on Record
 * filing…, and on a filing already recorded it is saved at once.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import LienFilingTabs from './LienFilingTabs'

const inserts: Array<Record<string, unknown>> = []
const updates: Array<{ row: Record<string, unknown>; id: unknown }> = []
const puts: Array<{ jobId: string; where: string; name: string; type: string; size: number }> = []

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push(row)
        return { select: () => ({ single: async () => ({ data: { id: 'f1' }, error: null }) }) }
      },
      update: (row: Record<string, unknown>) => ({
        eq: async (_col: string, id: unknown) => {
          updates.push({ row, id })
          return { data: null, error: null }
        },
      }),
    }),
  },
}))
vi.mock('../../lib/jobs/jobFolderAddFileIo', () => ({
  putJobFolderFile: async (jobId: string, where: string, file: File) => {
    puts.push({ jobId, where, name: file.name, type: file.type, size: file.size })
    return { driveFileId: 'made-up-scan', url: 'https://drive.google.com/file/d/made-up-scan/view' }
  },
}))

afterEach(() => {
  cleanup()
  inserts.length = 0
  updates.length = 0
  puts.length = 0
})

// Every name, address and figure here is made up.
const job = makeJob({ id: 'job-77', hcp_number: '77', job_name: 'Alder Clinic', job_address: '12 Alder St, Marlow, TX 78000', status: 'billed', revenue: 9000 })
const address = { id: 'addr-1', county: 'Alder', legal_description: 'LOT 1 BLK 2 ALDER SUBD', owner_name: 'Alder Holdings LLC', owner_company: '', owner_mailing_address: '1 Owner Way, Marlow, TX 78000', is_homestead: false, homestead: false }
const notice = { id: 'n1', kind: 'notice_53_056', months_covered: ['2026-08'], sends: [], voided_at: null, created_at: '2026-09-01T00:00:00Z', amount: 1 }
const filed = { id: 'a1', kind: 'affidavit', months_covered: [], sends: [], voided_at: null, created_at: '2026-11-13T00:00:00Z', amount: 9000, county: 'Alder', recording_number: '2026-0001', filed_at: '2026-11-13', serve_due: '2026-11-18', served_at: null, fields: {}, document_url: '', document_note: '' }

type Props = Parameters<typeof LienFilingTabs>[0]
function props(over: Partial<Props>): Props {
  return {
    job,
    jobNumber: '77',
    activeTab: 'affidavit',
    issuer: null,
    signerNameFallback: 'Pat Marlow, Master Plumber',
    linkedAddress: address as never,
    jobOwnerRow: null,
    filings: [notice] as never,
    clock: { workMonth: '2026-08', noticeDeadline: '2026-11-16', filingDeadline: '2026-12-15' },
    isSub: false,
    originalContractorName: '',
    ownerEmail: '',
    originalContractorEmail: '',
    onChanged: () => {},
    ...over,
  }
}

const scan = (name = 'SCAN0007.PDF', type = 'application/pdf', bytes = 2048) => new File([new Uint8Array(bytes)], name, { type })
const pick = (file: File) => fireEvent.change(screen.getByLabelText('Upload the scanned PDF'), { target: { files: [file] } })

describe('LienFilingTabs · the scanned PDF of a filed affidavit', () => {
  it('on Record filing… the scan goes to the job’s folder as it is and becomes the filing’s saved copy', async () => {
    renderWithProviders(<LienFilingTabs {...props({})} />)
    fireEvent.click(screen.getByRole('button', { name: 'Record filing…' }))
    // The photo press stays beside it, for a phone.
    expect(screen.getByLabelText('Take a photo of the stamped page')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Filed on'), { target: { value: '2026-11-13' } })
    pick(scan())
    expect(await screen.findByRole('link', { name: 'Scan saved ›' })).toBeTruthy()
    // As it is: the same bytes, a PDF, under a name that says what it is.
    expect(puts).toEqual([{ jobId: 'job-77', where: 'sent', name: 'Lien affidavit, Job 77, the clerk’s stamped affidavit, scanned, 2026-11-13.pdf', type: 'application/pdf', size: 2048 }])
    expect((screen.getByLabelText('Saved copy — link') as HTMLInputElement).value).toBe('https://drive.google.com/file/d/made-up-scan/view')
    expect((screen.getByLabelText('Saved copy — note') as HTMLInputElement).value).toBe('the clerk’s stamped affidavit, scanned')
    fireEvent.change(screen.getByLabelText('Recording #'), { target: { value: '2026-0001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Record filing' }))
    await waitFor(() => expect(inserts.length).toBe(1))
    expect(inserts[0]).toMatchObject({ kind: 'affidavit', recording_number: '2026-0001', document_url: 'https://drive.google.com/file/d/made-up-scan/view', document_note: 'the clerk’s stamped affidavit, scanned' })
  })

  it('a scan too big for the folder is refused with what to do, and nothing is saved', async () => {
    renderWithProviders(<LienFilingTabs {...props({})} />)
    fireEvent.click(screen.getByRole('button', { name: 'Record filing…' }))
    pick(scan('stack.pdf', 'application/pdf', 11 * 1024 * 1024))
    expect(await screen.findByText('That file is 11 MB. The most a file can be is 10 MB. Scan this affidavit alone, or at a lower quality.')).toBeTruthy()
    expect(puts).toEqual([])
    expect((screen.getByLabelText('Saved copy — link') as HTMLInputElement).value).toBe('')
  })

  it('a file that is not a scan is refused', async () => {
    renderWithProviders(<LienFilingTabs {...props({})} />)
    fireEvent.click(screen.getByRole('button', { name: 'Record filing…' }))
    pick(scan('notes.txt', 'text/plain'))
    expect(await screen.findByText('That file is not a scan or a photo. Add a PDF or a picture.')).toBeTruthy()
    expect(puts).toEqual([])
  })

  it('on a filing already recorded the scan is saved as its saved copy at once', async () => {
    const onChanged = vi.fn()
    renderWithProviders(<LienFilingTabs {...props({ filings: [notice, filed] as never, onChanged })} />)
    const doors = screen.getAllByRole('button', { name: 'link the saved copy' })
    // The affidavit's row is the last under Filings on this job.
    fireEvent.click(doors[doors.length - 1]!)
    pick(scan('recorded.pdf'))
    await waitFor(() => expect(updates.length).toBe(1))
    expect(puts[0]).toMatchObject({ jobId: 'job-77', where: 'sent', name: 'Lien affidavit, Job 77, the clerk’s stamped affidavit, scanned, 2026-11-13.pdf' })
    expect(updates[0]).toEqual({ id: 'a1', row: { document_url: 'https://drive.google.com/file/d/made-up-scan/view', document_note: 'the clerk’s stamped affidavit, scanned' } })
    expect(onChanged).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Scan saved as the filing’s saved copy.')).toBeTruthy()
  })

  it('a notice’s saved copy keeps its typed link alone: the scan press is the affidavit’s', () => {
    renderWithProviders(<LienFilingTabs {...props({ filings: [notice] as never })} />)
    fireEvent.click(screen.getByRole('button', { name: 'link the saved copy' }))
    expect(screen.queryByLabelText('Upload the scanned PDF')).toBeNull()
  })
})
