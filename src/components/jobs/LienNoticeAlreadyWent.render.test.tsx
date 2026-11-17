// @vitest-environment jsdom
/**
 * Already mailed? Record it (v2.7508): when the property holds a notice on record the door first asks which paper
 * went, warns on what does not match, takes a reason and applies it to this job; with none on record, or when the
 * paper is not on the list, it is the by-hand record as before.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { LienRecordedPaper } from '../../lib/jobs/lienNoticeApply'
import LienNoticeAlreadyWent from './LienNoticeAlreadyWent'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
vi.mock('../../lib/jobs/lienNoticeByHandIo', () => ({ loadJobsAtProperty: async () => [], recordLienNoticeByHand: vi.fn() }))

// Made-up: 14 Larkspur Ln under Redbud Builders. A paper of Sep 22 is on record on jobs 4101 and 4112.
const paper: LienRecordedPaper = {
  key: 'sent:2026-09-22:certified_mail:11',
  sourceFilingId: 'f1',
  sourceJobId: 'j4101',
  sourceJobLabel: '4101',
  sentOn: '2026-09-22',
  method: 'certified_mail',
  tracking: '11',
  toOwner: true,
  toContractor: false,
  claimAsPrinted: 12_400,
  monthsPrinted: ['2026-06', '2026-07', '2026-08'],
  jobLabels: ['4101', '4112'],
  documentUrl: '',
  sends: [{ recipient: 'owner', method: 'certified_mail', tracking: '11', sent_on: '2026-09-22' }],
  packetId: 'p1',
  fields: {},
}
const io = vi.hoisted(() => ({ papers: [] as unknown[], apply: vi.fn(async (_input: unknown) => ({ filingId: 'new', setAside: true })) }))
vi.mock('../../lib/jobs/lienNoticeApplyIo', () => ({
  loadLienApplyContext: async () => ({ papers: io.papers, noticedMonths: [] }),
  applyLienNoticePaper: (input: unknown) => io.apply(input),
}))

const fields = { noticeDate: '2026-11-16', projectDescription: 'Redbud Builders — 14 Larkspur Ln', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Redbud Builders', contractedWithIfDifferent: '', claimAmount: '1900.00', claimantAddress: '', contactPerson: '', homesteadStatement: true }
const onRecorded = vi.fn()
const draw = () =>
  renderWithProviders(
    <LienNoticeAlreadyWent
      apply={{ gcCustomerId: 'gc1', jobNumber: '4107', months: ['2026-09'], propertyKind: 'residential', lastWorkYmd: '2026-09-11', userName: 'Dana', item: { id: 'it1', fields: {}, months: ['2026-09'] } }}
      job={{ id: 'j4107', label: '4107 · Redbud Builders', jobAddress: '14 Larkspur Ln', customerAddressId: 'a1', amount: 1_900, itemId: 'it1' }}
      fields={fields}
      appClaim={1_900}
      appClaimIsTimely={false}
      defaultMonths={['2026-09']}
      todayYmd="2026-11-16"
      userId="u1"
      onClose={() => {}}
      onRecorded={onRecorded}
    />,
  )

beforeEach(() => {
  io.papers = [paper]
  io.apply.mockClear()
  onRecorded.mockClear()
})

describe('LienNoticeAlreadyWent', () => {
  it('asks which paper went, warns, takes a reason and applies it to this job', async () => {
    draw()
    await settle()
    const pane = await screen.findByTestId('lien-notice-apply')
    expect(pane.textContent).toContain('Sep 22 · certified mail · $12,400')
    expect(pane.textContent).toContain('On jobs 4101 and 4112 · names Jun, Jul and Aug · to the owner')
    expect(pane.textContent).toContain('The paper lists Jun, Jul and Aug. September is not printed on it.')
    expect(pane.textContent).toContain('No copy to the original contractor is on record for this paper.')
    expect(pane.textContent).toContain('set aside, not mailed')
    const press = screen.getByTestId('lien-apply-record') as HTMLButtonElement
    expect(press.textContent).toContain('Apply the Sep 22 notice to job 4107')
    // Warned, so the press is dead until a reason is typed.
    expect(press.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why the paper stands for the month'), { target: { value: 'Its total held this job’s unpaid bill.' } })
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(io.apply).toHaveBeenCalledTimes(1))
    expect(io.apply.mock.calls[0]![0]).toMatchObject({ job: { id: 'j4107', amount: 1_900 }, months: ['2026-09'], reason: 'Its total held this job’s unpaid bill.', userId: 'u1', userName: 'Dana', setAside: { id: 'it1' } })
    await waitFor(() => expect(onRecorded).toHaveBeenCalledWith({ filingIds: ['new'], jobs: 1 }))
  })

  it('goes to the by-hand record when the paper is not on the list', async () => {
    draw()
    await settle()
    fireEvent.click(await screen.findByText('It is not on this list. Record it now ›'))
    expect(await screen.findByTestId('lien-notice-by-hand')).toBeTruthy()
  })

  it('is the by-hand record straight away when the property has no notice on record', async () => {
    io.papers = []
    draw()
    await settle()
    expect(await screen.findByTestId('lien-notice-by-hand')).toBeTruthy()
    expect(screen.queryByTestId('lien-notice-apply')).toBeNull()
  })
})
