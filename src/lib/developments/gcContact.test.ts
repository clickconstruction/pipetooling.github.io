import { describe, expect, it } from 'vitest'
import { gcContactDoneWords, gcContactDraftProblem, gcContactTargets, gcContactValues } from './gcContact'

const bid = (id: string, name: string | null, phone: string | null = null) => ({ id, gc_contact_name: name, gc_contact_phone: phone, gc_contact_email: null })

describe('gcContactTargets', () => {
  it('with no contact yet, every bid with a blank name is a target; a bid naming someone else is left alone', () => {
    const out = gcContactTargets([bid('a', null), bid('b', ''), bid('c', 'J'), bid('d', 'Pat Lee', '555')], null)
    expect(out.map((b) => b.id)).toEqual(['a', 'b', 'c'])
  })

  it('changing a contact also takes the bids that carry the current name, whatever its case', () => {
    const out = gcContactTargets([bid('a', 'Pat Lee'), bid('b', 'pat lee'), bid('c', 'Sam Roe'), bid('d', null)], { name: 'Pat Lee' })
    expect(out.map((b) => b.id)).toEqual(['a', 'b', 'd'])
    expect(out[0]).toEqual({ id: 'a', gc_contact_name: 'Pat Lee', gc_contact_phone: null, gc_contact_email: null })
  })
})

describe('the draft', () => {
  it('needs a name of two letters and an email that reads as one', () => {
    expect(gcContactDraftProblem({ name: 'J', email: '' })).toBe('The name needs two letters or more.')
    expect(gcContactDraftProblem({ name: 'Jo', email: 'nope' })).toBe('The email does not read as one.')
    expect(gcContactDraftProblem({ name: 'Jo', email: 'jo@example.com' })).toBeNull()
    expect(gcContactDraftProblem({ name: 'Jo', email: '' })).toBeNull()
  })

  it('trims and blanks to null', () => {
    expect(gcContactValues({ name: ' Jo Roe ', phone: ' ', email: ' jo@example.com ' })).toEqual({ name: 'Jo Roe', phone: null, email: 'jo@example.com' })
  })

  it('says what it did', () => {
    expect(gcContactDoneWords('Jo Roe', 1)).toBe('Jo Roe is the GC contact on 1 bid.')
    expect(gcContactDoneWords('Jo Roe', 15)).toBe('Jo Roe is the GC contact on 15 bids.')
  })
})
