// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 12b: the rough schedule for our bid (G-45) on main's test state, the card
 * rendered alone with its presses stood in for. Ported from the prototype's render test (branch spike/gc-mode,
 * `GcRoughSchedule.render.test.tsx`), whose presses went through its reducer: here a draw is laid on the job the way the
 * window's read would show it. Our number's weeks are `GcOurNumber.render.test.tsx`'s; the first draft after we win is
 * the window's.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react'
import { GcRoughSchedule } from './GcRoughSchedule'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { RoughSchedule } from '../../lib/gc/schedule/types'
import type { GcProject, GcState } from '../../lib/gc/types'
import { plainWordsFailures } from '../../lib/plainWords'

afterEach(cleanup)

const s = initialGcState()
const boerne = s.projects.find((p) => p.id === 'boerne')!
const card = () => document.querySelector('[data-tour="gc-rough"]') as HTMLElement

/** The card on Boerne, its draws laid on the job as the window's read would after the press saved. */
function Rough({ project = boerne, onDraw, onKeep, readOnly = false }: { project?: GcProject; onDraw?: (r: RoughSchedule) => Promise<void>; onKeep?: (k: NonNullable<RoughSchedule['kept']>) => Promise<void>; readOnly?: boolean }) {
  const [job, setJob] = useState(project)
  const state: GcState = { ...s, projects: s.projects.map((p) => (p.id === job.id ? job : p)) }
  const draw = async (rough: RoughSchedule) => {
    await onDraw?.(rough)
    setJob((was) => ({ ...was, rough }))
  }
  return <GcRoughSchedule state={state} project={job} by="Robert" {...(readOnly ? {} : { onDraw: draw })} {...(onKeep ? { onKeep } : {})} />
}

async function drawFromNov2() {
  fireEvent.change(within(card()).getByLabelText('If work starts'), { target: { value: '2026-11-02' } })
  fireEvent.click(within(card()).getByRole('button', { name: 'Draw a rough schedule' }))
  await within(card()).findByText(/weeks to build$/)
}

describe('a rough schedule while we bid (PR 12b, G-45)', () => {
  it('opens a bidding job on the rough, in a first-timer’s words', () => {
    render(<Rough />)
    expect(within(card()).getByText('A rough schedule for our bid')).toBeTruthy()
    const sentences = [...card().querySelectorAll('span')].filter((el) => el.children.length === 0).map((el) => el.textContent ?? '')
    expect(sentences).toContain('Nothing here goes to the trades or to Cibolo Creek Partners.')
    for (const sentence of sentences) expect(plainWordsFailures(sentence), sentence).toEqual([])
  })

  it('draws Boerne Retail Shell from Mon Nov 2: its stages and 14 weeks, sent whole', async () => {
    const onDraw = vi.fn(async () => {})
    render(<Rough onDraw={onDraw} />)
    await drawFromNov2()
    expect(onDraw).toHaveBeenCalledWith({ start: '2026-11-02', days: {}, by: 'Robert', on: s.today })
    expect(card().querySelectorAll('[data-rough-stage]')).toHaveLength(10)
    expect(within(card()).getByText('14 weeks to build')).toBeTruthy()
    expect(within(card()).getByText('If work starts Mon Nov 2, substantial completion is Tue Feb 2. That is 14 weeks.')).toBeTruthy()
  })

  it('takes a stage’s own days on Redraw, and the count follows the draw', async () => {
    const onDraw = vi.fn(async () => {})
    render(<Rough onDraw={onDraw} />)
    await drawFromNov2()
    fireEvent.change(within(card()).getByLabelText('Structure days'), { target: { value: '25' } })
    fireEvent.click(within(card()).getByRole('button', { name: 'Redraw' }))
    expect(await within(card()).findByText('15 weeks to build')).toBeTruthy()
    expect(onDraw).toHaveBeenLastCalledWith(expect.objectContaining({ days: { structure: 25 } }))
    expect((within(card()).getByLabelText('Structure days') as HTMLInputElement).value).toBe('25')
  })

  it('locks once our bid went in: no boxes, no Redraw, and the weeks read as they went', () => {
    const rough: RoughSchedule = { start: '2026-11-02', days: {}, by: 'Robert', on: '2026-10-01', kept: { on: s.today, weeks: 14, finish: '2027-02-02', at: 'bid' } }
    render(<Rough project={{ ...boerne, rough, ourBidSentOn: s.today }} onKeep={vi.fn(async () => {})} />)
    expect(within(card()).queryByRole('button', { name: 'Redraw' })).toBeNull()
    expect(card().querySelectorAll('input')).toHaveLength(0)
    expect(within(card()).getByText('Our bid went in Fri Oct 2 with 14 weeks to build. The rough stays as it went.')).toBeTruthy()
    // Kept already: nothing more to keep.
    expect(within(card()).queryByRole('button', { name: 'Keep the weeks as sent' })).toBeNull()
  })

  it('keeps the weeks later with the day our bid went, when the keep at the press did not happen (gc 4’s note)', async () => {
    const onKeep = vi.fn(async () => {})
    const rough: RoughSchedule = { start: '2026-11-02', days: {}, by: 'Robert', on: '2026-09-25' }
    render(<Rough project={{ ...boerne, rough, ourBidSentOn: '2026-09-28' }} onKeep={onKeep} />)
    expect(within(card()).getByText('The rough’s weeks were not kept when our bid went in.')).toBeTruthy()
    fireEvent.click(within(card()).getByRole('button', { name: 'Keep the weeks as sent' }))
    await waitFor(() => expect(onKeep).toHaveBeenCalledWith({ on: '2026-09-28', weeks: 14, finish: '2027-02-02', at: 'bid' }))
  })

  it('is read only for someone who may not move a bar, and says why a draw did not save', async () => {
    render(<Rough readOnly />)
    expect(within(card()).queryByRole('button', { name: 'Draw a rough schedule' })).toBeNull()
    cleanup()
    render(<Rough onDraw={vi.fn(async () => Promise.reject(new Error('Read-only (training) mode: changes are blocked.')))} />)
    fireEvent.click(within(card()).getByRole('button', { name: 'Draw a rough schedule' }))
    expect((await within(card()).findByRole('alert')).textContent).toBe('Read-only (training) mode: changes are blocked.')
  })
})
