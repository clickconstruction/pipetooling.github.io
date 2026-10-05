import { describe, expect, it } from 'vitest'
import { hiddenRobotsWords, isZzBidName, normalizeHideRobots, splitRobotBids } from './bidPickerRobots'

describe('isZzBidName', () => {
  it('a name that starts with the word ZZ, whatever its case or leading space', () => {
    for (const n of ['ZZ Shadow PATAGONIA - AUSTIN', 'ZZ Twin MPH STAGE (backtest)', 'ZZ Test', 'zz takeoffs test', '  ZZ Shadow X', 'ZZ']) expect(isZzBidName(n)).toBe(true)
  })

  it('a real project is not one, even with ZZ inside it or more Zs in front', () => {
    for (const n of ['PATAGONIA - AUSTIN', 'ZZZ Corp remodel', 'Pizza ZZ Top', 'Zzyzx Road', '', null, undefined]) expect(isZzBidName(n)).toBe(false)
  })
})

describe('splitRobotBids', () => {
  const bids = [
    { id: 'b1', project_name: 'ZZ Shadow LONE STAR MARKET' },
    { id: 'b2', project_name: 'Lone Star Market' },
    { id: 'b3', project_name: 'ZZ Test' },
    { id: 'b4', project_name: null },
  ]

  it('off: every bid, the same array, nothing counted', () => {
    const r = splitRobotBids(bids, false, () => false)
    expect(r.shown).toBe(bids)
    expect(r.hidden).toBe(0)
  })

  it('on: the ZZ bids go and are counted; the order of the rest holds', () => {
    const r = splitRobotBids(bids, true, () => false)
    expect(r.shown.map((b) => b.id)).toEqual(['b2', 'b4'])
    expect(r.hidden).toBe(2)
  })

  it('a ZZ bid marked by you or for you stays', () => {
    const r = splitRobotBids(bids, true, (id) => id === 'b1')
    expect(r.shown.map((b) => b.id)).toEqual(['b1', 'b2', 'b4'])
    expect(r.hidden).toBe(1)
  })
})

describe('hiddenRobotsWords', () => {
  it('counts in plain words and says nothing for none', () => {
    expect(hiddenRobotsWords(0)).toBe('')
    expect(hiddenRobotsWords(1)).toBe('1 ZZ bid hidden.')
    expect(hiddenRobotsWords(12)).toBe('12 ZZ bids hidden.')
  })
})

describe('normalizeHideRobots', () => {
  it('on until the person turns it off: only the stored "0" is off', () => {
    expect(normalizeHideRobots('0')).toBe(false)
    for (const raw of [null, undefined, '', '1', 'true']) expect(normalizeHideRobots(raw)).toBe(true)
  })
})
