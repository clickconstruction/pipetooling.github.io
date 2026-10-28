// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 12a: schedule templates (G-44) on main's test state, the Templates card and
 * Start from a template rendered alone with their presses stood in for. Ported from the prototype's render test
 * (branch spike/gc-mode, `GcScheduleTemplates.render.test.tsx`), whose presses went through its reducer; here each is
 * a callback, and the Schedule window's tests send them. Since #204 (PR 3 and PR 5) the card saves and opens the Templates
 * page, where every template is listed, renamed and set aside; a template with rows says D3's lines on the pick.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
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

function Card({ state = s, onSave = vi.fn(async () => {}) }: { state?: GcState; onSave?: (name: string) => Promise<void> }) {
  return (
    <MemoryRouter>
      <GcTemplatesCard state={state} project={job(state, 'fairoaksd')} onSave={onSave} />
    </MemoryRouter>
  )
}

/** Start from a template on a job's first draft, holding what is picked as the draft card does. */
function Pick({ state, id }: { state: GcState; id: string }) {
  const project = job(state, id)
  const [value, setValue] = useState('')
  return <GcTemplatePick project={project} start={draftStart(project, state.today)} offered={state.scheduleTemplates ?? []} value={value} onChange={setValue} />
}

describe('the Templates card (PR 12a, G-44; a door since #204)', () => {
  it('saves Fair Oaks D’s schedule under its name, a record', async () => {
    const onSave = vi.fn(async () => {})
    render(<Card onSave={onSave} />)
    expect(within(card()).getByText('It keeps no dates, companies, percents or moves.')).toBeTruthy()
    expect((within(card()).getByRole('textbox', { name: "The template's name" }) as HTMLInputElement).value).toBe('Fair Oaks Shops, Building D')
    fireEvent.click(within(card()).getByRole('button', { name: 'Save as a template' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Fair Oaks Shops, Building D'))
  })

  it('refuses a name a template has, and opens the Templates page for the rest', () => {
    render(<Card state={withTemplate()} />)
    expect(within(card()).getByText('Another template has that name.')).toBeTruthy()
    expect((within(card()).getByRole('button', { name: 'Save as a template' }) as HTMLButtonElement).disabled).toBe(true)
    expect(within(card()).getByRole('link', { name: 'Open the Templates page' }).getAttribute('href')).toBe('/gc?view=templates')
    expect(card().querySelector('[data-template]')).toBeNull()
  })

  it('says why a save did not go, in words', async () => {
    render(<Card onSave={vi.fn(async () => Promise.reject(new Error('Another template has that name.')))} />)
    fireEvent.click(within(card()).getByRole('button', { name: 'Save as a template' }))
    const alert = await within(card()).findByRole('alert')
    expect(alert.textContent).toBe('Another template has that name.')
    expect(plainWordsFailures(alert.textContent ?? '')).toEqual([])
  })
})

describe('Start from a template (PR 12a, G-44)', () => {
  it('offers it on Helotes Dental Office’s first draft and says what will land before anything is drawn (#204, D3)', () => {
    render(<Pick state={withTemplate()} id="helotes" />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Start from a template' }), { target: { value: 'tpl-1' } })
    const fit = document.querySelector('[data-rows-fit]')
    expect(fit).toBeTruthy()
    const text = fit?.textContent ?? ''
    for (const label of ['Rows', 'Trades', 'Our crew', 'Office', 'Milestones', 'Not in it']) expect(text).toContain(label)
    expect(text).toMatch(/rows in \d+ phases land on this job\./)
  })

  it('says the cover for a template with lines alone, saved before the builder', () => {
    const old: ScheduleTemplate = { ...template, rows: undefined, phases: undefined, workingDays: undefined }
    render(<Pick state={withTemplate(old)} id="helotes" />)
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
