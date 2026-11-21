import { describe, expect, it } from 'vitest'
import { plainSentence } from '../valuesInPlace'
import {
  checkedWords,
  foldLookups,
  kindUnknownWords,
  lookedUpDayWords,
  lookedUpKind,
  lookupFacts,
  lookupFootWords,
  lookupHasGap,
  lookupNotFoundWords,
  lookupOrder,
  lookupPill,
  lookupPressName,
  lookupPressedWords,
  lookupTag,
  lookupValueWords,
  sourceWords,
  telHref,
  wrongWords,
  type BuilderLookup,
  type LookupCheckRow,
  type LookupRow,
} from './builderLookups'

/** Every company, person, phone and web address here is made up. */
const TODAY = '2026-11-23'

let n = 0
function fact(over: Partial<LookupRow> = {}): LookupRow {
  n += 1
  return { id: `f${n}`, builder_key: 'ridgewaybuilders', fact: 'phone', value: '(210) 555-0142', detail: '', source_url: 'https://ridgewaybuilders.example/contact', looked_up_on: '2026-11-20', looked_up_by: 'dev', looked_up_how: 'agent', city: 'San Antonio', created_at: '2026-11-20T18:00:00Z', ...over }
}
function press(lookupId: string, verdict: LookupCheckRow['verdict'], over: Partial<LookupCheckRow> = {}): LookupCheckRow {
  n += 1
  return { id: `c${n}`, lookup_id: lookupId, verdict, said_by: 'u1', said_at: '2026-11-23T15:00:00Z', ...over }
}
const nameOf = (id: string) => (id === 'u2' ? 'Sam' : null)
const one = (rows: LookupRow[], checks: LookupCheckRow[] = []): BuilderLookup => foldLookups(rows, checks).get('ridgewaybuilders') as BuilderLookup

describe('foldLookups', () => {
  it('folds a name’s rows to its three facts, each not checked', () => {
    const kind = fact({ fact: 'kind', value: 'builder', source_url: 'https://ridgewaybuilders.example/about' })
    const phone = fact()
    const person = fact({ fact: 'person', value: 'Dana Whitlock', detail: 'Director of Preconstruction', source_url: 'https://ridgewaybuilders.example/team' })
    const other = fact({ builder_key: 'tallpine', fact: 'phone', value: '(210) 555-0177' })
    const all = foldLookups([kind, phone, person, other], [])
    expect([...all.keys()]).toEqual(['ridgewaybuilders', 'tallpine'])
    const lookup = all.get('ridgewaybuilders') as BuilderLookup
    expect(lookupFacts(lookup).map((s) => [s.row.fact, s.state])).toEqual([
      ['kind', 'unchecked'],
      ['phone', 'unchecked'],
      ['person', 'unchecked'],
    ])
    expect(all.get('tallpine')?.person).toBeNull()
  })

  it('takes the newest press on a fact as its state, and a press put back leaves it not checked', () => {
    const phone = fact()
    const checked = press(phone.id, 'checked')
    expect(one([phone], [checked]).phone).toMatchObject({ state: 'checked', said: checked })
    const wrong = press(phone.id, 'wrong', { said_at: '2026-11-23T16:00:00Z' })
    expect(one([phone], [wrong, checked]).phone?.state).toBe('wrong')
    const back = press(phone.id, 'back', { said_at: '2026-11-23T17:00:00Z' })
    expect(one([phone], [checked, wrong, back]).phone).toMatchObject({ state: 'unchecked', said: null })
  })

  it('lets a later lookup of the same fact replace the earlier one, and start as not checked', () => {
    const old = fact()
    const newer = fact({ value: '(210) 555-0199', created_at: '2026-12-01T18:00:00Z' })
    const lookup = one([newer, old], [press(old.id, 'checked')])
    expect(lookup.phone?.row.value).toBe('(210) 555-0199')
    expect(lookup.phone?.state).toBe('unchecked')
  })

  it('passes by a row whose fact it does not know', () => {
    expect(foldLookups([fact({ fact: 'email' as never })], []).has('ridgewaybuilders')).toBe(false)
  })
})

describe('the kind', () => {
  const kind = (value: string) => fact({ fact: 'kind', value, source_url: value === 'unknown' ? '' : 'https://ridgewaybuilders.example/about' })

  it('reads the kind a lookup settled on, and whether a person checked it', () => {
    const k = kind('design_firm')
    expect(lookedUpKind(one([k]))).toEqual({ kind: 'design_firm', checked: false })
    expect(lookedUpKind(one([k], [press(k.id, 'checked')]))).toEqual({ kind: 'design_firm', checked: true })
  })

  it('reads no kind when none was found, when it could not be told, and when it was marked wrong', () => {
    expect(lookedUpKind(null)).toBeNull()
    expect(lookedUpKind(one([fact()]))).toBeNull()
    expect(lookedUpKind(one([kind('unknown')]))).toBeNull()
    const k = kind('trade')
    expect(lookedUpKind(one([k], [press(k.id, 'wrong')]))).toBeNull()
    expect(lookedUpKind(one([kind('plumber')]))).toBeNull()
  })

  it('tags a name as an outline until the kind is checked, then as a fill', () => {
    const k = kind('design_firm')
    expect(lookupTag(one([k]))).toEqual({ words: 'Looked up: a design firm', tone: 'grey', outline: true })
    expect(lookupTag(one([k], [press(k.id, 'checked')]))).toEqual({ words: 'A design firm, checked', tone: 'grey', outline: false })
    expect(lookupTag(one([kind('owner')]))?.words).toBe('Looked up: an owner')
    expect(lookupTag(one([kind('unknown')]))).toBeNull()
  })

  it('moves a name in the order only once a person checked the kind', () => {
    const order = (value: string, checked: boolean, office = false) => {
      const k = kind(value)
      return lookupOrder(one([k], checked ? [press(k.id, 'checked')] : []), office)
    }
    for (const value of ['builder', 'owner', 'design_firm', 'permit_service', 'trade']) expect(order(value, false)).toBeNull()
    expect(order('builder', true)).toBe('leads')
    expect(order('owner', true)).toBeNull()
    expect(order('design_firm', true)).toBe('waits')
    expect(order('permit_service', true)).toBe('waits')
    expect(order('trade', true)).toBe('waits')
  })

  it('moves nothing where the office has said a kind: its word orders', () => {
    const k = kind('builder')
    expect(lookupOrder(one([k], [press(k.id, 'checked')]), true)).toBeNull()
  })
})

describe('the words', () => {
  it('prints a fact’s value: the kind’s words, the phone, the name', () => {
    expect(lookupValueWords({ fact: 'kind', value: 'permit_service' })).toBe('A permit service')
    expect(lookupValueWords({ fact: 'phone', value: ' (210) 555-0142 ' })).toBe('(210) 555-0142')
    expect(lookupValueWords({ fact: 'person', value: 'Dana Whitlock' })).toBe('Dana Whitlock')
  })

  it('names the page a fact came from, short enough for a row', () => {
    expect(sourceWords('https://www.ridgewaybuilders.example/about/')).toBe('ridgewaybuilders.example/about')
    expect(sourceWords('https://ridgewaybuilders.example')).toBe('ridgewaybuilders.example')
    expect(sourceWords('https://www.google.com/maps/place/Ridgeway+Builders/@29.4,-98.5')).toBe('its Google Maps listing')
    expect(sourceWords('https://maps.app.goo.gl/abc123')).toBe('its Google Maps listing')
    expect(sourceWords('https://maps.google.com/?cid=1234567890')).toBe('its Google Maps listing')
    expect(sourceWords('https://www.google.com/search?q=ridgeway')).toBe('google.com/search')
    expect(sourceWords('https://ridgewaybuilders.example/a/very/long/path/to/the/people/page')).toBe('ridgewaybuilders.example/a/very/long/path/t…')
    expect(sourceWords('not a web address')).toBe('not a web address')
  })

  it('makes a phone a link to call, and never from a number it cannot read', () => {
    expect(telHref('(210) 555-0142')).toBe('tel:+12105550142')
    expect(telHref('1-210-555-0142')).toBe('tel:+12105550142')
    expect(telHref('210.555.0142 ext. 12')).toBe('tel:+12105550142')
    expect(telHref('555-0142')).toBeNull()
    expect(telHref('call the office')).toBeNull()
  })

  it('says who checked a fact and when, with each value marked', () => {
    const said = press('f', 'checked')
    expect(plainSentence(checkedWords(said, 'u1', nameOf, TODAY))).toBe('Checked by you, Nov 23')
    expect(plainSentence(checkedWords({ ...said, said_by: 'u2' }, 'u1', nameOf, TODAY))).toBe('Checked by Sam, Nov 23')
    expect(plainSentence(checkedWords({ ...said, said_by: null }, 'u1', nameOf, TODAY))).toBe('Checked by someone, Nov 23')
    expect(checkedWords(said, 'u1', nameOf, TODAY)).toBe('Checked by ⟪who|you⟫, ⟪day|Nov 23⟫')
    expect(plainSentence(wrongWords({ ...said, said_by: 'u9' }, 'u1', nameOf, TODAY))).toBe('Marked wrong by someone, Nov 23.')
  })

  it('reads a press made in the evening as that day’s, on the app’s calendar', () => {
    expect(plainSentence(checkedWords(press('f', 'checked', { said_at: '2026-11-24T02:30:00Z' }), 'u1', nameOf, TODAY))).toBe('Checked by you, Nov 23')
  })

  it('says the day a fact was read, and that a kind could not be told', () => {
    expect(plainSentence(lookedUpDayWords({ looked_up_on: '2026-11-20' }, TODAY))).toBe('Nov 20')
    expect(plainSentence(kindUnknownWords({ looked_up_on: '2026-11-20' }, TODAY))).toBe('Could not tell from a public page. Looked Nov 20.')
  })

  it('says how much of what is shown a person has checked', () => {
    const kind = fact({ fact: 'kind', value: 'builder' })
    const phone = fact()
    const person = fact({ fact: 'person', value: 'Dana Whitlock' })
    expect(lookupPill(one([kind, phone, person]))).toEqual({ words: 'Looked up, not checked', checked: false })
    expect(lookupPill(one([kind, phone, person], [press(kind.id, 'checked'), press(phone.id, 'checked')]))).toEqual({ words: '2 of 3 checked', checked: true })
    expect(lookupPill(one([kind, phone, person], [press(kind.id, 'checked'), press(phone.id, 'checked'), press(person.id, 'checked')]))).toEqual({ words: 'Checked', checked: true })
    // A fact marked wrong and a kind that could not be told are not counted: nothing of theirs is shown.
    expect(lookupPill(one([fact({ fact: 'kind', value: 'unknown', source_url: '' }), phone, person], [press(phone.id, 'checked'), press(person.id, 'wrong')]))).toEqual({ words: 'Checked', checked: true })
  })

  it('says who looked and when, and that an agent contacted nobody', () => {
    expect(plainSentence(lookupFootWords(one([fact(), fact({ fact: 'person', value: 'Dana Whitlock', looked_up_on: '2026-11-21' })]), TODAY))).toBe('Looked up by an agent on Nov 21. Nobody was called or written to.')
    expect(plainSentence(lookupFootWords(one([fact({ looked_up_how: 'person' })]), TODAY))).toBe('Looked up on Nov 20.')
  })

  it('says what the lookup did not find, and offers a search while a fact is missing', () => {
    const kind = fact({ fact: 'kind', value: 'builder' })
    const phone = fact()
    const person = fact({ fact: 'person', value: 'Dana Whitlock' })
    expect(lookupNotFoundWords(one([kind, phone, person]))).toBeNull()
    expect(lookupNotFoundWords(one([kind, phone]))).toBe('No person to ask for was found on a public business page.')
    expect(lookupNotFoundWords(one([kind]))).toBe('No office phone or person to ask for was found on a public business page.')
    expect(lookupHasGap(one([kind, phone, person]))).toBe(false)
    expect(lookupHasGap(one([kind, phone]))).toBe(true)
    expect(lookupHasGap(one([kind, phone, person], [press(phone.id, 'wrong')]))).toBe(true)
    expect(lookupHasGap(one([fact({ fact: 'kind', value: 'unknown', source_url: '' }), phone, person]))).toBe(true)
  })

  it('names each press, and says what a press did', () => {
    expect(lookupPressName('Checked', 'phone', 'Ridgeway Builders')).toBe('Checked: the office phone of Ridgeway Builders')
    expect(lookupPressName('Put back', 'person', 'Ridgeway Builders')).toBe('Put back: the person to ask for of Ridgeway Builders')
    expect(lookupPressedWords('checked', 'kind', 'Ridgeway Builders')).toBe('Checked the kind of company of Ridgeway Builders.')
    expect(lookupPressedWords('wrong', 'phone', 'Ridgeway Builders')).toBe('Marked the office phone of Ridgeway Builders wrong. It is off the row for everyone.')
    expect(lookupPressedWords('back', 'phone', 'Ridgeway Builders')).toBe('Put back the office phone of Ridgeway Builders. It reads as not checked.')
  })
})
