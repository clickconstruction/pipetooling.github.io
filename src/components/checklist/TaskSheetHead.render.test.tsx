// @vitest-environment jsdom
/**
 * The four windows behind More's choices (v2.8057): each takes the head More has, so the title is centred, the task is
 * one line in a quiet pill, the old muted lines under the title are gone, and Close still closes.
 */
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { TaskSheetHead } from './TaskSheetHead'
import { TaskMoveDaySheet } from './TaskMoveDaySheet'
import { TaskStuckSheet } from './TaskStuckSheet'
import { TaskDropSheet } from './TaskDropSheet'
import { TaskHandOnSheet } from './TaskHandOnSheet'
import { DROP_TITLE, HAND_TITLE, MOVE_DAY_TITLE, STUCK_TITLE } from '../../lib/tasks/taskDoerActs'

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))

const TASK = 'Paint the shelves white and hang the wood on the back wall'
const never = () => Promise.resolve(null)

const WINDOWS: ReadonlyArray<[name: string, title: string, draw: (onClose: () => void, taskTitle?: string) => ReactElement]> = [
  ['Not today', MOVE_DAY_TITLE, (onClose, taskTitle = TASK) => <TaskMoveDaySheet open taskTitle={taskTitle} todayYmd="2026-11-20" giverName="Sam" onMove={never} onClose={onClose} />],
  ["Can't do it", STUCK_TITLE, (onClose, taskTitle = TASK) => <TaskStuckSheet open taskTitle={taskTitle} giverName="Sam" onSay={never} onClose={onClose} />],
  ['No longer applies', DROP_TITLE, (onClose, taskTitle = TASK) => <TaskDropSheet open taskTitle={taskTitle} giverName="Sam" onDrop={never} onClose={onClose} />],
  ['Hand it on', HAND_TITLE, (onClose, taskTitle = TASK) => <TaskHandOnSheet open taskTitle={taskTitle} once selfId="me" giver={{ id: 'sam', name: 'Sam' }} people={[{ id: 'sam', name: 'Sam' }, { id: 'lee', name: 'Lee' }]} onHand={never} onClose={onClose} />],
]

describe('TaskSheetHead', () => {
  it('centres the title, shows the task on one line in a pill and closes on Close', () => {
    const onClose = vi.fn()
    render(<TaskSheetHead title="More for this task" labelId="t" taskTitle={TASK} onClose={onClose} />)
    expect(screen.getByRole('heading', { name: 'More for this task' }).style.textAlign).toBe('center')
    const pill = document.querySelector('[data-choice-task]') as HTMLElement
    expect(pill.textContent).toBe(TASK)
    expect(pill.getAttribute('title')).toBe(TASK)
    const words = pill.querySelector('span') as HTMLElement
    expect(words.style.whiteSpace).toBe('nowrap')
    expect(words.style.textOverflow).toBe('ellipsis')
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('draws no pill for a task with no words', () => {
    render(<TaskSheetHead title="More for this task" labelId="t" taskTitle="" onClose={vi.fn()} />)
    expect(document.querySelector('[data-choice-task]')).toBeNull()
  })
})

describe.each(WINDOWS)('the %s window', (_name, title, draw) => {
  it('has the head More has: a centred title naming the dialog, and the task in a one-line pill', () => {
    render(draw(vi.fn()))
    const dialog = screen.getByRole('dialog', { name: title })
    expect(within(dialog).getByRole('heading', { name: title }).style.textAlign).toBe('center')
    const pill = dialog.querySelector('[data-choice-task]') as HTMLElement
    expect(pill.textContent).toBe(TASK)
    expect((pill.querySelector('span') as HTMLElement).style.whiteSpace).toBe('nowrap')
    // The task is said once: the old muted paragraph under the title is gone.
    expect([...dialog.querySelectorAll('p')].filter((p) => p.textContent === TASK)).toEqual([])
  })

  it('closes on Close, on Escape and on the backdrop, and not on a press inside', () => {
    const onClose = vi.fn()
    render(draw(onClose))
    const dialog = screen.getByRole('dialog', { name: title })
    fireEvent.click(dialog)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(dialog.parentElement as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('draws no pill when the task has no words', () => {
    render(draw(vi.fn(), ''))
    expect(screen.getByRole('dialog', { name: title }).querySelector('[data-choice-task]')).toBeNull()
  })
})
