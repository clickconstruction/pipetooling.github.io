// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { legalNarrativeBandWords, legalNarrativeFromRow, legalNarrativeProblem, LEGAL_NARRATIVE_MAX_CHARS, LEGAL_NARRATIVE_OUTLINE, parseLegalNarrative } from './legalNarrative'
import { legalNarrativeHtml } from './legalNarrativeHtml'

describe('legalNarrative (v2.4812)', () => {
  it('reads a matter row: none when empty, else the text, the day and who', () => {
    expect(legalNarrativeFromRow({ narrative_md: '  ' }, 'R', (iso) => iso.slice(0, 10))).toBeNull()
    expect(legalNarrativeFromRow({ narrative_md: '## The parties\n\nX', narrative_updated_at: '2026-10-07T15:00:00Z' }, 'Robin Ortega', (iso) => iso.slice(0, 10))).toEqual({ markdown: '## The parties\n\nX', updatedOn: '2026-10-07', updatedByName: 'Robin Ortega' })
    expect(parseLegalNarrative(undefined)).toBeNull()
    expect(parseLegalNarrative({ markdown: ' ' })).toBeNull()
    expect(parseLegalNarrative({ markdown: 'A', updatedOn: 7 })).toEqual({ markdown: 'A', updatedOn: '', updatedByName: '' })
  })

  it('says whose account it is, and refuses a text over the limit', () => {
    expect(legalNarrativeBandWords({ updatedOn: '2026-10-07', updatedByName: 'Robin Ortega' })).toBe("The office's account of this matter, written by Robin Ortega on 2026-10-07. The record behind it is on the other tabs, and the documents it names are under Evidence.")
    expect(legalNarrativeBandWords({ updatedOn: '', updatedByName: '' })).toContain('written by the office.')
    expect(legalNarrativeProblem('x'.repeat(LEGAL_NARRATIVE_MAX_CHARS + 1))).toContain('longer than 40,000 characters')
    expect(legalNarrativeProblem(LEGAL_NARRATIVE_OUTLINE)).toBeNull()
  })

  it('renders headings, tables and links, and drops scripts, handlers, images and unsafe links', () => {
    const html = legalNarrativeHtml(`## The parties\n\n**Bold** and a [record](https://example.com/r).\n\n| They say | The record |\n|---|---|\n| a | b |\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[bad](javascript:alert(3))\n\n<p onclick="x()">click</p>`)
    expect(html).toContain('<h2>The parties</h2>')
    expect(html).toContain('<strong>Bold</strong>')
    expect(html).toContain('<a href="https://example.com/r" target="_blank" rel="noopener noreferrer">record</a>')
    expect(html).toContain('<table>')
    expect(html).toContain('<th>They say</th>')
    expect(html).not.toMatch(/<script|onerror|onclick|<img|javascript:/i)
    expect(legalNarrativeHtml('  ')).toBe('')
  })
})
