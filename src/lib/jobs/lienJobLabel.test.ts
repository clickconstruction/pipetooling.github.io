import { describe, expect, it } from 'vitest'
import { splitLienJobLabel } from './lienJobLabel'

describe('splitLienJobLabel', () => {
  it('splits the number from the name at the first dot', () => {
    expect(splitLienJobLabel('663 · Knight Contracting- Taylor (GRAEF)')).toEqual({ number: '663', name: 'Knight Contracting- Taylor (GRAEF)' })
    expect(splitLienJobLabel('1046 PLUM · Pretest')).toEqual({ number: '1046 PLUM', name: 'Pretest' })
  })
  it('keeps a later dot in the name', () => {
    expect(splitLienJobLabel('273 · Dudley · Lennox')).toEqual({ number: '273', name: 'Dudley · Lennox' })
  })
  it('a label with no name is all number', () => {
    expect(splitLienJobLabel('663')).toEqual({ number: '663', name: '' })
    expect(splitLienJobLabel('a1b2c3d4')).toEqual({ number: 'a1b2c3d4', name: '' })
  })
})
