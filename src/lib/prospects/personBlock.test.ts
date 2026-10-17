import { describe, expect, it } from 'vitest'
import { EMPTY_COMPANY, EMPTY_PERSON, blocksFromRow, blocksProblem, callNumbers, okToTextOf, personLineParts, prospectTitle, rowFromBlocks, textAskWords } from './personBlock'

const sub = rowFromBlocks(
  { name: 'Tomás Reyna', title: 'Estimator', cell: '(210) 555-0122', email: 'tomas@example.com', lang: 'es', okToText: 'not_asked' },
  { company: 'Bexar Fire Protection', officePhone: '(210) 555-0188', address: '1800 Cibolo Trail, Boerne', website: 'https://bexarfire.example', alsoReach: 'Ana Reyna, office · (210) 555-0190', mapsUrl: '', license: '' },
)

describe('rowFromBlocks and blocksFromRow', () => {
  it('a company with a person: the company is the title, the person is the contact', () => {
    expect(sub.is_person).toBe(false)
    expect(sub.company_name).toBe('Bexar Fire Protection')
    expect(sub.contact_name).toBe('Tomás Reyna')
    expect(sub.contact_title).toBe('Estimator')
    expect(sub.contact_phone).toBe('(210) 555-0122')
    expect(sub.phone_number).toBe('(210) 555-0188')
    expect(sub.lang).toBe('es')
    expect(sub.ok_to_text).toBe('not_asked')
    expect(blocksFromRow(sub)).toEqual({
      person: { name: 'Tomás Reyna', title: 'Estimator', cell: '(210) 555-0122', email: 'tomas@example.com', lang: 'es', okToText: 'not_asked' },
      company: { company: 'Bexar Fire Protection', officePhone: '(210) 555-0188', address: '1800 Cibolo Trail, Boerne', website: 'https://bexarfire.example', alsoReach: 'Ana Reyna, office · (210) 555-0190', mapsUrl: '', license: '' },
    })
  })

  it('a person on their own: their name is the title, is_person is true, and the blocks come back the same', () => {
    const dana = rowFromBlocks({ ...EMPTY_PERSON, name: ' Dana Whitlock ', cell: '(512) 555-0177', okToText: 'yes' }, { ...EMPTY_COMPANY, address: '1208 Mesquite Ln' })
    expect(dana.is_person).toBe(true)
    expect(dana.company_name).toBe('Dana Whitlock')
    expect(dana.contact_name).toBe('Dana Whitlock')
    expect(dana.phone_number).toBeNull()
    expect(dana.ok_to_text).toBe('yes')
    const back = blocksFromRow(dana)
    expect(back.person.name).toBe('Dana Whitlock')
    expect(back.company.company).toBe('')
    expect(back.person.okToText).toBe('yes')
  })

  it('an old row with no person reads as a company with an empty person block', () => {
    const old = blocksFromRow({ company_name: 'Ridgeway Builders', contact_name: null, contact_title: null, contact_phone: null, phone_number: '(512) 555-0142', email: null, address: null, links_to_website: null, lang: null, ok_to_text: null, is_person: false, also_reach: null, maps_url: null, license: null })
    expect(old.person).toEqual(EMPTY_PERSON)
    expect(old.company.company).toBe('Ridgeway Builders')
    expect(old.company.officePhone).toBe('(512) 555-0142')
  })

  it('holds a save with no name on either block', () => {
    expect(blocksProblem(EMPTY_PERSON, EMPTY_COMPANY)).toBe('Give the person or the company a name.')
    expect(blocksProblem({ ...EMPTY_PERSON, name: 'Dana' }, EMPTY_COMPANY)).toBeNull()
    expect(blocksProblem(EMPTY_PERSON, { ...EMPTY_COMPANY, company: 'Bexar' })).toBeNull()
  })
})

describe('the card', () => {
  it('titles the company, or the person on their own, or says no name', () => {
    expect(prospectTitle(sub)).toBe('Bexar Fire Protection')
    expect(prospectTitle({ company_name: null, contact_name: 'Dana' })).toBe('Dana')
    expect(prospectTitle({ company_name: null, contact_name: null })).toBe('(no name)')
  })
  it('lines up the person, their title and language, and leaves the title out when they are the record', () => {
    expect(personLineParts(sub)).toEqual(['Tomás Reyna', 'Estimator', 'Spanish'])
    expect(personLineParts({ contact_name: 'Dana Whitlock', contact_title: null, lang: 'en', is_person: true })).toEqual(['English'])
  })
  it('says where texting stands', () => {
    expect(textAskWords('not_asked')).toEqual({ words: 'text? not asked', tone: 'quiet' })
    expect(textAskWords('yes').words).toBe('OK to text')
    expect(textAskWords('no').tone).toBe('no')
    expect(okToTextOf('maybe')).toBe('not_asked')
  })
  it('dials the cell first and names the other number', () => {
    expect(callNumbers(sub)).toEqual({ call: '(210) 555-0122', other: { label: 'office', number: '(210) 555-0188' } })
    expect(callNumbers({ contact_phone: null, phone_number: '(512) 555-0142' })).toEqual({ call: '(512) 555-0142', other: null })
    expect(callNumbers({ contact_phone: null, phone_number: null }).call).toBeNull()
  })
  it('carries the Maps link and the license both ways (v2.5604)', () => {
    const row = rowFromBlocks({ ...EMPTY_PERSON, name: 'Tomás' }, { ...EMPTY_COMPANY, company: 'Bexar Fire Protection', mapsUrl: ' https://maps.app.goo.gl/x7Qz ', license: 'TX SCR-1884' })
    expect(row.maps_url).toBe('https://maps.app.goo.gl/x7Qz')
    expect(row.license).toBe('TX SCR-1884')
    expect(blocksFromRow(row).company.mapsUrl).toBe('https://maps.app.goo.gl/x7Qz')
  })
})
