// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 9a: the job's own work, an inspection and the dates to meet, on main's test
 * state. A pass is a record. A failure moves the inspection and what waits on it, and one someone else beat keeps the
 * person's words and reads again. The job's own work goes on with what it waits on and holds up, and its form's buttons
 * mark it done or take it off. A milestone is added, moved and taken off. Since 9b, a wait added, stepped, given a new
 * day and taken off, and a new baseline.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcAddOwnWork, GcBaseline, GcInspectionCheck, GcMilestones, GcOwnWorkButtons, GcWaits } from './GcScheduleCards'
import { nextBaselineName } from '../../lib/gc/schedule/baseline'
import { waitRows } from '../../lib/gc/schedule/waits'
import { addDays } from '../../lib/gc/building'
import { scheduleMeasures } from '../../lib/gc/schedule/schedule'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { InspectionFailure, ScheduleActivity, ScheduleWait } from '../../lib/gc/schedule/types'
import { SCHEDULE_CHANGED } from '../../lib/gc/schedule/versionRefusal'
import { checkSupabaseError } from '../../utils/errorHandling'

afterEach(cleanup)

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const roughIn = fairOaks.schedule!.activities.find((a) => a.lineId === 'fairoaksd-insp-roughin')!

/** A plan write's refusal as the io throws it: the phrase, and the change saved since. */
function refusal(): unknown {
  const details = JSON.stringify({ read: 3, version: 4, changes: [{ version: 4, at: '2026-11-02T20:14:00+00:00', by: null, name: 'Ann', words: 'Ann moved Lighting.' }] })
  try {
    checkSupabaseError({ data: null, status: 400, error: { code: 'P0001', message: SCHEDULE_CHANGED, details, hint: null } }, 'record the inspection')
  } catch (e) {
    return e
  }
  throw new Error('no refusal')
}

/** It failed, with what failed and a re-inspection day. */
function failIt(note: string) {
  fireEvent.click(screen.getByRole('button', { name: 'It failed' }))
  fireEvent.change(screen.getByRole('textbox'), { target: { value: note } })
  fireEvent.change(screen.getByDisplayValue(addDays(s.today, 3)), { target: { value: '2026-11-02' } })
  fireEvent.click(screen.getByRole('button', { name: 'Record the failure' }))
}

describe('an inspection in the bar’s form', () => {
  it('passes today, a record', async () => {
    const onPass = vi.fn(() => Promise.resolve())
    render(<GcInspectionCheck project={fairOaks} activity={roughIn} today={s.today} onPass={onPass} onFail={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'It passed today' }))
    await waitFor(() => expect(onPass).toHaveBeenCalledTimes(1))
  })

  it('records a failure only with what failed, and sends the bars as it leaves them with the log’s line', async () => {
    const onFail = vi.fn((_failure: InspectionFailure, _activities: ScheduleActivity[], _words: string) => Promise.resolve())
    render(<GcInspectionCheck project={fairOaks} activity={roughIn} today={s.today} onPass={vi.fn()} onFail={onFail} />)
    fireEvent.click(screen.getByRole('button', { name: 'It failed' }))
    expect((screen.getByRole('button', { name: 'Record the failure' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))
    failIt('The bonding jumper is missing.')
    await waitFor(() => expect(onFail).toHaveBeenCalledTimes(1))
    const [failure, activities, words] = onFail.mock.calls[0]!
    expect(failure).toMatchObject({ on: s.today, note: 'The bonding jumper is missing.', reinspectOn: '2026-11-02' })
    expect(activities.find((a) => a.lineId === roughIn.lineId)).toMatchObject({ start: '2026-11-02', finish: '2026-11-03' })
    expect(words).toMatch(/^The rough-in inspection failed on .*Re-inspection Mon Nov 2\. 2 activities after it move out\.$/)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Record the failure' })).toBeNull())
  })

  it('stays open with the person’s words when someone saved first, says what they changed, and reads again', async () => {
    const onFail = vi.fn().mockRejectedValueOnce(refusal())
    const onReload = vi.fn()
    render(<GcInspectionCheck project={fairOaks} activity={roughIn} today={s.today} onPass={vi.fn()} onFail={onFail} onReload={onReload} />)
    failIt('The bonding jumper is missing.')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain(SCHEDULE_CHANGED)
    expect(alert.textContent).toContain('Ann moved Lighting.')
    expect(alert.textContent).toContain('Nothing was saved. The chart shows the new dates now. Try it again on them.')
    expect(onReload).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('The bonding jumper is missing.')
  })
})

describe('the job’s own work (G-38)', () => {
  const items = scheduleMeasures(s, fairOaks).items

  it('goes on the schedule with what it waits on and what it holds up, and the card closes', async () => {
    const onAdd = vi.fn((_activities: ScheduleActivity[], _words: string) => Promise.resolve())
    render(<GcAddOwnWork project={fairOaks} items={items} today={s.today} by="Robert" onAdd={onAdd} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add an activity' }))
    fireEvent.change(screen.getByLabelText('What it is'), { target: { value: 'Slab cure' } })
    fireEvent.change(screen.getByLabelText('The day it starts'), { target: { value: '2026-10-05' } })
    fireEvent.change(screen.getByLabelText('The day it finishes'), { target: { value: '2026-10-14' } })
    fireEvent.click(screen.getAllByRole('checkbox', { name: /TPO membrane/ })[0]!)
    fireEvent.click(screen.getAllByRole('checkbox', { name: /Sheet metal and flashing/ })[1]!)
    expect(screen.getByText('What waits on it moves out if it has to.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Put it on the schedule' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
    const [activities, words] = onAdd.mock.calls[0]!
    expect(activities.find((a) => a.added)).toMatchObject({ start: '2026-10-05', finish: '2026-10-14', after: ['froof-1'], added: { label: 'Slab cure', who: 'Cure time', doneOn: null } })
    expect(activities.find((a) => a.lineId === 'froof-3')).toMatchObject({ start: '2026-10-15', finish: '2026-10-24' })
    expect(words).toMatch(/^Robert put Slab cure on .* 1 activity waits on it\./)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add an activity' })).toBeTruthy())
  })

  it('says its problem and puts nothing on the schedule with no name', () => {
    const onAdd = vi.fn()
    render(<GcAddOwnWork project={fairOaks} items={items} today={s.today} by="Robert" onAdd={onAdd} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add an activity' }))
    expect(screen.getByText('Give it a name.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Put it on the schedule' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('its form’s buttons mark it done today, not done after all, and take it off', async () => {
    const own: ScheduleActivity = { lineId: 'fairoaksd-own-1', packageId: '', start: '2026-10-05', finish: '2026-10-14', after: [], added: { label: 'Slab cure', who: 'Cure time', doneOn: null } }
    const onDone = vi.fn(() => Promise.resolve())
    const onRemove = vi.fn(() => Promise.resolve())
    const view = render(<GcOwnWorkButtons activity={own} today={s.today} onDone={onDone} onRemove={onRemove} />)
    expect(screen.getByText('Cure time. Nobody reports it: mark it here.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mark it done today' }))
    await waitFor(() => expect(onDone).toHaveBeenLastCalledWith(s.today))
    view.rerender(<GcOwnWorkButtons activity={{ ...own, added: { ...own.added!, doneOn: s.today } }} today={s.today} onDone={onDone} onRemove={onRemove} />)
    fireEvent.click(screen.getByRole('button', { name: 'Not done after all' }))
    await waitFor(() => expect(onDone).toHaveBeenLastCalledWith(null))
    fireEvent.click(screen.getByRole('button', { name: 'Take it off the schedule' }))
    await waitFor(() => expect(onRemove).toHaveBeenCalledTimes(1))
  })
})

describe('the dates to meet', () => {
  it('adds a milestone, moves one and takes one off, each a record', async () => {
    const onSave = vi.fn(() => Promise.resolve())
    const onRemove = vi.fn(() => Promise.resolve())
    render(<GcMilestones project={fairOaks} milestones={fairOaks.schedule!.milestones} onSave={onSave} onRemove={onRemove} />)
    fireEvent.change(screen.getByLabelText('New milestone'), { target: { value: 'Storefront glazed' } })
    fireEvent.change(screen.getByLabelText('New milestone’s day'.replace('’', "'")), { target: { value: '2026-11-06' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ label: 'Storefront glazed', planned: '2026-11-06', packageId: null, metOn: null })))
    await waitFor(() => expect((screen.getByLabelText('New milestone') as HTMLInputElement).value).toBe(''))
    fireEvent.change(screen.getByLabelText('Substantial completion day'), { target: { value: '2026-12-18' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' }).find((b) => !(b as HTMLButtonElement).disabled)!)
    await waitFor(() => expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'fo-substantial', planned: '2026-12-18' })))
    fireEvent.click(screen.getAllByRole('button', { name: 'Take off' })[0]!)
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('fo-slab'))
  })
})

describe('what the work waits on (PR 9b)', () => {
  const items = scheduleMeasures(s, fairOaks).items
  function waits() {
    const onAdd = vi.fn((_wait: ScheduleWait) => Promise.resolve())
    const onStep = vi.fn((_id: string, _step: string, _on: string, _note?: string) => Promise.resolve())
    const onRemove = vi.fn((_id: string) => Promise.resolve())
    render(<GcWaits state={s} project={fairOaks} rows={waitRows(s, fairOaks)} items={items} onAdd={onAdd} onStep={onStep} onRemove={onRemove} />)
    return { onAdd, onStep, onRemove }
  }

  it('adds a permit with its name, its day and the work it holds, a record', async () => {
    const { onAdd } = waits()
    fireEvent.click(screen.getByRole('button', { name: 'Add one' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'What kind of wait' })).getByRole('button', { name: 'A permit' }))
    fireEvent.change(screen.getByLabelText('What it is'), { target: { value: 'Electrical service permit' } })
    fireEvent.change(screen.getByLabelText('Whose work it is for'), { target: { value: 'felec' } })
    expect(screen.getByText('Say when it is expected.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('The day it is expected'), { target: { value: '2026-10-16' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Fire alarm/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Put it on the schedule' }))
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1))
    expect(onAdd.mock.calls[0]![0]).toMatchObject({ kind: 'permit', title: 'Electrical service permit', packageId: 'felec', lineIds: ['felec-4'], expectedOn: '2026-10-16', askedOn: null, doneOn: null })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add one' })).toBeTruthy())
  })

  it('marks a wait’s next step today, gives it a new expected day with who said so, and takes it off, each a record', async () => {
    const { onStep, onRemove } = waits()
    const units = document.querySelector('[data-gc-wait="fairoaksd-wait-1"]') as HTMLElement
    fireEvent.click(within(units).getByRole('button', { name: 'Shipped today' }))
    await waitFor(() => expect(onStep).toHaveBeenCalledWith('fairoaksd-wait-1', 'shipped', s.today))
    fireEvent.click(within(units).getByRole('button', { name: 'A new expected day' }))
    fireEvent.change(within(units).getByLabelText('The new expected day'), { target: { value: '2026-10-27' } })
    fireEvent.change(within(units).getByLabelText('Who said the new day'), { target: { value: 'Carrier, on the phone' } })
    fireEvent.click(within(units).getByRole('button', { name: 'Save the day' }))
    await waitFor(() => expect(onStep).toHaveBeenLastCalledWith('fairoaksd-wait-1', 'expected', '2026-10-27', 'Carrier, on the phone'))
    await waitFor(() => expect((within(units).getByRole('button', { name: 'Take it off' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(within(units).getByRole('button', { name: 'Take it off' }))
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('fairoaksd-wait-1'))
  })
})

describe('the baseline (PR 9b)', () => {
  it('offers the next name and takes the plan as it stands with why, a plan write with its line', async () => {
    const onBaseline = vi.fn((_name: string, _why: string, _words: string) => Promise.resolve())
    render(<GcBaseline project={fairOaks} today={s.today} by="Robert" onBaseline={onBaseline} />)
    fireEvent.click(screen.getByRole('button', { name: 'Set a new baseline' }))
    const offered = nextBaselineName(fairOaks, s.today)
    expect((screen.getByLabelText("The new baseline's name") as HTMLInputElement).value).toBe(offered)
    fireEvent.change(screen.getByLabelText('Why a new baseline'), { target: { value: 'Change order 2 added a canopy' } })
    fireEvent.click(screen.getByRole('button', { name: 'Take the plan as it stands' }))
    await waitFor(() => expect(onBaseline).toHaveBeenCalledTimes(1))
    expect(onBaseline.mock.calls[0]).toEqual([offered, 'Change order 2 added a canopy', `Robert set a new baseline on ${fairOaks.name}, ${offered}: Change order 2 added a canopy. The plan at Start is kept.`])
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Take the plan as it stands' })).toBeNull())
  })

  it('stays open when someone saved first, says what they changed, and reads again', async () => {
    const onBaseline = vi.fn().mockRejectedValueOnce(refusal())
    const onReload = vi.fn()
    render(<GcBaseline project={fairOaks} today={s.today} by="Robert" onBaseline={onBaseline} onReload={onReload} />)
    fireEvent.click(screen.getByRole('button', { name: 'Set a new baseline' }))
    fireEvent.click(screen.getByRole('button', { name: 'Take the plan as it stands' }))
    expect((await screen.findByRole('alert')).textContent).toContain(SCHEDULE_CHANGED)
    expect(onReload).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Take the plan as it stands' })).toBeTruthy()
  })
})
