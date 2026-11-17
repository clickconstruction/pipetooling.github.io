// @vitest-environment jsdom
/**
 * The doer's tools on a page (punch list #369, step C3): ⋯ More per task, Not today behind it, the giver told and the
 * page re-read once the task has moved.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useTaskDoerActs, type TaskDoerActsTarget } from './useTaskDoerActs'

vi.mock('./useIsMobile', () => ({ useIsMobile: () => true }))

const TASK: TaskDoerActsTarget = { instanceId: 'inst-1', title: 'Give every tool a home', once: true, roadmap: false, vehicle: false, done: false, giverId: 'u-imani', giverName: 'Imani', dueYmd: null }

function Host({ target, moveDay, drop = async () => null, tellGiver, onChanged, authUserId = 'u-me' }: { target: TaskDoerActsTarget; moveDay: (id: string, ymd: string) => Promise<string | null>; drop?: (id: string, reason: string) => Promise<string | null>; tellGiver: (a: { giverId: string | null; instanceId: string; title: string; body: string }) => Promise<void>; onChanged: () => void; authUserId?: string }) {
  const doer = useTaskDoerActs({ authUserId, todayYmd: '2026-11-16', onChanged, moveDay, drop, tellGiver, nameOf: async () => 'Theo' })
  return (
    <div>
      {doer.morePress(target)}
      {doer.sheets}
    </div>
  )
}

function setup(over: { target?: Partial<TaskDoerActsTarget>; refuse?: string | null; authUserId?: string } = {}) {
  const moveDay = vi.fn(async (_id: string, _ymd: string) => over.refuse ?? null)
  const tellGiver = vi.fn(async (_a: { giverId: string | null; instanceId: string; title: string; body: string }) => {})
  const onChanged = vi.fn()
  render(<Host target={{ ...TASK, ...over.target }} moveDay={moveDay} tellGiver={tellGiver} onChanged={onChanged} authUserId={over.authUserId} />)
  return { moveDay, tellGiver, onChanged }
}

describe('useTaskDoerActs', () => {
  it('a task that repeats, or one that is done, has no More', () => {
    const { unmount } = render(<Host target={{ ...TASK, once: false }} moveDay={vi.fn()} tellGiver={vi.fn()} onChanged={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '⋯ More' })).toBeNull()
    unmount()
    render(<Host target={{ ...TASK, done: true }} moveDay={vi.fn()} tellGiver={vi.fn()} onChanged={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '⋯ More' })).toBeNull()
  })

  it('More lists Not today, which opens its sheet with a dead press that says what is missing', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    expect(screen.getByRole('dialog', { name: 'More for this task' }).textContent).toContain('Give every tool a home')
    fireEvent.click(screen.getByRole('button', { name: /Not today/ }))
    expect(screen.getByRole('dialog', { name: 'Not today' })).toBeTruthy()
    const press = screen.getByRole('button', { name: 'Pick a day first' }) as HTMLButtonElement
    expect(press.disabled).toBe(true)
  })

  it('Tomorrow names the day on the press and in the sentence, moves the task, tells the giver and re-reads the page', async () => {
    const { moveDay, tellGiver, onChanged } = setup()
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    fireEvent.click(screen.getByRole('button', { name: /Not today/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
    expect(document.querySelector('[data-move-day-sentence]')?.textContent).toMatch(/^It moves to .+\. Imani is told\.$/)
    const press = document.querySelector('[data-move-day-press]') as HTMLButtonElement
    expect(press.textContent).toMatch(/^Move it to /)
    fireEvent.click(press)
    await waitFor(() => expect(moveDay).toHaveBeenCalledWith('inst-1', '2026-11-17'))
    await waitFor(() => expect(tellGiver).toHaveBeenCalledTimes(1))
    expect(tellGiver.mock.calls[0]![0]).toMatchObject({ giverId: 'u-imani', instanceId: 'inst-1', title: 'A task was moved' })
    expect(tellGiver.mock.calls[0]![0].body).toMatch(/^Theo moved "Give every tool a home" to /)
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('Pick a day opens the date box, and a day gone by keeps the press dead with the reason', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    fireEvent.click(screen.getByRole('button', { name: /Not today/ }))
    expect(screen.queryByLabelText('The day')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Pick a day' }))
    fireEvent.change(screen.getByLabelText('The day'), { target: { value: '2026-11-10' } })
    expect(document.querySelector('[data-move-day-sentence]')?.textContent).toBe('Pick today or a later day.')
    expect((document.querySelector('[data-move-day-press]') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('The day'), { target: { value: '2026-11-20' } })
    expect((document.querySelector('[data-move-day-press]') as HTMLButtonElement).disabled).toBe(false)
  })

  it('a refusal keeps the sheet open with the database\'s words, and nobody is told', async () => {
    const { tellGiver, onChanged } = setup({ refuse: 'Only a one-time task can be moved to another day.' })
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    fireEvent.click(screen.getByRole('button', { name: /Not today/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }))
    fireEvent.click(document.querySelector('[data-move-day-press]') as HTMLButtonElement)
    await screen.findByText('Only a one-time task can be moved to another day.')
    expect(screen.getByRole('dialog', { name: 'Not today' })).toBeTruthy()
    expect(tellGiver).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('a task the person gave themself tells nobody, and its sentence names nobody', async () => {
    const { moveDay, tellGiver } = setup({ target: { giverId: 'u-me', giverName: 'Theo' } })
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    fireEvent.click(screen.getByRole('button', { name: /Not today/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Monday' }))
    expect(document.querySelector('[data-move-day-sentence]')?.textContent).toMatch(/^It moves to [^.]+\.$/)
    fireEvent.click(document.querySelector('[data-move-day-press]') as HTMLButtonElement)
    await waitFor(() => expect(moveDay).toHaveBeenCalledWith('inst-1', '2026-11-23'))
    expect(tellGiver).not.toHaveBeenCalled()
  })

  it('No longer applies: a ready-made reason frees the press, closes the task, tells the giver and re-reads the page', async () => {
    const drop = vi.fn(async (_id: string, _reason: string) => null)
    const tellGiver = vi.fn(async (_a: { giverId: string | null; instanceId: string; title: string; body: string }) => {})
    const onChanged = vi.fn()
    render(<Host target={TASK} moveDay={vi.fn()} drop={drop} tellGiver={tellGiver} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    fireEvent.click(screen.getByRole('button', { name: /No longer applies/ }))
    expect(screen.getByRole('dialog', { name: 'No longer applies' })).toBeTruthy()
    expect((document.querySelector('[data-drop-press]') as HTMLButtonElement).disabled).toBe(true)
    expect(document.querySelector('[data-drop-press]')?.textContent).toBe('Say why first')
    fireEvent.click(screen.getByRole('button', { name: 'Plans changed' }))
    expect(document.querySelector('[data-drop-sentence]')?.textContent).toBe('It leaves your list. Imani is told and can put it back.')
    fireEvent.click(screen.getByRole('button', { name: 'Close this task' }))
    await waitFor(() => expect(drop).toHaveBeenCalledWith('inst-1', 'Plans changed'))
    await waitFor(() => expect(tellGiver).toHaveBeenCalledTimes(1))
    expect(tellGiver.mock.calls[0]![0].body).toBe('Theo closed "Give every tool a home" as no longer applying: Plans changed')
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('No longer applies: typed words are tidied, and a refusal stays on the sheet', async () => {
    const drop = vi.fn(async (_id: string, _reason: string) => 'This task belongs to a roadmap, and its lead takes it off there. Say why in a note.')
    const onChanged = vi.fn()
    render(<Host target={TASK} moveDay={vi.fn()} drop={drop} tellGiver={vi.fn()} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    fireEvent.click(screen.getByRole('button', { name: /No longer applies/ }))
    fireEvent.change(screen.getByLabelText('Why it no longer applies'), { target: { value: '  The shelf  came down ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Close this task' }))
    await waitFor(() => expect(drop).toHaveBeenCalledWith('inst-1', 'The shelf came down'))
    await screen.findByText(/belongs to a roadmap/)
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('a roadmap task is offered Not today and no close', () => {
    render(<Host target={{ ...TASK, roadmap: true }} moveDay={vi.fn()} tellGiver={vi.fn()} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    expect(screen.getByRole('button', { name: /Not today/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /No longer applies/ })).toBeNull()
  })
})
