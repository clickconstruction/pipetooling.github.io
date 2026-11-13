import { describe, expect, it } from 'vitest'
import { citationsBySection, citedByWords, citedCorrectedWords, headingNumber, parseSectionCitations, sectionByNumber, splitByCitations } from './hrDocCitations'

describe('hrDocCitations (an entry cites a section of the narrative, v2.6615)', () => {
  it('parses N§16, N §16 and §16, each number once, in order', () => {
    expect(parseSectionCitations('Trip charge; see N§16 and N §2, then §16 again and §999.')).toEqual([
      { raw: 'N§16', section: 16 }, { raw: 'N §2', section: 2 }, { raw: '§999', section: 999 },
    ])
    expect(parseSectionCitations('No citation here, not even a section sign.')).toEqual([])
  })

  it('splits a line into runs and citations so each becomes a press in place', () => {
    expect(splitByCitations('Told to stop. N§2 (and §3).')).toEqual([
      { kind: 'text', text: 'Told to stop. ' }, { kind: 'cite', raw: 'N§2', section: 2 }, { kind: 'text', text: ' (and ' }, { kind: 'cite', raw: '§3', section: 3 }, { kind: 'text', text: ').' },
    ])
    expect(splitByCitations('plain')).toEqual([{ kind: 'text', text: 'plain' }])
  })

  it('reads a heading number and finds the heading a citation names', () => {
    expect(headingNumber('16. Bidding conduct')).toBe(16)
    expect(headingNumber('§3 The shop')).toBe(3)
    expect(headingNumber('2 — The second year')).toBe(2)
    expect(headingNumber('Appendix A — People')).toBeNull()
    expect(headingNumber('2026 in review')).toBeNull()
    const headings = [{ text: '1. Background', level: 2, slug: '1-background' }, { text: '2. The spring', level: 2, slug: '2-the-spring' }]
    expect(sectionByNumber(headings, 2)?.slug).toBe('2-the-spring')
    expect(sectionByNumber(headings, 9)).toBeNull()
  })

  it('groups the citing lines by section and says how many', () => {
    const lines = [
      { key: 'a', ymd: '2026-03-30', what: 'Trip charge. N§2' },
      { key: 'b', ymd: '2026-04-15', what: 'Told to stop (§2); see also N§3.' },
      { key: 'c', ymd: '2026-05-02', what: 'Nothing cited.' },
    ]
    const by = citationsBySection(lines)
    expect([...by.keys()]).toEqual([2, 3])
    expect(by.get(2)?.map((l) => l.key)).toEqual(['a', 'b'])
    expect(citedByWords(2)).toBe('cited by 2 entries')
    expect(citedByWords(1)).toBe('cited by 1 entry')
  })

  it('counts the citing entries a later entry corrected (punch list #315)', () => {
    expect(citedCorrectedWords(1)).toBe('1 of them corrected since')
    expect(citedCorrectedWords(3)).toBe('3 of them corrected since')
  })
})
