import { describe, expect, it } from 'vitest'
import { stagesRowIconsPerRow } from './stagesRowIconGrid'

describe('stagesRowIconsPerRow', () => {
  it('keeps up to four icons on one row', () => {
    expect([0, 1, 2, 3, 4].map(stagesRowIconsPerRow)).toEqual([0, 1, 2, 3, 4])
  })

  it('splits two rows evenly, never more than four a row', () => {
    expect([5, 6, 7, 8].map(stagesRowIconsPerRow)).toEqual([3, 3, 4, 4])
  })

  it('takes a third row past eight', () => {
    expect([9, 10, 12].map(stagesRowIconsPerRow)).toEqual([3, 4, 4])
  })
})
