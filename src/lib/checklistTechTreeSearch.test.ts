import { describe, expect, it } from 'vitest'
import { computeRoadmapSearchMatches } from './checklistTechTreeSearch'

const G = (id: string, title: string) => ({ id, title })
const T = (
  id: string,
  groupId: string,
  title: string,
  assigneeLabel: string,
) => ({ id, groupId, title, assigneeLabel })

describe('computeRoadmapSearchMatches', () => {
  it('returns empty when query is blank or whitespace', () => {
    const r = computeRoadmapSearchMatches('   ', { groups: [G('g1', 'A')], tasks: [T('t1', 'g1', 'X', '')] })
    expect(r.normalizedQuery).toBe('')
    expect(r.groupIdsWithAnyMatch).toEqual([])
    expect(r.matchCount).toBe(0)
  })

  it('matches group title (case-insensitive)', () => {
    const r = computeRoadmapSearchMatches('plumb', {
      groups: [G('g1', 'Residential Plumbing')],
      tasks: [],
    })
    expect(r.groupIdsWithTitleMatch).toEqual(['g1'])
    expect(r.groupIdsWithAnyMatch).toEqual(['g1'])
    expect(r.matchCount).toBe(1)
  })

  it('matches task title', () => {
    const r = computeRoadmapSearchMatches('rough', {
      groups: [G('g1', 'Group A')],
      tasks: [T('t1', 'g1', 'Rough-in inspection', '')],
    })
    expect(r.taskIdsMatching).toEqual(['t1'])
    expect(r.groupIdsWithTitleMatch).toEqual([])
    expect(r.groupIdsWithAnyMatch).toEqual(['g1'])
    expect(r.matchCount).toBe(1)
  })

  it('matches assignee label', () => {
    const r = computeRoadmapSearchMatches('jane', {
      groups: [G('g1', 'G')],
      tasks: [T('t1', 'g1', 'Task', 'Jane, Bob')],
    })
    expect(r.taskIdsMatching).toEqual(['t1'])
    expect(r.groupIdsWithAnyMatch).toEqual(['g1'])
    expect(r.matchCount).toBe(1)
  })

  it('counts group title and each task as separate matchCount entries', () => {
    const r = computeRoadmapSearchMatches('x', {
      groups: [G('g1', 'X-g')],
      tasks: [
        T('t1', 'g1', 'a', ''),
        T('t2', 'g1', 'bx', ''),
      ],
    })
    expect(r.groupIdsWithTitleMatch).toEqual(['g1'])
    expect(r.taskIdsMatching).toEqual(['t2'])
    expect(r.matchCount).toBe(2)
  })
})
