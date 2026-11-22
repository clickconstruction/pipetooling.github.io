import { describe, expect, it } from 'vitest'
import { rosterEmailCheck, rosterEmailOffer, rosterEmailText } from './subPaperRosterEmail'
import { subPaperEmailDoor } from './subPaperSend'

// Made-up people and addresses.
describe('rosterEmailCheck: an address the function would send to', () => {
  it('keeps an address with a name, an @ and a place, spaces around it aside', () => {
    expect(rosterEmailCheck('office@harlanmechanical.example')).toBeNull()
    expect(rosterEmailCheck('  office@harlanmechanical.example ')).toBeNull()
  })

  it('says why anything else stays in the field', () => {
    for (const typed of ['harlan', 'harlan@', '@harlan.example', 'harlan@mechanical', 'har lan@mechanical.example', 'a@b.example, c@d.example'])
      expect(rosterEmailCheck(typed), typed).toBe('That does not look like an email. It needs a name, an @ and a place, like name@example.com.')
  })
})

describe('rosterEmailText', () => {
  it('is the roster’s own address, or that there is none', () => {
    expect(rosterEmailText('office@harlanmechanical.example')).toBe('office@harlanmechanical.example')
    expect(rosterEmailText(null)).toBe('no email on the roster')
  })
})

describe('rosterEmailOffer: the sign-in address of a sub with none on the roster', () => {
  it('offers it with the press that puts it on the row', () => {
    expect(rosterEmailOffer({ rosterEmail: null, loginEmail: ' harlan@signin.example ' })).toEqual({ email: 'harlan@signin.example', words: 'They sign in as harlan@signin.example.', label: 'Put harlan@signin.example on their roster row' })
  })

  it('offers nothing over an address the roster has', () => {
    expect(rosterEmailOffer({ rosterEmail: 'office@harlanmechanical.example', loginEmail: 'harlan@signin.example' })).toBeNull()
  })

  it('offers nothing when the login has no address, or one the function would refuse', () => {
    expect(rosterEmailOffer({ rosterEmail: null, loginEmail: null })).toBeNull()
    expect(rosterEmailOffer({ rosterEmail: null, loginEmail: undefined })).toBeNull()
    expect(rosterEmailOffer({ rosterEmail: null, loginEmail: '   ' })).toBeNull()
    expect(rosterEmailOffer({ rosterEmail: null, loginEmail: 'not-an-address' })).toBeNull()
  })
})

describe('subPaperEmailDoor', () => {
  it('points a viewer who can add the address at the To line, and anyone else at a dev', () => {
    expect(subPaperEmailDoor(true).words).toBe('Press the To line above and type their email. You can also print or download the paper.')
    expect(subPaperEmailDoor(false).words).toBe('Print or download the paper for now. A dev can add an email to their roster row.')
    expect(subPaperEmailDoor().words).toBe(subPaperEmailDoor(false).words)
  })
})
