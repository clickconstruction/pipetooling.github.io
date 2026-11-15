// @vitest-environment jsdom
/**
 * Punch list #357 PR 5: the master's sheet, over a fake io. From a bid: the bid named over the title, Paying locked
 * with the numbers behind its point, the consequence in dollars moving as a sentence is picked, how bids to this GC
 * have gone, and a save that is the card's own write. A bid not costed yet says so. A GC already rated opens on its
 * picks and wakes only on a change. From the ask at the end of a job: the job named, no bid, and the same picks with
 * what happened is a rating. Someone the price list does not let rate reads and has no Save.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DIFFICULTY_CRITERIA_V1, DIFFICULTY_CRITERIA_V2 } from '../../lib/bids/difficultyCriteria'
import { DIFFICULTY_PRICE_V1 } from '../../lib/bids/difficultyPrice'
import type { DifficultyPayingInputs } from '../../lib/bids/difficultyPaying'
import { RATE_SHEET_WORDS as S } from '../../lib/bids/difficultyRateSheet'
import type { RateSheetBid, RateSheetBidRead, RateSheetIo } from '../../lib/bids/difficultyRateSheetIo'
import { GC_DIFFICULTY_WORDS as W, type DifficultyVersionLite, type GcDifficultyRating } from '../../lib/bids/gcDifficultyRating'
import { installDomShims, renderWithProviders } from '../../test/renderSmokeMocks'
import DifficultyRateSheet from './DifficultyRateSheet'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'master_technician' })
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

installDomShims()

const V1: DifficultyVersionLite = { id: 'v1', version: 1, body: DIFFICULTY_CRITERIA_V1 }
const RATED: GcDifficultyRating = { id: 'r1', customerId: 'c1', criteriaVersionId: 'v1', picks: { field: 2, office: 1 }, pickReasons: {}, note: 'Moved us from C to A.', ratedByName: 'Robert', ratedAt: '2026-11-14T20:00:00Z' }
/** Seven bills, paid in 52 days: a Paying point by the default rule. */
const PAYING: DifficultyPayingInputs = { readable: true, own: { medianDays: 52, samples: 7 }, receipts: [], gcPace: null, calendar: null, todayYmd: '2026-11-15' }
const BID: RateSheetBid = { id: 'b1', label: 'b512', project: 'Riverside Lofts', serviceTypeId: 'st1', bidValue: 100_000, pricedRevenueUsd: 100_000, pricedCostUsd: 70_000, pricedDifficultyUsd: 0 }
const READ: RateSheetBidRead = {
  pin: null,
  estimate: { fieldHours: 480, laborRate: 80 },
  history: [
    { bid_id: 'h1', project_name: null, outcome: 'won', loss_reason: null, bid_value: 100_000, est_cost: 72_000, customer_id: 'c1' },
    { bid_id: 'h2', project_name: null, outcome: 'won', loss_reason: null, bid_value: 50_000, est_cost: 34_000, customer_id: 'c1' },
    { bid_id: 'h3', project_name: null, outcome: 'lost', loss_reason: null, bid_value: 80_000, est_cost: 60_000, customer_id: 'c1' },
  ],
}

function fakeIo(ratings: GcDifficultyRating[] = [], over: Partial<RateSheetIo> = {}): RateSheetIo {
  return {
    loadVersions: vi.fn(async () => ({ versions: [V1], published: V1 })),
    loadRatings: vi.fn(async () => ratings),
    loadPaying: vi.fn(async () => PAYING),
    loadPrice: vi.fn(async () => DIFFICULTY_PRICE_V1),
    loadBid: vi.fn(async () => READ),
    saveRating: vi.fn(async (customerId, criteriaVersionId, picks, note, reasons = {}) => ({ id: 'r-new', customerId, criteriaVersionId, picks, pickReasons: reasons, note, ratedByName: 'Micah', ratedAt: '2026-11-15T00:00:00Z' })),
    ...over,
  }
}

const head = () => screen.getByTestId('rate-sheet-consequence-head').textContent

afterEach(cleanup)

describe('DifficultyRateSheet', () => {
  it('from a bid: Paying locked, the consequence in dollars before Save, the GC’s record, and the card’s own save', async () => {
    const io = fakeIo()
    const onClose = vi.fn()
    const onSaved = vi.fn()
    renderWithProviders(<DifficultyRateSheet customerId="c1" customerName="Seguin Ridge Builders" bid={BID} role="master_technician" io={io} onClose={onClose} onSaved={onSaved} />)
    expect(await screen.findByRole('dialog', { name: 'Rate Seguin Ridge Builders' })).toBeTruthy()
    expect(screen.getByTestId('rate-sheet-over-title').textContent).toBe('Bid b512 · Riverside Lofts')
    expect(screen.getByText(S.lead)).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('rate-sheet-paying').textContent).toBe('1 point from their bills · Paid in 52 days, the median of 7 bills. Not yours to pick.'))
    expect((screen.getByRole('radio', { name: 'Paying: 1 point' }) as HTMLInputElement).disabled).toBe(true)
    // Paying alone: $100,000 carried 7 days past 45 at 1.5% a month.
    await waitFor(() => expect(head()).toBe('1 point · about +$350 in cost'))
    expect(screen.getByTestId('rate-sheet-record').textContent).toBe('Bids like this: won 2 of 3 to them, at 28 to 32%.')

    const press = screen.getByRole('button', { name: W.save(1) }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.title).toBe(W.noPick)
    fireEvent.click(screen.getByRole('radio', { name: 'Field and superintendent: 2 points' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Their office: 1 point' }))
    expect(head()).toBe('4 points · about +$5,150 in cost')
    expect(screen.getByTestId('rate-sheet-consequence').textContent).toContain('48 field hours, 12 office hours and the wait on their pay. About +$7,357 on the price at 30%.')
    const press4 = screen.getByRole('button', { name: W.save(4) }) as HTMLButtonElement
    expect(press4.title).toBe(W.noNote)
    fireEvent.change(screen.getByLabelText(W.noteLabel), { target: { value: 'The super moved us twice on phase 1.' } })
    expect(press4.disabled).toBe(false)

    fireEvent.click(press4)
    await waitFor(() =>
      expect(io.saveRating).toHaveBeenCalledWith('c1', 'v1', { paying: 1, field: 2, office: 1 }, 'The super moved us twice on phase 1.', { paying: 'Read from their bills: Paid in 52 days, the median of 7 bills.' }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'r-new' }))
    expect(await screen.findByText(W.saved(4))).toBeTruthy()
  })

  it('a bid not costed yet says so, with the points alone', async () => {
    const io = fakeIo([], { loadBid: vi.fn(async () => ({ pin: null, estimate: null, history: null })) })
    renderWithProviders(<DifficultyRateSheet customerId="c1" customerName="Seguin Ridge Builders" bid={{ ...BID, pricedRevenueUsd: null, pricedCostUsd: null, pricedDifficultyUsd: null }} role="master_technician" io={io} onClose={() => {}} />)
    await waitFor(() => expect(head()).toBe('1 point'))
    expect(screen.getByText(S.notCosted)).toBeTruthy()
    expect(screen.queryByTestId('rate-sheet-record')).toBeNull()
  })

  it('a GC already rated opens on its picks, says who rated, and wakes only on a change', async () => {
    const io = fakeIo([RATED], { loadPaying: vi.fn(async () => ({ ...PAYING, own: { medianDays: 52, samples: 2 } })) })
    renderWithProviders(<DifficultyRateSheet customerId="c1" customerName="Seguin Ridge Builders" bid={BID} role="master_technician" io={io} onClose={() => {}} />)
    expect((await screen.findByTestId('rate-sheet-rated-by')).textContent).toBe('Rated by Robert on 2026-11-14 under criteria version 1.')
    expect((screen.getByRole('radio', { name: 'Field and superintendent: 2 points' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.change(screen.getByLabelText(W.noteLabel), { target: { value: 'Same as before.' } })
    const press = screen.getByRole('button', { name: W.save(3) }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.title).toBe('Nothing changed since the rating that stands.')
    fireEvent.click(screen.getByRole('radio', { name: 'Field and superintendent: 3 points' }))
    expect((screen.getByRole('button', { name: W.save(4) }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('from the ask at the end of a job: the job named, no bid, the same picks with what happened is a rating, and Not now puts it away', async () => {
    const io = fakeIo([RATED], { loadPaying: vi.fn(async () => ({ ...PAYING, own: { medianDays: 52, samples: 2 } })) })
    const onNotNow = vi.fn()
    const onClose = vi.fn()
    renderWithProviders(<DifficultyRateSheet customerId="c1" customerName="Seguin Ridge Builders" ask={{ jobLabel: '1042 Riverside Lofts' }} role="master_technician" io={io} onClose={onClose} onNotNow={onNotNow} />)
    expect(await screen.findByText(S.askLead('1042 Riverside Lofts'))).toBeTruthy()
    expect(screen.queryByTestId('rate-sheet-over-title')).toBeNull()
    expect(io.loadBid).not.toHaveBeenCalled()
    await waitFor(() => expect(head()).toBe('3 points'))
    expect(screen.getByText(S.noBid)).toBeTruthy()
    const note = screen.getByLabelText(W.noteLabel) as HTMLTextAreaElement
    expect(note.placeholder).toBe('On 1042 Riverside Lofts: what happened')
    fireEvent.change(note, { target: { value: 'Ran the same as the last one.' } })
    expect((screen.getByRole('button', { name: W.save(3) }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: S.notNow }))
    expect(onNotNow).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('someone the price list does not let rate reads the rating and has no Save', async () => {
    const io = fakeIo([RATED])
    renderWithProviders(<DifficultyRateSheet customerId="c1" customerName="Seguin Ridge Builders" bid={BID} role="estimator" io={io} onClose={() => {}} />)
    expect(await screen.findByText(S.cannotRate)).toBeTruthy()
    expect(screen.queryByLabelText(W.noteLabel)).toBeNull()
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull()
    expect((screen.getByRole('radio', { name: 'Field and superintendent: 3 points' }) as HTMLInputElement).disabled).toBe(true)
  })

  it('PR 6: under version 2 the site is picked on the bid; the site alone saves with no reason asked, and the rating is left as it stands', async () => {
    const V2: DifficultyVersionLite = { id: 'v2', version: 2, body: DIFFICULTY_CRITERIA_V2 }
    const io = fakeIo([{ ...RATED, criteriaVersionId: 'v2' }], {
      loadVersions: vi.fn(async () => ({ versions: [V2], published: V2 })),
      loadPaying: vi.fn(async () => ({ ...PAYING, own: { medianDays: 52, samples: 2 } })),
      loadBidPicks: vi.fn(async () => ({})),
      saveBidPicks: vi.fn(async (_bidId, _versionId, picks) => picks),
    })
    const onClose = vi.fn()
    renderWithProviders(<DifficultyRateSheet customerId="c1" customerName="Seguin Ridge Builders" bid={BID} role="master_technician" io={io} onClose={onClose} />)
    expect(await screen.findByTestId('rate-sheet-bid-picks')).toBeTruthy()
    // The GC's 3 points: field 2 = 48 h at $80, office 1 = 12 h at $80.
    await waitFor(() => expect(head()).toBe('3 points · about +$4,800 in cost'))
    expect((screen.getByRole('button', { name: W.save(3) }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'The site: 1 point' }))
    // The site adds 4% of 480 hours = 19.2 h at $80.
    expect(head()).toBe('4 points · about +$6,336 in cost')
    const press = screen.getByRole('button', { name: W.save(4) }) as HTMLButtonElement
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(io.saveBidPicks).toHaveBeenCalledWith('b1', 'v2', { site: 1 }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(io.saveRating).not.toHaveBeenCalled()
    expect(await screen.findByText(S.savedBidOnly)).toBeTruthy()
  })

  it('PR 6: from the ask there is no bid, so no site', async () => {
    const V2: DifficultyVersionLite = { id: 'v2', version: 2, body: DIFFICULTY_CRITERIA_V2 }
    const io = fakeIo([], { loadVersions: vi.fn(async () => ({ versions: [V2], published: V2 })) })
    renderWithProviders(<DifficultyRateSheet customerId="c1" customerName="Seguin Ridge Builders" ask={{ jobLabel: '1042 Riverside Lofts' }} role="master_technician" io={io} onClose={() => {}} />)
    expect(await screen.findByRole('radio', { name: 'Field and superintendent: 2 points' })).toBeTruthy()
    expect(screen.queryByTestId('rate-sheet-bid-picks')).toBeNull()
    expect(screen.queryByRole('radio', { name: 'The site: 1 point' })).toBeNull()
  })
})
