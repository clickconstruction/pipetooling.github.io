// @vitest-environment jsdom
/**
 * Render smoke for What your materials cost (Materials → Parts Book, v2.4391): the loading, error
 * and empty states, the number with its line and freshness, the honest "not enough fresh prices",
 * and the prices that moved lately.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MaterialPricesCardView } from './MaterialPricesCard'
import type { MaterialPriceIndex } from '../../lib/materials/materialPriceIndex'

afterEach(() => cleanup())

const months = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
const index = (over: Partial<MaterialPriceIndex> = {}): MaterialPriceIndex => ({
  baseMonth: '2026-02',
  months: months.map((month, i) => ({ month, index: i === 6 ? 100.1 : i >= 7 ? 99.7 : 100, coverage: i < 4 ? 0.2 : 0.9, faint: i < 4 })),
  latest: 99.7,
  sinceBase: -0.003,
  last3: -0.003,
  freshness: { within30: 0.11, within90: 0.55, older: 0.34 },
  showNumber: true,
  moved: [
    { partId: 'peak', houseId: 'reece', partName: 'PEAKFLOW C ANTI-SCALE SYS COMM', houseName: 'Reece', day: '2026-09-29', oldPrice: 704.31, newPrice: 770.59, change: 770.59 / 704.31 - 1, openBidCount: 1 },
    { partId: 'pvc', houseId: 'reece', partName: '4IN 90 PVC', houseName: 'Reece', day: '2026-09-21', oldPrice: 19.52, newPrice: 17.56, change: 17.56 / 19.52 - 1, openBidCount: 6 },
    { partId: 'tank', houseId: 'reece', partName: 'EXPANSION TANK', houseName: 'Reece', day: '2026-09-18', oldPrice: 83.8, newPrice: 86.67, change: 86.67 / 83.8 - 1, openBidCount: 0 },
  ],
  checks: {
    items: [
      { priceId: 'p-toilet', partId: 'toilet', houseId: 'moore', partName: 'ETWS-1490-CM-BS', houseName: 'Moore Supply', price: 1993.1, lastCheckedDay: '2026-04-14', spendShare: 0.031 },
      { priceId: 'p-pvc', partId: 'pvc', houseId: 'reece', partName: '3IN PVC TUBING', houseName: 'Reece', price: 10.8, lastCheckedDay: '2026-06-12', spendShare: 0.029 },
    ],
    spendShare: 0.61,
    due: true,
    oldestDay: '2026-04-14',
  },
  pairCount: 653,
  totalSpend: 1_000_000,
  ...over,
})

const card = () => screen.getByRole('region', { name: 'What your materials cost' })

describe('MaterialPricesCardView', () => {
  it('says it is reading, and says so plainly when the read fails', () => {
    const { rerender } = render(<MaterialPricesCardView state={{ status: 'loading' }} />)
    expect(screen.getByText('Reading your material prices…')).toBeTruthy()
    rerender(<MaterialPricesCardView state={{ status: 'error' }} />)
    expect(screen.getByText('Couldn’t read your material prices just now.')).toBeTruthy()
  })

  it('draws nothing for a trade with nothing bid from the book', () => {
    const { container } = render(<MaterialPricesCardView state={{ status: 'ready', index: null, today: '2026-10-02' }} />)
    expect(container.textContent).toBe('')
  })

  it('the number: the verdict in words, the line, faint where thin, the last 3 months and the guide', () => {
    render(<MaterialPricesCardView state={{ status: 'ready', index: index(), today: '2026-10-02' }} />)
    const c = card()
    expect(within(c).getByText('About the same as February')).toBeTruthy()
    expect(c.textContent).toContain('99.7 against 100 in February.')
    expect(within(c).getByRole('img', { name: /^From February to October: 100\.0/ })).toBeTruthy()
    expect(c.querySelectorAll('path[stroke-dasharray]')).toHaveLength(3)
    expect(c.textContent).toContain('The line is faint where too few of these parts had a price yet.')
    expect(c.textContent).toContain('Last 3 months: about the same')
    expect(within(c).getByRole('link', { name: 'How this works' }).getAttribute('href')).toBe('/help?g=track-what-your-materials-cost')
  })

  it('freshness: the bar, its three shares and the stale sentence', () => {
    render(<MaterialPricesCardView state={{ status: 'ready', index: index(), today: '2026-10-02' }} />)
    const c = card()
    expect(within(c).getByRole('img', { name: '11% checked in the last 30 days, 55% checked 31 to 90 days ago, 34% older than 90 days' })).toBeTruthy()
    expect(c.textContent).toContain('34% of your bid dollars sit on a price older than 90 days.')
  })

  it('moved lately: rises orange and up, drops blue and down, with the open bids that use each', () => {
    render(<MaterialPricesCardView state={{ status: 'ready', index: index(), today: '2026-10-02' }} />)
    const c = card()
    const rise = within(c).getByText('▲ 9.4%')
    expect(rise.getAttribute('style')).toContain('var(--text-orange-700)')
    const drop = within(c).getByText('▼ 10.0%')
    expect(drop.getAttribute('style')).toContain('var(--text-blue-700)')
    expect(c.textContent).toContain('4IN 90 PVC · Reece · Sep 21')
    expect(c.textContent).toContain('on 6 open bids')
    expect(c.textContent).toContain('on 1 open bid')
    expect(c.textContent).not.toContain('on 0 open bids')
  })

  it('a rise since February reads as one', () => {
    render(<MaterialPricesCardView state={{ status: 'ready', index: index({ latest: 103.2, sinceBase: 0.032, last3: 0.021 }), today: '2026-10-02' }} />)
    expect(screen.getByText('Up 3.2% since February')).toBeTruthy()
    expect(card().textContent).toContain('Last 3 months: up 2.1%')
  })

  it('holds the number back when too little is fresh, and still shows how fresh', () => {
    render(<MaterialPricesCardView state={{ status: 'ready', index: index({ showNumber: false, freshness: { within30: 0.05, within90: 0.2, older: 0.75 } }), today: '2026-10-02' }} />)
    const c = card()
    expect(within(c).getByText('Not enough fresh prices to say')).toBeTruthy()
    expect(c.textContent).not.toContain('against 100')
    expect(c.querySelector('svg')).toBeNull()
    expect(c.textContent).toContain('75% of your bid dollars sit on a price older than 90 days.')
  })

  it('Check prices: the reminder when the oldest is due, a blue button, and what the parts cover', () => {
    const onOpenCheck = vi.fn()
    render(<MaterialPricesCardView state={{ status: 'ready', index: index(), today: '2026-10-02' }} onOpenCheck={onOpenCheck} />)
    const c = card()
    expect(c.textContent).toContain('The oldest of your top 2 was last checked Apr 14.')
    expect(c.textContent).toContain('2 parts are 61% of what you bid. About ten minutes.')
    const button = within(c).getByRole('button', { name: 'Check 2 prices' })
    expect(button.getAttribute('style')).toContain('rgb(37, 99, 235)')
    fireEvent.click(button)
    expect(onOpenCheck).toHaveBeenCalledTimes(1)
  })

  it('Check prices when nothing is due: a plain button and a calm line', () => {
    render(<MaterialPricesCardView state={{ status: 'ready', index: index({ checks: { ...index().checks, due: false, oldestDay: '2026-09-20' } }), today: '2026-10-02' }} onOpenCheck={() => {}} />)
    const c = card()
    expect(c.textContent).toContain('All of your top 2 were checked in the last 30 days.')
    expect(within(c).getByRole('button', { name: 'Check 2 prices' }).getAttribute('style')).not.toContain('rgb(37, 99, 235)')
  })

  it('no button where nothing can open the window', () => {
    render(<MaterialPricesCardView state={{ status: 'ready', index: index(), today: '2026-10-02' }} />)
    expect(within(card()).queryByRole('button')).toBeNull()
  })
})
