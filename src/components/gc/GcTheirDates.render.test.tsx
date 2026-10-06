// @vitest-environment jsdom
/**
 * Render smoke for their dates onto a running job (G-145): the door in the Milestones card on a job
 * being built, closed while a what-if copy is open and gone inside it; the window with Cibolo Creek
 * Partners' file, what starts ticked and what never can, the contract's sentence; and one take, after
 * which the Projected finish measure reads the new contract day only when it was ticked.
 */
import { useReducer } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { GcBuildingScheduleTab } from './GcBuildingSchedule'
import { GcTheirDatesDoor } from './GcTheirDates'
import { initialGcState } from '../../lib/gcMode/gcFixture'
import { gcReducer } from '../../lib/gcMode/gcReducer'
import { THEIR_DATES_SAMPLE_FILE, THEIR_DATES_SAMPLE_XML } from '../../lib/gcMode/gcTheirDatesSample'
import type { GcState } from '../../lib/gcMode/gcTypes'

afterEach(cleanup)

const ID = 'fairoaksd'
const job = (s: GcState) => s.projects.find((p) => p.id === ID)!

function Shell({ initial }: { initial?: GcState }) {
  const [state, dispatch] = useReducer(gcReducer, initial ?? initialGcState())
  return <GcBuildingScheduleTab state={state} project={job(state)} dispatch={dispatch} />
}

const dialog = () => screen.getByRole('dialog', { name: 'Their dates to meet' })
const row = (name: string) => dialog().querySelector(`[data-their-date="${name}"]`) as HTMLElement
const tick = (name: string) => within(dialog()).getByLabelText(`Take ${name}`) as HTMLInputElement

async function openWithSample() {
  fireEvent.click(screen.getByText('Bring in their dates…'))
  fireEvent.change(within(dialog()).getByLabelText('Choose a file'), { target: { files: [new File([THEIR_DATES_SAMPLE_XML], THEIR_DATES_SAMPLE_FILE, { type: 'application/xml' })] } })
  await within(dialog()).findByText('In the file: 6 dates. Its 9 activities are passed over.')
}

describe('the door', () => {
  it('is in the Milestones card on a job being built', () => {
    render(<Shell />)
    expect(screen.getByText('Bring in their dates…')).toBeTruthy()
  })

  it('is closed while a what-if copy is open, and gone inside the copy', () => {
    render(<Shell initial={gcReducer(initialGcState(), { type: 'startWhatIf', projectId: ID, by: 'Robert' })} />)
    expect(screen.queryByText('Bring in their dates…')).toBeNull()
    expect(screen.getByText('A what-if copy is open. Keep it or throw it away first.')).toBeTruthy()
    fireEvent.click(screen.getByText('What if · 0'))
    expect(screen.queryByText('A what-if copy is open. Keep it or throw it away first.')).toBeNull()
    expect(screen.queryByText('Bring in their dates…')).toBeNull()
  })
})

describe('the window', () => {
  it('sets their dates beside ours: what starts ticked, what never can, and the contract’s sentence', async () => {
    render(<Shell />)
    await openWithSample()
    expect(['Notice to proceed', 'Dry-in', 'Rough-in inspection', 'Substantial completion', 'Grand opening'].map((n) => [n, tick(n).checked])).toEqual([
      ['Notice to proceed', false],
      ['Dry-in', true],
      ['Rough-in inspection', true],
      ['Substantial completion', false],
      ['Grand opening', true],
    ])
    expect(tick('Slab poured').disabled).toBe(true)
    expect(row('Slab poured').textContent).toContain('Ours was met Thu Aug 27, so it stays.')
    expect(row('Dry-in').textContent).toContain('7 days later')
    expect(row('Notice to proceed').textContent).toContain('That day has passed.')
    expect(row('Substantial completion').textContent).toContain("This is the contract's finish. With theirs, the projected finish, Fri Dec 11, is 7 days past the contract.")
    expect(within(dialog()).getByText('Take 3 dates')).toBeTruthy()
  })

  it('leaves the contract’s day alone unless it is ticked, and reads it in the measure once it is', async () => {
    render(<Shell />)
    await openWithSample()
    fireEvent.click(within(dialog()).getByText('Take 3 dates'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('7 days past the contract')).toBeNull()
    // The Milestones card's own box shows their day, so its Save has nothing stale to put back.
    const dryIn = screen.getByLabelText('Dry-in day') as HTMLInputElement
    expect(dryIn.value).toBe('2026-10-02')
    expect((dryIn.parentElement?.querySelector('button') as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    render(<Shell />)
    await openWithSample()
    fireEvent.click(tick('Substantial completion'))
    fireEvent.click(within(dialog()).getByText('Take 4 dates'))
    expect(screen.getByText('7 days past the contract')).toBeTruthy()
  })

  it('sends one action with what is ticked, to the one of ours each is set to', async () => {
    const dispatch = vi.fn()
    const s = initialGcState()
    render(<GcTheirDatesDoor state={s} project={job(s)} dispatch={dispatch} by="Robert" />)
    await openWithSample()
    // As it opens: Dry-in and the rough-in inspection on ours, Grand opening a new date, the rest unticked.
    fireEvent.click(within(dialog()).getByText('Take 3 dates'))
    expect(dispatch).toHaveBeenCalledWith({
      type: 'takeTheirDates',
      projectId: ID,
      file: THEIR_DATES_SAMPLE_FILE,
      from: 'Cibolo Creek Partners',
      dates: [
        { name: 'Dry-in', on: '2026-10-02', ours: 'fo-dryin' },
        { name: 'Rough-in inspection', on: '2026-10-16', ours: 'fo-roughin' },
        { name: 'Grand opening', on: '2027-01-15', ours: null },
      ],
      by: 'Robert',
    })
  })

  it('says why when two of theirs would take one of ours, and holds Take', async () => {
    render(<Shell />)
    await openWithSample()
    fireEvent.change(within(dialog()).getByLabelText('Which of ours Grand opening takes the place of'), { target: { value: 'fo-dryin' } })
    expect(within(dialog()).getByText('Two of their dates take the place of Dry-in.')).toBeTruthy()
    expect((within(dialog()).getByText('Take 3 dates') as HTMLButtonElement).disabled).toBe(true)
  })
})
