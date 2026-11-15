// @vitest-environment jsdom
/**
 * Punch list #357 PR 2: the GC's card How they are to work with, over a fake io. An unrated GC for the office: the
 * three scales with Paying locked, the press dead until a pick and a note, then a save with only the picked scales,
 * and the chip reads the points. A rated GC opens on its picks with the rated-by line and the press dead until a
 * change. An estimator reads and cannot save. A rating under version 1 with version 2 published carries what it can
 * and says what is unrated.
 */
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DIFFICULTY_CRITERIA_V1 } from '../../lib/bids/difficultyCriteria'
import { DIFFICULTY_PRICE_V1 } from '../../lib/bids/difficultyPrice'
import { GC_DIFFICULTY_WORDS as W, type DifficultyVersionLite, type GcDifficultyRating } from '../../lib/bids/gcDifficultyRating'
import type { GcDifficultyIo } from '../../lib/bids/gcDifficultyRatingIo'
import type { DifficultyPayingInputs } from '../../lib/bids/difficultyPaying'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import GcDifficultyCard from './GcDifficultyCard'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const V1: DifficultyVersionLite = { id: 'v1', version: 1, body: DIFFICULTY_CRITERIA_V1 }
const field = DIFFICULTY_CRITERIA_V1.scales[1]!
const V2: DifficultyVersionLite = { id: 'v2', version: 2, body: { scales: [DIFFICULTY_CRITERIA_V1.scales[0]!, { ...field, max: 2, rungs: field.rungs.slice(0, 3) }, DIFFICULTY_CRITERIA_V1.scales[2]!] } }

const RATED: GcDifficultyRating = { id: 'r1', customerId: 'c1', criteriaVersionId: 'v1', picks: { field: 3, office: 1 }, pickReasons: {}, note: 'Moved us from C to A.', ratedByName: 'Robert', ratedAt: '2026-11-14T20:00:00Z' }

/** Seven bills, paid in 52 days: a Paying point by the default rule. */
const PAYING: DifficultyPayingInputs = { readable: true, own: { medianDays: 52, samples: 7 }, receipts: [], gcPace: { medianDays: 35, payers: 9 }, calendar: null, todayYmd: '2026-11-14' }
const TOO_FEW: DifficultyPayingInputs = { ...PAYING, own: { medianDays: 52, samples: 2 } }

function fakeIo(ratings: GcDifficultyRating[] = [], versions: DifficultyVersionLite[] = [V1], over: Partial<GcDifficultyIo> = {}, paying: DifficultyPayingInputs = TOO_FEW): GcDifficultyIo {
  return {
    loadVersions: vi.fn(async () => ({ versions, published: versions[0] ?? null })),
    loadRatings: vi.fn(async () => ratings),
    loadPaying: vi.fn(async () => paying),
    saveRating: vi.fn(async (customerId, criteriaVersionId, picks, note, reasons = {}) => ({ id: 'r-new', customerId, criteriaVersionId, picks, pickReasons: reasons, note, ratedByName: 'Micah', ratedAt: '2026-11-15T00:00:00Z' })),
    ...over,
  }
}

const card = () => within(screen.getByTestId('gc-difficulty-card'))
const total = () => screen.getByTestId('gc-difficulty-total').textContent

afterEach(cleanup)

describe('GcDifficultyCard', () => {
  it('an unrated GC for the office: picks and a note wake the press; the save carries only the picked scales', async () => {
    const io = fakeIo()
    renderWithProviders(<GcDifficultyCard customerId="c1" customerName="Seguin Ridge Builders" role="assistant" io={io} />)
    expect(await card().findByText(W.notRated)).toBeTruthy()
    expect(total()).toBe('0 points on every new bid to them.')
    const press = card().getByRole('button', { name: W.save(0) }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.title).toBe(W.noPick)
    expect((card().getByRole('radio', { name: 'Paying: 1 point' }) as HTMLInputElement).disabled).toBe(true)
    expect((await screen.findByTestId('gc-difficulty-paying-words')).textContent).toBe('2 bills on record, fewer than the 3 the read needs. No point.')

    fireEvent.click(card().getByRole('radio', { name: 'Field and superintendent: 2 points' }))
    fireEvent.click(card().getByRole('radio', { name: 'Their office: 1 point' }))
    expect(total()).toBe('3 points on every new bid to them.')
    const press3 = card().getByRole('button', { name: W.save(3) }) as HTMLButtonElement
    expect(press3.disabled).toBe(true)
    expect(press3.title).toBe(W.noNote)
    fireEvent.change(card().getByLabelText(W.noteLabel), { target: { value: 'Phase 1: the super moved us from building C to A.' } })
    expect(press3.disabled).toBe(false)

    fireEvent.click(press3)
    await waitFor(() => expect(io.saveRating).toHaveBeenCalledWith('c1', 'v1', { field: 2, office: 1 }, 'Phase 1: the super moved us from building C to A.', {}))
    expect(await screen.findByText(W.saved(3))).toBeTruthy()
    expect(screen.getByTestId('gc-difficulty-chip').textContent).toBe('Rated 3 points')
    expect(card().getByText('Rated by Micah on 2026-11-15 under criteria version 1.')).toBeTruthy()
  })

  it('a rated GC opens on its picks with the rated-by line; the press stays dead until a pick changes', async () => {
    renderWithProviders(<GcDifficultyCard customerId="c1" customerName="Seguin Ridge Builders" role="dev" io={fakeIo([RATED])} />)
    expect(await card().findByText('Rated by Robert on 2026-11-14 under criteria version 1.')).toBeTruthy()
    expect(screen.getByTestId('gc-difficulty-chip').textContent).toBe('Rated 4 points')
    expect((card().getByRole('radio', { name: 'Field and superintendent: 3 points' }) as HTMLInputElement).checked).toBe(true)
    const press = card().getByRole('button', { name: W.save(4) }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    fireEvent.change(card().getByLabelText(W.noteLabel), { target: { value: 'Still the same.' } })
    expect(press.disabled).toBe(true)
    fireEvent.click(card().getByRole('radio', { name: 'Field and superintendent: 1 point' }))
    expect(total()).toBe('2 points on every new bid to them.')
    expect((card().getByRole('button', { name: W.save(2) }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('an estimator reads the rating and cannot save', async () => {
    renderWithProviders(<GcDifficultyCard customerId="c1" customerName="Seguin Ridge Builders" role="estimator" io={fakeIo([RATED])} />)
    expect(await card().findByText(W.cannotRate)).toBeTruthy()
    expect(card().queryByRole('button', { name: /^Save/ })).toBeNull()
    expect(card().queryByLabelText(W.noteLabel)).toBeNull()
    expect((card().getByRole('radio', { name: 'Field and superintendent: 3 points' }) as HTMLInputElement).checked).toBe(true)
  })

  it('the price list says who may rate (PR 4): an estimator saves when it names the estimators', async () => {
    const io = fakeIo([RATED], [V1], { loadPrice: vi.fn(async () => ({ ...DIFFICULTY_PRICE_V1, raters: ['estimator' as const] })) })
    renderWithProviders(<GcDifficultyCard customerId="c1" customerName="Seguin Ridge Builders" role="estimator" io={io} />)
    expect(await card().findByText('Rated by Robert on 2026-11-14 under criteria version 1.')).toBeTruthy()
    await waitFor(() => expect(card().queryByText(W.cannotRate)).toBeNull())
    expect(card().getByRole('button', { name: W.save(4) })).toBeTruthy()
  })

  it('a version 1 rating with version 2 published carries what it can and says what is unrated; the earlier ratings fold', async () => {
    const older: GcDifficultyRating = { ...RATED, id: 'r0', ratedAt: '2026-10-01T00:00:00Z', picks: { field: 1 }, note: 'First job.' }
    renderWithProviders(<GcDifficultyCard customerId="c1" customerName="Seguin Ridge Builders" role="dev" io={fakeIo([RATED, older], [V2, V1])} />)
    expect((await screen.findByTestId('gc-difficulty-carry')).textContent).toBe('Rated under version 1; version 2 is published. Paying, Field and superintendent are unrated under this version. A pick from an older version did not carry: its rung is gone.')
    expect(screen.getByTestId('gc-difficulty-chip').textContent).toBe('Rated 4 points')
    expect((card().getByRole('radio', { name: 'Their office: 1 point' }) as HTMLInputElement).checked).toBe(true)
    expect(card().queryByRole('radio', { name: 'Field and superintendent: 3 points' })).toBeNull()
    expect(total()).toBe('1 point on every new bid to them.')
    fireEvent.click(card().getByRole('button', { name: `${W.earlier} (1)` }))
    expect(within(screen.getByTestId('gc-difficulty-earlier')).getByText('2026-10-01 · Robert · 1 point · First job.')).toBeTruthy()
  })

  it('the Paying point is read from the bills with its words, counts in the total, and goes into the save with its reason', async () => {
    const io = fakeIo([], [V1], {}, PAYING)
    renderWithProviders(<GcDifficultyCard customerId="c1" customerName="Seguin Ridge Builders" role="controller" io={io} />)
    expect((await screen.findByTestId('gc-difficulty-paying-words')).textContent).toBe('Paid in 52 days, the median of 7 bills. The GC pace is 35 days.')
    expect(screen.getByTestId('gc-difficulty-paying-drift').textContent).toBe('Their bills read 1 point now. The rating that stands has no Paying point yet. Save to read it in.')
    expect((card().getByRole('radio', { name: 'Paying: 1 point' }) as HTMLInputElement).checked).toBe(true)
    expect(total()).toBe('1 point on every new bid to them.')
    fireEvent.click(card().getByRole('radio', { name: 'Their office: 2 points' }))
    fireEvent.change(card().getByLabelText(W.noteLabel), { target: { value: 'Every bill is a fight.' } })
    fireEvent.click(card().getByRole('button', { name: W.save(3) }))
    await waitFor(() => expect(io.saveRating).toHaveBeenCalledTimes(1))
    const [, , picks, , reasons] = (io.saveRating as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, Record<string, number>, string, Record<string, string>]
    expect(picks).toEqual({ office: 2, paying: 1 })
    expect(reasons).toEqual({ paying: 'Read from their bills: Paid in 52 days, the median of 7 bills. The GC pace is 35 days.' })
  })

  it('the office sets the Paying point by hand with a reason; the save carries By hand', async () => {
    const io = fakeIo([], [V1], {}, PAYING)
    renderWithProviders(<GcDifficultyCard customerId="c1" customerName="Seguin Ridge Builders" role="dev" io={io} />)
    fireEvent.click(await card().findByRole('button', { name: W.setByHand }))
    const use = card().getByRole('button', { name: W.byHandUse }) as HTMLButtonElement
    expect(use.disabled).toBe(true)
    fireEvent.click(card().getByRole('radio', { name: 'By hand: 0 points' }))
    fireEvent.change(card().getByLabelText(W.byHandLabel), { target: { value: 'They pay us first every month.' } })
    fireEvent.click(use)
    expect(screen.getByTestId('gc-difficulty-paying-by-hand').textContent).toContain('Set by hand to 0 points: They pay us first every month.')
    expect(screen.queryByTestId('gc-difficulty-paying-drift')).toBeNull()
    expect(total()).toBe('0 points on every new bid to them.')
    fireEvent.click(card().getByRole('radio', { name: 'Field and superintendent: 1 point' }))
    fireEvent.change(card().getByLabelText(W.noteLabel), { target: { value: 'Small surprises only.' } })
    fireEvent.click(card().getByRole('button', { name: W.save(1) }))
    await waitFor(() => expect(io.saveRating).toHaveBeenCalledTimes(1))
    const [, , picks, , reasons] = (io.saveRating as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, Record<string, number>, string, Record<string, string>]
    expect(picks).toEqual({ field: 1, paying: 0 })
    expect(reasons).toEqual({ paying: 'By hand: They pay us first every month.' })
  })

  it('a rated GC whose bills now read a point says so and wakes the press', async () => {
    renderWithProviders(<GcDifficultyCard customerId="c1" customerName="Seguin Ridge Builders" role="dev" io={fakeIo([RATED], [V1], {}, PAYING)} />)
    expect((await screen.findByTestId('gc-difficulty-paying-drift')).textContent).toBe('Their bills read 1 point now. The rating that stands has no Paying point yet. Save to read it in.')
    expect(total()).toBe('5 points on every new bid to them.')
    const press = card().getByRole('button', { name: W.save(5) }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
    expect(press.title).toBe(W.noNote)
  })

  it('a failed read says so and offers to try again', async () => {
    renderWithProviders(<GcDifficultyCard customerId="c1" customerName="X" role="dev" io={fakeIo([], [V1], { loadRatings: vi.fn(async () => { throw new Error('The database is away.') }) })} />)
    expect((await screen.findByRole('alert')).textContent).toContain('The database is away.')
    expect(card().getByRole('button', { name: 'Try again' })).toBeTruthy()
  })
})
