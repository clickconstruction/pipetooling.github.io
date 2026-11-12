import { describe, expect, it } from 'vitest'
import { builderKeyOf } from '../../../supabase/functions/_shared/permitLookup'
import { NO_OUR_KEYS, NO_OUR_NAMES, OUR_NAMES_MAX, OUR_NAME_MAX_LENGTH, addOurName, companyNameLine, isOurName, ourNameKeys, ourNamesValueLine, parseOurNames, removeOurName, storeOurNames, type OurNames } from './ourNames'

// Every name here is made up.
const ours = (over: Partial<OurNames> = {}): OurNames => ({ names: [], companyName: null, ...over })

describe('the names that are us on a plumbing permit', () => {
  it('reads the stored list, and anything else as an empty one', () => {
    expect(parseOurNames('{"names":["Blue Heron Plumbing LLC","  Marco   Vale "]}')).toEqual(['Blue Heron Plumbing LLC', 'Marco Vale'])
    expect(parseOurNames(null)).toEqual([])
    expect(parseOurNames('')).toEqual([])
    expect(parseOurNames('not json')).toEqual([])
    expect(parseOurNames('["Blue Heron Plumbing"]')).toEqual([])
    expect(parseOurNames('{"names":"Blue Heron Plumbing"}')).toEqual([])
    // A name with nothing to match on, a non-string and a second spelling of one name are dropped.
    expect(parseOurNames('{"names":["Blue Heron Plumbing","BLUE HERON PLUMBING, LLC","…",7,""]}')).toEqual(['Blue Heron Plumbing'])
  })

  it('stores what it reads back', () => {
    const names = ['Blue Heron Plumbing LLC', 'Marco Vale']
    expect(parseOurNames(storeOurNames(names))).toEqual(names)
    expect(storeOurNames([])).toBe('{"names":[]}')
  })

  it('keys a name the way the feed keys the name on a permit', () => {
    const keys = ourNameKeys(ours({ names: ['Blue Heron Plumbing LLC', 'Marco Vale'] }))
    expect([...keys].sort()).toEqual(['blueheronplumbing', 'marcovale'])
    // The company on the line, whoever the person is; capitals, punctuation and the suffix make no difference.
    expect(isOurName('BLUE HERON PLUMBING', keys)).toBe(true)
    expect(isOurName('Blue Heron Plumbing, LLC', keys)).toBe(true)
    expect(isOurName('Blue Heron Plumbing Inc.', keys)).toBe(true)
    expect(isOurName('Marco Vale, Blue Heron Plumbing LLC', keys)).toBe(true)
    expect(isOurName('MARCO VALE', keys)).toBe(true)
    // A name typed exactly as a city writes it meets itself, however the line splits.
    for (const line of ['VALE, MARCO', 'Marco Vale, Blue Heron Plumbing LLC', 'Blue Heron Plumbing & Drain']) {
      expect(isOurName(line, ourNameKeys(ours({ names: [line] })))).toBe(true)
    }
  })

  it('takes nothing fuzzier than the key for ours', () => {
    const keys = ourNameKeys(ours({ names: ['Blue Heron Plumbing LLC', 'Marco Vale'] }))
    expect(isOurName('Blue Heron Plumbing & Drain', keys)).toBe(false)
    expect(isOurName('Blue Heron', keys)).toBe(false)
    expect(isOurName('Lone Oak Plumbing', keys)).toBe(false)
    // Our plumber listed with another company is that company's line, by the feed's own key.
    expect(builderKeyOf('Marco Vale, Lone Oak Plumbing')).toBe('loneoakplumbing')
    expect(isOurName('Marco Vale, Lone Oak Plumbing', keys)).toBe(false)
    expect(isOurName(null, keys)).toBe(false)
    expect(isOurName('', keys)).toBe(false)
    // The feed's key keeps a dotted L.L.C. at the end of a name, so that spelling is a name of its own to add.
    expect(isOurName('Blue Heron Plumbing, L.L.C.', keys)).toBe(false)
    expect(addOurName(ours({ names: ['Blue Heron Plumbing LLC'] }), 'Blue Heron Plumbing, L.L.C.')).toEqual({ ok: true, names: ['Blue Heron Plumbing LLC', 'Blue Heron Plumbing, L.L.C.'] })
  })

  it('has no name that is us until one is added or a company name is set', () => {
    expect(ourNameKeys(NO_OUR_NAMES).size).toBe(0)
    expect(isOurName('Blue Heron Plumbing', NO_OUR_KEYS)).toBe(false)
    expect(isOurName('Blue Heron Plumbing', ourNameKeys(NO_OUR_NAMES))).toBe(false)
  })

  it('counts the company name on paper bills without it being added', () => {
    const keys = ourNameKeys(ours({ companyName: 'Blue Heron Plumbing, LLC' }))
    expect(isOurName('BLUE HERON PLUMBING', keys)).toBe(true)
    expect(isOurName('Marco Vale', keys)).toBe(false)
    expect(ourNameKeys(ours({ companyName: '   ' })).size).toBe(0)
  })

  it('adds a name, tidied, at the end of the list', () => {
    expect(addOurName(ours({ names: ['Blue Heron Plumbing LLC'] }), '  Marco   Vale ')).toEqual({ ok: true, names: ['Blue Heron Plumbing LLC', 'Marco Vale'] })
  })

  it('says why a name is not added', () => {
    const list = ours({ names: ['Blue Heron Plumbing LLC'], companyName: 'Heron Mechanical Inc' })
    expect(addOurName(list, '   ')).toEqual({ ok: false, reason: 'Type the name as the city lists it.' })
    expect(addOurName(list, '…')).toEqual({ ok: false, reason: 'That name has no letters or digits to match on.' })
    expect(addOurName(list, 'BLUE HERON PLUMBING')).toEqual({ ok: false, reason: 'Blue Heron Plumbing LLC is on the list, and it reads the same as that name.' })
    expect(addOurName(list, 'heron mechanical')).toEqual({ ok: false, reason: 'Heron Mechanical Inc is the company name on paper bills, so it counts already.' })
    expect(addOurName(list, 'x'.repeat(OUR_NAME_MAX_LENGTH + 1))).toEqual({ ok: false, reason: `A name is at most ${OUR_NAME_MAX_LENGTH} characters.` })
    const full = ours({ names: Array.from({ length: OUR_NAMES_MAX }, (_, i) => `Made Up Plumber ${i + 1}`) })
    expect(addOurName(full, 'One More Plumbing')).toEqual({ ok: false, reason: `The list holds ${OUR_NAMES_MAX} names. Take one back first.` })
  })

  it('takes a name back, by its key', () => {
    expect(removeOurName(['Blue Heron Plumbing LLC', 'Marco Vale'], 'Marco Vale')).toEqual(['Blue Heron Plumbing LLC'])
    expect(removeOurName(['Blue Heron Plumbing LLC', 'Marco Vale'], 'BLUE HERON PLUMBING')).toEqual(['Marco Vale'])
    expect(removeOurName(['Marco Vale'], 'Someone Else')).toEqual(['Marco Vale'])
  })

  it('says in the card what counts already and what the list holds', () => {
    expect(companyNameLine('Blue Heron Plumbing LLC')).toBe('Blue Heron Plumbing LLC counts already. It is the company name on paper bills.')
    expect(companyNameLine(null)).toBe('No company name is set for paper bills, so only the names added here count.')
    expect(companyNameLine('  ')).toBe('No company name is set for paper bills, so only the names added here count.')
    expect(ourNamesValueLine(ours())).toBe('none yet')
    expect(ourNamesValueLine(ours({ companyName: 'Blue Heron Plumbing LLC' }))).toBe('the company name on paper bills alone')
    expect(ourNamesValueLine(ours({ names: ['Marco Vale'] }))).toBe('1 name')
    expect(ourNamesValueLine(ours({ names: ['Marco Vale', 'M Vale Plumbing'], companyName: 'Blue Heron Plumbing LLC' }))).toBe('2 names and the company name on paper bills')
  })
})
