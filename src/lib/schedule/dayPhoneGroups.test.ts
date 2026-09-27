import { describe, expect, it } from 'vitest'
import { buildDayPhoneGroups, dayPhoneDefaultGroup, dayPhoneVisibleSections, isDayPhoneCrewRole } from './dayPhoneGroups'

const users = [
  { id: 'grace', name: 'Grace' },
  { id: 'kyle', name: 'Kyle' },
  { id: 'malachi', name: 'Malachi' },
  { id: 'michael', name: 'Michael A' },
  { id: 'roxi', name: 'Roxi' },
  { id: 'sam', name: 'Sam' },
  { id: 'taunya', name: 'Taunya' },
  { id: 'zed', name: 'Zed' },
]
const roles = new Map([
  ['grace', 'assistant'],
  ['kyle', 'helpers'],
  ['malachi', 'master_technician'],
  ['michael', 'subcontractor'],
  ['roxi', 'assistant'],
  ['sam', 'superintendent'],
  ['taunya', 'assistant'],
  ['zed', 'subcontractor'],
])
const blocks = new Map<string, { note?: string | null }[]>([
  ['grace', [{ note: '' }]],
  ['kyle', [{ note: 'bring the jetter' }, { note: null }]],
  ['malachi', [{ note: '' }, { note: '  ' }, { note: 'call first' }]],
  ['michael', [{ note: null }]],
  ['sam', [{ note: 'walk' }]],
  ['taunya', [{ note: null }]],
])

describe('buildDayPhoneGroups', () => {
  const g = buildDayPhoneGroups(users, roles, blocks)
  it('puts the crews first in the owner’s order — leaders, superintendents, subcontractors, helpers', () => {
    expect(g.sections.crews.map((s) => `${s.label}:${s.rows.map((r) => r.name).join(',')}`)).toEqual(['Leaders:Malachi', 'Superintendents:Sam', 'Subcontractors:Michael A', 'Helper:Kyle'])
    expect(isDayPhoneCrewRole('superintendent')).toBe(true)
    expect(isDayPhoneCrewRole('assistant')).toBe(false)
  })
  it('keeps the office behind its chip and anyone with no block behind Free, whatever the role', () => {
    expect(g.sections.office.map((s) => `${s.label}:${s.rows.map((r) => r.name).join(',')}`)).toEqual(['Assistants:Grace,Taunya'])
    expect(g.sections.free.flatMap((s) => s.rows.map((r) => r.name))).toEqual(['Roxi', 'Zed'])
    expect(g.counts).toEqual({ crews: 4, office: 2, free: 2 })
  })
  it('counts the crew blocks with no note', () => {
    expect(g.crewBlocksWithoutNote).toBe(4)
  })
  it('names several helpers in the plural', () => {
    const two = buildDayPhoneGroups(users, new Map([...roles, ['zed', 'helpers']]), new Map([...blocks, ['zed', [{ note: 'x' }]]]))
    expect(two.sections.crews[two.sections.crews.length - 1]?.label).toBe('Helpers')
  })
})

describe('what the Day opens on and draws', () => {
  const g = buildDayPhoneGroups(users, roles, blocks)
  it('opens on the crews, or the first group with anyone in it', () => {
    expect(dayPhoneDefaultGroup(g.counts)).toBe('crews')
    expect(dayPhoneDefaultGroup({ crews: 0, office: 3, free: 1 })).toBe('office')
    expect(dayPhoneDefaultGroup({ crews: 0, office: 0, free: 1 })).toBe('free')
  })
  it('draws the picked group, and every group while a search is typed', () => {
    expect(dayPhoneVisibleSections(g, 'office', false).map((s) => s.label)).toEqual(['Assistants'])
    const all = dayPhoneVisibleSections(g, 'office', true)
    expect(all.map((s) => s.label)).toEqual(['Leaders', 'Superintendents', 'Subcontractors', 'Helper', 'Assistants', 'Assistants · free', 'Subcontractors · free'])
    expect(new Set(all.map((s) => s.sectionKey)).size).toBe(all.length)
  })
})
