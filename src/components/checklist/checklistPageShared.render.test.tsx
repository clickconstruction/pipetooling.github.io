// @vitest-environment jsdom
/**
 * The roadmap stage chip the Checklist page's tabs share (v2.7724, out of `pages/Checklist.tsx`). Today, the Review
 * row and Manage each draw it, so what it says and what its press does are held here once.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { roadmapGoalChip } from './checklistPageShared'

const embed = (stage: string | null, roadmap: string | null) => ({
  group_id: 'g1',
  checklist_tech_tree_groups: { title: stage, roadmap_id: 'r1', checklist_tech_tree_roadmaps: roadmap == null ? null : { title: roadmap } },
})

describe('roadmapGoalChip', () => {
  it('draws nothing for a task that is not off a roadmap', () => {
    expect(roadmapGoalChip(null)).toBeNull()
    expect(roadmapGoalChip({ roadmap_group_task_id: null, checklist_tech_tree_group_tasks: embed('Stage Two', 'Farm 1') })).toBeNull()
  })

  it('says the stage alone, with the roadmap in its title', () => {
    render(<>{roadmapGoalChip({ roadmap_group_task_id: 't1', checklist_tech_tree_group_tasks: embed(' Stage Two ', 'Farm 1') })}</>)
    const chip = screen.getByText('Stage Two')
    expect(chip.tagName).toBe('SPAN')
    expect(chip.getAttribute('title')).toBe('Farm 1 · Stage Two')
    // One line by default: a long stage name is cut, never wrapped.
    expect(chip.style.whiteSpace).toBe('nowrap')
  })

  it('falls back to the roadmap, then to the plain goal mark, when the tree is hidden', () => {
    const { unmount } = render(<>{roadmapGoalChip({ roadmap_group_task_id: 't1', checklist_tech_tree_group_tasks: embed('', 'Farm 1') })}</>)
    expect(screen.getByText('Farm 1').getAttribute('title')).toBe('Farm 1')
    unmount()
    render(<>{roadmapGoalChip({ roadmap_group_task_id: 't1', checklist_tech_tree_group_tasks: null })}</>)
    expect(screen.getByText('⛰ goal').getAttribute('title')).toBe('roadmap goal')
  })

  it('with a door it is a press that opens the task and keeps the row’s own press out of it', () => {
    const onOpen = vi.fn()
    const onRow = vi.fn()
    render(<div onClick={onRow}>{roadmapGoalChip({ roadmap_group_task_id: 't1', checklist_tech_tree_group_tasks: embed('Stage Two', 'Farm 1') as never }, onOpen, { wrap: true })}</div>)
    const press = screen.getByRole('button', { name: 'Stage Two' })
    expect(press.getAttribute('title')).toBe('Farm 1 · Stage Two — see where this task fits in the roadmap')
    // The bar placement wraps a long stage name.
    expect(press.style.whiteSpace).toBe('normal')
    fireEvent.click(press)
    expect(onOpen).toHaveBeenCalledWith('t1')
    expect(onRow).not.toHaveBeenCalled()
  })
})
