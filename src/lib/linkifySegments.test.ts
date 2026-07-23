import { describe, expect, it } from 'vitest'
import { containsUrl, shortUrlLabel, splitLinkSegments } from './linkifySegments'

describe('shortUrlLabel', () => {
  it('returns the hostname without www', () => {
    expect(shortUrlLabel('https://employers.indeed.com/candidates/view?id=f1150b&listQuery=aWQlM0Q')).toBe('employers.indeed.com')
    expect(shortUrlLabel('https://www.linkedin.com/in/someone')).toBe('linkedin.com')
  })
  it('falls back to a trimmed prefix for junk', () => {
    expect(shortUrlLabel('https://')).toBe('https://')
  })
})

describe('splitLinkSegments', () => {
  it('splits text around URLs and shortens their labels', () => {
    const segments = splitLinkSegments('via https://employers.indeed.com/candidates/view?id=abc long tail')
    expect(segments).toEqual([
      { kind: 'text', text: 'via ' },
      { kind: 'link', href: 'https://employers.indeed.com/candidates/view?id=abc', label: 'employers.indeed.com' },
      { kind: 'text', text: ' long tail' },
    ])
  })

  it('keeps sentence-trailing punctuation out of the link', () => {
    const segments = splitLinkSegments('see https://example.com/x. Then call.')
    expect(segments[1]).toEqual({ kind: 'link', href: 'https://example.com/x', label: 'example.com' })
    expect(segments[2]).toEqual({ kind: 'text', text: '.' })
  })

  it('handles multiple URLs and no-URL text', () => {
    const two = splitLinkSegments('https://a.com/1 and https://b.com/2')
    expect(two.filter((s) => s.kind === 'link')).toHaveLength(2)
    expect(splitLinkSegments('no links here')).toEqual([{ kind: 'text', text: 'no links here' }])
  })
})

describe('containsUrl', () => {
  it('detects http and https', () => {
    expect(containsUrl('x https://a.com')).toBe(true)
    expect(containsUrl('plain text')).toBe(false)
  })
})
