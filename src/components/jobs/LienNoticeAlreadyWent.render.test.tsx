// @vitest-environment jsdom
/**
 * Already mailed? Record it (v2.7508): when the property holds a notice on record the door first asks which paper
 * went, warns on what does not match, takes a reason and applies it to this job; with none on record, or when the
 * paper is not on the list, it is the by-hand record as before.
 *
 * The owner's answers of 2026-11-20 to the audit of punch list #361: `startBlank` opens the step with no paper picked
 * and no month ticked; with no month to apply the step is the by-hand record at once, with no read when the desk asks
 * for none; and `onReady` is told once per read, when the step has its final pane.
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
const io = vi.hoisted(() => ({
  papers: [] as unknown[],
  noticedMonths: [] as string[],
  load: vi.fn(async (_job: unknown) => ({ papers: io.papers, noticedMonths: io.noticedMonths })),
  apply: vi.fn(async (_input: unknown) => ({ filingId: 'new', setAside: true })),
}))
vi.mock('../../lib/jobs/lienNoticeApplyIo', () => ({
  loadLienApplyContext: (job: unknown) => io.load(job),
  applyLienNoticePaper: (input: unknown) => io.apply(input),
}))

const fields = { noticeDate: '2026-11-16', projectDescription: 'Redbud Builders — 14 Larkspur Ln', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'Redbud Builders', contractedWithIfDifferent: '', claimAmount: '1900.00', claimantAddress: '', contactPerson: '', homesteadStatement: true }
const onRecorded = vi.fn()
const onReady = vi.fn()
const draw = (over: { months?: string[]; startBlank?: boolean } = {}) =>
  renderWithProviders(
    <LienNoticeAlreadyWent
      apply={{ gcCustomerId: 'gc1', jobNumber: '4107', months: over.months ?? ['2026-09'], propertyKind: 'residential', lastWorkYmd: '2026-09-11', userName: 'Dana', item: { id: 'it1', fields: {}, months: ['2026-09'] }, startBlank: over.startBlank }}
      job={{ id: 'j4107', label: '4107 · Redbud Builders', jobAddress: '14 Larkspur Ln', customerAddressId: 'a1', amount: 1_900, itemId: 'it1' }}
      fields={fields}
      appClaim={1_900}
      appClaimIsTimely={false}
      defaultMonths={['2026-09']}
      todayYmd="2026-11-16"
      userId="u1"
      onClose={() => {}}
      onRecorded={onRecorded}
      onReady={onReady}
    />,
  )

beforeEach(() => {
  io.papers = [paper]
  io.noticedMonths = []
  io.load.mockClear()
  io.apply.mockClear()
  onRecorded.mockClear()
  onReady.mockClear()
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

  // The owner's answer 1 of 2026-11-20: on a missed notice with no month still due the months offered are closed ones,
  // so the office says which paper went and which month it stood for. Nothing is picked or ticked for it.
  it('with startBlank, opens with no paper picked and no month ticked, and Apply waits for both', async () => {
    draw({ startBlank: true })
    await settle()
    await screen.findByTestId('lien-notice-apply')
    const radio = screen.getByRole('radio', { name: 'The notice of Sep 22 · certified mail · $12,400' }) as HTMLInputElement
    const sep = screen.getByRole('checkbox', { name: 'Sep 2026' }) as HTMLInputElement
    const press = screen.getByTestId('lien-apply-record') as HTMLButtonElement
    // The lone paper on record is not picked, and the offered month is not ticked.
    expect(radio.checked).toBe(false)
    expect(sep.checked).toBe(false)
    expect(press.textContent).toContain('Pick the paper that went')
    expect(press.disabled).toBe(true)
    expect(screen.queryByTestId('lien-apply-checks')).toBeNull()
    // The paper picked, with no month ticked: the check refuses, and no reason is asked for yet.
    fireEvent.click(radio)
    expect(screen.getByTestId('lien-apply-checks').textContent).toContain('Tick the month this paper stands for.')
    expect(press.disabled).toBe(true)
    // The month ticked: the warnings ask for the reason, and with it Apply writes that month alone.
    fireEvent.click(sep)
    expect(screen.getByTestId('lien-apply-checks').textContent).not.toContain('Tick the month this paper stands for.')
    expect(press.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Why the paper stands for the month'), { target: { value: 'Its total held this job’s unpaid bill.' } })
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(io.apply).toHaveBeenCalledTimes(1))
    expect(io.apply.mock.calls[0]![0]).toMatchObject({ months: ['2026-09'] })
  })

  it('without startBlank, a lone paper starts picked and the notice’s own month starts ticked', async () => {
    draw({ startBlank: false })
    await settle()
    await screen.findByTestId('lien-notice-apply')
    expect((screen.getByRole('radio', { name: 'The notice of Sep 22 · certified mail · $12,400' }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('checkbox', { name: 'Sep 2026' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByTestId('lien-apply-record').textContent).toContain('Apply the Sep 22 notice to job 4107')
  })

  // The owner's answer 3 of 2026-11-20: with no month to apply, the paper list over a dead Apply is skipped.
  it('is the by-hand record at once, with no read of the papers, when the desk asks this job for no month', async () => {
    draw({ months: [] })
    // On the first draw, before any read could end: no loading box.
    expect(screen.getByTestId('lien-notice-by-hand')).toBeTruthy()
    expect(screen.queryByTestId('lien-already-went-loading')).toBeNull()
    await settle()
    expect(screen.getByTestId('lien-notice-by-hand')).toBeTruthy()
    expect(screen.queryByTestId('lien-notice-apply')).toBeNull()
    expect(io.load).not.toHaveBeenCalled()
  })

  it('is the by-hand record when every month offered already has a notice on this job', async () => {
    io.noticedMonths = ['2026-08', '2026-09']
    draw({ months: ['2026-08', '2026-09'] })
    await settle()
    expect(await screen.findByTestId('lien-notice-by-hand')).toBeTruthy()
    expect(screen.queryByTestId('lien-notice-apply')).toBeNull()
    expect(io.load).toHaveBeenCalledTimes(1)
  })

  it('is the apply step when one offered month has no notice yet and a paper is on record', async () => {
    io.noticedMonths = ['2026-08']
    draw({ months: ['2026-08', '2026-09'] })
    await settle()
    expect(await screen.findByTestId('lien-notice-apply')).toBeTruthy()
    expect(screen.queryByTestId('lien-notice-by-hand')).toBeNull()
    // August already has a notice, so its tick is dead. September is the one to apply.
    expect((screen.getByRole('checkbox', { name: 'Aug 2026' }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('checkbox', { name: 'Sep 2026' }) as HTMLInputElement).checked).toBe(true)
  })

  // The owner's answer 4 of 2026-11-20: the desk lands the step when it has its final pane, however long the read took.
  it('tells onReady once when the read ends, and not before', async () => {
    let release: () => void = () => {}
    io.load.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ papers: io.papers, noticedMonths: io.noticedMonths }) }))
    const view = draw()
    await settle()
    expect(screen.getByTestId('lien-already-went-loading')).toBeTruthy()
    expect(onReady).not.toHaveBeenCalled()
    release()
    await screen.findByTestId('lien-notice-apply')
    expect(onReady).toHaveBeenCalledTimes(1)
    // A new draw hands a new callback: that is not a new read, so it is not told again.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sep 2026' }))
    await settle()
    expect(onReady).toHaveBeenCalledTimes(1)
    view.unmount()
  })

  it('tells onReady once when the read fails, and at once when no read is made', async () => {
    io.load.mockImplementationOnce(() => Promise.reject(new Error('lost signal')))
    const failed = draw()
    await settle()
    expect(await screen.findByTestId('lien-notice-by-hand')).toBeTruthy()
    expect(onReady).toHaveBeenCalledTimes(1)
    failed.unmount()
    onReady.mockClear()
    draw({ months: [] })
    expect(onReady).toHaveBeenCalledTimes(1)
    await settle()
    expect(onReady).toHaveBeenCalledTimes(1)
  })
})
