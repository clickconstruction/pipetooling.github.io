// @vitest-environment jsdom
/**
 * Render smoke for Bring in their schedule (the Gantt's G-137, `to-dos/gc-mode/mockups/G-137.md`):
 * the first-draft card's door, the window reading Studio Ocotillo's file for Helotes Dental Office,
 * what it found shown before anything is written with the rows to look at first, the office placing
 * a row, Make the schedule from it drawing the chart through a real reducer, and the doors shut.
 */
import { useReducer } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { importLines } from '../../lib/gcMode/gcScheduleImport'
import { HELOTES_SAMPLE_FILE, HELOTES_SAMPLE_XML } from '../../lib/gcMode/gcScheduleImportSample'
import { plainWordsFailures } from '../../lib/plainWords'
import type { GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

function Shell({ id, initial }: { id: string; initial?: GcState }) {
  const [state, dispatch] = useReducer(gcReducer, initial ?? initialGcState())
  const project = state.projects.find((p) => p.id === id)!
  return (
    <>
      <GcBuildingScheduleTab state={state} project={project} dispatch={dispatch} />
      <output data-testid="log">{state.log[0]?.text}</output>
    </>
  )
}

const dialog = () => screen.getByRole('dialog', { name: 'Bring in a schedule' })
const helotesLine = (label: string) => `line:${importLines(initialGcState().projects.find((p) => p.id === 'helotes')!).find((l) => l.label === label)?.lineId}`

async function chooseFile(text: string, name: string) {
  fireEvent.change(within(dialog()).getByLabelText('Choose a file'), { target: { files: [new File([text], name, { type: 'application/xml' })] } })
}

async function openWithSample() {
  render(<Shell id="helotes" />)
  fireEvent.click(screen.getByRole('button', { name: 'Bring in their schedule' }))
  await chooseFile(HELOTES_SAMPLE_XML, HELOTES_SAMPLE_FILE)
  await within(dialog()).findByText('What it holds: 13 activities, 14 waits between them and 4 dates.')
}

describe('Bring in their schedule (G-137)', () => {
  it('is a second way in on the first-draft card of a job with no schedule', () => {
    render(<Shell id="helotes" />)
    expect(screen.getByText('Or start from the schedule the customer or the architect handed us.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Draw a first draft' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Bring in their schedule' }))
    expect(within(dialog()).getByText('Nothing is sent to the trades or the customer.')).toBeTruthy()
    expect(within(dialog()).queryByText('It takes the place of the schedule drawn now. The changes made to it are lost.')).toBeNull()
  })

  it('shows what the file holds before anything is written: the rows with no place first, each with why we guessed it', async () => {
    await openWithSample()
    const d = dialog()
    expect([...d.querySelectorAll('[data-import-row]')].slice(0, 3).map((r) => r.getAttribute('data-import-row'))).toEqual(['MEP rough-in', 'Casework install', 'Punch list'])
    expect((within(d).getByLabelText('Where Underground plumbing goes') as HTMLSelectElement).value).toBe(helotesLine('Underground'))
    expect((within(d).getByLabelText('Where Dental equipment, by owner goes') as HTMLSelectElement).value).toBe('out')
    expect(within(d).getByText("rough is in Electrical's lines and in Plumbing's")).toBeTruthy()
    expect(within(d).getByText('after MEP rough-in and HVAC ductwork')).toBeTruthy()
    expect(within(d).getByText('3 of theirs are not placed. They stay out unless you pick a place.')).toBeTruthy()
    expect(within(d).getByText('What it could not read: 2')).toBeTruthy()
    expect(within(d).getByText('Our lines not in it: 10')).toBeTruthy()
    expect(within(d).getByText('It takes the place of our own substantial completion.')).toBeTruthy()
    expect(within(d).getAllByRole('checkbox').map((c) => (c as HTMLInputElement).checked)).toEqual([true, true, true, true])
    // Nothing is written yet: the job still has no schedule, and the log is as it was.
    expect(document.querySelector('[data-tour="gc-gantt-toolbar"]')).toBeNull()
    expect(screen.getByTestId('log').textContent).not.toMatch(/^Drew the schedule/)
    // Every sentence the window says is a first-timer's.
    const sentences = [...d.querySelectorAll('div, span, strong')].filter((el) => el.children.length === 0).map((el) => el.textContent ?? '').filter(Boolean)
    expect(sentences.length).toBeGreaterThan(20)
    for (const s of sentences) expect(plainWordsFailures(s)).toEqual([])
  })

  it('takes the office’s picks, then Make the schedule from it draws the chart in one press', async () => {
    await openWithSample()
    const d = dialog()
    fireEvent.change(within(d).getByLabelText('Who handed it'), { target: { value: 'Studio Ocotillo' } })
    fireEvent.change(within(d).getByLabelText('Where MEP rough-in goes'), { target: { value: helotesLine('Rough in') } })
    fireEvent.change(within(d).getByLabelText('Where Casework install goes'), { target: { value: helotesLine('Reception desk') } })
    expect(within(d).getByText('1 of theirs is not placed. It stays out unless you pick a place.')).toBeTruthy()
    expect(within(d).getByText('Our lines not in it: 8')).toBeTruthy()
    expect(within(d).getByText('Lighting and Controls run into their final inspection. Look at them before Start.')).toBeTruthy()
    fireEvent.click(within(d).getByRole('button', { name: 'Make the schedule from it' }))
    expect(screen.queryByRole('dialog', { name: 'Bring in a schedule' })).toBeNull()
    expect(document.querySelector('[data-tour="gc-gantt-toolbar"]')).toBeTruthy()
    expect(screen.getByTestId('log').textContent).toBe("Drew the schedule on Helotes Dental Office from Studio Ocotillo's file helotes-schedule.xml. 11 of their activities are on our schedule, with 4 dates to meet. 8 of our lines were drawn as the first draft draws them.")
    // A first draft nobody has walked or moved: the second door is there, and it says what it replaces.
    fireEvent.click(screen.getByRole('button', { name: 'Bring in their schedule instead' }))
    expect(within(dialog()).getByText('It takes the place of the schedule drawn now. The changes made to it are lost.')).toBeTruthy()
  })

  it('says what to ask for when it cannot read a file', async () => {
    render(<Shell id="helotes" />)
    fireEvent.click(screen.getByRole('button', { name: 'Bring in their schedule' }))
    await chooseFile('binary', 'helotes.mpp')
    expect((await within(dialog()).findByRole('alert')).textContent).toBe('Only its own program opens this file. Ask them to save it from Project or Primavera with Save as XML.')
    expect((within(dialog()).getByRole('button', { name: 'Make the schedule from it' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('has no door on Fair Oaks D, started Jul 1, nor while bidding', () => {
    render(<Shell id="fairoaksd" />)
    expect(screen.queryByRole('button', { name: /Bring in their schedule/ })).toBeNull()
    cleanup()
    render(<Shell id="boerne" />)
    expect(screen.queryByRole('button', { name: /Bring in their schedule/ })).toBeNull()
  })
})
