// @vitest-environment jsdom
/**
 * Print the copies to mail (punch list #366): a filed lien affidavit's copy and its cover letter, printed from the
 * Lien window and filed on the job. A filing with no recording number is held, and the letter can be left out while
 * the copy never is.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import type { JobLienFilingRow } from '../../lib/jobs/lienDeadlines'
import { LienServeCopiesPress } from './LienServeCopiesPress'

const prints: Array<{ html: string; filing: Record<string, unknown> }> = []

const updates: Array<{ row: Record<string, unknown>; id: unknown }> = []

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
vi.mock('../../lib/sent/sentCopiesIo', () => ({
  printAndFile: (html: string, filing: Record<string, unknown>) => {
    prints.push({ html, filing })
    return true
  },
}))

afterEach(() => {
  cleanup()
  prints.length = 0
  updates.length = 0
  window.localStorage.clear()
})

// Every name, address and figure here is made up.
const FIELDS = {
  county: 'Alder',
  claimantPersonName: 'Pat Marlow',
  claimantCompany: 'Sample Plumbing LLC',
  claimantAddress: 'PO Box 100, Marlow, TX 78000',
  legalDescription: 'LOT 1 BLK 2 ALDER SUBD',
  propertyAddress: '12 Alder St, Marlow, TX 78000',
  contractedWithName: 'Brightline Builders',
  workDescription: 'Plumbing labor and materials',
  workStart: '2026-08-01',
  workEnd: '2026-08-28',
  ownerName: 'Alder Holdings LLC',
  ownerAddress: '1 Owner Way, Marlow, TX 78000',
  originalContractorName: 'Brightline Builders',
  originalContractorAddress: '12 Example Pkwy, Marlow, TX 78000',
  contractAmount: '9000.00',
  paidAmount: '0.00',
  unpaidAmount: '9000.00',
  includeNoticesSworn: true,
  form: 'short',
  isSub: true,
}

const filing = (over: Record<string, unknown> = {}) =>
  ({ id: 'a1', job_id: 'job-77', kind: 'affidavit', fields: FIELDS, county: 'Alder', recording_number: '2026-0001', filed_at: '2026-11-13', serve_due: '2026-11-18', served_at: null, voided_at: null, sends: [], ...over }) as unknown as JobLienFilingRow

const issuer = { companyName: 'Sample Plumbing LLC', addressText: 'PO Box 100\nMarlow, TX 78000', phone: '(512) 555-0142', email: '', licenseLine: '' } as never

describe('LienServeCopiesPress', () => {
  it('prints each reader’s letter and copy, and files the packet on the job against the filing', () => {
    renderWithProviders(<LienServeCopiesPress filing={filing()} jobId="job-77" jobNumber="77" isSub issuer={issuer} />)
    expect(screen.getByText('Two envelopes: the owner and the original contractor. Mail each envelope by certified mail. Then press Enter mail numbers… and type each number.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Print the copies to mail' }))
    expect(prints).toHaveLength(1)
    const { html, filing: filed } = prints[0]!
    expect(filed).toEqual({ kind: 'lien_affidavit_copy', title: 'Copy of lien affidavit — Job 77', jobIds: ['job-77'], recipientName: 'Alder Holdings LLC', source: { table: 'job_lien_filings', id: 'a1' } })
    expect(html).toContain('COPY. This is a copy of the lien affidavit filed with the County Clerk of Alder County, Texas, on November 13, 2026, as document number 2026-0001.')
    expect(html).toContain('It is sent to you as the owner or reputed owner of the property')
    expect(html).toContain('It is sent to you as the original contractor')
    expect(html).toContain('call (512) 555-0142')
    expect(html.match(/class="filing-paper/g)?.length).toBe(4)
  })

  it('says counsel has not read the letter or the copy yet', () => {
    renderWithProviders(<LienServeCopiesPress filing={filing()} jobId="job-77" jobNumber="77" isSub issuer={issuer} />)
    expect(screen.getByText('Counsel has not read this letter yet.')).toBeTruthy()
    expect(screen.getByText('Counsel has not said yet that this page counts as the copy. The page says what it does not show.')).toBeTruthy()
  })

  it('leaves the letter out when its box is unticked, and never the copy', () => {
    renderWithProviders(<LienServeCopiesPress filing={filing()} jobId="job-77" jobNumber="77" isSub={false} issuer={issuer} />)
    // The filing's own answer wins over the job's: the paper on file names an original contractor.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Print the cover letter in front of each copy' }))
    expect(screen.queryByText('Counsel has not read this letter yet.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Print the copies to mail' }))
    const html = prints[0]!.html
    expect(html).not.toContain('It is sent to you as')
    expect(html.match(/class="filing-paper/g)?.length).toBe(2)
    expect(html).toContain('COPY. This is a copy of the lien affidavit')
  })

  it('holds a filing with no recording number, says why, and takes the number right there', async () => {
    const onChanged = vi.fn()
    renderWithProviders(<LienServeCopiesPress filing={filing({ recording_number: '' })} jobId="job-77" jobNumber="77" isSub issuer={issuer} onChanged={onChanged} />)
    const press = screen.getByRole('button', { name: 'Print the copies to mail' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(screen.getByText('Held: no recording number yet.')).toBeTruthy()
    expect(screen.getByText('Type the number the clerk gave.')).toBeTruthy()
    fireEvent.click(press)
    expect(prints).toHaveLength(0)
    const save = screen.getByRole('button', { name: 'Save the number' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox', { name: 'Recording number' }), { target: { value: ' 2026-0042 ' } })
    fireEvent.click(save)
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(updates).toEqual([{ row: { recording_number: '2026-0042' }, id: 'a1' }])
  })

  it('mails to the owner’s address on the property record today', () => {
    renderWithProviders(<LienServeCopiesPress filing={filing({ fields: { ...FIELDS, ownerAddress: '' } })} jobId="job-77" jobNumber="77" isSub issuer={issuer} to={{ owner: { name: 'Alder Holdings LLC', address: '500 New Owner Blvd, Marlow, TX 78000' }, contractor: { name: '', address: '' } }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Print the copies to mail' }))
    expect(prints[0]!.html).toContain('500 New Owner Blvd, Marlow, TX 78000')
  })

  it('says where a missing address is added', () => {
    renderWithProviders(<LienServeCopiesPress filing={filing({ fields: { ...FIELDS, ownerAddress: '' } })} jobId="job-77" jobNumber="77" isSub issuer={issuer} />)
    expect(screen.getByText('Held: no mailing address for the owner.')).toBeTruthy()
    expect(screen.getByText('Add it on the property record.')).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Recording number' })).toBeNull()
  })

  it('draws nothing for a row that is not a filed affidavit', () => {
    const { container } = renderWithProviders(<LienServeCopiesPress filing={filing({ filed_at: null })} jobId="job-77" jobNumber="77" isSub issuer={issuer} />)
    expect(container.querySelector('[data-lien-serve-copies]')).toBeNull()
  })
})
