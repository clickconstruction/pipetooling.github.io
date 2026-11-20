// @vitest-environment jsdom
/**
 * The Checklist's Waiting For section (Today tab) starts folded. It is what will be the person's once someone else's
 * step is done, so it is reference and not work, and open it could run longer than the day's own tasks. Folded it is
 * one row with the count, and a press opens it to the whole list and folds it again.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChecklistWaitingForFold, type WaitingGroup } from './ChecklistComingUpSection'
import { TaskLookGate } from './TaskLookGate'

const GROUPS: WaitingGroup[] = [
  {
    blockerId: 'b1',
    blockerTitle: 'get measurment of foam thickness so i know what wood to buy',
    blockerNames: [],
    stageTitle: 'Workout Facility',
    tasks: [
      { taskId: 't1', title: 'before mounting the board coat everything', queued: false },
      { taskId: 't2', title: 'mount lights in the right places', queued: true },
      { taskId: 't3', title: 'wire and secure the lights', queued: true },
      { taskId: 't4', title: 'pug the pegboard on top', queued: true },
    ],
  },
  {
    blockerId: 'b2',
    blockerTitle: 'cut the trees on the straight',
    blockerNames: ['Michael'],
    stageTitle: 'Concrete the great views',
    tasks: [{ taskId: 't5', title: 'add concrete with Michael', queued: false }],
  },
]

const row = () => screen.getByRole('button', { name: /Waiting For/ })

describe('ChecklistWaitingForFold', () => {
  it('draws nothing when nothing waits', () => {
    const { container } = render(<ChecklistWaitingForFold groups={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('starts folded: one row with the count and a peek, and no task of the list', () => {
    render(<ChecklistWaitingForFold groups={GROUPS} />)
    expect(document.querySelector('[data-waiting-for]')?.getAttribute('data-waiting-for')).toBe('folded')
    expect(row().getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('[data-waiting-for-count]')?.textContent).toBe('5 tasks behind 2 steps')
    expect(row().textContent).toContain('after "get measurment of foam thickness so i know w…" — not staffed yet')
    expect(row().textContent).toContain('⌄')
    expect(screen.queryByText('add concrete with Michael')).toBeNull()
    expect(screen.queryByText('Michael')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('the row is a press a thumb can hit', () => {
    render(<ChecklistWaitingForFold groups={GROUPS} />)
    expect(row().style.minHeight).toBe('44px')
    expect(row().style.width).toBe('100%')
  })

  it('a press opens it to the whole list, and a second press folds it again', () => {
    render(<ChecklistWaitingForFold groups={GROUPS} />)
    fireEvent.click(row())
    expect(document.querySelector('[data-waiting-for]')?.getAttribute('data-waiting-for')).toBe('open')
    expect(row().getAttribute('aria-expanded')).toBe('true')
    expect(row().textContent).toContain('yours, once the step ahead clears')
    expect(row().textContent).toContain('⌃')
    expect(document.querySelector('[data-waiting-for-count]')).toBeNull()
    expect(screen.getByText('add concrete with Michael')).toBeTruthy()
    expect(screen.getByText('wire and secure the lights')).toBeTruthy()
    expect(screen.getByText('Michael')).toBeTruthy()
    expect(screen.getByText('not staffed yet')).toBeTruthy()
    const list = document.getElementById(row().getAttribute('aria-controls') ?? '')
    expect(list?.textContent).toContain('add concrete with Michael')

    fireEvent.click(row())
    expect(row().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('add concrete with Michael')).toBeNull()
    expect(document.querySelector('[data-waiting-for-count]')?.textContent).toBe('5 tasks behind 2 steps')
  })

  it('is folded again on the next load: nothing is remembered', () => {
    const first = render(<ChecklistWaitingForFold groups={GROUPS} />)
    fireEvent.click(row())
    expect(row().getAttribute('aria-expanded')).toBe('true')
    first.unmount()
    render(<ChecklistWaitingForFold groups={GROUPS} />)
    expect(row().getAttribute('aria-expanded')).toBe('false')
  })

  it('opens inside a look at another person’s Task Mode, where only a fold may be pressed', () => {
    render(
      <TaskLookGate>
        <ChecklistWaitingForFold groups={GROUPS} />
      </TaskLookGate>,
    )
    fireEvent.click(row())
    expect(row().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('add concrete with Michael')).toBeTruthy()
  })
})
