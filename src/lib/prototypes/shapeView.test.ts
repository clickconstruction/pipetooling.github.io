import { describe, expect, it } from 'vitest'
import { shapeViewAsked } from './shapeView'

describe('shapeViewAsked', () => {
  it('asks for every prototype with 1, all or true, and for one by its key', () => {
    expect(['1', 'all', 'true', 'day-strip', 'Day-Strip', 'crew-cards,day-strip'].map((v) => shapeViewAsked(v, 'day-strip'))).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ])
    expect([null, '', '0', 'crew-cards'].map((v) => shapeViewAsked(v, 'day-strip'))).toEqual([false, false, false, false])
  })
})
