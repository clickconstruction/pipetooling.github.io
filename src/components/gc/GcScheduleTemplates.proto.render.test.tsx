// @vitest-environment jsdom
/**
 * Render smoke for schedule templates (G-44): the Templates card on a job being built saves one and
 * lists it, the rough while bidding and the first draft offer Start from a template with the fit said
 * before anything is drawn, and nothing is offered where there is no template.
 */
import { useReducer } from 'react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import type { GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
  }
})

/** A job's Schedule tab on a state the real reducer moves, so a save or a draw shows. */
function Tab({ start, id }: { start: GcState; id: string }) {
  const [state, dispatch] = useReducer(gcReducer, start)
  return <GcBuildingScheduleTab state={state} project={state.projects.find((p) => p.id === id)!} dispatch={dispatch} />
}

/** Fair Oaks D saved as a template, the made-up data otherwise as it is. */
const withTemplate = () => gcReducer(initialGcState(), { type: 'saveScheduleTemplate', projectId: 'fairoaksd', name: 'Fair Oaks Shops, Building D', by: 'Robert' })
const card = () => document.querySelector('[data-tour="gc-templates"]') as HTMLElement
const pick = (id: string) => fireEvent.change(screen.getByRole('combobox', { name: 'Start from a template' }), { target: { value: id } })

describe('schedule templates (G-44)', () => {
  it('saves Fair Oaks D’s schedule from its Templates card and lists it', () => {
    render(<Tab start={initialGcState()} id="fairoaksd" />)
    expect(within(card()).getByText('It keeps no dates, companies, percents or moves.')).toBeTruthy()
    expect((within(card()).getByRole('textbox', { name: "The template's name" }) as HTMLInputElement).value).toBe('Fair Oaks Shops, Building D')
    fireEvent.click(within(card()).getByRole('button', { name: 'Save as a template' }))
    const row = card().querySelector('[data-template="tpl-1"]') as HTMLElement
    expect(within(row).getByText('Saved Fri Oct 2 from Fair Oaks Shops, Building D, with 72% of the work done.')).toBeTruthy()
    expect(within(row).getByText('27 lines of 7 trades and its 2 inspections. 23 weeks to build there.')).toBeTruthy()
    expect(within(row).getByText('Structure 47 days')).toBeTruthy()
    expect(within(row).getByText('No job is drawn from it yet.')).toBeTruthy()
    // Its name is taken now, so the same one cannot be saved again.
    expect(within(card()).getByText('Another template has that name.')).toBeTruthy()
    expect((within(card()).getByRole('button', { name: 'Save as a template' }) as HTMLButtonElement).disabled).toBe(true)
    // Set aside, it says so, and comes back.
    fireEvent.click(within(row).getByRole('button', { name: 'Set it aside' }))
    expect(within(row).getByText('Set aside Fri Oct 2. New jobs are not offered it. The jobs drawn from it keep what they drew.')).toBeTruthy()
    fireEvent.click(within(row).getByRole('button', { name: 'Bring it back' }))
    expect(within(row).queryByText(/^Set aside/)).toBeNull()
  })

  it('offers it on Boerne Retail Shell’s rough, says the fit, and draws 27 weeks from it', () => {
    render(<Tab start={withTemplate()} id="boerne" />)
    pick('tpl-1')
    expect(screen.getByText('The template Fair Oaks Shops, Building D covers 27 of the 31 lines here. Those run as they ran there. The other 4 take the stage days. It makes 27 weeks to build. Without it, 14 weeks.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Draw a rough schedule' }))
    expect(screen.getByText('27 weeks to build')).toBeTruthy()
    expect(screen.getByText('Drawn from the template Fair Oaks Shops, Building D. It covers 27 of the 31 lines here.')).toBeTruthy()
    // Structure is all Fair Oaks D's lines; site prep has the fire sprinkler's design and permit, the first draft's own.
    expect(document.querySelector('[data-rough-stage="structure"]')?.textContent).toContain('from the template')
    expect(within(document.querySelector('[data-rough-stage="sitePrep"]') as HTMLElement).getByRole('spinbutton', { name: 'Site prep days' })).toBeTruthy()
  })

  it('offers it on Helotes Dental Office’s first draft, says 8 of 17 and 19 weeks, and the draw says where it came from', () => {
    render(<Tab start={withTemplate()} id="helotes" />)
    pick('tpl-1')
    expect(screen.getByText('The template Fair Oaks Shops, Building D covers 8 of the 17 lines here. Those run as they ran there. The other 9 take the stage days. It makes 19 weeks to build. Without it, 10 weeks.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Draw a first draft' }))
    expect(document.querySelector('[data-drawn-from]')?.textContent).toBe('Drawn from the template Fair Oaks Shops, Building D, Fri Oct 2.')
  })

  it('lists on the card the jobs drawn from it', () => {
    const s = gcReducer(withTemplate(), { type: 'setRough', projectId: 'boerne', start: '2026-11-02', days: {}, by: 'Robert', templateId: 'tpl-1' })
    render(<Tab start={s} id="fairoaksd" />)
    const row = card().querySelector('[data-template="tpl-1"]') as HTMLElement
    expect(within(row).getByText("Boerne Retail Shell's rough schedule, Fri Oct 2.")).toBeTruthy()
  })

  it('shows no template control where none is offered', () => {
    render(<Tab start={initialGcState()} id="boerne" />)
    expect(screen.getByRole('button', { name: 'Draw a rough schedule' })).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: 'Start from a template' })).toBeNull()
    cleanup()
    render(<Tab start={initialGcState()} id="helotes" />)
    expect(screen.queryByRole('combobox', { name: 'Start from a template' })).toBeNull()
  })
})
