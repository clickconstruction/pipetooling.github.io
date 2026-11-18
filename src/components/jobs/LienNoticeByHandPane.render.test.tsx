// @vitest-environment jsdom
/**
 * Record a notice that already went out (#35 PR 2): the pane takes the paper
 * as printed, offers the other unpaid jobs at the property, words the
 * difference, and writes one filing per covered job through the IO.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import LienNoticeByHandPane from './LienNoticeByHandPane'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock()
})
vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})
const recordMock = vi.fn(async () => ({ packetId: 'p1', filingIds: ['f1', 'f2'] }))
vi.mock('../../lib/jobs/lienNoticeByHandIo', () => ({
  loadJobsAtProperty: async () => [
    { id: 'j858', hcp_number: '', click_number: '858', job_name: 'Service visit', job_address: '9703 Linmor Hl', customer_address_id: 'a1', revenue: 7902, payments_made: 0, status: 'billed', itemId: null },
    { id: 'j866', hcp_number: '', click_number: '866', job_name: 'Oran Karrow- Linmoor', job_address: '9703 Linmor Hl', customer_address_id: 'a1', revenue: 3500, payments_made: 0, status: 'billed', itemId: 'it866' },
  ],
  recordLienNoticeByHand: (...args: unknown[]) => recordMock(...(args as [])),
}))

const fields = { noticeDate: '2026-09-22', projectDescription: 'Dunmere (Linmoor) — 9703 Linmor Hl', claimantName: 'Click Plumbing and Electrical', laborMaterialsType: 'Plumbing labor and materials', originalContractorName: 'RLC-Dunmere Mallin', contractedWithIfDifferent: '', claimAmount: '17585.00', contactPerson: 'Malachi Whites', claimantAddress: '5501 Balcones Dr' }
const job = { id: 'j273', label: '273 · Dunmere (Linmoor)', jobAddress: '9703 Linmor Hl', customerAddressId: 'a1', amount: 17_585, itemId: 'it273' }

describe('LienNoticeByHandPane', () => {
  it('prefills the app’s claim and months, lists the other jobs at the property, words the paper’s difference, and records on every ticked job', async () => {
    const onRecorded = vi.fn()
    renderWithProviders(<LienNoticeByHandPane job={job} fields={fields} appClaim={9_802} appClaimIsTimely defaultMonths={['2026-08']} todayYmd="2026-09-23" userId="u1" onClose={() => {}} onRecorded={onRecorded} />)
    expect((screen.getByLabelText('Claim as printed') as HTMLInputElement).value).toBe('9802')
    expect((screen.getByLabelText('Months as printed') as HTMLInputElement).value).toBe('2026-08')
    await waitFor(() => expect(screen.getByTestId('by-hand-other-jobs')).toBeTruthy())
    expect(screen.getByTestId('by-hand-other-jobs').textContent).toContain('858 · Service visit')
    expect(screen.getByTestId('by-hand-other-jobs').textContent).toContain('on the desk')
    // The paper as Taunya printed it.
    fireEvent.change(screen.getByLabelText('Sent on'), { target: { value: '2026-09-22' } })
    fireEvent.change(screen.getByLabelText('How it went'), { target: { value: 'mail' } })
    fireEvent.change(screen.getByLabelText('Claim as printed'), { target: { value: '28,987' } })
    fireEvent.change(screen.getByLabelText('Months as printed'), { target: { value: 'April, June, July and August 2026' } })
    expect(screen.getByText(/Months read as Apr, Jun, Jul, Aug/)).toBeTruthy()
    expect(screen.getByTestId('by-hand-claim-diff').textContent).toContain("printed $28,987 · the app's timely claim would have been $9,802")
    fireEvent.click(screen.getByLabelText('Also covers 858'))
    fireEvent.click(screen.getByLabelText('Also covers 866'))
    expect(screen.getByText(/3 jobs · \$28,987 open between them/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Saved copy — link'), { target: { value: 'drive.google.com/file/d/linmor/view' } })
    fireEvent.click(screen.getByTestId('by-hand-record'))
    await waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
    const [input, opts] = recordMock.mock.calls[0] as unknown as [{ jobs: { jobId: string; itemId: string | null }[]; printedClaim: number; printedMonths: string[]; method: string; sentOn: string; documentUrl: string }, { fields: typeof fields }]
    expect(input.jobs.map((j) => [j.jobId, j.itemId])).toEqual([['j273', 'it273'], ['j858', null], ['j866', 'it866']])
    expect(input).toMatchObject({ printedClaim: 28_987, printedMonths: ['2026-04', '2026-06', '2026-07', '2026-08'], method: 'mail', sentOn: '2026-09-22', documentUrl: 'drive.google.com/file/d/linmor/view' })
    expect(opts.fields.claimantName).toBe('Click Plumbing and Electrical')
    await waitFor(() => expect(onRecorded).toHaveBeenCalledWith({ filingIds: ['f1', 'f2'], jobs: 3 }))
  })
  it('a future date or no recipient blocks the record and says what is missing', async () => {
    renderWithProviders(<LienNoticeByHandPane job={job} fields={fields} appClaim={17_585} appClaimIsTimely={false} defaultMonths={['2026-08']} todayYmd="2026-09-23" userId="u1" onClose={() => {}} onRecorded={() => {}} />)
    await settle()
    expect(screen.queryByTestId('by-hand-problems')).toBeNull()
    fireEvent.change(screen.getByLabelText('Sent on'), { target: { value: '2026-10-01' } })
    expect(screen.getByTestId('by-hand-problems').textContent).toContain('The send date is in the future')
    expect((screen.getByTestId('by-hand-record') as HTMLButtonElement).disabled).toBe(true)
  })
  it('layout "sheet" (v2.4423) is the same step on the Lien window’s record sheet: full-width fields, rows to tick, the same record', async () => {
    const onRecorded = vi.fn()
    const onClose = vi.fn()
    const onCloseWindow = vi.fn()
    recordMock.mockClear()
    renderWithProviders(<LienNoticeByHandPane layout="sheet" onCloseWindow={onCloseWindow} job={job} fields={fields} appClaim={17_585} appClaimIsTimely={false} defaultMonths={['2026-08']} todayYmd="2026-09-23" userId="u1" onClose={onClose} onRecorded={onRecorded} />)
    await settle()
    const sheet = document.querySelector('[data-lien-record-sheet="notice_by_hand"]') as HTMLElement
    expect(sheet).toBeTruthy()
    expect(sheet.querySelector('[data-lien-record-summary]')!.textContent).toContain('273 · Dunmere (Linmoor)')
    // the prefill and the fields, in 16 px type
    expect((screen.getByLabelText('Claim as printed') as HTMLInputElement).value).toBe('17585')
    expect((screen.getByLabelText('Months as printed') as HTMLInputElement).value).toBe('2026-08')
    for (const name of ['Sent on', 'How it went', 'Tracking — owner of record', 'Tracking — original contractor', 'Claim as printed', 'Months as printed', 'Saved copy — link', 'Saved copy — note']) {
      expect((screen.getByLabelText(name) as HTMLElement).style.fontSize).toBe('1rem')
    }
    // what is missing greys the one button, and says so above it
    const action = sheet.querySelector('[data-lien-record-action]') as HTMLButtonElement
    expect(action.textContent).toBe('Record it on 1 job')
    fireEvent.click(screen.getByLabelText('owner of record'))
    fireEvent.click(screen.getByLabelText('original contractor'))
    expect(screen.getByTestId('by-hand-problems').textContent).toContain('Still needed')
    expect(action.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('owner of record'))
    expect(action.disabled).toBe(false)
    // another job at the property rides the same paper
    fireEvent.click(screen.getByLabelText('Also covers 866'))
    expect(action.textContent).toBe('Record it on 2 jobs')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onCloseWindow).toHaveBeenCalledTimes(1)
    fireEvent.click(action)
    await waitFor(() => expect(onRecorded).toHaveBeenCalledWith({ filingIds: ['f1', 'f2'], jobs: 2 }))
    expect(recordMock).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  describe('a number for each envelope (v2.7705)', () => {
    // Made-up label numbers: 22 digits each, as a counter label prints them.
    const OWNER_NO = '9407 1000 0000 0000 0000 11'
    const GC_NO = '9407 1000 0000 0000 0000 28'
    const pane = (layout?: 'sheet') => <LienNoticeByHandPane layout={layout} job={job} fields={fields} appClaim={17_585} appClaimIsTimely={false} defaultMonths={['2026-08']} todayYmd="2026-09-23" userId="u1" onClose={() => {}} onRecorded={() => {}} />
    const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

    it('certified mail to both recipients draws a box for each, checks each number as typed, and records each send its own', async () => {
      recordMock.mockClear()
      renderWithProviders(pane())
      await settle()
      // Certified mail to both is how the form opens: two boxes, and no one box.
      expect(screen.queryByLabelText('Tracking')).toBeNull()
      type('Tracking — owner of record', '9407 1000')
      expect(screen.getByTestId('by-hand-number-shape-owner').textContent).toBe('8 digits — a certified number has 20 or 22')
      type('Tracking — owner of record', OWNER_NO)
      expect(screen.getByTestId('by-hand-number-shape-owner').textContent).toBe('✓ 22 digits · certified')
      expect(screen.queryByTestId('by-hand-number-shape-original_contractor')).toBeNull()
      // The same number in the second box is said, and does not stop the record.
      type('Tracking — original contractor', OWNER_NO.replace(/ /g, ''))
      expect(screen.getByTestId('by-hand-same-number').textContent).toContain('Each envelope has its own label')
      expect((screen.getByTestId('by-hand-record') as HTMLButtonElement).disabled).toBe(false)
      type('Tracking — original contractor', GC_NO)
      expect(screen.queryByTestId('by-hand-same-number')).toBeNull()
      fireEvent.click(screen.getByTestId('by-hand-record'))
      await waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
      const [input] = recordMock.mock.calls[0] as unknown as [{ method: string; tracking: string; trackingBy: Record<string, string>; recipients: string[] }]
      expect(input).toMatchObject({ method: 'certified_mail', tracking: '', recipients: ['owner', 'original_contractor'], trackingBy: { owner: OWNER_NO, original_contractor: GC_NO } })
    })

    it('one recipient keeps one box, holding that recipient’s own number; email keeps the one box for everyone', async () => {
      recordMock.mockClear()
      renderWithProviders(pane())
      await settle()
      type('Tracking — owner of record', OWNER_NO)
      type('Tracking — original contractor', GC_NO)
      // The owner's copy did not go: the one box left is the original contractor's, with the contractor's number.
      fireEvent.click(screen.getByLabelText('owner of record'))
      expect((screen.getByLabelText('Tracking') as HTMLInputElement).value).toBe(GC_NO)
      expect(screen.queryByLabelText('Tracking — owner of record')).toBeNull()
      fireEvent.click(screen.getByLabelText('owner of record'))
      expect((screen.getByLabelText('Tracking — owner of record') as HTMLInputElement).value).toBe(OWNER_NO)
      // Email: one box, the address, on both sends. The numbers typed above are not read.
      type('How it went', 'email')
      expect(screen.queryByLabelText('Tracking — owner of record')).toBeNull()
      type('Tracking', 'office@example.test')
      fireEvent.click(screen.getByTestId('by-hand-record'))
      await waitFor(() => expect(recordMock).toHaveBeenCalledTimes(1))
      const [input] = recordMock.mock.calls[0] as unknown as [{ method: string; tracking: string; trackingBy?: unknown }]
      expect(input).toMatchObject({ method: 'email', tracking: 'office@example.test' })
      expect(input.trackingBy).toBeUndefined()
    })

    it('a courier to both draws the two boxes with no length check; the sheet draws them full width', async () => {
      renderWithProviders(pane('sheet'))
      await settle()
      type('How it went', 'traceable_courier')
      type('Tracking — owner of record', 'ZZ-123')
      type('Tracking — original contractor', 'ZZ-123')
      expect(screen.queryByTestId('by-hand-number-shape-owner')).toBeNull()
      expect(screen.getByTestId('by-hand-same-number')).toBeTruthy()
      for (const name of ['Tracking — owner of record', 'Tracking — original contractor']) expect((screen.getByLabelText(name) as HTMLElement).style.fontSize).toBe('1rem')
      // Hand delivery: back to the one box, who signed for it.
      type('How it went', 'hand')
      expect((screen.getByLabelText('Tracking') as HTMLInputElement).placeholder).toBe('who signed for it')
      expect(screen.queryByTestId('by-hand-same-number')).toBeNull()
    })
  })
})
