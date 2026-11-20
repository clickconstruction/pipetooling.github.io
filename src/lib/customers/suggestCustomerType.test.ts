import { describe, expect, it } from 'vitest'
import { suggestCustomerType } from './suggestCustomerType'

describe('suggestCustomerType', () => {
  it('flags business words as commercial with the matched word', () => {
    expect(suggestCustomerType('Lowbeck Contracting')).toEqual({ suggested: 'commercial', matchedWord: 'Contracting' })
    expect(suggestCustomerType('Blythe Emery Saloon')).toEqual({ suggested: 'commercial', matchedWord: 'Saloon' })
    expect(suggestCustomerType('City of Sefton')).toEqual({ suggested: 'commercial', matchedWord: 'City of' })
    expect(suggestCustomerType('Linwick Renovations & Design LLC').suggested).toBe('commercial')
    expect(suggestCustomerType('Hartwell Valley Management').suggested).toBe('commercial')
    expect(suggestCustomerType('San Macrae Housing Authority').suggested).toBe('commercial')
  })

  it('defaults person-looking names to residential', () => {
    expect(suggestCustomerType('Alan Jardine')).toEqual({ suggested: 'residential', matchedWord: null })
    expect(suggestCustomerType('Harold & Dennis Mercer').suggested).toBe('residential')
    expect(suggestCustomerType('Angela Kt').suggested).toBe('residential')
    expect(suggestCustomerType('')).toEqual({ suggested: 'residential', matchedWord: null })
    expect(suggestCustomerType(null).suggested).toBe('residential')
  })

  it('does not fire on substrings inside ordinary words', () => {
    // "co" and "inc" must match as whole words only.
    expect(suggestCustomerType('Cora Coleman').suggested).toBe('residential')
    expect(suggestCustomerType('Vince Price').suggested).toBe('residential')
  })
})
