import { describe, expect, it } from 'vitest'
import { deriveBidLastContact, isContactEntry, lastContactByGc } from './bidContacts'

const at = (iso: string) => iso

describe('isContactEntry', () => {
  it('method entries count; blank/whitespace/null do not', () => {
    expect(isContactEntry({ contact_method: 'call' })).toBe(true)
    expect(isContactEntry({ contact_method: 'email' })).toBe(true)
    expect(isContactEntry({ contact_method: null })).toBe(false)
    expect(isContactEntry({ contact_method: '' })).toBe(false)
    expect(isContactEntry({ contact_method: '   ' })).toBe(false)
  })
})

describe('deriveBidLastContact', () => {
  it('latest method entry wins; notes are invisible', () => {
    expect(
      deriveBidLastContact([
        { contact_method: 'call', occurred_at: at('2026-08-20T10:00:00Z') },
        { contact_method: null, occurred_at: at('2026-08-27T10:00:00Z') }, // a note — ignored
        { contact_method: 'text', occurred_at: at('2026-08-25T10:00:00Z') },
      ]),
    ).toBe('2026-08-25T10:00:00Z')
  })
  it('null when only notes (or nothing) exist', () => {
    expect(deriveBidLastContact([{ contact_method: null, occurred_at: at('2026-08-27T10:00:00Z') }])).toBeNull()
    expect(deriveBidLastContact([])).toBeNull()
  })
})

describe('lastContactByGc', () => {
  it("groups by GC; NULL-GC entries count as the own GC ('') only", () => {
    const map = lastContactByGc([
      { gc_customer_id: null, contact_method: 'call', occurred_at: at('2026-08-20T10:00:00Z') },
      { gc_customer_id: 'gc-a', contact_method: 'email', occurred_at: at('2026-08-26T10:00:00Z') },
      { gc_customer_id: 'gc-a', contact_method: null, occurred_at: at('2026-08-27T10:00:00Z') }, // note
      { gc_customer_id: 'gc-b', contact_method: 'call', occurred_at: at('2026-08-22T10:00:00Z') },
    ])
    expect(map).toEqual({
      '': '2026-08-20T10:00:00Z',
      'gc-a': '2026-08-26T10:00:00Z',
      'gc-b': '2026-08-22T10:00:00Z',
    })
  })
  it("another GC's contact never freshens the own GC", () => {
    const map = lastContactByGc([{ gc_customer_id: 'gc-a', contact_method: 'call', occurred_at: at('2026-08-27T10:00:00Z') }])
    expect(map['']).toBeUndefined()
  })
  it("entries stamped with the own GC's customer id fold into '' when ownGcCustomerId is passed", () => {
    const map = lastContactByGc(
      [
        { gc_customer_id: 'gc-own', contact_method: 'call', occurred_at: at('2026-08-27T10:00:00Z') },
        { gc_customer_id: null, contact_method: 'email', occurred_at: at('2026-08-20T10:00:00Z') },
      ],
      'gc-own',
    )
    expect(map).toEqual({ '': '2026-08-27T10:00:00Z' })
  })
})

describe('entryGcIdFromPacketKey', () => {
  it("'' and null mean the own GC → null; shared keys unwrap; customer ids pass through", async () => {
    const { entryGcIdFromPacketKey } = await import('./bidContacts')
    expect(entryGcIdFromPacketKey('')).toBeNull()
    expect(entryGcIdFromPacketKey(null)).toBeNull()
    expect(entryGcIdFromPacketKey('shared:gc-b')).toBe('gc-b')
    expect(entryGcIdFromPacketKey('gc-a')).toBe('gc-a')
  })
})
