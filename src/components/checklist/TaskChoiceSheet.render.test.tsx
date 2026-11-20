// @vitest-environment jsdom
/**
 * A task's choice sheet (v2.8034, the owner's walk of 2026-11-20): the title is centred, the task is one line in a
 * quiet pill, and every row the kernel can return is drawn with its picture, which a screen reader passes over.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { TaskChoiceSheet } from './TaskChoiceSheet'
import { TaskChoiceRows } from './TaskChoiceRows'
import { TASK_MAP_START_PICTURES, TASK_MORE_PICTURES, TASK_MORE_TITLE, passAnswers, taskMapStarts, taskMoreChoices, type TaskChoice, type TaskMoreKey } from '../../lib/tasks/taskDoerActs'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))

const TASK = 'Paint the shelves white and hang the wood on the back wall'

/** Every row More can return, each once: the lists of a plain task, one picked first and a stuck one, joined. */
function everyMoreRow(): TaskChoice<TaskMoreKey>[] {
  const rows = new Map<TaskMoreKey, TaskChoice<TaskMoreKey>>()
  for (const shape of [{}, { first: true }, { stuck: true }]) for (const row of taskMoreChoices({ once: true, done: false, ...shape })) rows.set(row.key, row)
  return [...rows.values()]
}

describe('TaskChoiceSheet', () => {
  it('centres the title and names the dialog by it', () => {
    render(<TaskChoiceSheet open title={TASK_MORE_TITLE} taskTitle={TASK} choices={taskMoreChoices({ once: true, done: false })} onPick={vi.fn()} onClose={vi.fn()} labelId="more-title" />)
    const dialog = screen.getByRole('dialog', { name: 'More for this task' })
    const title = within(dialog).getByRole('heading', { name: 'More for this task' })
    expect(title.style.textAlign).toBe('center')
  })

  it('shows the task on one line in a pill, cut with an ellipsis when it is long', () => {
    render(<TaskChoiceSheet open title={TASK_MORE_TITLE} taskTitle={TASK} choices={taskMoreChoices({ once: true, done: false })} onPick={vi.fn()} onClose={vi.fn()} />)
    const pill = document.querySelector('[data-choice-task]') as HTMLElement
    expect(pill.textContent).toBe(TASK)
    const words = pill.querySelector('span') as HTMLElement
    expect(words.style.whiteSpace).toBe('nowrap')
    expect(words.style.textOverflow).toBe('ellipsis')
    // The old two muted lines under the title are gone.
    expect(screen.getByRole('dialog').querySelector('p')).toBeNull()
  })

  it('draws no pill for a task with no words', () => {
    render(<TaskChoiceSheet open title={TASK_MORE_TITLE} taskTitle="" choices={taskMoreChoices({ once: true, done: false })} onPick={vi.fn()} onClose={vi.fn()} />)
    expect(document.querySelector('[data-choice-task]')).toBeNull()
  })

  it('draws every row More can return with the picture of its key, hidden from a screen reader', () => {
    const rows = everyMoreRow()
    expect(rows.map((r) => r.key).sort()).toEqual(Object.keys(TASK_MORE_PICTURES).sort())
    render(<TaskChoiceSheet open title={TASK_MORE_TITLE} taskTitle={TASK} choices={rows} onPick={vi.fn()} onClose={vi.fn()} />)
    for (const row of rows) {
      const press = document.querySelector(`button[data-task-choice="${row.key}"]`) as HTMLButtonElement
      const picture = press.querySelector('[data-choice-picture]') as HTMLElement
      expect(picture.getAttribute('data-choice-picture')).toBe(TASK_MORE_PICTURES[row.key].icon)
      expect(picture.getAttribute('data-choice-tone')).toBe(TASK_MORE_PICTURES[row.key].tone)
      expect(picture.getAttribute('aria-hidden')).toBe('true')
      expect(picture.querySelector('svg')).toBeTruthy()
      // The row reads as its name and its line, as it did before the picture.
      expect(screen.getByRole('button', { name: `${row.label} ${row.words}` })).toBe(press)
      // A thumb's target: the row is never shorter than 44 px.
      expect(parseInt(press.style.minHeight, 10)).toBeGreaterThanOrEqual(44)
    }
  })

  it('draws each way to start a map with its picture', () => {
    render(<TaskChoiceSheet open title="A map for this task" taskTitle={TASK} choices={taskMapStarts(true)} onPick={vi.fn()} onClose={vi.fn()} />)
    for (const row of taskMapStarts(true)) {
      const picture = document.querySelector(`button[data-task-choice="${row.key}"] [data-choice-picture]`) as HTMLElement
      expect(picture.getAttribute('data-choice-picture')).toBe(TASK_MAP_START_PICTURES[row.key].icon)
    }
  })

  it('a press on a row picks its key, and Close, Escape and the backdrop close the sheet', () => {
    const onPick = vi.fn()
    const onClose = vi.fn()
    render(<TaskChoiceSheet open title={TASK_MORE_TITLE} taskTitle={TASK} choices={taskMoreChoices({ once: true, done: false })} onPick={onPick} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /Hand it on/ }))
    expect(onPick).toHaveBeenCalledWith('hand')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('presentation'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})

describe('TaskChoiceRows', () => {
  it('carries each key on the attribute it is handed, and goes dead while an answer is saved', () => {
    const onPick = vi.fn()
    render(<TaskChoiceRows choices={passAnswers({ once: true, done: false })} onPick={onPick} busy keyAttr="data-pass-answer" />)
    const done = document.querySelector('button[data-pass-answer="done"]') as HTMLButtonElement
    expect(done.disabled).toBe(true)
    expect(done.querySelector('[data-choice-picture]')?.getAttribute('data-choice-picture')).toBe('tick')
    fireEvent.click(done)
    expect(onPick).not.toHaveBeenCalled()
  })
})
