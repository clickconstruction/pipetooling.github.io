import { describe, expect, it } from 'vitest'
import { cadPasteHasFacts, parseCadPagePaste } from './cadPagePaste'

/** A BIS "esearch" property page (Comal / Hays / Guadalupe / …) copied whole: labels and values on separate lines. */
const BIS_PAGE = `Comal AD Property Search
Property ID: 178402 For Year 2026
Property Details
Account
Property ID:
178402
Geographic ID:
10000000000
Type:
Real
Property Use Code:
A1
Location
Situs Address:
412 GRUENE RD
NEW BRAUNFELS, TX 78130
Map ID:
Neighborhood CD:
Legal Description:
GRUENE CROSSING 2, BLOCK 4,
LOT 17
Abstract/Subdivision:
S1234 - GRUENE CROSSING 2
Owner
Owner Name:
WHITFIELD DANA & MARCUS
Owner ID:
55512
Mailing Address:
PO BOX 2210
NEW BRAUNFELS, TX 78131
% Ownership:
100.0000000000%
Exemptions:
HS
Values
Improvement Homesite Value:
$310,000
Deed History
Deed Date
Type
Grantor
Grantee
Owner Name:
PREVIOUS OWNER LLC`

describe('parseCadPagePaste — BIS esearch page', () => {
  const r = parseCadPagePaste(BIS_PAGE)
  it('reads the legal description across its wrap, the first owner, and the mailing address', () => {
    expect(r.propId).toBe('178402')
    expect(r.legalDescription).toBe('GRUENE CROSSING 2, BLOCK 4, LOT 17')
    expect(r.ownerName).toBe('WHITFIELD DANA & MARCUS')
    expect(r.mailingAddress).toBe('PO BOX 2210 NEW BRAUNFELS, TX 78131')
    expect(r.situsAddress).toBe('412 GRUENE RD NEW BRAUNFELS, TX 78130')
  })
  it('reads the HS exemption as a homestead', () => {
    expect(r.homestead).toBe('yes')
  })
  it('lists what it found in page order and ignores the deed-history repeat of Owner Name', () => {
    expect(r.found).toEqual(['propId', 'situsAddress', 'legalDescription', 'ownerName', 'mailingAddress', 'exemptions'])
    expect(cadPasteHasFacts(r)).toBe(true)
  })
})

describe('parseCadPagePaste — other shapes', () => {
  it('single-line "Label: value" rows (TrueAutomation / spreadsheets)', () => {
    const r = parseCadPagePaste(`Account Number: 04456-000-0170
Owner Name: ORTEGA HOLDINGS LLC
Mailing Address: 1180 S GUADALUPE ST, SAN MARCOS, TX 78666
Legal Description: PECAN PARK SEC 3, BLOCK C, LOT 12
Exemptions: none
Land Value: $80,000`)
    expect(r.propId).toBe('04456-000-0170')
    expect(r.ownerName).toBe('ORTEGA HOLDINGS LLC')
    expect(r.mailingAddress).toBe('1180 S GUADALUPE ST, SAN MARCOS, TX 78666')
    expect(r.legalDescription).toBe('PECAN PARK SEC 3, BLOCK C, LOT 12')
    expect(r.homestead).toBe('no')
  })
  it('an OV65-only exemption line is not a homestead; a missing line is unknown', () => {
    expect(parseCadPagePaste('Exemptions: OV65').homestead).toBe('no')
    expect(parseCadPagePaste('Exemptions: HS, OV65').homestead).toBe('yes')
    expect(parseCadPagePaste('Owner Name: X').homestead).toBe('unknown')
  })
  it('a blank line ends a wrapped value; unrelated labelled rows do not leak in', () => {
    const r = parseCadPagePaste(`Legal Description:
LOT 3, BLOCK A

Market Value: $1
Owner Name:
GARZA ELENA M
Owner ID: 9`)
    expect(r.legalDescription).toBe('LOT 3, BLOCK A')
    expect(r.ownerName).toBe('GARZA ELENA M')
  })
  it('nothing useful → no facts', () => {
    const r = parseCadPagePaste('Welcome to the property search.\nType an address to begin.')
    expect(cadPasteHasFacts(r)).toBe(false)
    expect(r.found).toEqual([])
    expect(parseCadPagePaste('').found).toEqual([])
  })
})
