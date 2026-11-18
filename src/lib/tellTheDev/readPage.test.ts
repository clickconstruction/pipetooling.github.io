// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { openWindowTitle } from './readPage'

const shown = () => true

afterEach(() => {
  document.body.innerHTML = ''
})

describe('openWindowTitle', () => {
  it('answers null with no window open', () => {
    document.body.innerHTML = '<main><h1>Jobs</h1></main>'
    expect(openWindowTitle(document, shown)).toBeNull()
  })

  it('reads the label of the window on top', () => {
    document.body.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="a"><h2 id="a">Edit Job</h2></div>
      <div role="dialog" aria-modal="true" aria-labelledby="b"><h2 id="b">  Pick the
        GC </h2></div>`
    expect(openWindowTitle(document, shown)).toBe('Pick the GC')
  })

  it('falls back to aria-label, then to the first heading', () => {
    document.body.innerHTML = '<div aria-modal="true" aria-label="Add a photo"></div>'
    expect(openWindowTitle(document, shown)).toBe('Add a photo')
    document.body.innerHTML = '<div role="dialog"><h3>Sign the tailgate sheet</h3></div>'
    expect(openWindowTitle(document, shown)).toBe('Sign the tailgate sheet')
  })

  it('says so when a window has no title', () => {
    document.body.innerHTML = '<div role="dialog"><p>Body</p></div>'
    expect(openWindowTitle(document, shown)).toBe('A window with no title')
  })

  it('never counts the box’s own window', () => {
    document.body.innerHTML = `
      <div role="dialog" aria-labelledby="a"><h2 id="a">Edit Job</h2></div>
      <div data-tell-the-dev><div role="dialog" aria-label="Tell the dev"></div></div>`
    expect(openWindowTitle(document, shown)).toBe('Edit Job')
  })

  it('skips a window that is not drawn', () => {
    document.body.innerHTML = '<div role="dialog" aria-label="Hidden one"></div>'
    expect(openWindowTitle(document, () => false)).toBeNull()
  })
})
