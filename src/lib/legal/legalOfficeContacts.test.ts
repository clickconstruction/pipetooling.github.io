import { describe, expect, it } from 'vitest'
import { askForWords, emptyOfficeContacts, formatUsPhone, legalOfficeContactLines, legalOfficeContactPrintLines, legalOfficeContactsGap, legalOfficeContactsHoursLine, officeContactsFromUsers, telHref } from './legalOfficeContacts'

const rows = [
  { name: 'Robin Ortega', phone: null, role: 'assistant' },
  { name: 'Casey Lindell', phone: '(512) 555-0199', role: 'assistant' },
  { name: 'Robert Douglas', phone: '+1 617 939 6295', role: 'controller' },
  { name: '  ', phone: '1', role: 'assistant' },
]

describe('legalOfficeContacts', () => {
  it('builds the contacts from the users rows, by name, and formats the numbers one way', () => {
    const c = officeContactsFromUsers(rows, '(512) 360-0599')
    expect(c).toEqual({ phone: '(512) 360-0599', assistants: ['Casey Lindell', 'Robin Ortega'], controllers: [{ name: 'Robert Douglas', phone: '+1 617 939 6295' }] })
    expect(formatUsPhone('+1 617 939 6295')).toBe('(617) 939-6295')
    expect(formatUsPhone('5123600599')).toBe('(512) 360-0599')
    expect(formatUsPhone('ext 204')).toBe('ext 204')
    expect(telHref('(617) 939-6295')).toBe('tel:+16179396295')
  })

  it('says who to ask for by first name', () => {
    expect(askForWords([])).toBe('')
    expect(askForWords(['Robin Ortega'])).toBe('ask for Robin')
    expect(askForWords(['Casey Lindell', 'Robin Ortega'])).toBe('ask for Casey or Robin')
    expect(askForWords(['Casey Lindell', 'Robin Ortega', 'Lee Park', 'Lee Tran'])).toBe('ask for Casey, Robin or Lee')
  })

  it('draws the strip, the hours line and the print lines', () => {
    const c = officeContactsFromUsers(rows, '(512) 360-0599')
    expect(legalOfficeContactLines(c)).toEqual([
      { role: 'Office', name: '', phoneWords: '(512) 360-0599', href: 'tel:+15123600599', note: 'ask for Casey or Robin' },
      { role: 'Controller · settlements and payments', name: 'Robert Douglas', phoneWords: '(617) 939-6295', href: 'tel:+16179396295', note: '' },
    ])
    expect(legalOfficeContactsHoursLine(c)).toBe('The office in business hours. Robert when the office does not answer.')
    expect(legalOfficeContactPrintLines(c)).toEqual(['Reach the office: (512) 360-0599, ask for Casey or Robin', 'Controller Robert Douglas (617) 939-6295'])
    expect(legalOfficeContactsGap(c)).toBeNull()
  })

  it('an older payload, or a controller with no phone, shows the office line alone and names the gap', () => {
    const bare = emptyOfficeContacts('(512) 360-0599')
    expect(legalOfficeContactLines(bare)).toHaveLength(1)
    expect(legalOfficeContactLines(bare)[0]!.note).toBe('')
    expect(legalOfficeContactsHoursLine(bare)).toBe('The office in business hours.')
    expect(legalOfficeContactsGap(bare)).toBe('No controller on file — the firm’s page shows the office number alone.')
    const noPhone = officeContactsFromUsers([{ name: 'Robert Douglas', phone: '', role: 'controller' }], '(512) 360-0599')
    expect(legalOfficeContactLines(noPhone)).toHaveLength(1)
    expect(legalOfficeContactsGap(noPhone)).toBe('Robert Douglas has no phone on file — the firm’s page shows the office number alone.')
    expect(legalOfficeContactLines(emptyOfficeContacts())).toEqual([])
    expect(legalOfficeContactsHoursLine(emptyOfficeContacts())).toBe('')
  })
})
