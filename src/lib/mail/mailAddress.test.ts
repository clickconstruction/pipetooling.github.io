import { describe, expect, it } from 'vitest'
import { mailParty, mailPartyAddress, mailPartyName, mailPartyProblems } from './mailAddress'

describe('a mail piece’s party (the Docsmit train, PR 1)', () => {
  it('a company goes whole as the organization; a person splits on the last space', () => {
    expect(mailPartyName('ATI Schertz Holdings LLC')).toEqual({ firstName: '', lastName: '', organization: 'ATI Schertz Holdings LLC' })
    expect(mailPartyName('Loberg Contracting')).toEqual({ firstName: '', lastName: '', organization: 'Loberg Contracting' })
    expect(mailPartyName('John A. Backham')).toEqual({ firstName: 'John A.', lastName: 'Backham', organization: '' })
    expect(mailPartyName('RIZVI SYED ZULFIQAR & KIZILBASH QURATULAIN FATIMA').organization).toBe('RIZVI SYED ZULFIQAR & KIZILBASH QURATULAIN FATIMA')
    expect(mailPartyName('Madonna').organization).toBe('Madonna')
    expect(mailPartyName('  ')).toEqual({ firstName: '', lastName: '', organization: '' })
  })

  it('the one-line address becomes the provider’s lines, with a suite on line 2 and the label CSV’s no-comma rule', () => {
    expect(mailPartyAddress('17300 IH 35 N, Schertz, TX 78154')).toEqual({ address1: '17300 IH 35 N', address2: '', city: 'Schertz', state: 'TX', postalCode: '78154' })
    expect(mailPartyAddress('9993 IH 10 West Suite 102, San Antonio, TX 78230')).toEqual({ address1: '9993 IH 10 West', address2: 'Suite 102', city: 'San Antonio', state: 'TX', postalCode: '78230' })
    expect(mailPartyAddress('50 Journal Square, 8th Fl, Jersey City, NJ 07306-1234')).toEqual({ address1: '50 Journal Square', address2: '8th Fl', city: 'Jersey City', state: 'NJ', postalCode: '07306-1234' })
    expect(mailPartyAddress('311 E Illinois Ave. Palatine, Il 60067')).toEqual({ address1: '311 E Illinois Ave.', address2: '', city: 'Palatine', state: 'IL', postalCode: '60067' })
    expect(mailPartyAddress('')).toEqual({ address1: '', address2: '', city: '', state: '', postalCode: '' })
  })

  it('names what stops a party from mailing, in the provider’s terms', () => {
    expect(mailPartyProblems(mailParty('ATI Schertz Holdings LLC', '17300 IH 35 N, Schertz, TX 78154'))).toEqual([])
    expect(mailPartyProblems(mailParty('', ''))).toEqual(['a name: a company, or a first and last name', 'a street line', 'a city', 'a two-letter state', 'a ZIP or ZIP+4'])
    expect(mailPartyProblems(mailParty('Jane Doe', '1 Main St, Austin, Texas 787'))).toEqual(['a two-letter state', 'a ZIP or ZIP+4'])
  })
})
