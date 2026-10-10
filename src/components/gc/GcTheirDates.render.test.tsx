// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 12c: their dates to meet onto a running job (G-145) on main's test state,
 * the Milestones card's door and its window rendered alone with the press stood in for. Ported from the prototype's
 * render test (branch spike/gc-mode, `GcTheirDates.render.test.tsx`), whose sample file is the spike's: here a small
 * Project file is written in the test.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcTheirDatesDoor, type TakeTheirDates } from './GcTheirDates'
import { withTheirDates } from '../../lib/gc/schedule/theirDates'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { GcProject } from '../../lib/gc/types'

afterEach(cleanup)

const s = initialGcState()
const fair = s.projects.find((p) => p.id === 'fairoaksd')!
const task = (uid: number, name: string, extra: string) => `<Task><UID>${uid}</UID><Name>${name}</Name><OutlineLevel>1</OutlineLevel>${extra}</Task>`
const on = (day: string) => `<Milestone>1</Milestone><Start>${day}T08:00:00</Start><Finish>${day}T08:00:00</Finish>`
/** Cibolo's file: five dates to meet and one activity, which is passed over. */
const XML = `<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project"><MinutesPerDay>480</MinutesPerDay><Tasks>
  ${task(1, 'Slab poured', on('2026-08-27'))}
  ${task(2, 'Dry-in', on('2026-10-02'))}
  ${task(3, 'Rough-in inspection', on('2026-10-16'))}
  ${task(4, 'Substantial completion', on('2026-12-18'))}
  ${task(5, 'Grand opening', on('2027-01-15'))}
  ${task(6, 'Framing', '<Start>2026-08-31T08:00:00</Start><Finish>2026-09-11T17:00:00</Finish>')}
</Tasks></Project>`

const dialog = () => screen.getByRole('dialog', { name: 'Their dates to meet' })
const tick = (name: string) => within(dialog()).getByLabelText(`Take ${name}`) as HTMLInputElement
function door(project: GcProject = fair, onTake: TakeTheirDates = vi.fn(async () => {})) {
  render(<GcTheirDatesDoor state={s} project={project} onTake={onTake} />)
  return onTake
}
async function openWithFile() {
  fireEvent.click(screen.getByText('Bring in their dates…'))
  fireEvent.change(within(dialog()).getByLabelText('Choose a file'), { target: { files: [new File([XML], 'cibolo.xml', { type: 'application/xml' })] } })
  await within(dialog()).findByText(/^In the file: 5 dates\./)
}

describe('their dates to meet (PR 12c, G-145)', () => {
  it('is a door on a job being built, closed while a what-if copy is open, and nothing elsewhere', () => {
    door()
    expect(screen.getByText('Bring in their dates…')).toBeTruthy()
    cleanup()
    door({ ...fair, whatIf: { schedule: fair.schedule!, base: {}, on: s.today, by: 'Robert' } } as GcProject)
    expect(screen.getByText('A what-if copy is open. Keep it or throw it away first.')).toBeTruthy()
    cleanup()
    door(s.projects.find((p) => p.id === 'helotes')!)
    expect(screen.queryByText('Bring in their dates…')).toBeNull()
  })

  it('sets their dates beside ours: what starts ticked and what never can', async () => {
    door()
    await openWithFile()
    expect(tick('Slab poured').disabled).toBe(true)
    expect((dialog().querySelector('[data-their-date="Slab poured"]') as HTMLElement).textContent).toContain('Ours was met Thu Aug 27, so it stays.')
    expect((dialog().querySelector('[data-their-date="Dry-in"]') as HTMLElement).textContent).toContain('7 days later')
    expect(tick('Substantial completion').checked).toBe(false)
  })

  it('takes what is ticked as one record, each on the one of ours it is set to, then closes', async () => {
    const onTake = door()
    await openWithFile()
    const take = within(dialog()).getByRole('button', { name: /^Take \d+ dates?$/ })
    fireEvent.click(take)
    await waitFor(() => expect(onTake).toHaveBeenCalledTimes(1))
    const [dates, milestones] = vi.mocked(onTake).mock.calls[0]!
    expect(dates.find((d) => d.name === 'Dry-in')).toEqual({ name: 'Dry-in', on: '2026-10-02', ours: 'fo-dryin' })
    expect(dates.find((d) => d.name === 'Grand opening')).toEqual({ name: 'Grand opening', on: '2027-01-15', ours: null })
    expect(milestones).toEqual(withTheirDates(fair, dates))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('says why when two of theirs would take one of ours, and holds Take', async () => {
    door()
    await openWithFile()
    fireEvent.change(within(dialog()).getByLabelText('Which of ours Grand opening takes the place of'), { target: { value: 'fo-dryin' } })
    expect(within(dialog()).getByText('Two of their dates take the place of Dry-in.')).toBeTruthy()
    expect((within(dialog()).getByRole('button', { name: /^Take \d+ dates?$/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('keeps the window open with the database’s words when the take is refused', async () => {
    door(fair, vi.fn(async () => Promise.reject(new Error('Read-only (training) mode: changes are blocked.'))))
    await openWithFile()
    fireEvent.click(within(dialog()).getByRole('button', { name: /^Take \d+ dates?$/ }))
    expect((await within(dialog()).findByRole('alert')).textContent).toBe('Read-only (training) mode: changes are blocked.')
  })
})
