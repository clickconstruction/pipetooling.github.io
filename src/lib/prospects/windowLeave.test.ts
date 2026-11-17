import { describe, expect, it } from 'vitest'
import { anyTyped, editDirty, editSnapshotOf } from './windowLeave'

describe('anyTyped', () => {
  it('is clean while every box is blank and no flag is set', () => {
    expect(anyTyped({ company: '', contact: '  ', phone: null, linked: false, role: undefined })).toBe(false)
  })
  it('is dirty on one letter, or a linked customer', () => {
    expect(anyTyped({ company: 'B', contact: '' })).toBe(true)
    expect(anyTyped({ company: '', linked: true })).toBe(true)
  })
})

describe('editDirty', () => {
  const opened = { company: 'Baxter Fire Protection', phone: '(210) 555-0188', trades: 'Concrete' }
  it('is clean while the boxes read as they opened, spaces aside', () => {
    expect(editDirty({ ...opened }, opened)).toBe(false)
    expect(editDirty({ ...opened, phone: ' (210) 555-0188 ' }, opened)).toBe(false)
  })
  it('is dirty on a changed, added or cleared box', () => {
    expect(editDirty({ ...opened, trades: 'Concrete, Masonry' }, opened)).toBe(true)
    expect(editDirty({ ...opened, trades: '' }, opened)).toBe(true)
    expect(editDirty({ ...opened, role: 'developer' }, opened)).toBe(true)
  })
})

describe('editSnapshotOf', () => {
  const row = {
    company_name: 'ZZ Test Concrete',
    contact_name: 'Pat Sample',
    phone_number: '555-0100',
    email: 'pat@example.test',
    address: '1 Test St',
    links_to_website: 'example.test',
    is_person: false,
    contact_title: 'Estimator',
    contact_phone: '555-0101',
    lang: 'en',
    ok_to_text: 'yes',
    maps_url: null,
    license: null,
    also_reach: null,
    source: 'A referral',
    trades: ['Concrete', 'Fire sprinkler'],
    max_miles: 40,
    company_role: null,
  }

  it('holds the kind boxes under the keys the page compares: source, trades, miles, role', () => {
    const snap = editSnapshotOf(row)
    expect(snap.source).toBe('A referral')
    expect(snap.trades).toBe('Concrete, Fire sprinkler')
    expect(snap.miles).toBe('40')
    expect(snap.role).toBe('')
  })
  it('writes every missing fact as an empty string, so an untouched window is not dirty', () => {
    const snap = editSnapshotOf({ ...row, source: null, trades: null, max_miles: null, company_role: null })
    expect([snap.source, snap.trades, snap.miles, snap.role]).toEqual(['', '', '', ''])
    for (const v of Object.values(snap)) expect(typeof v).toBe('string')
  })
  it('is clean against itself and dirty once a box changes', () => {
    const snap = editSnapshotOf(row)
    expect(editDirty({ ...snap }, snap)).toBe(false)
    expect(editDirty({ ...snap, miles: '45' }, snap)).toBe(true)
  })
})
