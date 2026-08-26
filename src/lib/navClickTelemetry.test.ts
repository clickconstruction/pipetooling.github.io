// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { resolveNavClick } from './navClickTelemetry'

function domFrom(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  return root
}

describe('resolveNavClick', () => {
  it('resolves a link inside a tracked container', () => {
    const root = domFrom('<nav data-navtrack="top-nav"><a href="/jobs"><span id="hit">Jobs</span></a></nav>')
    expect(resolveNavClick(root.querySelector('#hit'))).toEqual({ control: 'top-nav', target: '/jobs' })
  })

  it('inner tracked containers override outer ones (gear menu inside the nav)', () => {
    const root = domFrom(
      '<nav data-navtrack="top-nav"><div data-navtrack="gear-menu"><a href="/tally" id="hit">Job Parts Tally</a></div></nav>',
    )
    expect(resolveNavClick(root.querySelector('#hit'))).toEqual({ control: 'gear-menu', target: '/tally' })
  })

  it('keeps the search string so tab targets stay distinct', () => {
    const root = domFrom('<div data-navtrack="quick-button"><a href="/jobs?tab=billing&newJob=true" id="hit">Job</a></div>')
    expect(resolveNavClick(root.querySelector('#hit'))?.target).toBe('/jobs?tab=billing&newJob=true')
  })

  it('strips an absolute origin down to the app path', () => {
    const root = domFrom('<div data-navtrack="banner"><a href="https://example.com/accounts-receivable" id="hit">AR</a></div>')
    expect(resolveNavClick(root.querySelector('#hit'))?.target).toBe('/accounts-receivable')
  })

  it('returns null for clicks that are not on a link, links outside tracked chrome, and non-path hrefs', () => {
    const noLink = domFrom('<nav data-navtrack="top-nav"><button id="hit">Menu</button></nav>')
    expect(resolveNavClick(noLink.querySelector('#hit'))).toBeNull()
    const untracked = domFrom('<div><a href="/jobs" id="hit">Jobs</a></div>')
    expect(resolveNavClick(untracked.querySelector('#hit'))).toBeNull()
    const tel = domFrom('<div data-navtrack="banner"><a href="tel:5551234" id="hit">Call</a></div>')
    expect(resolveNavClick(tel.querySelector('#hit'))).toBeNull()
    expect(resolveNavClick(null)).toBeNull()
  })
})
