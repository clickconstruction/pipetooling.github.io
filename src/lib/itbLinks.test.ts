import { describe, expect, it } from 'vitest'
import { itbLinkLabel, itbLinkLabels, parseItbLinks, serializeItbLinks } from './itbLinks'

describe('parseItbLinks', () => {
  it('reads an array of URL strings', () => {
    expect(parseItbLinks(['https://app.planhub.com/x', ' https://buildingconnected.com/y '])).toEqual([
      'https://app.planhub.com/x',
      'https://buildingconnected.com/y',
    ])
  })

  it('tolerates junk shapes from the column', () => {
    expect(parseItbLinks(null)).toEqual([])
    expect(parseItbLinks(undefined)).toEqual([])
    expect(parseItbLinks('not-an-array')).toEqual([])
    expect(parseItbLinks([1, null, 'https://a.com', '', '  '])).toEqual(['https://a.com'])
  })
})

describe('serializeItbLinks', () => {
  it('trims and drops blanks', () => {
    expect(serializeItbLinks([' https://a.com ', '', '  ', 'https://b.com'])).toEqual(['https://a.com', 'https://b.com'])
  })
})

describe('itbLinkLabel', () => {
  it('recognizes known portals', () => {
    expect(itbLinkLabel('https://app.planhub.com/projects/123')).toBe('PlanHub')
    expect(itbLinkLabel('https://app.buildingconnected.com/opportunities/9')).toBe('BuildingConnected')
    expect(itbLinkLabel('https://us02.procore.com/bids/1')).toBe('Procore')
  })

  it('falls back to the hostname without www', () => {
    expect(itbLinkLabel('https://www.someportal.com/itb/4')).toBe('someportal.com')
  })

  it('handles scheme-less input and unparseable strings', () => {
    expect(itbLinkLabel('planhub.com/projects/5')).toBe('PlanHub')
    expect(itbLinkLabel('not a url at all')).toBe('not a url at all')
  })
})

describe('itbLinkLabels', () => {
  it('numbers duplicate labels', () => {
    expect(
      itbLinkLabels([
        'https://app.planhub.com/a',
        'https://app.buildingconnected.com/b',
        'https://planhub.com/c',
      ]),
    ).toEqual(['PlanHub', 'BuildingConnected', 'PlanHub 2'])
  })
})
