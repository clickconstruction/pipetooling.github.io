// @vitest-environment jsdom
/**
 * The Lien window draws a dev's list of the job's voided by-hand notice records (punch list #443, row 1), under
 * the live filings on each tab, and draws nothing of it for the office. On a test job it reads the job's Activity by
 * the job's id and draws the lines of records deleted before. Every job, name and number is made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { makeJob, renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienFilingTabs from './LienFilingTabs'

const who = vi.hoisted(() => ({ role: 'assistant' }))
const io = vi.hoisted(() => ({ asked: [] as string[], lines: [] as Array<{ id: string; detail: unknown }>, linesRead: [] as string[], clearAsked: [] as string[] }))

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
  readLienNoticeActivityLines: async (jobId: string) => {
    io.linesRead.push(jobId)
    return io.lines
  },
  clearLienNoticeStrayLines: async (jobId: string) => {
    io.clearAsked.push(jobId)
    return io.lines.length
  },
}))

afterEach(() => {
  cleanup()
  io.asked.length = 0
  io.lines = []
  io.linesRead.length = 0
  io.clearAsked.length = 0
  who.role = 'assistant'
})

const job = makeJob({ id: 'job-9100', hcp_number: '9100', job_name: 'ZZ Test lien walk', customer_name: 'ZZ Test Customer', job_address: '100 Sample St, Alder, TX 78000', status: 'billed', revenue: 9000, payments_made: 0 })
const address = { id: 'addr-1', county: 'Alder', legal_description: 'LOT 1 BLK 2 SAMPLE SUBD', owner_name: 'Sample Holdings LLC', owner_company: '', owner_mailing_address: '1 Owner Way, Alder, TX 78000', owner_mode: 'company', homestead: false, property_kind: 'non_residential' }
const voidedByHand = { id: 'notice-void', job_id: 'job-9100', kind: 'notice_53_056', by_hand: true, packet_id: 'p1', months_covered: ['2026-08'], sends: [], fields: {}, amount: 9000, filed_at: null, voided_at: '2026-11-24T20:00:00Z', created_at: '2026-11-23T18:00:00Z', document_url: '', document_note: '' }

type Props = Parameters<typeof LienFilingTabs>[0]
function mount(activeTab: Props['activeTab'], filings: unknown[] = [voidedByHand]) {
  const onChanged = vi.fn()
  const all: Props = {
    job,
    jobNumber: '9100',
    activeTab,
    issuer: null,
    signerNameFallback: 'Sample Leader, Master Plumber',
    linkedAddress: address as never,
    jobOwnerRow: null,
    filings: filings as never,
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
  it('draws no such list for the office, on any tab, and reads no Activity line for it', async () => {
    io.lines = [{ id: 'l-gone', detail: { source_id: 'notice-gone' } }]
    for (const tab of ['notice', 'affidavit', 'release_record'] as const) {
      mount(tab)
      await settle()
      expect(screen.queryByTestId('lien-voided-by-hand')).toBeNull()
      expect(screen.queryByTestId('lien-notice-stray-lines')).toBeNull()
      cleanup()
    }
    expect(io.linesRead).toEqual([])
  })

  it('draws it once for a dev on each tab, though the job has no live filing', async () => {
    who.role = 'dev'
    for (const tab of ['notice', 'affidavit', 'release_record'] as const) {
      mount(tab)
      await settle()
      expect(screen.getAllByTestId('lien-voided-by-hand')).toHaveLength(1)
      expect(screen.getByTestId('lien-voided-by-hand').textContent).toContain('Voided by-hand notice records · 1')
      expect(screen.queryByTestId('lien-notice-stray-lines')).toBeNull()
      cleanup()
    }
  })

  it('reads the job’s Activity by the job’s id and draws a dev the lines of deleted records, on a job with no record at all', async () => {
    who.role = 'dev'
    io.lines = [
      { id: 'l-gone', detail: { source_id: 'notice-gone' } },
      { id: 'l-stands', detail: { source_id: 'notice-void' } },
    ]
    for (const tab of ['notice', 'affidavit', 'release_record'] as const) {
      mount(tab, [])
      const box = await screen.findByTestId('lien-notice-stray-lines')
      // With no record on the job, the line that names notice-void is a stray too.
      expect(box.textContent).toContain('Activity lines of deleted notice records · 2')
      expect(screen.getAllByTestId('lien-notice-stray-lines')).toHaveLength(1)
      expect(screen.queryByTestId('lien-voided-by-hand')).toBeNull()
      cleanup()
    }
    expect(io.linesRead).toEqual(['job-9100', 'job-9100', 'job-9100'])
  })

  it('a dev’s Clear… goes through the shared writer with the job’s id, and the window reads again', async () => {
    who.role = 'dev'
    io.lines = [{ id: 'l-gone', detail: { source_id: 'notice-gone' } }]
    const { onChanged } = mount('notice')
    const box = await screen.findByTestId('lien-notice-stray-lines')
    expect(box.textContent).toContain('· 1')
    fireEvent.click(within(box).getByRole('button', { name: 'Clear…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Clear 1 line' }))
    await waitFor(() => expect(io.clearAsked).toEqual(['job-9100']))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
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
