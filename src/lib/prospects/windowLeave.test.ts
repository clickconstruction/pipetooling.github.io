import { describe, expect, it } from 'vitest'
import { anyTyped, editDirty } from './windowLeave'

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
  const opened = { company: 'Bexar Fire Protection', phone: '(210) 555-0188', trades: 'Concrete' }
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
