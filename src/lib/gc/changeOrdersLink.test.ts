import { describe, expect, it } from 'vitest'
import { changeOrdersFromSearch, changeOrdersHref } from './changeOrdersLink'

describe('a GC project’s Change orders, by its address', () => {
  it('opens on the GC projects page at ?changes=, and the page reads the same project back', () => {
    const href = changeOrdersHref('00000000-0000-4000-8000-0000000000aa')
    expect(href).toBe('/gc?changes=00000000-0000-4000-8000-0000000000aa')
    expect(changeOrdersFromSearch(new URLSearchParams(href.split('?')[1]))).toBe('00000000-0000-4000-8000-0000000000aa')
  })

  it('reads no project from a page that names none', () => {
    expect(changeOrdersFromSearch(new URLSearchParams(''))).toBeNull()
    expect(changeOrdersFromSearch(new URLSearchParams('changes=%20'))).toBeNull()
  })
})
