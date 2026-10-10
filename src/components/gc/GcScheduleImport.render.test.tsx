// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 12c: Bring in their schedule (G-137) on main's test state, the window
 * rendered alone with its press stood in for. Ported from the prototype's render test (branch spike/gc-mode,
 * `GcScheduleImport.render.test.tsx`), whose sample file is the spike's: here a small Project file is written in the
 * test, and the words it should read are worked out by the same kernels. The window's doors are the Schedule window's.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GcScheduleImport } from './GcScheduleImport'
import { IMPORT_REPLACES, importHoldsWords, readScheduleFile, type ScheduleFileReading } from '../../lib/gc/schedule/import'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { ProjectSchedule } from '../../lib/gc/schedule/types'
import { plainWordsFailures } from '../../lib/plainWords'

afterEach(cleanup)

const s = initialGcState()
const helotes = s.projects.find((p) => p.id === 'helotes')!
const task = (uid: number, name: string, extra: string) => `<Task><UID>${uid}</UID><Name>${name}</Name><OutlineLevel>1</OutlineLevel>${extra}</Task>`
const dates = (start: string, finish: string) => `<Start>${start}T08:00:00</Start><Finish>${finish}T17:00:00</Finish>`
/** Their file: two of our lines by name, one that is not ours, and one date to meet. */
const XML = `<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project"><MinutesPerDay>480</MinutesPerDay><Tasks>
  ${task(1, 'Framing', dates('2026-11-02', '2026-11-13'))}
  ${task(2, 'Lighting', `${dates('2026-11-16', '2026-11-20')}<PredecessorLink><PredecessorUID>1</PredecessorUID><Type>1</Type><CrossProject>0</CrossProject><LinkLag>0</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`)}
  ${task(3, 'Dental equipment, by owner', dates('2026-12-01', '2026-12-04'))}
  ${task(4, 'Substantial completion', `<Milestone>1</Milestone>${dates('2027-01-29', '2027-01-29')}`)}
</Tasks></Project>`

const dialog = () => screen.getByRole('dialog', { name: 'Bring in a schedule' })
function open({ replacing = false, onMake = vi.fn(async () => {}), onClose = vi.fn() } = {}) {
  render(<GcScheduleImport state={s} project={helotes} replacing={replacing} defaultStart="2026-11-02" onMake={onMake} onClose={onClose} />)
  return { onMake, onClose }
}
async function choose(text: string, name: string) {
  fireEvent.change(within(dialog()).getByLabelText('Choose a file'), { target: { files: [new File([text], name, { type: 'application/xml' })] } })
}

describe('Bring in their schedule (PR 12c, G-137)', () => {
  it('reads their file and shows what it holds before anything is written, in a first-timer’s words', async () => {
    const { onMake } = open()
    await choose(XML, 'helotes.xml')
    const reading = readScheduleFile(XML, 'helotes.xml') as ScheduleFileReading
    expect(await within(dialog()).findByText(importHoldsWords(reading))).toBeTruthy()
    expect(dialog().querySelectorAll('[data-import-row]')).toHaveLength(3)
    expect(onMake).not.toHaveBeenCalled()
    const sentences = [...dialog().querySelectorAll('div, span, strong')].filter((el) => el.children.length === 0).map((el) => el.textContent ?? '').filter(Boolean)
    for (const sentence of sentences) expect(plainWordsFailures(sentence), sentence).toEqual([])
  })

  it('Make the schedule from it sends the kernel’s schedule and its line naming the file, then closes', async () => {
    const { onMake, onClose } = open()
    await choose(XML, 'helotes.xml')
    await within(dialog()).findByText(/^What it holds:/)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Make the schedule from it' }))
    await waitFor(() => expect(onMake).toHaveBeenCalledTimes(1))
    const [schedule, words] = onMake.mock.calls[0] as unknown as [ProjectSchedule, string]
    expect(schedule.activities.length).toBeGreaterThan(0)
    expect(words).toMatch(/^Drew the schedule on Helotes Dental Office from .+ file helotes\.xml\./)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('keeps the window open with the database’s words when the make is refused', async () => {
    const { onClose } = open({ onMake: vi.fn(async () => Promise.reject(new Error('The schedule has moves with their reasons. They stay as they are.'))) })
    await choose(XML, 'helotes.xml')
    await within(dialog()).findByText(/^What it holds:/)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Make the schedule from it' }))
    expect((await within(dialog()).findByRole('alert')).textContent).toBe('The schedule has moves with their reasons. They stay as they are.')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('says what to ask for when it cannot read a file, and makes nothing', async () => {
    open()
    await choose('binary', 'helotes.mpp')
    expect((await within(dialog()).findByRole('alert')).textContent).toBe('Only its own program opens this file. Ask them to save it from Project or Primavera with Save as XML.')
    expect((within(dialog()).getByRole('button', { name: 'Make the schedule from it' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('says what it replaces when it takes the place of a draft', () => {
    open({ replacing: true })
    expect(within(dialog()).getByText(IMPORT_REPLACES)).toBeTruthy()
  })
})
