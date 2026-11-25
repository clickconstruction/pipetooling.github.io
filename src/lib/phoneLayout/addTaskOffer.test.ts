import { describe, expect, it } from 'vitest'
import { addTaskOfferPlace } from './addTaskOffer'

describe('addTaskOfferPlace', () => {
  it('a phone with the new layout off: the line, on the Dashboard alone', () => {
    expect(addTaskOfferPlace({ phoneBars: false, narrow: true, pathname: '/dashboard' })).toBe('line')
    expect(addTaskOfferPlace({ phoneBars: false, narrow: true, pathname: '/lien-desk' })).toBeNull()
    expect(addTaskOfferPlace({ phoneBars: false, narrow: true, pathname: '/job-mode/schedule' })).toBeNull()
    expect(addTaskOfferPlace({ phoneBars: false, narrow: true, pathname: '/dashboard/more' })).toBeNull()
  })

  it('a phone with the new layout on: the quiet row, on the Dashboard alone', () => {
    expect(addTaskOfferPlace({ phoneBars: true, narrow: true, pathname: '/dashboard' })).toBe('quiet')
    expect(addTaskOfferPlace({ phoneBars: true, narrow: true, pathname: '/lien-desk' })).toBeNull()
  })

  it('a wider screen keeps the line on every page', () => {
    expect(addTaskOfferPlace({ phoneBars: false, narrow: false, pathname: '/dashboard' })).toBe('line')
    expect(addTaskOfferPlace({ phoneBars: false, narrow: false, pathname: '/lien-desk' })).toBe('line')
  })
})
