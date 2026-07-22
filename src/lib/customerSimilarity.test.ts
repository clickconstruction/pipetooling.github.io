import { describe, expect, it } from 'vitest'
import {
  findSimilarCustomerGroups,
  normalizeCustomerAddress,
  normalizeCustomerEmail,
  normalizeCustomerName,
  normalizeCustomerPhone,
} from './customerSimilarity'

describe('normalizers', () => {
  it('name: case, punctuation, whitespace', () => {
    expect(normalizeCustomerName('  John   Ingram ')).toBe('john ingram')
    expect(normalizeCustomerName('Mike. Holub')).toBe('mike holub')
    expect(normalizeCustomerName(null)).toBe('')
  })
  it('address: punctuation-insensitive, short strings rejected', () => {
    expect(normalizeCustomerAddress('1603 Sycamore Street Bandera, TX 78003')).toBe(
      normalizeCustomerAddress('1603 Sycamore Street, Bandera TX 78003'),
    )
    expect(normalizeCustomerAddress('TX')).toBe('')
  })
  it('phone: digits only, US country code stripped, short rejected', () => {
    expect(normalizeCustomerPhone('(210) 889-1297')).toBe('2108891297')
    expect(normalizeCustomerPhone('+1 210 889 1297')).toBe('2108891297')
    expect(normalizeCustomerPhone('911')).toBe('')
  })
  it('email: lowercased, must contain @', () => {
    expect(normalizeCustomerEmail(' Jingram2@SATX.rr.com ')).toBe('jingram2@satx.rr.com')
    expect(normalizeCustomerEmail('not-an-email')).toBe('')
  })
})

describe('findSimilarCustomerGroups', () => {
  it('groups exact duplicate name+address and reports both signals', () => {
    const groups = findSimilarCustomerGroups([
      { id: 'a', name: 'John Ingram', address: '1603 Sycamore Street Bandera, TX 78003' },
      { id: 'b', name: 'John Ingram', address: '1603 Sycamore Street Bandera TX 78003' },
      { id: 'c', name: 'Someone Else', address: '99 Elsewhere Rd San Antonio TX' },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.ids.sort()).toEqual(['a', 'b'])
    expect(groups[0]!.matchedBy).toEqual(['name', 'address'])
  })

  it('different names still group on shared phone', () => {
    const groups = findSimilarCustomerGroups([
      { id: 'a', name: 'John Ingram', phone: '(210) 889-1297' },
      { id: 'b', name: 'Johnny Ingram', phone: '210-889-1297' },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.matchedBy).toEqual(['phone'])
  })

  it('is transitive across different signals', () => {
    const groups = findSimilarCustomerGroups([
      { id: 'a', name: 'A Corp', phone: '210 555 0001' },
      { id: 'b', name: 'B Corp', phone: '2105550001', address: '500 Main Street San Antonio TX' },
      { id: 'c', name: 'C Corp', address: '500 Main St.  San Antonio, TX'.replace('St.', 'Street') },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.ids.sort()).toEqual(['a', 'b', 'c'])
  })

  it('never groups on empty or too-generic values', () => {
    const groups = findSimilarCustomerGroups([
      { id: 'a', name: '', address: 'TX', phone: '', email: 'x' },
      { id: 'b', name: '', address: 'TX', phone: '', email: 'y' },
    ])
    expect(groups).toHaveLength(0)
  })

  it('sorts bigger groups first', () => {
    const groups = findSimilarCustomerGroups([
      { id: 'a', name: 'Trio' },
      { id: 'b', name: 'Trio' },
      { id: 'c', name: 'Trio' },
      { id: 'd', name: 'Pair' },
      { id: 'e', name: 'Pair' },
    ])
    expect(groups.map((g) => g.ids.length)).toEqual([3, 2])
  })
})
