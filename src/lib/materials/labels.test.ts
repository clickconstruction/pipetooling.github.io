import { describe, expect, it } from 'vitest'
import { boxAddress, boxCode, boxUrl, labelRows, normalizeBoxCode } from './labels'

const ID = '7d759246-8476-4a37-884f-ed1562d5663f'

describe('the box code', () => {
  it('is the first eight characters of the id, in capitals', () => {
    expect(boxCode(ID)).toBe('7D759246')
  })

  it('makes an address short enough for a 21-module code, in the letters a QR packs tight', () => {
    const url = boxUrl(ID)
    expect(url).toBe('PRTS.CO/B/7D759246')
    // a version-1 QR at level M holds 20 characters of its letter mode
    expect(url.length).toBeLessThanOrEqual(20)
    expect(url).toMatch(/^[0-9A-Z $%*+\-./:]+$/)
    expect(boxAddress(ID)).toBe('prts.co/b/7D759246')
  })

  it('reads a code back however it was typed', () => {
    expect(normalizeBoxCode('7d759246')).toBe('7D759246')
    expect(normalizeBoxCode('7D75-9246')).toBe('7D759246')
    expect(normalizeBoxCode('7D75')).toBe('')
  })
})

describe('labelRows', () => {
  const line = (partName: string, onHand: number) => ({ partName, manufacturer: null, onHand })

  it('lists what is on hand, then blank rows up to ten', () => {
    const rows = labelRows([line('3/4" copper 90', 25), line('1/2" ball valve', 4), line('gone', 0)])
    expect(rows).toHaveLength(10)
    expect(rows.slice(0, 2)).toEqual([{ partName: '3/4" copper 90', manufacturer: null, onHand: 25 }, { partName: '1/2" ball valve', manufacturer: null, onHand: 4 }])
    expect(rows.slice(2).every((r) => r === null)).toBe(true)
  })

  it('keeps four blank rows under a full box', () => {
    const rows = labelRows(Array.from({ length: 12 }, (_, i) => line(`part ${i}`, 1)))
    expect(rows).toHaveLength(16)
    expect(rows.filter((r) => r === null)).toHaveLength(4)
  })

  it('is ten blank rows on an empty box', () => {
    expect(labelRows([])).toEqual(Array.from({ length: 10 }, () => null))
  })
})
