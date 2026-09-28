import { describe, expect, it } from 'vitest'
import { groupActiveProjectsByPerson } from './personActiveProjects'

const workflows = [
  { id: 'w1', project_id: 'p1' },
  { id: 'w2', project_id: 'p2' },
  { id: 'w3', project_id: 'p3' },
]
const projects = [
  { id: 'p1', name: 'Oak Ridge' },
  { id: 'p2', name: 'Birch Court' },
]

describe('groupActiveProjectsByPerson', () => {
  it('lists each person under their assigned name, projects by name', () => {
    const steps = [
      { workflow_id: 'w1', assigned_to_name: 'Alex Rivera' },
      { workflow_id: 'w2', assigned_to_name: 'Alex Rivera' },
      { workflow_id: 'w2', assigned_to_name: 'Sam Lee' },
    ]
    expect(groupActiveProjectsByPerson(steps, workflows, projects)).toEqual({
      'Alex Rivera': [
        { id: 'p2', name: 'Birch Court' },
        { id: 'p1', name: 'Oak Ridge' },
      ],
      'Sam Lee': [{ id: 'p2', name: 'Birch Court' }],
    })
  })

  it('names a project once however many steps a person holds on it', () => {
    const steps = [
      { workflow_id: 'w1', assigned_to_name: 'Alex Rivera' },
      { workflow_id: 'w1', assigned_to_name: 'Alex Rivera' },
    ]
    expect(groupActiveProjectsByPerson(steps, workflows, projects)).toEqual({ 'Alex Rivera': [{ id: 'p1', name: 'Oak Ridge' }] })
  })

  it('trims the name, and skips a blank or missing one', () => {
    const steps = [
      { workflow_id: 'w1', assigned_to_name: '  Alex Rivera ' },
      { workflow_id: 'w1', assigned_to_name: '   ' },
      { workflow_id: 'w1', assigned_to_name: null },
    ]
    expect(Object.keys(groupActiveProjectsByPerson(steps, workflows, projects))).toEqual(['Alex Rivera'])
  })

  it('skips a step whose project is not among the active ones, or whose workflow is unknown', () => {
    const steps = [
      { workflow_id: 'w3', assigned_to_name: 'Alex Rivera' },
      { workflow_id: 'w9', assigned_to_name: 'Alex Rivera' },
    ]
    expect(groupActiveProjectsByPerson(steps, workflows, projects)).toEqual({})
  })

  it('is empty with nothing to read', () => {
    expect(groupActiveProjectsByPerson([], [], [])).toEqual({})
  })
})
