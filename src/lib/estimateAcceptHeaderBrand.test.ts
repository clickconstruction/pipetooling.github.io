import { describe, expect, it } from 'vitest'
import {
  acceptHeaderBrandImageSrc,
  acceptHeaderBrandLabel,
  acceptHeaderBrandPublicPath,
  parseAcceptHeaderBrand,
} from './estimateAcceptHeaderBrand'

describe('estimateAcceptHeaderBrand', () => {
  it('parses only the two known brands', () => {
    expect(parseAcceptHeaderBrand(' elec ')).toBe('elec')
    expect(parseAcceptHeaderBrand('plum')).toBe('plum')
    expect(parseAcceptHeaderBrand('gas')).toBeNull()
    expect(parseAcceptHeaderBrand(null)).toBeNull()
    expect(parseAcceptHeaderBrand(1)).toBeNull()
  })
  it('labels, public paths and the subpath-safe image src', () => {
    expect(acceptHeaderBrandLabel('elec')).toBe('Electrical')
    expect(acceptHeaderBrandLabel('plum')).toBe('Plumbing')
    expect(acceptHeaderBrandPublicPath('elec')).toBe('/brand/click-elec.png')
    expect(acceptHeaderBrandPublicPath('plum')).toBe('/brand/click-plum.png')
    // vitest serves BASE_URL as '/', so the src is the bare path with no double slash
    expect(acceptHeaderBrandImageSrc('plum')).toBe('/brand/click-plum.png')
  })
})
