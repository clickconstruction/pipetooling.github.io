// @vitest-environment jsdom
/**
 * Record service… on a filed lien affidavit takes each copy's certified mail number and a photo of its receipt
 * (punch list #314, change 5). The day still records alone, the proof can be added once the day is on record, and
 * the press stays offered while a hold is closed, since a paper on file is served whatever has closed since.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import LienFilingTabs from './LienFilingTabs'

const updates: Array<{ row: Record<string, unknown>; id: unknown }> = []
const puts: Array<{ jobId: string; where: string; name: string }> = []

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
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
    puts.push({ jobId, where, name: file.name })
    return { driveFileId: 'made-up-file', url: 'https://drive.google.com/file/d/made-up-file/view' }
  },
}))

afterEach(() => {
  cleanup()
  updates.length = 0
  puts.length = 0
})

const job = makeJob({ id: 'job-77', hcp_number: '77', job_name: 'Alder Clinic', job_address: '12 Alder St, Marlow, TX 78000', status: 'billed', revenue: 9000 })
// Every gate of the affidavit clears: an owner with a mailing address, the county, the legal description, not a homestead.
const address = { id: 'addr-1', county: 'Alder', legal_description: 'LOT 1 BLK 2 ALDER SUBD', owner_name: 'Alder Holdings LLC', owner_company: '', owner_mailing_address: '1 Owner Way, Marlow, TX 78000', is_homestead: false, homestead: false }
const notice = { id: 'n1', kind: 'notice_53_056', months_covered: ['2026-08'], sends: [], voided_at: null, created_at: '2026-09-01T00:00:00Z', amount: 1 }
const filed = { id: 'a1', kind: 'affidavit', months_covered: [], sends: [], voided_at: null, created_at: '2026-11-16T00:00:00Z', amount: 9000, county: 'Alder', recording_number: '2026-0001', filed_at: '2026-11-16', serve_due: '2026-11-23', served_at: null, fields: null }

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
    filings: [notice, filed] as never,
    clock: { workMonth: '2026-08', noticeDeadline: '2026-11-16', filingDeadline: '2026-12-15' },
    isSub: false,
    originalContractorName: '',
    ownerEmail: '',
    originalContractorEmail: '',
    onChanged: () => {},
    ...over,
  }
}

const box = () => document.querySelector('[data-lien-record-box="affidavit_service"]') as HTMLElement

describe('LienFilingTabs · the mail receipts on Record service…', () => {
  it('the day records alone, as before, and writes no send', async () => {
    renderWithProviders(<LienFilingTabs {...props({})} />)
    fireEvent.click(screen.getByRole('button', { name: 'Record service…' }))
    expect(within(box()).getByLabelText('Copy to the owner, certified mail number')).toBeTruthy()
    // A job contracted with the owner mails one copy.
    expect(within(box()).queryByLabelText('Copy to the original contractor, certified mail number')).toBeNull()
    fireEvent.change(within(box()).getByLabelText('Served on'), { target: { value: '2026-11-18' } })
    fireEvent.click(within(box()).getByRole('button', { name: 'Record service' }))
    await waitFor(() => expect(updates.length).toBe(1))
    expect(updates[0]).toEqual({ id: 'a1', row: { served_at: '2026-11-18', sends: [] } })
  })

  it('a number and a receipt photo for each copy ride on the filing, and the photo goes to Sent by us', async () => {
    renderWithProviders(<LienFilingTabs {...props({ isSub: true, originalContractorName: 'Birch Builders', originalContractorAddress: '9 Birch Rd, Marlow, TX 78000', originalContractorAddressRead: true })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Record service…' }))
    fireEvent.change(within(box()).getByLabelText('Served on'), { target: { value: '2026-11-18' } })
    fireEvent.change(within(box()).getByLabelText('Copy to the owner, certified mail number'), { target: { value: '0000 0000 0001' } })
    fireEvent.change(within(box()).getByLabelText('Copy to the original contractor, certified mail number'), { target: { value: '0000 0000 0002' } })
    const ownerCopy = box().querySelector('[data-lien-service-copy="owner"]') as HTMLElement
    const shot = new File(['not really a picture'], 'IMG_0001.jpg', { type: 'image/jpeg' })
    fireEvent.change(within(ownerCopy).getByLabelText('Take a photo of the receipt'), { target: { files: [shot] } })
    expect(await within(ownerCopy).findByRole('link', { name: 'Photo saved ›' })).toBeTruthy()
    expect(puts).toEqual([{ jobId: 'job-77', where: 'sent', name: 'Lien affidavit, Job 77, mail receipt, owner, 2026-11-18.jpg' }])
    fireEvent.click(within(box()).getByRole('button', { name: 'Record service' }))
    await waitFor(() => expect(updates.length).toBe(1))
    expect(updates[0]!.row).toEqual({
      served_at: '2026-11-18',
      sends: [
        { recipient: 'owner', method: 'certified_mail', tracking: '0000 0000 0001', sent_on: '2026-11-18', receipt_url: 'https://drive.google.com/file/d/made-up-file/view' },
        { recipient: 'original_contractor', method: 'certified_mail', tracking: '0000 0000 0002', sent_on: '2026-11-18' },
      ],
    })
  })

  it('a served paper keeps a door to add its receipts, opened on what it holds', async () => {
    const served = { ...filed, served_at: '2026-11-18', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '0000 0000 0001', sent_on: '2026-11-18' }] }
    renderWithProviders(<LienFilingTabs {...props({ filings: [notice, served] as never })} />)
    // The Filings list shows the number already on record.
    const proof = document.querySelector('[data-lien-service-proof]') as HTMLElement
    expect(proof.textContent).toContain('Owner of record 0000 0000 0001')
    expect(screen.queryByRole('button', { name: 'Record service…' })).toBeNull()
    fireEvent.click(within(proof).getByRole('button', { name: 'mail receipts' }))
    expect((within(box()).getByLabelText('Served on') as HTMLInputElement).value).toBe('2026-11-18')
    expect((within(box()).getByLabelText('Copy to the owner, certified mail number') as HTMLInputElement).value).toBe('0000 0000 0001')
    fireEvent.click(within(box()).getByRole('button', { name: 'Save the mail receipts' }))
    await waitFor(() => expect(updates.length).toBe(1))
    expect(updates[0]!.row.served_at).toBe('2026-11-18')
  })

  it('a hold closed after the filing does not take the press away', () => {
    // The county is gone from the property record, so the affidavit's gate is closed. The paper is on file and its five days are running.
    renderWithProviders(<LienFilingTabs {...props({ linkedAddress: { ...address, county: '' } as never })} />)
    const press = document.querySelector('[data-lien-held-service]') as HTMLElement
    expect(press.textContent).toBe('Record service…')
    expect(screen.getByText(/This affidavit is already on file\. Mail its copies by /)).toBeTruthy()
    fireEvent.click(press)
    expect(within(box()).getByLabelText('Served on')).toBeTruthy()
  })
})
