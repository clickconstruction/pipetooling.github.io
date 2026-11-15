// @vitest-environment jsdom
/**
 * Punch list #357 PR 4: Bid Board → Pricing rules, over a fake io. The owner edits a number and the press saves the
 * draft and publishes it as the next version; an estimator reads the list with the press gone; a bad number lists its
 * problem and holds the press dead; the try-it line reads the kernel on the canvas's example.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DIFFICULTY_PRICE_V1, DIFFICULTY_PRICE_WORDS as W } from '../../lib/bids/difficultyPrice'
import type { DifficultyPriceIo, DifficultyPriceVersion } from '../../lib/bids/difficultyPriceIo'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import BidDifficultyPriceModal from './BidDifficultyPriceModal'

vi.mock('../../hooks/useAuth', async () => {
  const { useAuthModuleMock } = await import('../../test/renderSmokeMocks')
  return useAuthModuleMock({ role: 'dev' })
})

vi.mock('../../lib/supabase', async () => {
  const { makeSupabaseStub } = await import('../../test/renderSmokeMocks')
  return { supabase: makeSupabaseStub() }
})

const V1: DifficultyPriceVersion = { id: 'p1', version: 1, status: 'published', body: DIFFICULTY_PRICE_V1, note: '', publishedAt: '2026-11-15T10:00:00Z', publishedByName: 'the app', updatedAt: '2026-11-15T10:00:00Z' }

function fakeIo(versions: DifficultyPriceVersion[] = [V1]): DifficultyPriceIo {
  return {
    loadVersions: vi.fn(async () => versions),
    saveDraft: vi.fn(async (id, body, note) => ({ id: id ?? 'd1', version: 0, status: 'draft' as const, body, note, publishedAt: null, publishedByName: '', updatedAt: '2026-11-20T10:00:00Z' })),
    publish: vi.fn(async (id) => ({ ...V1, id, version: 2, publishedByName: 'Taunya', publishedAt: '2026-11-20T10:00:00Z' })),
  }
}

afterEach(cleanup)

describe('BidDifficultyPriceModal', () => {
  it('the owner edits a number; the press saves the draft and publishes version 2', async () => {
    const io = fakeIo()
    renderWithProviders(<BidDifficultyPriceModal role="master_technician" onClose={() => {}} io={io} />)
    expect(await screen.findByText('price list version 1 · 2026-11-15 by the app · The owner and the controller edit, estimators read.')).toBeTruthy()
    expect(screen.getByTestId('difficulty-price-try').textContent).toContain('field 2 is $3,840, office 1 is $960, paying 1 is $1,465. $6,265 of cost, about $8,951 on the price at 30%.')
    const press = screen.getByTestId('difficulty-price-save') as HTMLButtonElement
    expect(press.textContent).toBe(W.saveAs(2))
    expect(press.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Percent of field hours for a field point'), { target: { value: '7.5' } })
    expect(screen.getByTestId('difficulty-price-try').textContent).toContain('field 2 is $5,760')
    expect(press.disabled).toBe(false)
    fireEvent.click(press)
    await waitFor(() => expect(io.publish).toHaveBeenCalledWith('d1'))
    expect(io.saveDraft).toHaveBeenCalledWith(null, { ...DIFFICULTY_PRICE_V1, fieldPctPerPoint: 7.5 }, '')
  })

  it('a bad number names its problem and holds the press dead', async () => {
    renderWithProviders(<BidDifficultyPriceModal role="controller" onClose={() => {}} io={fakeIo()} />)
    await screen.findByTestId('difficulty-price-save')
    fireEvent.change(screen.getByLabelText('Cap as a percent of the bid cost'), { target: { value: '140' } })
    expect(screen.getByText('The cap is a percent from 0 to 100.')).toBeTruthy()
    expect((screen.getByTestId('difficulty-price-save') as HTMLButtonElement).disabled).toBe(true)
  })

  it('an estimator reads the list; no press, the boxes read only', async () => {
    renderWithProviders(<BidDifficultyPriceModal role="estimator" onClose={() => {}} io={fakeIo()} />)
    expect(await screen.findByText(W.readOnly)).toBeTruthy()
    expect(screen.queryByTestId('difficulty-price-save')).toBeNull()
    expect((screen.getByLabelText('Office rate an hour') as HTMLInputElement).readOnly).toBe(true)
  })

  it('every version folds open with each one in sentences', async () => {
    renderWithProviders(<BidDifficultyPriceModal role="dev" onClose={() => {}} io={fakeIo()} />)
    fireEvent.click(await screen.findByRole('button', { name: W.everyVersion }))
    expect(screen.getByTestId('difficulty-price-versions').textContent).toContain('Each office point adds 12 office hours at $80 an hour.')
  })
})
