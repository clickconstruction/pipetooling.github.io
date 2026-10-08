// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GcDailyLogWindow } from './GcDailyLog'
import { initialGcState } from '../../lib/gc/schedule/testState'
import type { GcProject } from '../../lib/gc/types'
import { installDomShims } from '../../test/renderSmokeMocks'

installDomShims()

/** Fair Oaks D on the test state's Friday, Oct 2: logs from Sep 21, Sep 30 missed, today not written yet. */
function setup(opts: { project?: (p: GcProject) => GcProject; saved?: boolean; problem?: string | null } = {}) {
  const state = initialGcState()
  const fairOaks = state.projects.find((p) => p.id === 'fairoaksd')!
  const project = opts.project ? opts.project(fairOaks) : fairOaks
  const onSave = vi.fn(() => Promise.resolve(opts.saved ?? true))
  const onClose = vi.fn()
  render(<GcDailyLogWindow state={state} project={project} today="2026-10-02" problem={opts.problem ?? null} onSave={onSave} onClose={onClose} />)
  return { onSave, onClose }
}

const workersOn = (trade: string) => screen.getByRole('spinbutton', { name: `Workers on site, ${trade}` }) as HTMLInputElement

describe('GcDailyLogWindow', () => {
  it('flags the missed day, and starts today’s log from the day before', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Fair Oaks Shops, Building D: daily log' })).toBeTruthy()
    expect(screen.getByText('One working day in the last week has no log.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Write Wed Sep 30' })).toBeTruthy()
    expect(screen.getByText("Today's log · Fri Oct 2")).toBeTruthy()
    // Thursday's log: cloudy, 85 and 70, steel 3 and roofing 4.
    expect((screen.getByRole('spinbutton', { name: 'High, degrees' }) as HTMLInputElement).value).toBe('85')
    expect((screen.getByRole('spinbutton', { name: 'Low, degrees' }) as HTMLInputElement).value).toBe('70')
    expect(workersOn('Structural steel').value).toBe('3')
    expect(workersOn('Roofing').value).toBe('4')
    expect(screen.getByText('This week')).toBeTruthy()
    expect(screen.getByText('Earlier days')).toBeTruthy()
  })

  it('hands the log to the press as written', async () => {
    const { onSave } = setup()
    fireEvent.change(workersOn('Structural steel'), { target: { value: '6' } })
    fireEvent.change(screen.getByPlaceholderText('Membrane down on the east half. Ductwork in bay 4.'), { target: { value: 'Joists set on the east bay.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add a delay' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'What happened' }), { target: { value: 'Rain until ten' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the log' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-10-02',
        sky: 'cloudy',
        high: 85,
        low: 70,
        done: 'Joists set on the east bay.',
        delays: [{ packageId: null, reason: 'weather', note: 'Rain until ten' }],
        crews: expect.arrayContaining([{ packageId: 'fsteel', workers: 6 }, { packageId: 'froof', workers: 4 }]),
      }),
    )
  })

  it('names only the trades a log may: a trade whose statement of work is not signed is left off, even from the day before', async () => {
    const { onSave } = setup({ project: (p) => ({ ...p, packages: p.packages.map((k) => (k.id === 'fhvac' ? { ...k, sow: null } : k)) }) })
    expect(screen.queryByRole('spinbutton', { name: 'Workers on site, HVAC' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save the log' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const crews = (onSave.mock.calls[0] as unknown as [{ crews: { packageId: string }[] }])[0].crews
    expect(crews.map((c) => c.packageId)).not.toContain('fhvac')
    expect(crews.map((c) => c.packageId)).toContain('fplumb')
  })

  it('reads a day of this week back, and Change it opens it to change', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /^Thu Oct 1/ }))
    expect(screen.getByText('The log for Thu Oct 1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
    expect(screen.getByRole('button', { name: 'Keep it as it was' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(screen.getByText("Today's log · Fri Oct 2")).toBeTruthy()
  })

  it('catches up a missed day', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Write Wed Sep 30' }))
    expect(screen.getByText('The log for Wed Sep 30 · caught up')).toBeTruthy()
  })

  it('keeps the form as typed when the press refuses, with its words above', async () => {
    const { onSave } = setup({ saved: false, problem: 'A log is written on its day or after, never before.' })
    expect(screen.getByRole('alert').textContent).toBe('A log is written on its day or after, never before.')
    fireEvent.change(screen.getByPlaceholderText('Membrane down on the east half. Ductwork in bay 4.'), { target: { value: 'Kept as typed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the log' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect((screen.getByPlaceholderText('Membrane down on the east half. Ductwork in bay 4.') as HTMLTextAreaElement).value).toBe('Kept as typed')
  })

  it('says the log starts once work starts, on a job not started', () => {
    setup({ project: (p) => ({ ...p, startedOn: null }) })
    expect(screen.getByText('The daily log starts once work starts.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save the log' })).toBeNull()
  })

  it('closes on Escape and on ×', () => {
    const { onClose } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
