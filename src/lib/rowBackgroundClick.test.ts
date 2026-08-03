// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { isRowBackgroundClick } from './rowBackgroundClick'

function row(html: string): HTMLElement {
  const li = document.createElement('li')
  li.innerHTML = html
  document.body.appendChild(li)
  return li
}

describe('isRowBackgroundClick', () => {
  it('true for the row element itself and plain text containers', () => {
    const li = row('<div><span class="plain">Customer name</span></div>')
    expect(isRowBackgroundClick(li, { selection: '' })).toBe(true)
    expect(isRowBackgroundClick(li.querySelector('.plain'), { selection: '' })).toBe(true)
  })

  it('false on links, buttons, and anything nested inside them', () => {
    const li = row('<a href="/x"><span class="inner">Name</span></a><button><svg class="icon"></svg></button>')
    expect(isRowBackgroundClick(li.querySelector('a'), { selection: '' })).toBe(false)
    expect(isRowBackgroundClick(li.querySelector('.inner'), { selection: '' })).toBe(false)
    expect(isRowBackgroundClick(li.querySelector('button'), { selection: '' })).toBe(false)
    expect(isRowBackgroundClick(li.querySelector('.icon'), { selection: '' })).toBe(false)
  })

  it('false on role=button spans and form fields', () => {
    const li = row('<span role="button" class="pill">chip</span><input type="text" class="field" />')
    expect(isRowBackgroundClick(li.querySelector('.pill'), { selection: '' })).toBe(false)
    expect(isRowBackgroundClick(li.querySelector('.field'), { selection: '' })).toBe(false)
  })

  it('false while text is selected — releasing a sweep-select must not navigate', () => {
    const li = row('<span class="plain">address text</span>')
    expect(isRowBackgroundClick(li.querySelector('.plain'), { selection: 'address te' })).toBe(false)
  })

  it('true for non-Element targets (defensive)', () => {
    expect(isRowBackgroundClick(null, { selection: '' })).toBe(true)
  })
})
