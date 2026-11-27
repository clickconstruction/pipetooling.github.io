// @vitest-environment jsdom
/**
 * The Lien window draws a dev's list of a test job's voided records (punch list #443, row 2), under the live filings
 * on each tab. It draws nothing of it for the office, and nothing on a real job. Every job, name and number is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
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
  deleteLienByHandRecord: async () => undefined,
  readLienNoticeActivityLines: async () => [],
  clearLienNoticeStrayLines: async () => 0,
}))
vi.mock('../../lib/jobs/lienFilingUnvoidIo', () => ({
  LienUnvoidRefused: class extends Error {},
  unvoidLienFiling: async (record: { id: string }) => {
    io.asked.push(record.id)
    return { restored: 1, unsetAside: 0 }
  },
}))

afterEach(() => {
  cleanup()
  io.asked.length = 0
  who.role = 'assistant'
})

const zzJob = makeJob({ id: 'job-9100', hcp_number: '9100', job_name: 'ZZ Test lien walk', customer_name: 'ZZ Test Customer', job_address: '100 Sample St, Alder, TX 78000', status: 'billed', revenue: 9000, payments_made: 0 })
const realJob = makeJob({ id: 'job-9200', hcp_number: '9200', job_name: 'Larkfield Lot 9', customer_name: 'Larkfield Homes', job_address: '200 Sample St, Alder, TX 78000', status: 'billed', revenue: 9000, payments_made: 0 })
const address = { id: 'addr-1', county: 'Alder', legal_description: 'LOT 1 BLK 2 SAMPLE SUBD', owner_name: 'Sample Holdings LLC', owner_company: '', owner_mailing_address: '1 Owner Way, Alder, TX 78000', owner_mode: 'company', homestead: false, property_kind: 'non_residential' }
/** A voided notice the run made: row 1's list of by-hand records never holds it. */
const voided = (jobId: string) => ({ id: 'notice-void', job_id: jobId, kind: 'notice_53_056', by_hand: false, applied_from: null, packet_id: null, months_covered: ['2026-08'], sends: [], fields: {}, amount: 9000, filed_at: null, voided_at: '2026-11-24T20:00:00Z', created_at: '2026-11-23T18:00:00Z', document_url: '', document_note: '' })

type Props = Parameters<typeof LienFilingTabs>[0]
function mount(activeTab: Props['activeTab'], job = zzJob) {
  const onChanged = vi.fn()
  const all: Props = {
    job,
    jobNumber: String(job.hcp_number),
    activeTab,
    issuer: null,
    signerNameFallback: 'Sample Leader, Master Plumber',
    linkedAddress: address as never,
    jobOwnerRow: null,
    filings: [voided(job.id)] as never,
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

describe('LienFilingTabs · a dev’s voided records on a test job (punch list #443, row 2)', () => {
  it('draws no such list for the office, on any tab', async () => {
    for (const tab of ['notice', 'affidavit', 'release_record'] as const) {
      mount(tab)
      await settle()
      expect(screen.queryByTestId('lien-voided-records')).toBeNull()
      cleanup()
    }
  })

  it('draws no such list for a dev on a real job, on any tab', async () => {
    who.role = 'dev'
    for (const tab of ['notice', 'affidavit', 'release_record'] as const) {
      mount(tab, realJob)
      await settle()
      expect(screen.queryByTestId('lien-voided-records')).toBeNull()
      cleanup()
    }
  })

  it('draws it once for a dev on a test job, on each tab, though the job has no live filing', async () => {
    who.role = 'dev'
    for (const tab of ['notice', 'affidavit', 'release_record'] as const) {
      mount(tab)
      await settle()
      expect(screen.getAllByTestId('lien-voided-records')).toHaveLength(1)
      expect(screen.getByTestId('lien-voided-records').textContent).toContain('Voided records · 1')
      // The record is not one made by hand, so row 1's list of by-hand records is not drawn for it.
      expect(screen.queryByTestId('lien-voided-by-hand')).toBeNull()
      cleanup()
    }
  })

  it('a dev’s Put back… goes through the shared writer with the record, and the window reads again', async () => {
    who.role = 'dev'
    const { onChanged } = mount('notice')
    const box = screen.getByTestId('lien-voided-records')
    fireEvent.click(within(box).getByRole('button', { name: 'Show' }))
    fireEvent.click(within(box).getByRole('button', { name: 'Put back…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Put the record back' }))
    await waitFor(() => expect(io.asked).toEqual(['notice-void']))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  })
})
