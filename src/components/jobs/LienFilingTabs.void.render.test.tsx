// @vitest-environment jsdom
/**
 * Void on a filed lien in the Lien window (v2.7892): the filing is voided through `voidLienFiling`, which reads where
 * the database put the lien's paper, and the window says where it went. Until then Void wrote `voided_at` and said
 * *Record voided.* while the paper stayed on the Board under Served.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import LienFilingTabs from './LienFilingTabs'

const voided = vi.hoisted(() => ({ calls: [] as Array<{ id: string; kind: string }>, answer: 'approved' as string, fail: null as null | { message: string } }))

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'assistant' })
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/jobs/lienFilingVoidIo', () => ({
  voidLienFiling: async (filing: { id: string; kind: string }) => {
    voided.calls.push(filing)
    if (voided.fail) throw voided.fail
    return voided.answer
  },
}))

afterEach(() => {
  cleanup()
  voided.calls.length = 0
  voided.answer = 'approved'
  voided.fail = null
})

// Every job, county and number here is made up.
const job = makeJob({ id: 'job-9004', hcp_number: '9004', job_name: 'Sample Job', job_address: '100 Sample St, Alder, TX 78000', status: 'billed', revenue: 9000, payments_made: 0 })
const address = { id: 'addr-1', county: 'Alder', legal_description: 'LOT 1 BLK 2 SAMPLE SUBD', owner_name: 'Sample Holdings LLC', owner_company: '', owner_mailing_address: '1 Owner Way, Alder, TX 78000', owner_mode: 'company', homestead: false, property_kind: 'non_residential' }
const filedLien = { id: 'filing-1', job_id: 'job-9004', kind: 'affidavit', months_covered: [], sends: [], fields: {}, amount: 9000, filed_at: '2026-11-16', county: 'Alder', recording_number: '20260229004', serve_due: '2026-11-23', served_at: null, voided_at: null, created_at: '2026-11-16T15:00:00Z', document_url: '', document_note: '' }
const sentNotice = { id: 'notice-1', job_id: 'job-9004', kind: 'notice_53_056', months_covered: ['2026-08'], sends: [], fields: {}, amount: 9000, filed_at: null, voided_at: null, created_at: '2026-09-10T15:00:00Z', document_url: '', document_note: '' }

type Props = Parameters<typeof LienFilingTabs>[0]
function mount(over: Partial<Props> = {}) {
  const onChanged = vi.fn()
  const all: Props = {
    job,
    jobNumber: '9004',
    activeTab: 'affidavit',
    issuer: null,
    signerNameFallback: 'Sample Leader, Master Plumber',
    linkedAddress: address as never,
    jobOwnerRow: null,
    filings: [filedLien, sentNotice] as never,
    clock: { workMonth: '2026-08', noticeDeadline: '2026-10-15', filingDeadline: '2026-12-15' },
    isSub: true,
    originalContractorName: 'Sample Contractor',
    ownerEmail: '',
    originalContractorEmail: '',
    onChanged,
    ...over,
  }
  renderWithProviders(<LienFilingTabs {...all} />)
  return { onChanged }
}
const filingRow = (id: string) => document.querySelector(`[data-lien-filing-row="${id}"]`) as HTMLElement

describe('LienFilingTabs · Void on a filed lien (v2.7892)', () => {
  it('asks first, voids the filing through the shared writer, and says the paper is back on the desk', async () => {
    const { onChanged } = mount()
    fireEvent.click(within(filingRow('filing-1')).getByRole('button', { name: 'Void' }))
    expect(voided.calls).toEqual([])
    fireEvent.click(within(filingRow('filing-1')).getByRole('button', { name: 'Confirm void' }))
    await waitFor(() => expect(voided.calls).toEqual([{ id: 'filing-1', kind: 'affidavit' }]))
    expect(await screen.findByText('Record voided. The lien’s paper is approved again and back on the Lien desk.')).toBeTruthy()
    expect(onChanged).toHaveBeenCalledTimes(1)
  })

  it('says so when the filing is voided and its paper still reads as filed', async () => {
    voided.answer = 'still_sent'
    mount()
    fireEvent.click(within(filingRow('filing-1')).getByRole('button', { name: 'Void' }))
    fireEvent.click(within(filingRow('filing-1')).getByRole('button', { name: 'Confirm void' }))
    expect(await screen.findByText('Record voided. Its paper still reads as filed on the Lien desk. Tell your lead.')).toBeTruthy()
  })

  it('a notice voids through the same writer and says the notice is back, in a notice’s words (v2.7911)', async () => {
    mount()
    fireEvent.click(within(filingRow('notice-1')).getByRole('button', { name: 'Void' }))
    fireEvent.click(within(filingRow('notice-1')).getByRole('button', { name: 'Confirm void' }))
    await waitFor(() => expect(voided.calls).toEqual([{ id: 'notice-1', kind: 'notice_53_056' }]))
    expect(await screen.findByText('Record voided. The notice is approved again and back on the Lien desk.')).toBeTruthy()
  })

  it('a notice with no paper tied to it says only that it is voided', async () => {
    voided.answer = 'none'
    mount()
    fireEvent.click(within(filingRow('notice-1')).getByRole('button', { name: 'Void' }))
    fireEvent.click(within(filingRow('notice-1')).getByRole('button', { name: 'Confirm void' }))
    expect(await screen.findByText('Record voided.')).toBeTruthy()
  })

  it('a void that does not land names its reason and changes nothing', async () => {
    voided.fail = { message: 'permission denied for table job_lien_filings' }
    const { onChanged } = mount()
    fireEvent.click(within(filingRow('filing-1')).getByRole('button', { name: 'Void' }))
    fireEvent.click(within(filingRow('filing-1')).getByRole('button', { name: 'Confirm void' }))
    expect(await screen.findByText(/permission denied for table job_lien_filings/)).toBeTruthy()
    expect(onChanged).not.toHaveBeenCalled()
  })
})
