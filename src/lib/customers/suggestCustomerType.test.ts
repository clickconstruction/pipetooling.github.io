import { describe, expect, it } from 'vitest'
import { suggestCustomerType } from './suggestCustomerType'

describe('suggestCustomerType', () => {
  it('flags business words as commercial with the matched word', () => {
    expect(suggestCustomerType('Loberg Contracting')).toEqual({ suggested: 'commercial', matchedWord: 'Contracting' })
    expect(suggestCustomerType('Big Easy Saloon')).toEqual({ suggested: 'commercial', matchedWord: 'Saloon' })
    expect(suggestCustomerType('City of Seguin')).toEqual({ suggested: 'commercial', matchedWord: 'City of' })
    expect(suggestCustomerType('Limitless Renovations & Design LLC').suggested).toBe('commercial')
    expect(suggestCustomerType('Hamilton Valley Management').suggested).toBe('commercial')
    expect(suggestCustomerType('San Marcos Housing Authority').suggested).toBe('commercial')
  })

  it('defaults person-looking names to residential', () => {
    expect(suggestCustomerType('Adam Jendrzy')).toEqual({ suggested: 'residential', matchedWord: null })
    expect(suggestCustomerType('Hortensia & Daniel Moreno').suggested).toBe('residential')
    expect(suggestCustomerType('Akshay Kh').suggested).toBe('residential')
    expect(suggestCustomerType('')).toEqual({ suggested: 'residential', matchedWord: null })
    expect(suggestCustomerType(null).suggested).toBe('residential')
  })

  it('does not fire on substrings inside ordinary words', () => {
    // "co" and "inc" must match as whole words only.
    expect(suggestCustomerType('Cora Coleman').suggested).toBe('residential')
    expect(suggestCustomerType('Vince Price').suggested).toBe('residential')
  })
})
