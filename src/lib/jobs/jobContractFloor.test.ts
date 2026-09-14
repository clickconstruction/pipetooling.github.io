import { describe, expect, it } from 'vitest'
import { parseJobContractFloorCents } from '../appSettingsKeys'
import { formatContractFloor, isUnderContractFloor, parseTypedFloorToCents } from './jobContractFloor'

describe('the contract floor', () => {
  it('parses the stored value: missing, garbage and negatives read 0 (no floor)', () => {
    expect(parseJobContractFloorCents(null)).toBe(0)
    expect(parseJobContractFloorCents('')).toBe(0)
    expect(parseJobContractFloorCents('abc')).toBe(0)
    expect(parseJobContractFloorCents(-5)).toBe(0)
    expect(parseJobContractFloorCents(250000)).toBe(250000)
    expect(parseJobContractFloorCents('250000.4')).toBe(250000)
  })

  it('a job is under the floor only when it has an amount below it — no amount is unknown, not small', () => {
    expect(isUnderContractFloor(450, 250000)).toBe(true)
    expect(isUnderContractFloor(2500, 250000)).toBe(false)
    expect(isUnderContractFloor(123600, 250000)).toBe(false)
    expect(isUnderContractFloor(null, 250000)).toBe(false)
    expect(isUnderContractFloor(0, 250000)).toBe(false)
    expect(isUnderContractFloor(450, 0)).toBe(false)
  })

  it('formats the floor for the card and parses what a dev types', () => {
    expect(formatContractFloor(250000)).toBe('$2,500')
    expect(formatContractFloor(250050)).toBe('$2,500.50')
    expect(formatContractFloor(0)).toBe('')
    expect(parseTypedFloorToCents('2,500')).toBe(250000)
    expect(parseTypedFloorToCents('$2500.50')).toBe(250050)
    expect(parseTypedFloorToCents('0')).toBe(0)
    expect(parseTypedFloorToCents('')).toBeNull()
    expect(parseTypedFloorToCents('two')).toBeNull()
  })
})
