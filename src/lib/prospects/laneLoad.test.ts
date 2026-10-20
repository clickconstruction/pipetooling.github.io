import { describe, expect, it } from 'vitest'
import { cardOnLane, kindFromSearch, laneLoadingWords, makeLatestOnly } from './laneLoad'

describe('kindFromSearch', () => {
  it('reads the lane from ?kind=', () => {
    expect(kindFromSearch('?tab=follow-up&kind=gc-leads')).toBe('gc_lead')
    expect(kindFromSearch('?kind=subs&trade=Concrete')).toBe('sub')
  })
  it('reads the doors from elsewhere, ?tab=subs and ?tab=gc-leads', () => {
    expect(kindFromSearch('?tab=subs')).toBe('sub')
    expect(kindFromSearch('?tab=gc-leads')).toBe('gc_lead')
  })
  it('is the customer deck with no kind, an unknown kind, or no search at all', () => {
    expect(kindFromSearch('')).toBe('customer')
    expect(kindFromSearch('?tab=follow-up')).toBe('customer')
    expect(kindFromSearch('?kind=nonsense')).toBe('customer')
  })
})

describe('cardOnLane', () => {
  it('is true only for the lane\'s own kind', () => {
    expect(cardOnLane({ kind: 'sub' }, 'sub')).toBe(true)
    expect(cardOnLane({ kind: 'customer' }, 'gc_lead')).toBe(false)
    expect(cardOnLane(null, 'sub')).toBe(false)
    expect(cardOnLane(undefined, 'customer')).toBe(false)
  })
})

describe('laneLoadingWords', () => {
  it('names the lane', () => {
    expect(laneLoadingWords('sub')).toBe('Loading Subs…')
    expect(laneLoadingWords('gc_lead')).toBe('Loading Jobs to GC…')
    expect(laneLoadingWords('customer')).toBe('Loading Customers…')
  })
})

describe('makeLatestOnly', () => {
  it('counts only the newest load, whichever answers last', () => {
    const latest = makeLatestOnly()
    const first = latest.start()
    const second = latest.start()
    expect(latest.isLatest(first)).toBe(false)
    expect(latest.isLatest(second)).toBe(true)
    const third = latest.start()
    expect(latest.isLatest(second)).toBe(false)
    expect(latest.isLatest(third)).toBe(true)
  })
})
