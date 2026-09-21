import { describe, expect, it } from 'vitest'
import { rollMailingLines } from './rollMailingLines'

describe('rollMailingLines', () => {
  it('reads the roll’s leading % as care-of and breaks the address into envelope lines', () => {
    expect(rollMailingLines('% SABRA HEALTH CARE REIT INC 18500 VON KARMAN AVE STE 550, IRVINE, CA 92612')).toEqual({
      careOf: 'Sabra Health Care Reit Inc',
      lines: ['18500 Von Karman Ave Ste 550', 'Irvine, CA 92612'],
    })
  })

  it('a plain address has no care-of; the state stays upper-case and ZIP+4 survives', () => {
    expect(rollMailingLines('704 GARRATY CT , SAN ANTONIO, TX 78209-1234')).toEqual({ careOf: '', lines: ['704 Garraty Ct', 'San Antonio, TX 78209-1234'] })
  })

  it('C/O and ATTN lead the same way, and a PO box ends the care-of name', () => {
    expect(rollMailingLines('C/O RYAN LLC PO BOX 4900, SCOTTSDALE, AZ 85261')).toEqual({ careOf: 'Ryan Llc', lines: ['PO Box 4900', 'Scottsdale, AZ 85261'] })
    expect(rollMailingLines('ATTN: TAX DEPT 1 MAIN ST, DALLAS, TX 75201').careOf).toBe('Tax Dept')
  })

  it('a number inside the care-of name is not mistaken for the street', () => {
    expect(rollMailingLines('% 7-ELEVEN INC 1722 ROUTH ST STE 1000, DALLAS, TX 75201')).toEqual({ careOf: '7-Eleven Inc', lines: ['1722 Routh St Ste 1000', 'Dallas, TX 75201'] })
  })

  it('a suite on its own comma part stays its own line', () => {
    expect(rollMailingLines('100 CONGRESS AVE, STE 200, AUSTIN, TX 78701').lines).toEqual(['100 Congress Ave', 'Ste 200', 'Austin, TX 78701'])
  })

  it('falls back to the roll’s own string when the shape is not recognised', () => {
    expect(rollMailingLines('% SOMEBODY WITH NO STREET')).toEqual({ careOf: '', lines: ['% Somebody With No Street'] })
    expect(rollMailingLines('Calle 5 No. 12, Monterrey NL, Mexico')).toEqual({ careOf: '', lines: ['Calle 5 No. 12, Monterrey NL, Mexico'] })
    expect(rollMailingLines('  ')).toEqual({ careOf: '', lines: [] })
  })
})
