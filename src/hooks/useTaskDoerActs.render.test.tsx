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

type HandOn = (instanceId: string, toUserId: string, reason?: string | null, fromUserId?: string | null) => Promise<string | null>
const PEOPLE = [
  { id: 'u-hal', name: 'Hal' },
  { id: 'u-imani', name: 'Imani' },
  { id: 'u-me', name: 'Theo' },
]
type SayStuck = (a: { instanceId: string; userId: string; kind: 'stuck' | 'unstuck'; words: string }) => Promise<string | null>
function Host({ target, moveDay, drop = async () => null, sayStuck = async () => null, handOn = async () => null, tellGiver, onChanged, authUserId = 'u-me' }: { handOn?: HandOn; target: TaskDoerActsTarget; moveDay: (id: string, ymd: string) => Promise<string | null>; drop?: (id: string, reason: string) => Promise<string | null>; sayStuck?: SayStuck; tellGiver: (a: { giverId: string | null; instanceId: string; title: string; body: string }) => Promise<void>; onChanged: () => void; authUserId?: string }) {
  const doer = useTaskDoerActs({ authUserId, todayYmd: '2026-11-16', onChanged, moveDay, drop, sayStuck, handOn, loadPeople: async () => ({ people: PEOPLE, error: null }), tellGiver, nameOf: async () => 'Theo' })
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
  it('a task that repeats offers Can\'t do it alone, and one that is done has no More', () => {
    const { unmount } = render(<Host target={{ ...TASK, once: false }} moveDay={vi.fn()} tellGiver={vi.fn()} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    expect(screen.getByRole('button', { name: /Can't do it/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Not today/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /No longer applies/ })).toBeNull()
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

  it('Can\'t do it: a reason frees a press that names who is told, writes the stuck line, tells the giver and re-reads', async () => {
    const sayStuck = vi.fn<SayStuck>(async () => null)
    const tellGiver = vi.fn(async (_a: { giverId: string | null; instanceId: string; title: string; body: string }) => {})
    const onChanged = vi.fn()
    render(<Host target={TASK} moveDay={vi.fn()} sayStuck={sayStuck} tellGiver={tellGiver} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    fireEvent.click(screen.getByRole('button', { name: /Can't do it/ }))
    expect(screen.getByRole('dialog', { name: "Can't do it" }).textContent).toContain('What is in the way?')
    expect(document.querySelector('[data-stuck-press]')?.textContent).toBe('Say what is in the way first')
    fireEvent.click(screen.getByRole('button', { name: 'Waiting on a part' }))
    expect(document.querySelector('[data-stuck-sentence]')?.textContent).toBe('Imani is told now. The task stays yours.')
    fireEvent.click(screen.getByRole('button', { name: 'Tell Imani' }))
    await waitFor(() => expect(sayStuck).toHaveBeenCalledWith({ instanceId: 'inst-1', userId: 'u-me', kind: 'stuck', words: 'Waiting on a part' }))
    await waitFor(() => expect(tellGiver).toHaveBeenCalledTimes(1))
    expect(tellGiver.mock.calls[0]![0].body).toBe('Theo is stuck on "Give every tool a home": Waiting on a part')
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  })

  it('a stuck task offers No longer stuck, which takes the mark off in one press with no sheet', async () => {
    const sayStuck = vi.fn<SayStuck>(async () => null)
    const onChanged = vi.fn()
    render(<Host target={{ ...TASK, stuck: true }} moveDay={vi.fn()} sayStuck={sayStuck} tellGiver={vi.fn()} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    expect(screen.queryByRole('button', { name: /Can't do it/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /No longer stuck/ }))
    await waitFor(() => expect(sayStuck).toHaveBeenCalledWith({ instanceId: 'inst-1', userId: 'u-me', kind: 'unstuck', words: '' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Hand it on: Back to the giver is one press, the press names who takes it, and the taker is told', async () => {
    const handOn = vi.fn<HandOn>(async () => null)
    const tellGiver = vi.fn(async (_a: { giverId: string | null; instanceId: string; title: string; body: string }) => {})
    const onChanged = vi.fn()
    render(<Host target={TASK} moveDay={vi.fn()} handOn={handOn} tellGiver={tellGiver} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    fireEvent.click(screen.getByRole('button', { name: /Hand it on/ }))
    expect(screen.getByRole('dialog', { name: 'Hand it on' }).textContent).toContain('Who takes it?')
    expect(document.querySelector('[data-hand-press]')?.textContent).toBe('Pick who takes it first')
    fireEvent.click(screen.getByRole('button', { name: 'Back to Imani' }))
    expect(document.querySelector('[data-hand-sentence]')?.textContent).toBe('Imani gets it with its notes and its place.')
    fireEvent.click(screen.getByRole('button', { name: 'Hand it to Imani' }))
    await waitFor(() => expect(handOn).toHaveBeenCalledWith('inst-1', 'u-imani', null))
    // the giver took it back, so one push goes out, to them as the taker
    await waitFor(() => expect(tellGiver).toHaveBeenCalledTimes(1))
    expect(tellGiver.mock.calls[0]![0]).toMatchObject({ giverId: 'u-imani', title: 'A task was handed to you' })
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
  })

  it('Hand it on: someone else is found by name, a reason rides along, and the giver hears too', async () => {
    const handOn = vi.fn<HandOn>(async () => null)
    const tellGiver = vi.fn(async (_a: { giverId: string | null; instanceId: string; title: string; body: string }) => {})
    render(<Host target={TASK} moveDay={vi.fn()} handOn={handOn} tellGiver={tellGiver} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    fireEvent.click(screen.getByRole('button', { name: /Hand it on/ }))
    // the person handing it on is never offered, and the giver has their own press
    await waitFor(() => expect(document.querySelector('[data-hand-person="u-hal"]')).toBeTruthy())
    expect(document.querySelector('[data-hand-person="u-me"]')).toBeNull()
    expect(document.querySelector('[data-hand-person="u-imani"]')).toBeNull()
    fireEvent.change(screen.getByLabelText('Find a person'), { target: { value: 'ha' } })
    fireEvent.click(document.querySelector('[data-hand-person="u-hal"]') as HTMLElement)
    expect(document.querySelector('[data-hand-sentence]')?.textContent).toBe('Hal gets it with its notes and its place. Imani is told.')
    fireEvent.change(screen.getByLabelText('Why'), { target: { value: ' Wrong  crew ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hand it to Hal' }))
    await waitFor(() => expect(handOn).toHaveBeenCalledWith('inst-1', 'u-hal', 'Wrong crew'))
    await waitFor(() => expect(tellGiver).toHaveBeenCalledTimes(2))
    expect(tellGiver.mock.calls.map((c) => c[0].giverId)).toEqual(['u-hal', 'u-imani'])
    expect(tellGiver.mock.calls[1]![0].body).toBe('Theo handed "Give every tool a home" to Hal.')
  })

  it('Hand it on: a refusal stays on the sheet, and a roadmap task is not offered it', async () => {
    const handOn = vi.fn<HandOn>(async () => 'That person cannot take a task in the app.')
    const { unmount } = render(<Host target={TASK} moveDay={vi.fn()} handOn={handOn} tellGiver={vi.fn()} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    fireEvent.click(screen.getByRole('button', { name: /Hand it on/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to Imani' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hand it to Imani' }))
    await screen.findByText('That person cannot take a task in the app.')
    expect(screen.getByRole('dialog', { name: 'Hand it on' })).toBeTruthy()
    unmount()
    render(<Host target={{ ...TASK, roadmap: true }} moveDay={vi.fn()} tellGiver={vi.fn()} onChanged={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }))
    expect(screen.queryByRole('button', { name: /Hand it on/ })).toBeNull()
  })

  describe('the pass', () => {
    const THREE: TaskDoerActsTarget[] = [
      { ...TASK, instanceId: 'i1', title: 'Give every tool a home', meta: 'given Thu, Aug 20 · 88 days' },
      { ...TASK, instanceId: 'i2', title: 'Set a marker at every mile' },
      { ...TASK, instanceId: 'i3', title: 'Clear the back half of the floor' },
    ]
    function PassHost(p: { moveDay?: (id: string, ymd: string) => Promise<string | null>; drop?: (id: string, reason: string) => Promise<string | null>; markDone?: (id: string) => Promise<void>; onChanged?: () => void }) {
      const doer = useTaskDoerActs({ authUserId: 'u-me', todayYmd: '2026-11-16', onChanged: p.onChanged ?? (() => {}), moveDay: p.moveDay ?? (async () => null), drop: p.drop ?? (async () => null), sayStuck: async () => null, markDone: p.markDone, tellGiver: async () => {}, nameOf: async () => 'Theo' })
      return (
        <div>
          <button type="button" onClick={() => doer.startPass(THREE)}>
            start
          </button>
          {doer.sheets}
        </div>
      )
    }

    it('asks about one task at a time, counts what an answer changed, and ends by saying what it came to', async () => {
      const markDone = vi.fn(async (_id: string) => {})
      const drop = vi.fn(async (_id: string, _reason: string) => null)
      render(<PassHost markDone={markDone} drop={drop} />)
      fireEvent.click(screen.getByRole('button', { name: 'start' }))
      expect(screen.getByRole('dialog', { name: 'Go through the old ones' })).toBeTruthy()
      expect(document.querySelector('[data-pass-count]')?.textContent).toBe('1 of 3')
      expect(document.querySelector('[data-pass-task]')?.textContent).toBe('Give every tool a home')
      expect(screen.getByText('given Thu, Aug 20 · 88 days')).toBeTruthy()
      // Done marks it done by the tick's own path
      fireEvent.click(document.querySelector('[data-pass-answer="done"]') as HTMLElement)
      await waitFor(() => expect(markDone).toHaveBeenCalledWith('i1'))
      await waitFor(() => expect(document.querySelector('[data-pass-count]')?.textContent).toBe('2 of 3'))
      // No longer applies opens that tool's own sheet over the pass, and its close moves the pass on
      fireEvent.click(document.querySelector('[data-pass-answer="drop"]') as HTMLElement)
      expect(screen.getByRole('dialog', { name: 'No longer applies' }).textContent).toContain('Set a marker at every mile')
      fireEvent.click(screen.getByRole('button', { name: 'Plans changed' }))
      fireEvent.click(screen.getByRole('button', { name: 'Close this task' }))
      await waitFor(() => expect(drop).toHaveBeenCalledWith('i2', 'Plans changed'))
      await waitFor(() => expect(document.querySelector('[data-pass-count]')?.textContent).toBe('3 of 3'))
      // Skip leaves the last one as it is
      fireEvent.click(document.querySelector('[data-pass-answer="skip"]') as HTMLElement)
      await waitFor(() => expect(document.querySelector('[data-pass-summary]')?.textContent).toBe('You sorted 2. 1 is as it was.'))
      fireEvent.click(screen.getByRole('button', { name: 'Back to my list' }))
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('a tool\'s sheet closed with nothing done brings the same question back', async () => {
      const moveDay = vi.fn(async (_id: string, _ymd: string) => null)
      render(<PassHost moveDay={moveDay} />)
      fireEvent.click(screen.getByRole('button', { name: 'start' }))
      fireEvent.click(document.querySelector('[data-pass-answer="move"]') as HTMLElement)
      expect(screen.getByRole('dialog', { name: 'Not today' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.getByRole('dialog', { name: 'Go through the old ones' })).toBeTruthy()
      expect(document.querySelector('[data-pass-count]')?.textContent).toBe('1 of 3')
      expect(moveDay).not.toHaveBeenCalled()
    })

    it('a Done that fails keeps the task in hand and says so', async () => {
      render(<PassHost markDone={async () => Promise.reject(new Error('no'))} />)
      fireEvent.click(screen.getByRole('button', { name: 'start' }))
      fireEvent.click(document.querySelector('[data-pass-answer="done"]') as HTMLElement)
      await screen.findByText('The task did not mark done. Try it from the list.')
      expect(document.querySelector('[data-pass-count]')?.textContent).toBe('1 of 3')
    })
  })
})
