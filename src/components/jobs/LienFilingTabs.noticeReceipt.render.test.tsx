// @vitest-environment jsdom
/**
 * A § 53.056 notice's sends take a photo of each certified receipt (v2.7557): the photo is saved to the job's folder,
 * the number read off it fills the copy's box, and the recorded send carries both. A copy whose number could not be
 * read says so and keeps its box for typing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import LienFilingTabs from './LienFilingTabs'

const inserts: Array<Record<string, unknown>> = []
const named: string[] = []

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
    }),
  },
}))
vi.mock('../../lib/materials/photoShrink', () => ({ shrinkPhoto: async (f: File) => ({ blob: f, shrunk: true }) }))
vi.mock('../../lib/jobs/jobFolderAddFileIo', () => ({
  putJobFolderFile: async (_job: string, _where: string, file: File) => {
    named.push(file.name)
    return { url: `https://drive.example/${named.length}` }
  },
}))
// The owner's receipt reads; the contractor's photo is too blurry to read.
vi.mock('../../lib/jobs/lienReceiptReadIo', () => ({ readTrackingFromPhoto: async (f: File) => (f.name === 'owner.jpg' ? '9407111899560000000001' : '') }))

afterEach(() => {
  cleanup()
  inserts.length = 0
  named.length = 0
})

const job = makeJob({ id: 'job-4127', hcp_number: '4127', job_name: 'Sample Creek Bldg C', job_address: '2210 Sample Creek Dr, Kyle, TX 78640', status: 'billed', revenue: 27198.65 })
const address = { id: 'addr-1', county: 'Hays', legal_description: 'LOT 3 BLK 1 SAMPLE CREEK', owner_name: 'Cedar Point Holdings LLC', owner_company: '', owner_mailing_address: 'PO Box 4410, Austin, TX 78765', is_homestead: false, property_kind: 'non_residential' }

type Props = Parameters<typeof LienFilingTabs>[0]
const props: Props = {
  job,
  jobNumber: '4127',
  activeTab: 'notice',
  issuer: null,
  signerNameFallback: 'Sam Rivera, Master Plumber',
  linkedAddress: address as never,
  jobOwnerRow: null,
  filings: [],
  clock: { workMonth: '2026-09', noticeDeadline: '2026-11-20', filingDeadline: '2027-01-15' },
  isSub: true,
  originalContractorName: 'Northgate Builders Inc',
  ownerEmail: '',
  originalContractorEmail: '',
  onChanged: () => {},
}

describe('LienFilingTabs · a notice send takes a photo of its receipt', () => {
  it('saves each photo, fills the number it read, and records both on the sends', async () => {
    renderWithProviders(<LienFilingTabs {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save & record sends…' }))
    const [ownerPhoto, contractorPhoto] = screen.getAllByLabelText('Add the receipt')
    fireEvent.change(ownerPhoto!, { target: { files: [new File(['o'], 'owner.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(screen.getByLabelText('Owner tracking number')).toHaveProperty('value', '9407111899560000000001'))
    expect(screen.getByText('Read 9407111899560000000001 off the photo. Check it against the receipt.')).toBeTruthy()
    fireEvent.change(contractorPhoto!, { target: { files: [new File(['c'], 'contractor.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(screen.getByText('No number was read off the photo. Type it in the box.')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Original contractor tracking number'), { target: { value: '9407111899560000000002' } })
    // The folder names the paper: a notice's receipt, not an affidavit's.
    expect(named[0]).toMatch(/^Lien notice, Job 4127, mail receipt, owner, /)
    expect(named[1]).toMatch(/^Lien notice, Job 4127, mail receipt, original contractor, /)

    fireEvent.click(screen.getByRole('button', { name: 'Record both sends' }))
    await waitFor(() => expect(inserts.length).toBe(1))
    const sends = inserts[0]!.sends as Array<Record<string, string>>
    expect(sends[0]).toMatchObject({ recipient: 'owner', tracking: '9407111899560000000001', receipt_url: 'https://drive.example/1' })
    expect(sends[1]).toMatchObject({ recipient: 'original_contractor', tracking: '9407111899560000000002', receipt_url: 'https://drive.example/2' })
  })

  it('a copy sent by email offers no receipt photo', () => {
    renderWithProviders(<LienFilingTabs {...props} ownerEmail="office@example.com" />)
    fireEvent.click(screen.getByRole('button', { name: 'Save & record sends…' }))
    fireEvent.change(screen.getByLabelText('Owner send method'), { target: { value: 'email' } })
    expect(screen.getAllByLabelText('Add the receipt')).toHaveLength(1)
  })
})
