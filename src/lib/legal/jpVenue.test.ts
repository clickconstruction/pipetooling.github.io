import { describe, expect, it } from 'vitest'
import { courtWords, justiceCourtCap, lienForeclosureLine, venuePlaces, whereToFileText } from './jpVenue'

describe('jpVenue (v2.4764)', () => {
  it('the $20,000 justice court limit, fees in and interest out', () => {
    expect(justiceCourtCap(15781.82)).toEqual({ within: true, words: "$15,781.82 is within the justice court limit ($20,000, Gov't Code § 27.031; fees count, interest does not).", chip: 'within $20,000' })
    expect(justiceCourtCap(20000).within).toBe(true)
    expect(justiceCourtCap(38625)).toEqual({ within: false, words: '$38,625.00 is over the justice court limit ($20,000) — county or district court.', chip: 'over $20,000 · county court' })
  })

  it('both venue bases, one per distinct property, the precinct not yet', () => {
    const places = venuePlaces({
      properties: [
        { address: '380 TX-123, Seguin, TX 78155', county: 'Guadalupe', jobLabels: ['878 · Take 5- Seguin'] },
        { address: '380 TX-123, Seguin, TX 78155', county: 'Guadalupe', jobLabels: ['879 · Take 5- Seguin add'] },
        { address: '150 E Sonterra Blvd, San Antonio', county: 'Bexar', jobLabels: ['898 · Reliant'] },
      ],
      payer: { name: 'TC/JP Seguin 2019 LLC', address: '9000 Tesoro Dr, San Antonio', county: 'Bexar' },
    })
    expect(places.map((p) => [p.basis, p.county, p.where])).toEqual([
      ['work', 'Guadalupe', '380 TX-123, Seguin, TX 78155'],
      ['work', 'Bexar', '150 E Sonterra Blvd, San Antonio'],
      ['defendant', 'Bexar', 'TC/JP Seguin 2019 LLC, 9000 Tesoro Dr, San Antonio'],
    ])
    expect(courtWords(places[0]!)).toBe('Guadalupe County · justice precinct not yet')
    expect(courtWords({ county: 'Guadalupe', precinct: '2' })).toBe('Guadalupe County · Justice Court, Precinct 2')
    expect(courtWords({ county: '', precinct: null })).toBe('county not on the record')
  })

  it('the lien line and the printed paragraph', () => {
    expect(lienForeclosureLine(['Guadalupe', 'Guadalupe'])).toBe("A lien foreclosure goes to district court in Guadalupe County — a justice court cannot foreclose a lien on land (Gov't Code § 27.031(b)).")
    expect(lienForeclosureLine(['Guadalupe', 'Bexar'])).toContain('in Guadalupe or Bexar County')
    expect(lienForeclosureLine([])).toContain("in the property's county")
    const text = whereToFileText({ balance: 4800, places: venuePlaces({ properties: [{ address: '7 Willow Ct, San Marcos', county: 'Hays', jobLabels: ['1063'] }], payer: { name: 'Sam Whitfield', address: '7 Willow Ct, San Marcos', county: 'Hays' } }) })
    expect(text).toContain('$4,800.00 is within the justice court limit')
    expect(text).toContain('Where the work was done: Hays County · justice precinct not yet (7 Willow Ct, San Marcos).')
    expect(text).toContain('Where the defendant is: Hays County · justice precinct not yet (Sam Whitfield, 7 Willow Ct, San Marcos).')
    expect(text).toContain('district court in Hays County')
    expect(text).toContain('Confirm with the clerk before filing.')
  })
})
