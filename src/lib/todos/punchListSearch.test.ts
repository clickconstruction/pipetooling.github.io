import { describe, expect, it } from 'vitest'
import { cardMatchesSearch, cardSearchWords, foldSearchWords, parseSearch, searchCards, searchFromAddress, searchTerms, withSearch } from './punchListSearch'
import { searchFor } from './punchListByNumber'
import type { BoardItem } from './todoBoard'

const row = (over: Partial<BoardItem>): BoardItem => ({
  slug: 'a',
  number: 1,
  flagged: false,
  group: 'ready',
  name: 'A row',
  file: 'to-dos/a.md',
  pointer: false,
  summary: 's',
  next: 'n',
  size: 'S',
  blocker: 'none',
  ver: '',
  opinion: '',
  mockups: [],
  artifacts: [],
  mockup: 'waiting',
  mockupNote: '',
  ...over,
})

const receipt = row({ slug: 'receipt', number: 299, name: 'A receipt by text', summary: 'Ridgeway Builders won’t open a PDF on a phone.', next: 'Send the first one.', ver: 'v2.7120 · 7133' })
const ledger = row({ slug: 'ledger', number: 347, group: 'gated', name: 'Subs Ledger', summary: 'Match a payment to the bank line it left on.', next: 'The owner picks the column.', ver: 'v2.7239' })
const bill = row({ slug: 'bill', number: 343, group: 'close', name: 'Bill a customer: who gets it', summary: 'Café owners get the bill.', next: 'Delete the folder.' })
const cards = [receipt, ledger, bill]

describe('foldSearchWords', () => {
  it('lowercases, drops accents, plains the quotes and dashes, and squeezes the blanks', () => {
    expect(foldSearchWords('  Café  Won’t “Ledger” — now ')).toBe('cafe won\'t "ledger" - now')
    expect(foldSearchWords(null)).toBe('')
    expect(foldSearchWords('')).toBe('')
  })
})

describe('searchTerms', () => {
  it('splits a search into folded words and gives none for a blank', () => {
    expect(searchTerms(' Bank  Line ')).toEqual(['bank', 'line'])
    expect(searchTerms('   ')).toEqual([])
  })
})

describe('cardSearchWords and cardMatchesSearch', () => {
  it('reads the number, the name, the summary, the Next line, the versions and the group', () => {
    const words = cardSearchWords(ledger)
    expect(words).toContain('#347')
    expect(words).toContain('subs ledger')
    expect(words).toContain('bank line')
    expect(words).toContain('the owner picks')
    expect(words).toContain('v2.7239')
    expect(words).toContain('needs an owner decision')
  })

  it('finds a card by its number with or without the hash', () => {
    expect(cardMatchesSearch(ledger, '#347')).toBe(true)
    expect(cardMatchesSearch(ledger, '347')).toBe(true)
    expect(cardMatchesSearch(ledger, '#34')).toBe(true)
    expect(cardMatchesSearch(ledger, '#348')).toBe(false)
  })

  it('finds a card by a shipped version and by its group name', () => {
    expect(cardMatchesSearch(receipt, 'v2.7133')).toBe(false)
    expect(cardMatchesSearch(receipt, 'v2.7120')).toBe(true)
    expect(cardMatchesSearch(receipt, '7133')).toBe(true)
    expect(cardMatchesSearch(ledger, 'owner decision')).toBe(true)
    expect(cardMatchesSearch(bill, 'close out')).toBe(true)
    expect(cardMatchesSearch(bill, 'ready')).toBe(false)
  })

  it('ignores case, accents and curly quotes on both sides', () => {
    expect(cardMatchesSearch(receipt, 'RIDGEWAY')).toBe(true)
    expect(cardMatchesSearch(receipt, "won't")).toBe(true)
    expect(cardMatchesSearch(bill, 'cafe')).toBe(true)
    expect(cardMatchesSearch(bill, 'Café')).toBe(true)
  })

  it('needs every word, in any field and any order', () => {
    expect(cardMatchesSearch(ledger, 'ledger bank')).toBe(true)
    expect(cardMatchesSearch(ledger, 'ledger phone')).toBe(false)
    expect(cardMatchesSearch(receipt, '')).toBe(true)
    expect(cardMatchesSearch(receipt, '   ')).toBe(true)
  })

  it('leaves a card with no number findable by its words only', () => {
    const none = row({ number: 0, name: 'Hand-built' })
    expect(cardSearchWords(none).startsWith('hand-built')).toBe(true)
    expect(cardMatchesSearch(none, '#0')).toBe(false)
  })
})

describe('searchCards', () => {
  it('keeps the matching cards in their order, and hands the same array back for a blank search', () => {
    expect(searchCards(cards, '')).toBe(cards)
    expect(searchCards(cards, 'the').map((c) => c.number)).toEqual([299, 347, 343])
    expect(searchCards(cards, 'bill').map((c) => c.number)).toEqual([343])
    expect(searchCards(cards, 'nothing here')).toEqual([])
  })
})

describe('the address', () => {
  it('reads q trimmed, and nothing when the address has none', () => {
    expect(parseSearch('  bank ')).toBe('bank')
    expect(parseSearch(null)).toBe('')
    expect(searchFromAddress('?view=number&q=bank+line')).toBe('bank line')
    expect(searchFromAddress('?view=number')).toBe('')
    expect(searchFromAddress('')).toBe('')
  })

  it('writes q beside the view and the order, and drops it when the field is cleared', () => {
    expect(withSearch('?view=number&order=oldest', 'bank')).toBe('?view=number&order=oldest&q=bank')
    expect(withSearch('?view=number&q=old', 'new words')).toBe('?view=number&q=new+words')
    expect(withSearch('?view=number&q=old', '')).toBe('?view=number')
    expect(withSearch('?q=old', '  ')).toBe('')
    expect(withSearch('', 'x')).toBe('?q=x')
  })

  it('survives a view press: searchFor keeps q as it keeps every other parameter', () => {
    expect(searchFor('?q=bank', 'number', 'oldest')).toBe('?q=bank&view=number&order=oldest')
    expect(searchFor('?view=number&q=bank', 'group', 'newest')).toBe('?q=bank')
  })
})
