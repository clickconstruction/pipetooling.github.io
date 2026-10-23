import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { ownerFirstName, ownerSeesCard, ownerSeesCardSentences, type OwnerSeesInput } from './ownerSeesCard'

// A GC-billed job whose customer is the owner: the pill's three states, plus off with nothing billed.
const base: OwnerSeesInput = { state: 'off', ownerName: 'Nia Okafor', gcName: 'Ridgeway Builders', openBills: 2, open: 12400 }

describe('ownerSeesCard', () => {
  it('off with open bills the owner cannot see: an amber crossed eye, the fact first, the figure labelled, the door', () => {
    const c = ownerSeesCard(base)
    expect(c.eye).toBe('crossed')
    expect(c.tone).toBe('amber')
    expect(c.title).toBe("Nia Okafor's page shows $0 of this job.")
    expect(c.why).toContain('Ridgeway Builders')
    expect(c.fact).toEqual({ label: 'Open to Ridgeway Builders', value: '$12,400' })
    expect(c.door).toBe('Show Nia the bills')
  })
  it('off with no bill out: a grey crossed eye, nothing to act on, no figure', () => {
    const c = ownerSeesCard({ ...base, openBills: 0, open: 0 })
    expect(c.eye).toBe('crossed')
    expect(c.tone).toBe('grey')
    expect(c.title).toBe("Nia Okafor's page shows nothing of this job's money yet.")
    expect(c.fact).toBeNull()
    expect(c.door).toBe('Show Nia the bills')
  })
  it('an open bill of $0 counts as nothing to show', () => {
    expect(ownerSeesCard({ ...base, openBills: 1, open: 0 }).tone).toBe('grey')
  })
  it('on: a blue open eye, the figure on their page, Stop showing', () => {
    const c = ownerSeesCard({ ...base, state: 'on', open: 9200 })
    expect(c.eye).toBe('open')
    expect(c.tone).toBe('blue')
    expect(c.title).toBe("Nia Okafor sees this job's bills on their page.")
    expect(c.fact).toEqual({ label: 'On their page', value: '$9,200 open' })
    expect(c.door).toBe('Stop showing')
    expect(c.short).toBe('on their page')
  })
  it('on with nothing open says the next bill shows too', () => {
    const c = ownerSeesCard({ ...base, state: 'on', openBills: 0, open: 0 })
    expect(c.fact).toBeNull()
    expect(c.why).toContain('The next bill shows on their page too.')
  })
  it('partly: an amber hollow eye and Show the rest', () => {
    const c = ownerSeesCard({ ...base, state: 'partly' })
    expect(c.eye).toBe('hollow')
    expect(c.tone).toBe('amber')
    expect(c.door).toBe('Show Nia the rest')
    expect(c.short).toBe('some on their page')
  })
  it('the fallback name reads as the owner, never as a first name', () => {
    expect(ownerFirstName('The owner')).toBe('the owner')
    expect(ownerFirstName('')).toBe('the owner')
    expect(ownerFirstName('Billy & Sarah Garcia')).toBe('Billy')
    const c = ownerSeesCard({ ...base, ownerName: 'The owner', gcName: '' })
    expect(c.door).toBe('Show the owner the bills')
    expect(c.why).toContain('the GC')
  })
  it('every sentence the card says keeps to plain words', () => {
    const inputs: OwnerSeesInput[] = [base, { ...base, openBills: 0, open: 0 }, { ...base, state: 'on' }, { ...base, state: 'on', openBills: 0, open: 0 }, { ...base, state: 'partly' }, { ...base, ownerName: 'The owner' }]
    for (const i of inputs) {
      for (const s of ownerSeesCardSentences(ownerSeesCard(i))) expect(plainWordsFailures(s), s).toEqual([])
    }
  })
})
