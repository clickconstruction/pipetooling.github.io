/**
 * A sub's company on People (punch list #403, step 6): who sits under which company, what the find box finds, what
 * keeping the box does, and the words. Every name here is made up.
 */
import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import {
  SUB_COMPANY_TRADE,
  companyByPersonName,
  companyKeepPlan,
  companyKeepPreview,
  companyKeepRefusal,
  companyNameHolds,
  companyNamed,
  companyNameTyped,
  companySuggestions,
  companyWorkersLine,
  rosterByCompany,
  titleKeepRefusal,
} from './subCompanies'

const MECH = { id: 'c-mech', name: 'ZZ Sample Mechanical LLC' }
const PIPE = { id: 'c-pipe', name: 'Sample Pipe Co' }

describe('entering a company', () => {
  it('trims a typed name and makes its inner spaces single', () => {
    expect(companyNameTyped('  Sample   Pipe  Co ')).toBe('Sample Pipe Co')
    expect(companyNameTyped('   ')).toBe('')
  })

  it('finds the company we have whatever its case and spaces', () => {
    expect(companyNamed([MECH, PIPE], ' sample  PIPE co')).toEqual(PIPE)
    expect(companyNamed([MECH, PIPE], 'Sample Pipe')).toBeNull()
    expect(companyNamed([MECH, PIPE], '')).toBeNull()
  })

  it('refuses an empty name and one over 200 letters, in the draft’s words', () => {
    expect(companyKeepRefusal('')).toBe('Type the company’s name.')
    expect(companyKeepRefusal('x'.repeat(201))).toBe('A company’s name is 200 letters at most.')
    expect(companyKeepRefusal('x'.repeat(200))).toBeNull()
    expect(titleKeepRefusal('y'.repeat(201))).toBe('What they are there is 200 letters at most.')
    expect(titleKeepRefusal('Owner')).toBeNull()
  })

  it('plans the box: an empty box takes them off, a name we have links, a new name is made with its trade', () => {
    expect(companyKeepPlan('  ', [MECH])).toEqual({ kind: 'off' })
    expect(companyKeepPlan('zz sample mechanical llc', [MECH, PIPE])).toEqual({ kind: 'link', company: MECH })
    expect(companyKeepPlan(' Pat  Sample ', [MECH])).toEqual({ kind: 'make', name: 'Pat Sample', trades: [SUB_COMPANY_TRADE] })
    expect(companyKeepPlan('x'.repeat(201), [MECH])).toEqual({ kind: 'refused', why: 'A company’s name is 200 letters at most.' })
    // gc_companies asks for one trade at least, so a company made here always carries one.
    expect(SUB_COMPANY_TRADE).toBe('Plumbing')
  })

  it('says under the box what Keep will do', () => {
    expect(companyKeepPreview('Sample Pipe Co', [PIPE], '')).toBe('A trade company we have.')
    expect(companyKeepPreview('Pat Sample', [PIPE], '')).toBe('A new trade company. Its trade is Plumbing.')
    expect(companyKeepPreview('', [PIPE], 'Sample Pipe Co')).toBe('Keep takes them off the company.')
    expect(companyKeepPreview('', [PIPE], '')).toBeNull()
  })

  it('offers each company name once, sorted', () => {
    expect(companySuggestions([PIPE, MECH, { id: 'c-dup', name: 'sample pipe co ' }, { id: 'c-empty', name: ' ' }])).toEqual(['Sample Pipe Co', 'ZZ Sample Mechanical LLC'])
  })
})

describe('who sits under which company', () => {
  const people = [
    { id: 'p-pat', name: 'Pat Sample' },
    { id: 'p-lee', name: 'Lee Sample' },
    { id: 'p-kim', name: 'Kim Sample' },
    { id: 'p-twin-1', name: 'Sam Twin' },
    { id: 'p-twin-2', name: 'Sam Twin' },
  ]
  const links = [
    { person_id: 'p-pat', company_id: MECH.id, title: ' Owner ' },
    { person_id: 'p-lee', company_id: MECH.id, title: null },
    { person_id: 'p-twin-1', company_id: PIPE.id, title: null },
    { person_id: 'p-gone', company_id: PIPE.id, title: null },
  ]
  const byName = companyByPersonName(people, links, [MECH, PIPE])

  it('names each linked person’s company and title, and leaves out a name two people share', () => {
    expect(byName.get('Pat Sample')).toEqual({ company: MECH, title: 'Owner', personId: 'p-pat' })
    expect(byName.get('Lee Sample')).toEqual({ company: MECH, title: '', personId: 'p-lee' })
    expect(byName.has('Kim Sample')).toBe(false)
    expect(byName.has('Sam Twin')).toBe(false)
  })

  it('draws a company in its first worker’s place, with its workers under it, and everyone else in their own place', () => {
    const pieces = rosterByCompany(['Amy Staff', 'Lee Sample', 'Kim Sample', 'Pat Sample'], byName)
    expect(pieces).toEqual([
      { kind: 'person', name: 'Amy Staff' },
      {
        kind: 'company',
        group: {
          company: MECH,
          // Pat has a title, so Pat leads though Lee comes first by name.
          workers: [
            { personId: 'p-pat', name: 'Pat Sample', title: 'Owner' },
            { personId: 'p-lee', name: 'Lee Sample', title: '' },
          ],
        },
      },
      { kind: 'person', name: 'Kim Sample' },
    ])
  })

  it('leaves out a company none of whose workers is listed', () => {
    expect(rosterByCompany(['Kim Sample'], byName)).toEqual([{ kind: 'person', name: 'Kim Sample' }])
  })

  it('the company row names its workers, each name a value', () => {
    const line = companyWorkersLine([
      { name: 'Pat Sample', title: 'Owner' },
      { name: 'Lee Sample', title: '' },
    ])
    expect(plainSentence(line)).toBe('Workers Pat Sample, Owner · Lee Sample')
    expect(line).not.toBe(plainSentence(line))
  })
})

describe('the find box', () => {
  it('finds a worker by every word of their company’s name', () => {
    expect(companyNameHolds(MECH.name, 'sample mech')).toBe(true)
    expect(companyNameHolds(MECH.name, 'mechanical pipe')).toBe(false)
    expect(companyNameHolds(null, 'sample')).toBe(false)
    expect(companyNameHolds(MECH.name, '  ')).toBe(false)
  })
})
