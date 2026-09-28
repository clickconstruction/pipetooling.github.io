/** The Users tab's "Active projects" links: who is assigned a step on which active project. */

export type PersonActiveProject = { id: string; name: string }

export type PersonActiveProjectStepRow = { workflow_id: string; assigned_to_name: string | null }
export type PersonActiveProjectWorkflowRow = { id: string; project_id: string }
export type PersonActiveProjectRow = { id: string; name: string }

/**
 * Steps → their workflow's project → one list per assigned name (trimmed), each project once,
 * sorted by name. `projects` is already narrowed to the active ones; a step whose workflow or
 * project is not in hand is skipped.
 */
export function groupActiveProjectsByPerson(
  steps: PersonActiveProjectStepRow[],
  workflows: PersonActiveProjectWorkflowRow[],
  projects: PersonActiveProjectRow[],
): Record<string, PersonActiveProject[]> {
  const workflowToProject = new Map<string, PersonActiveProject>()
  for (const wf of workflows) {
    const proj = projects.find((p) => p.id === wf.project_id)
    if (proj) workflowToProject.set(wf.id, { id: proj.id, name: proj.name })
  }

  const projectsByPerson: Record<string, PersonActiveProject[]> = {}
  for (const step of steps) {
    const personName = step.assigned_to_name?.trim()
    if (!personName) continue
    const entry = workflowToProject.get(step.workflow_id)
    if (!entry) continue
    if (!projectsByPerson[personName]) projectsByPerson[personName] = []
    if (!projectsByPerson[personName].some((p) => p.id === entry.id)) {
      projectsByPerson[personName].push(entry)
    }
  }
  for (const k of Object.keys(projectsByPerson)) {
    const list = projectsByPerson[k]
    if (list) list.sort((a, b) => a.name.localeCompare(b.name))
  }
  return projectsByPerson
}
