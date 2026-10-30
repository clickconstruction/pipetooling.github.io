import { describe, expect, it } from 'vitest'
import { foldRetiredSectionId, markHistorySectionIds, QUICKFILL_RETIRED_SECTIONS, QUICKFILL_SECTION_LABEL_BY_ID, QUICKFILL_SECTIONS } from './sections'

describe('sections · Messages carries the Texts station (v2.6098, punch list #178)', () => {
  it('Messages is the second station and Texts is no longer one of its own', () => {
    expect(QUICKFILL_SECTIONS[0]!.sectionId).toBe('needs-you')
    expect(QUICKFILL_SECTIONS[1]).toEqual({ id: 'quickfill-messages', sectionId: 'messages', label: 'Messages' })
    expect(QUICKFILL_SECTIONS.some((s) => s.sectionId === 'texts')).toBe(false)
  })

  it('a retired id folds into its station, its history reads under the new id, and its label still names old events', () => {
    expect(QUICKFILL_RETIRED_SECTIONS.texts).toEqual({ label: 'Texts', into: 'messages' })
    expect(foldRetiredSectionId('texts')).toBe('messages')
    expect(foldRetiredSectionId('messages')).toBe('messages')
    expect(markHistorySectionIds('messages')).toEqual(['messages', 'texts'])
    expect(markHistorySectionIds('email-inbox')).toEqual(['email-inbox'])
    expect(QUICKFILL_SECTION_LABEL_BY_ID.get('texts')).toBe('Texts')
    expect(QUICKFILL_SECTION_LABEL_BY_ID.get('messages')).toBe('Messages')
  })
})
