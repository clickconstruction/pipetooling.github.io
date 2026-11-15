// @vitest-environment jsdom
/**
 * Punch list #357 PR 6: the bid's own pick on the Workbench. Under version 2 the line says the site is not picked
 * and offers Pick; a rung saves at once; a picked site reads with its sentence and can be cleared; a sent bid keeps
 * its pick and offers nothing; version 1 has no scale picked on the bid, so nothing draws; a refused save says why.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BID_PICK_WORDS as W } from '../../lib/bids/bidDifficultyPicks'
import { DIFFICULTY_CRITERIA_V1, DIFFICULTY_CRITERIA_V2 } from '../../lib/bids/difficultyCriteria'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import BidSitePick from './BidSitePick'

afterEach(cleanup)

describe('BidSitePick', () => {
  it('not picked: Pick opens the rungs, and a rung saves at once', async () => {
    const onPick = vi.fn(async () => {})
    renderWithProviders(<BidSitePick bidId="b1" body={DIFFICULTY_CRITERIA_V2} picks={{}} sent={false} onPick={onPick} />)
    expect(screen.getByTestId('bid-site-pick-line-site').textContent).toBe('The site: not picked on this bid')
    fireEvent.click(screen.getByRole('button', { name: W.pick }))
    expect(screen.getByText(W.lead)).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'The site: 1 point' }))
    await waitFor(() => expect(onPick).toHaveBeenCalledWith('site', 1))
  })

  it('picked: the line reads the sentence, Change opens the rungs, and the pick can be cleared', async () => {
    const onPick = vi.fn(async () => {})
    renderWithProviders(<BidSitePick bidId="b1" body={DIFFICULTY_CRITERIA_V2} picks={{ site: 2 }} sent={false} onPick={onPick} />)
    expect(screen.getByTestId('bid-site-pick-line-site').textContent).toBe('The site: 2 points · Work in phases, or every trip is a lift.')
    fireEvent.click(screen.getByRole('button', { name: W.change }))
    expect((screen.getByRole('radio', { name: 'The site: 2 points' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: W.clear }))
    await waitFor(() => expect(onPick).toHaveBeenCalledWith('site', null))
  })

  it('a sent bid keeps its pick; version 1 has nothing to pick on a bid', () => {
    const { container } = renderWithProviders(<BidSitePick bidId="b1" body={DIFFICULTY_CRITERIA_V2} picks={{ site: 1 }} sent onPick={async () => {}} />)
    expect(screen.getByText(W.sent)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    renderWithProviders(<BidSitePick bidId="b1" body={DIFFICULTY_CRITERIA_V1} picks={{}} sent={false} onPick={async () => {}} />)
    expect(container.querySelector('[data-testid="bid-site-pick"]')).toBeNull()
    expect(screen.queryByTestId('bid-site-pick')).toBeNull()
  })

  it('a refused save says why', async () => {
    renderWithProviders(<BidSitePick bidId="b1" body={DIFFICULTY_CRITERIA_V2} picks={{}} sent={false} onPick={async () => { throw new Error('Version 2 has no 5 point rung on site.') }} />)
    fireEvent.click(screen.getByRole('button', { name: W.pick }))
    fireEvent.click(screen.getByRole('radio', { name: 'The site: 1 point' }))
    expect(await screen.findByText('Version 2 has no 5 point rung on site.')).toBeTruthy()
  })
})
