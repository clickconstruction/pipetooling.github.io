// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 12a: schedule templates (G-44) on main's test state, the Templates card and
 * Start from a template rendered alone with their presses stood in for. Ported from the prototype's render test
 * (branch spike/gc-mode, `GcScheduleTemplates.render.test.tsx`), whose presses went through its reducer; here each is
 * a callback, and the Schedule window's tests send them.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcTemplatePick, GcTemplatesCard } from './GcScheduleTemplates'
import { draftStart } from '../../lib/gc/schedule/scheduleWindow'
import { templateShape } from '../../lib/gc/schedule/templates'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { ScheduleTemplate } from '../../lib/gc/schedule/types'
import type { GcState } from '../../lib/gc/types'
import { plainWordsFailures } from '../../lib/plainWords'

afterEach(cleanup)

const s = initialGcState()
const job = (st: GcState, id: string) => st.projects.find((p) => p.id === id)!
/** Fair Oaks D saved as a template, as Save as a template keeps it. */
const template: ScheduleTemplate = { id: 'tpl-1', name: 'Fair Oaks Shops, Building D', on: s.today, by: 'Robert', ...templateShape(s, job(s, 'fairoaksd'))! }
const withTemplate = (t: ScheduleTemplate = template): GcState => ({ ...s, scheduleTemplates: [t] })
const card = () => document.querySelector('[data-tour="gc-templates"]') as HTMLElement
const row = (id = 'tpl-1') => card().querySelector(`[data-template="${id}"]`) as HTMLElement

function Card({ state = s, onSave = vi.fn(async () => {}), onRename = vi.fn(async () => {}), onSetAside = vi.fn(async () => {}) }: { state?: GcState; onSave?: (name: string) => Promise<void>; onRename?: (id: string, name: string) => Promise<void>; onSetAside?: (id: string, aside: boolean) => Promise<void> }) {
  return <GcTemplatesCard state={state} project={job(state, 'fairoaksd')} onSave={onSave} onRename={onRename} onSetAside={onSetAside} />
}

/** Start from a template on a job's first draft, holding what is picked as the draft card does. */
function Pick({ state, id }: { state: GcState; id: string }) {
  const project = job(state, id)
  const [value, setValue] = useState('')
  return <GcTemplatePick project={project} start={draftStart(project, state.today)} offered={state.scheduleTemplates ?? []} value={value} onChange={setValue} />
}

describe('the Templates card (PR 12a, G-44)', () => {
  it('saves Fair Oaks D’s schedule under its name, a record', async () => {
    const onSave = vi.fn(async () => {})
    render(<Card onSave={onSave} />)
    expect(within(card()).getByText('It keeps no dates, companies, percents or moves.')).toBeTruthy()
    expect((within(card()).getByRole('textbox', { name: "The template's name" }) as HTMLInputElement).value).toBe('Fair Oaks Shops, Building D')
    fireEvent.click(within(card()).getByRole('button', { name: 'Save as a template' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Fair Oaks Shops, Building D'))
  })

  it('lists a template: where it came from, its size and stages, and no job drawn from it yet; its name is taken', () => {
    render(<Card state={withTemplate()} />)
    expect(within(row()).getByText('Saved Fri Oct 2 from Fair Oaks Shops, Building D, with 72% of the work done.')).toBeTruthy()
    expect(within(row()).getByText('27 lines of 7 trades and its 2 inspections. 23 weeks to build there.')).toBeTruthy()
    expect(within(row()).getByText('Structure 47 days')).toBeTruthy()
    expect(within(row()).getByText('No job is drawn from it yet.')).toBeTruthy()
    // Its name is taken now, so the same one cannot be saved again.
    expect(within(card()).getByText('Another template has that name.')).toBeTruthy()
    expect((within(card()).getByRole('button', { name: 'Save as a template' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('sets it aside and brings it back, each a record', async () => {
    const onSetAside = vi.fn(async () => {})
    render(<Card state={withTemplate()} onSetAside={onSetAside} />)
    fireEvent.click(within(row()).getByRole('button', { name: 'Set it aside' }))
    await waitFor(() => expect(onSetAside).toHaveBeenCalledWith('tpl-1', true))
    cleanup()
    render(<Card state={withTemplate({ ...template, asideOn: s.today })} onSetAside={onSetAside} />)
    expect(within(row()).getByText('Set aside Fri Oct 2. New jobs are not offered it. The jobs drawn from it keep what they drew.')).toBeTruthy()
    fireEvent.click(within(row()).getByRole('button', { name: 'Bring it back' }))
    await waitFor(() => expect(onSetAside).toHaveBeenCalledWith('tpl-1', false))
  })

  it('renames it, refusing a name another template has, and closes once saved', async () => {
    const onRename = vi.fn(async () => {})
    const other: ScheduleTemplate = { ...template, id: 'tpl-2', name: 'Pad shape' }
    render(<Card state={{ ...s, scheduleTemplates: [template, other] }} onRename={onRename} />)
    fireEvent.click(within(row()).getByRole('button', { name: 'Rename' }))
    const box = within(row()).getByRole('textbox', { name: 'A new name for Fair Oaks Shops, Building D' })
    fireEvent.change(box, { target: { value: 'pad shape' } })
    expect(within(row()).getByText('Another template has that name.')).toBeTruthy()
    expect((within(row()).getByRole('button', { name: 'Save the name' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(box, { target: { value: 'Retail shell, one story' } })
    fireEvent.click(within(row()).getByRole('button', { name: 'Save the name' }))
    await waitFor(() => expect(onRename).toHaveBeenCalledWith('tpl-1', 'Retail shell, one story'))
    await waitFor(() => expect(within(row()).queryByRole('textbox')).toBeNull())
  })

  it('says why a save did not go, in words', async () => {
    render(<Card onSave={vi.fn(async () => Promise.reject(new Error('Another template has that name.')))} />)
    fireEvent.click(within(card()).getByRole('button', { name: 'Save as a template' }))
    const alert = await within(card()).findByRole('alert')
    expect(alert.textContent).toBe('Another template has that name.')
    expect(plainWordsFailures(alert.textContent ?? '')).toEqual([])
  })

  it('lists the jobs drawn from it', () => {
    const rough = { start: '2026-11-02', days: {}, by: 'Robert', on: s.today, template: { id: 'tpl-1', name: template.name, on: s.today }, like: template.lines }
    const st: GcState = { ...withTemplate(), projects: withTemplate().projects.map((p) => (p.id === 'boerne' ? { ...p, rough } : p)) }
    render(<Card state={st} />)
    expect(within(row()).getByText("Boerne Retail Shell's rough schedule, Fri Oct 2.")).toBeTruthy()
  })
})

describe('Start from a template (PR 12a, G-44)', () => {
  it('offers it on Helotes Dental Office’s first draft and says the fit before anything is drawn', () => {
    render(<Pick state={withTemplate()} id="helotes" />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Start from a template' }), { target: { value: 'tpl-1' } })
    const fit = document.querySelector('[data-template-fit]')?.textContent ?? ''
    expect(fit).toBe('The template Fair Oaks Shops, Building D covers 8 of the 17 lines here. Those run as they ran there. The other 9 take the stage days. It makes 19 weeks to build. Without it, 10 weeks.')
    expect(plainWordsFailures(fit)).toEqual([])
  })

  it('shows no template control where none is offered', () => {
    render(<Pick state={s} id="helotes" />)
    expect(screen.queryByRole('combobox', { name: 'Start from a template' })).toBeNull()
  })
})
