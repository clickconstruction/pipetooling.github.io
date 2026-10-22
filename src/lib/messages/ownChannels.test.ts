import { describe, expect, it } from 'vitest'
import type { BoxSettings } from './boxes'
import { isOwnAddress, isOwnNumber, ownChannels } from './ownChannels'

const BOXES: BoxSettings = {
  team: { address: 'Team@ClickPlumbing.example', phone: '(512) 994-2774', numberId: 'PN-team' },
  bids: { address: 'bids@clickplumbing.example ', phone: '737-300-9478', numberId: 'PN-bids' },
}

describe('ownChannels (punch list #142 PR 1): the company’s own addresses and numbers', () => {
  it('holds both boxes’ addresses and the app’s sender, lower-cased and trimmed, and both numbers as E.164', () => {
    const own = ownChannels(BOXES, 'team@noreply.clicktooling.example')
    expect([...own.addresses].sort()).toEqual(['bids@clickplumbing.example', 'team@clickplumbing.example', 'team@noreply.clicktooling.example'])
    expect([...own.numbers].sort()).toEqual(['+15129942774', '+17373009478'])
  })

  it('takes more addresses the caller reads as its own, and reads no row or no sender as nothing', () => {
    const own = ownChannels(null, null, [' Bids@Secret.example '])
    expect([...own.addresses]).toEqual(['bids@secret.example'])
    expect(own.numbers.size).toBe(0)
    expect(ownChannels(null, undefined).addresses.size).toBe(0)
  })

  it('leaves out an empty field and a number it cannot read', () => {
    const own = ownChannels({ team: { address: '', phone: '555', numberId: '' }, bids: { address: '  ', phone: '', numberId: '' } }, '')
    expect(own.addresses.size).toBe(0)
    expect(own.numbers.size).toBe(0)
  })

  it('answers an address in any case and spacing, and a number however it is written', () => {
    const own = ownChannels(BOXES, 'team@noreply.clicktooling.example')
    expect(isOwnAddress(own, ' BIDS@clickplumbing.example')).toBe(true)
    expect(isOwnAddress(own, 'greg@hillside.example')).toBe(false)
    expect(isOwnNumber(own, '+1 (737) 300-9478')).toBe(true)
    expect(isOwnNumber(own, '7373009478')).toBe(true)
    expect(isOwnNumber(own, '17373009478')).toBe(true)
    expect(isOwnNumber(own, '+12105550100')).toBe(false)
    expect(isOwnNumber(own, 'not a number')).toBe(false)
  })
})
