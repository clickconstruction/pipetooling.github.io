import { describe, expect, it } from 'vitest'
import { townFromAddress } from './gcModel'

describe('townFromAddress (the drive read from the address)', () => {
  it('finds the town in the address, the one written last winning', () => {
    expect(townFromAddress('24165 IH-10 W, San Antonio')).toBe('San Antonio')
    expect(townFromAddress('4410 Boerne Stage Rd, San Antonio, TX 78256')).toBe('San Antonio')
    expect(townFromAddress('1436 River Rd, Boerne')).toBe('Boerne')
    expect(townFromAddress('9811 bandera rd, suite 140, helotes')).toBe('Helotes')
  })

  it('is null when no town we know is in it', () => {
    expect(townFromAddress('100 Main St, Comfort')).toBeNull()
    expect(townFromAddress('')).toBeNull()
  })
})
