// @vitest-environment jsdom
/**
 * The Lien window draws a dev's list of the job's voided by-hand notice records (punch list #443, row 1), under
 * the live filings on each tab, and draws nothing of it for the office. Every job, name and number is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeJob, renderWithProviders } from '../../test/renderSmokeMocks'
import LienFilingTabs from './LienFilingTabs'

const who = vi.hoisted(() => ({ role: 'assistant' }))
const io = vi.hoisted(() => ({ asked: [] as string[] }))

vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  const auth = () => makeUseAuthValue({ role: who.role })
  return { useAuth: auth, useOptionalAuth: auth }
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/jobs/lienByHandRecordDeleteIo', () => ({
  readLienRecordTies: async () => ({ deskPapers: 0, bills: 0, appliedFrom: 0, sentCopies: 0 }),
  countLienPacketSiblings: async () => 0,
  deleteLienByHandRecord: async (id: string) => void io.asked.push(id),
}))

afterEach(() => {
  cleanup()
  io.asked.length = 0
  who.role = 'assistant'
})

const job = makeJob({ id: 'job-9100', hcp_number: '9100', job_name: 'ZZ Test lien walk', customer_name: 'ZZ Test Customer', job_address: '100 Sample St, Alder, TX 78000', status: 'billed', revenue: 9000, payments_made: 0 })
const address = { id: 'addr-1', county: 'Alder', legal_description: 'LOT 1 BLK 2 SAMPLE SUBD', owner_name: 'Sample Holdings LLC', owner_company: '', owner_mailing_address: '1 Owner Way, Alder, TX 78000', owner_mode: 'company', homestead: false, property_kind: 'non_residential' }
const voidedByHand = { id: 'notice-void', job_id: 'job-9100', kind: 'notice_53_056', by_hand: true, packet_id: 'p1', months_covered: ['2026-08'], sends: [], fields: {}, amount: 9000, filed_at: null, voided_at: '2026-11-24T20:00:00Z', created_at: '2026-11-23T18:00:00Z', document_url: '', document_note: '' }

type Props = Parameters<typeof LienFilingTabs>[0]
function mount(activeTab: Props['activeTab']) {
  const onChanged = vi.fn()
  const all: Props = {
    job,
    jobNumber: '9100',
    activeTab,
    issuer: null,
    signerNameFallback: 'Sample Leader, Master Plumber',
    linkedAddress: address as never,
    jobOwnerRow: null,
    filings: [voidedByHand] as never,
    clock: { workMonth: '2026-08', noticeDeadline: '2026-10-15', filingDeadline: '2026-12-15' },
    isSub: true,
    originalContractorName: 'Sample Contractor',
    ownerEmail: '',
    originalContractorEmail: '',
    onChanged,
  }
  renderWithProviders(<LienFilingTabs {...all} />)
  return { onChanged }
}

describe('LienFilingTabs · a dev’s voided by-hand notice records (punch list #443)', () => {
  it('draws no such list for the office, on any tab', () => {
    for (const tab of ['notice', 'affidavit', 'release_record'] as const) {
      mount(tab)
      expect(screen.queryByTestId('lien-voided-by-hand')).toBeNull()
      cleanup()
    }
  })

  it('draws it once for a dev on each tab, though the job has no live filing', () => {
    who.role = 'dev'
    for (const tab of ['notice', 'affidavit', 'release_record'] as const) {
      mount(tab)
      expect(screen.getAllByTestId('lien-voided-by-hand')).toHaveLength(1)
      expect(screen.getByTestId('lien-voided-by-hand').textContent).toContain('Voided by-hand notice records · 1')
      cleanup()
    }
  })

  it('a dev’s delete goes through the shared writer and the window reads again', async () => {
    who.role = 'dev'
    const { onChanged } = mount('notice')
    const box = screen.getByTestId('lien-voided-by-hand')
    fireEvent.click(within(box).getByRole('button', { name: 'Show' }))
    fireEvent.click(within(box).getByRole('button', { name: 'Delete…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete the record' }))
    await waitFor(() => expect(io.asked).toEqual(['notice-void']))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  })
})
