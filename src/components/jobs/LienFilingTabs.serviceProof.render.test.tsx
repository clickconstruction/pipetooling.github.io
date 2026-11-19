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
// A receipt the filing already holds comes off the filing at once (v2.7743): the write, then the trash call, in order.
const order: string[] = []
vi.mock('../../lib/jobs/lienReceiptKeepIo', () => ({
  keepLienCopyProof: async (args: { filingId: string; recipient: string; proof: { receiptUrl?: string } }) => {
    order.push(`keep:${args.filingId}:${args.recipient}:${args.proof.receiptUrl}`)
    return []
  },
}))
vi.mock('../../lib/jobs/jobFolderTrashIo', () => ({
  takeFileToTrash: async (jobId: string, id: string | null) => {
    order.push(`trash:${jobId}:${id}`)
    return id ? { where: 'trash' } : null
  },
  untrashJobFolderFile: async () => ({ url: '' }),
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
  order.length = 0
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

describe('LienFilingTabs · the mail receipts on Enter mail numbers… (Record service… until v2.7816)', () => {
  it('the day records alone, as before, and writes no send', async () => {
    renderWithProviders(<LienFilingTabs {...props({})} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enter mail numbers…' }))
    expect(within(box()).getByLabelText('Copy to the owner, certified mail number')).toBeTruthy()
    // A job contracted with the owner mails one copy.
    expect(within(box()).queryByLabelText('Copy to the original contractor, certified mail number')).toBeNull()
    fireEvent.change(within(box()).getByLabelText('Mailed on'), { target: { value: '2026-11-18' } })
    fireEvent.click(within(box()).getByRole('button', { name: 'Record the mailing' }))
    await waitFor(() => expect(updates.length).toBe(1))
    expect(updates[0]).toEqual({ id: 'a1', row: { served_at: '2026-11-18', sends: [] } })
  })

  it('a number and a receipt photo for each copy ride on the filing, and the photo goes to Sent by us', async () => {
    renderWithProviders(<LienFilingTabs {...props({ isSub: true, originalContractorName: 'Birch Builders', originalContractorAddress: '9 Birch Rd, Marlow, TX 78000', originalContractorAddressRead: true })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enter mail numbers…' }))
    fireEvent.change(within(box()).getByLabelText('Mailed on'), { target: { value: '2026-11-18' } })
    fireEvent.change(within(box()).getByLabelText('Copy to the owner, certified mail number'), { target: { value: '0000 0000 0001' } })
    fireEvent.change(within(box()).getByLabelText('Copy to the original contractor, certified mail number'), { target: { value: '0000 0000 0002' } })
    const ownerCopy = box().querySelector('[data-lien-service-copy="owner"]') as HTMLElement
    const shot = new File(['not really a picture'], 'IMG_0001.jpg', { type: 'image/jpeg' })
    fireEvent.change(within(ownerCopy).getByLabelText('Add the receipt'), { target: { files: [shot] } })
    expect(await within(ownerCopy).findByRole('link', { name: 'Open the receipt' })).toBeTruthy()
    expect(puts).toEqual([{ jobId: 'job-77', where: 'sent', name: 'Lien affidavit, Job 77, mail receipt, owner, 2026-11-18.jpg' }])
    fireEvent.click(within(box()).getByRole('button', { name: 'Record the mailing' }))
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
    // The Filings list shows the number already on record, in What went out under the affidavit's row.
    const went = document.querySelector('[data-lien-mail-proof="affidavit"] [data-lien-mail-proof-envelope="owner"]') as HTMLElement
    expect(went.textContent).toContain('Owner of record')
    expect(went.textContent).toContain('Certified mail 0000 0000 0001')
    const proof = document.querySelector('[data-lien-service-proof]') as HTMLElement
    expect(screen.queryByRole('button', { name: 'Enter mail numbers…' })).toBeNull()
    fireEvent.click(within(proof).getByRole('button', { name: 'mail receipts' }))
    expect((within(box()).getByLabelText('Mailed on') as HTMLInputElement).value).toBe('2026-11-18')
    expect((within(box()).getByLabelText('Copy to the owner, certified mail number') as HTMLInputElement).value).toBe('0000 0000 0001')
    fireEvent.click(within(box()).getByRole('button', { name: 'Save the mail receipts' }))
    await waitFor(() => expect(updates.length).toBe(1))
    expect(updates[0]!.row.served_at).toBe('2026-11-18')
  })

  it('a receipt the filing holds comes off the filing at once, so its file can go to Drive’s trash (v2.7743)', async () => {
    const receipt = 'https://drive.google.com/file/d/made-up-receipt-1/view'
    const served = { ...filed, served_at: '2026-11-18', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '0000 0000 0001', sent_on: '2026-11-18', receipt_url: receipt }] }
    const onChanged = vi.fn()
    renderWithProviders(<LienFilingTabs {...props({ filings: [notice, served] as never, onChanged })} />)
    fireEvent.click(within(document.querySelector('[data-lien-service-proof]') as HTMLElement).getByRole('button', { name: 'mail receipts' }))
    const ownerCopy = box().querySelector('[data-lien-service-copy="owner"]') as HTMLElement
    fireEvent.click(within(ownerCopy).getByRole('button', { name: 'Take off' }))
    fireEvent.click(within(ownerCopy).getByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(ownerCopy.querySelector('[data-lien-receipt-off]')?.textContent).toContain('Taken off. The file is in Drive’s trash.'))
    expect(order).toEqual(['keep:a1:owner:', 'trash:job-77:made-up-receipt-1'])
    expect(onChanged).toHaveBeenCalledTimes(1)
    // Nothing else was written: the day and the number wait for the press below, as before.
    expect(updates).toEqual([])
  })

  it('a receipt added in the form alone is taken off with no write, and its file still goes to the trash', async () => {
    renderWithProviders(<LienFilingTabs {...props({})} />)
    fireEvent.click(screen.getByRole('button', { name: 'Enter mail numbers…' }))
    const ownerCopy = box().querySelector('[data-lien-service-copy="owner"]') as HTMLElement
    fireEvent.change(within(ownerCopy).getByLabelText('Add the receipt'), { target: { files: [new File(['not really a picture'], 'IMG_0001.jpg', { type: 'image/jpeg' })] } })
    expect(await within(ownerCopy).findByRole('link', { name: 'Open the receipt' })).toBeTruthy()
    fireEvent.click(within(ownerCopy).getByRole('button', { name: 'Take off' }))
    fireEvent.click(within(ownerCopy).getByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(ownerCopy.querySelector('[data-lien-receipt-off]')?.textContent).toContain('Taken off. The file is in Drive’s trash.'))
    expect(order).toEqual(['trash:job-77:made-up-file'])
  })

  // A stop window's card lands here (`lienMailProofDoor.ts`): each lack on the spot where it is entered.
  it('landed for a mail number on a lien not yet served, the service step opens with that copy’s fields lit', async () => {
    renderWithProviders(<LienFilingTabs {...props({ land: { jobId: 'j1', filingId: 'a1', paper: 'affidavit', recipient: 'owner', lack: 'number', at: 1 } })} />)
    await waitFor(() => expect(box()).toBeTruthy())
    await waitFor(() => expect(document.querySelectorAll('[data-landed="yes"]')).toHaveLength(1))
    expect(document.querySelector('[data-landed="yes"]')!.getAttribute('data-lien-service-copy')).toBe('owner')
    expect(updates).toEqual([])
  })

  it('landed for the print, Print the copies to mail is lit and no form opens', async () => {
    const onServePrinted = vi.fn()
    // A lien the app drew keeps its paper, which is what a copy prints from. Every name here is made up.
    const drawn = { ...filed, fields: { county: 'Alder', claimantPersonName: 'Pat Marlow', claimantCompany: 'Sample Plumbing LLC', claimantAddress: 'PO Box 100, Marlow, TX 78000', legalDescription: 'LOT 1 BLK 2 ALDER SUBD', propertyAddress: '12 Alder St, Marlow, TX 78000', contractedWithName: 'Alder Holdings LLC', workDescription: 'Plumbing labor and materials', workStart: '2026-08-01', workEnd: '2026-08-28', ownerName: 'Alder Holdings LLC', ownerAddress: '1 Owner Way, Marlow, TX 78000', originalContractorName: '', originalContractorAddress: '', contractAmount: '9000.00', paidAmount: '0.00', unpaidAmount: '9000.00', includeNoticesSworn: true, form: 'short', isSub: false } }
    renderWithProviders(<LienFilingTabs {...props({ filings: [notice, drawn] as never, onServePrinted, land: { jobId: 'j1', filingId: 'a1', paper: 'affidavit', recipient: 'owner', lack: 'print', at: 3 } })} />)
    await waitFor(() => expect(document.querySelectorAll('[data-landed="yes"]')).toHaveLength(1))
    const lit = document.querySelector('[data-landed="yes"]') as HTMLElement
    expect(lit.hasAttribute('data-lien-serve-copies')).toBe(true)
    expect(within(lit).getByRole('button', { name: 'Print the copies to mail' })).toBeTruthy()
    expect(box()).toBeNull()
    expect(updates).toEqual([])
  })

  it('landed for a receipt, the paper’s own row is lit at that copy’s line and the cursor is on Add the receipt', async () => {
    const served = { ...filed, served_at: '2026-11-18', sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '0000 0000 0001', sent_on: '2026-11-18' }] }
    renderWithProviders(<LienFilingTabs {...props({ filings: [notice, served] as never, land: { jobId: 'j1', filingId: 'a1', paper: 'affidavit', recipient: 'owner', lack: 'receipt', at: 2 } })} />)
    await waitFor(() => expect(document.querySelectorAll('[data-landed="yes"]')).toHaveLength(1))
    const lit = document.querySelector('[data-landed="yes"]') as HTMLElement
    expect(lit.getAttribute('data-lien-mail-proof-envelope')).toBe('owner')
    expect(lit.closest('[data-lien-filing-row]')?.getAttribute('data-lien-filing-row')).toBe('a1')
    expect(document.activeElement?.textContent).toBe('Add the receipt')
    // Landing opens no form and writes nothing.
    expect(box()).toBeNull()
    expect(updates).toEqual([])
  })

  it('with nothing to land on, lights nothing', () => {
    renderWithProviders(<LienFilingTabs {...props({})} />)
    expect(document.querySelectorAll('[data-landed="yes"]')).toHaveLength(0)
  })

  it('a hold closed after the filing does not take the press away', () => {
    // The county is gone from the property record, so the affidavit's gate is closed. The paper is on file and its five days are running.
    renderWithProviders(<LienFilingTabs {...props({ linkedAddress: { ...address, county: '' } as never })} />)
    const press = document.querySelector('[data-lien-held-service]') as HTMLElement
    expect(press.textContent).toBe('Enter mail numbers…')
    expect(screen.getByText(/This affidavit is already on file\. Mail its copies by /)).toBeTruthy()
    fireEvent.click(press)
    expect(within(box()).getByLabelText('Mailed on')).toBeTruthy()
  })
})
