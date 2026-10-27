/**
 * Empty words for Projects (punch list #184, sweep C): what the project list and the Job history
 * tab say when they have no rows, in `EmptyState`'s shape (`main`, the press, `tail`). The rule is
 * `emptyWords.ts`'s: a list says what fills it and offers the press, and a search or a filter with
 * no match says so and offers the control that clears it. `projectsEmptyWords.test.ts` fires every
 * press and holds every sentence to plain words.
 */
import { emptyWords, type EmptyStateWords } from '../emptyWords'

type Press = () => void

/** The page's make button. */
export const NEW_PROJECT_CONTROL = 'New Project'

/**
 * No project yet, for everyone or for the customer the page is filtered to: New Project opens the
 * form. Null for a role the page gives no New Project, and then the sentence stands alone.
 */
export function projectsListEmptyWords(customerName: string | null, newProject: Press | null): EmptyStateWords {
  const main = customerName ? `${customerName} has no projects yet.` : emptyWords({ kind: 'make', noun: 'projects', control: NEW_PROJECT_CONTROL }).main
  return newProject ? { main, next: { label: NEW_PROJECT_CONTROL, onPress: newProject }, tail: 'adds the first.' } : { main }
}

/** The search or the status chips hide every project: the bar's own Clear filters clears both. */
export function projectsFilterEmptyWords(query: string, clearFilters: Press): EmptyStateWords {
  const q = query.trim()
  return { main: q ? `No projects match ‘${q}’.` : 'No projects match the filters.', next: { label: 'Clear filters', onPress: clearFilters } }
}

/** Job history after a search, said for the jobs linked to a project when that switch is on. */
export function jobHistorySearchEmptyWords(query: string, onlyWithProjects: boolean, clearSearch: Press): EmptyStateWords {
  const q = query.trim()
  return { main: onlyWithProjects ? `No jobs linked to a project match ‘${q}’.` : `No jobs match ‘${q}’.`, next: { label: 'Clear the search', onPress: clearSearch } }
}

/** Job history with the linked-to-a-project switch hiding every job. */
export function jobHistoryNoProjectsEmptyWords(showAllJobs: Press): EmptyStateWords {
  return { main: 'No working jobs in scope are linked to a project.', next: { label: 'Show all jobs', onPress: showAllJobs } }
}
