import { describe, expect, it } from 'vitest'
import { PERSON_DESK_SECTION_IDS, deskSectionDomId, isPersonDeskSectionId, parseDeskSectionParam } from './personDeskSections'
import { personDeskLink } from './personKey'

describe('personDeskSections (v2.2810)', () => {
  it('ids are stable anchors and the param parser refuses strangers', () => {
    expect(PERSON_DESK_SECTION_IDS).toContain('paperwork')
    expect(deskSectionDomId('paperwork')).toBe('desk-paperwork')
    expect(isPersonDeskSectionId('push')).toBe(true)
    expect(parseDeskSectionParam(' Paperwork ')).toBe('paperwork')
    expect(parseDeskSectionParam('bogus')).toBeNull()
    expect(parseDeskSectionParam(null)).toBeNull()
  })
  it('personDeskLink carries the section beside the person', () => {
    const u = '11111111-1111-4111-8111-111111111111'
    expect(personDeskLink({ userId: u }, 'paperwork')).toBe(`?person=u:${u}&section=paperwork`)
    expect(personDeskLink({ personId: u })).toBe(`?person=p:${u}`)
    expect(personDeskLink({})).toBeNull()
  })
})
