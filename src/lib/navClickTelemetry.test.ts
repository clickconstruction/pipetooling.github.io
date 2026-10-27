// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { callPressedTarget, navButtonName, resolveNavClick } from './navClickTelemetry'

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
    const mail = domFrom('<div data-navtrack="banner"><a href="mailto:a@b.c" id="hit">Email</a></div>')
    expect(resolveNavClick(mail.querySelector('#hit'))).toBeNull()
    expect(resolveNavClick(null)).toBeNull()
  })

  it('a tel: link inside tracked chrome is the Call press, with the container as its site (v2.5904)', () => {
    const tel = domFrom('<div data-navtrack="pipeline-row" data-navbuttons=""><a href="tel:5551234" id="hit">Call</a></div>')
    expect(resolveNavClick(tel.querySelector('#hit'))).toEqual({ control: 'call_pressed', target: '#surface=pipeline-row' })
    const banner = domFrom('<div data-navtrack="banner"><a href="tel:5551234"><span id="hit">Call</span></a></div>')
    expect(resolveNavClick(banner.querySelector('#hit'))).toEqual({ control: 'call_pressed', target: '#surface=banner' })
    expect(callPressedTarget('thread')).toBe('#surface=thread')
  })

  it('a labelled button counts only inside chrome that carries data-navbuttons (v2.5904)', () => {
    // A div stands in for the row's <tr>: innerHTML drops table parts outside a <table>.
    const row = domFrom(
      '<div data-navtrack="pipeline-row" data-navbuttons=""><span><button type="button" aria-label="Open job detail for Ridgeway Builders"><svg id="hit"></svg></button></span></div>',
    )
    expect(resolveNavClick(row.querySelector('#hit'))).toEqual({ control: 'pipeline-row', target: '#Open job detail' })
    const nav = domFrom('<nav data-navtrack="top-nav"><button id="hit" aria-label="Open menu">☰</button></nav>')
    expect(resolveNavClick(nav.querySelector('#hit'))).toBeNull()
    const wordless = domFrom('<div data-navtrack="job-window" data-navbuttons=""><button id="hit"><svg></svg></button></div>')
    expect(resolveNavClick(wordless.querySelector('#hit'))).toBeNull()
    const named = domFrom('<div data-navtrack="job-window" data-navbuttons=""><button id="hit" data-nav="customer-messages" aria-label="Open Ridgeway Builders’s messages">💬</button></div>')
    expect(resolveNavClick(named.querySelector('#hit'))).toEqual({ control: 'job-window', target: '#customer-messages' })
  })
})

describe('navButtonName', () => {
  function button(attrs: string, text = ''): Element {
    return domFrom(`<button ${attrs}>${text}</button>`).firstElementChild as Element
  }
  it('cuts the label where it starts naming a thing and folds digits', () => {
    expect(navButtonName(button('aria-label="Call customer at (830) 555-0187"'))).toBe('Call customer')
    expect(navButtonName(button('aria-label="Crew on Ridgeway Builders — open hours by person"'))).toBe('Crew')
    expect(navButtonName(button('title="Schedule strip — Done — last Sun Oct 25"'))).toBe('Schedule strip')
    expect(navButtonName(button('aria-label="Residential property at 11704 FM1117 — change the kind"'))).toBe('Residential property')
    expect(navButtonName(button('aria-label="No job account at Ferguson yet — tap to ask the office"'))).toBe('No job account')
    expect(navButtonName(button('', 'Done · 0 open · Today’s lines'))).toBe('Done')
    expect(navButtonName(button('', '  Bill\n Customer '))).toBe('Bill Customer')
    expect(navButtonName(button('', 'Jump to Billed, 52 rows'))).toBe('Jump to Billed, # rows')
  })
  it('keeps every name out: a word the app does not own ends the name with …', () => {
    expect(navButtonName(button('aria-label="Open Ridgeway Builders’s messages"'))).toBe('Open …')
    expect(navButtonName(button('aria-label="Dana Whitfield sees this job’s bills on their page."'))).toBe('…')
    expect(navButtonName(button('', 'Rosa'))).toBe('…')
    expect(navButtonName(button('aria-label="Billed Aug 12 + Cedar Loop Homes’s pay speed"'))).toBe('Billed date #')
    expect(navButtonName(button('aria-label="Customer promised payment by Oct 3 (marked by Rosa)"'))).toBe('Customer promised payment by date #')
    expect(navButtonName(button('aria-label="The § 53.056 window closed Aug 14"'))).toBe('The § #.# window closed date #')
    expect(navButtonName(button('aria-label="Open AIA G702-G703 workbook generator"'))).toBe('Open AIA G#-G# workbook generator')
    expect(navButtonName(button('aria-label="Edit GC/Builder"'))).toBe('Edit GC/Builder')
    expect(navButtonName(button('aria-label="stripeResend"'))).toBe('stripeResend')
    // A month's letters inside a word are not a month (the sweep found Mark Paid read as date Paid).
    expect(navButtonName(button('', 'Mark Paid'))).toBe('Mark Paid')
    expect(navButtonName(button('', 'Money story'))).toBe('Money story')
    expect(navButtonName(button('aria-label="Next visit Mon, Oct 26 at 9"'))).toBe('Next visit date date #')
  })

  it('data-nav wins, a wordless button has no name, and a long label is capped', () => {
    expect(navButtonName(button('data-nav="speech-bubble" aria-label="Open Ridgeway’s messages"'))).toBe('speech-bubble')
    expect(navButtonName(button('', '<svg></svg>'))).toBeNull()
    expect(navButtonName(button(`aria-label="${'x'.repeat(80)}"`))?.length).toBe(48)
  })
})
