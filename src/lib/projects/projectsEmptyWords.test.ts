import { describe, expect, it, vi } from 'vitest'
import type { EmptyStateWords } from '../emptyWords'
import { plainWordsFailures } from '../plainWords'
import { jobHistoryNoProjectsEmptyWords, jobHistorySearchEmptyWords, projectsFilterEmptyWords, projectsListEmptyWords } from './projectsEmptyWords'

const noop = () => {}
const read = (w: EmptyStateWords) => [w.main, w.next?.label, w.tail].filter(Boolean).join(' ')
function press(w: EmptyStateWords) {
  if (!w.next || !('onPress' in w.next)) throw new Error(`no handler press on: ${w.main}`)
  w.next.onPress()
}

describe('projectsEmptyWords', () => {
  it('the list: New Project adds the first, named for the customer when the page is filtered to one', () => {
    const open = vi.fn()
    const none = projectsListEmptyWords(null, open)
    expect(read(none)).toBe('No projects yet. New Project adds the first.')
    press(none)
    expect(open).toHaveBeenCalledTimes(1)
    expect(projectsListEmptyWords('Ramirez Homes', open).main).toBe('Ramirez Homes has no projects yet.')
    expect(projectsListEmptyWords(null, null)).toEqual({ main: 'No projects yet.' })
  })

  it('the filters: the bar’s own Clear filters, with the search quoted', () => {
    const clear = vi.fn()
    const search = projectsFilterEmptyWords(' Oak ', clear)
    expect(read(search)).toBe('No projects match ‘Oak’. Clear filters')
    press(search)
    expect(clear).toHaveBeenCalledTimes(1)
    expect(projectsFilterEmptyWords('', clear).main).toBe('No projects match the filters.')
  })

  it('Job history: the search quoted for the jobs it reads, and Show all jobs', () => {
    const clear = vi.fn()
    const search = jobHistorySearchEmptyWords('258', true, clear)
    expect(search.main).toBe('No jobs linked to a project match ‘258’.')
    press(search)
    expect(clear).toHaveBeenCalledTimes(1)
    expect(jobHistorySearchEmptyWords('258', false, clear).main).toBe('No jobs match ‘258’.')
    const all = vi.fn()
    const linked = jobHistoryNoProjectsEmptyWords(all)
    expect(linked.next?.label).toBe('Show all jobs')
    press(linked)
    expect(all).toHaveBeenCalledTimes(1)
  })

  it('every sentence reads in plain words', () => {
    const all: EmptyStateWords[] = [
      projectsListEmptyWords(null, noop),
      projectsListEmptyWords('Ramirez Homes', noop),
      projectsFilterEmptyWords('Oak', noop),
      projectsFilterEmptyWords('', noop),
      jobHistorySearchEmptyWords('258', true, noop),
      jobHistoryNoProjectsEmptyWords(noop),
    ]
    for (const w of all) expect(plainWordsFailures(read(w)), read(w)).toEqual([])
  })
})
