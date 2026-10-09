// @vitest-environment jsdom
/**
 * GC mode, the real build, the schedule's PR 8b: the opened bar's form on main's test state. A change hands its dates,
 * waits and limits to the move's window; a bad date says so; the real days keep at once, and a refusal says its words.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { GcActivityEditor } from './GcActivityEditor'
import { scheduleMeasures } from '../../lib/gc/schedule/schedule'
import { initialGcState } from '../../lib/gc/schedule/testState'

afterEach(cleanup)

const s = initialGcState()
const fairOaks = s.projects.find((p) => p.id === 'fairoaksd')!
const m = scheduleMeasures(s, fairOaks)
const tpo = m.items.find((r) => r.activity.lineId === 'froof-1')!

function form(over: { onSave?: ReturnType<typeof vi.fn>; onActual?: ReturnType<typeof vi.fn> } = {}) {
  const onSave = over.onSave ?? vi.fn()
  const onActual = over.onActual ?? vi.fn(() => Promise.resolve())
  render(<GcActivityEditor project={fairOaks} row={tpo} rows={m.items} started today={s.today} onSave={onSave} onActual={onActual} onClose={vi.fn()} />)
  const save = () => screen.getByRole('button', { name: 'Save, and say why' }) as HTMLButtonElement
  return { onSave, onActual, save }
}

describe('the opened bar’s form', () => {
  it('saves nothing until something changes, then hands the new dates, waits and limits to the move’s window', () => {
    const { onSave, save } = form()
    expect(save().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Finishes'), { target: { value: '2026-10-16' } })
    expect(screen.getByText(/^On Save:/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('The day it must finish by'), { target: { value: '2026-10-14' } })
    expect(screen.getByText('It finishes 2 days past that.')).toBeTruthy()
    fireEvent.click(save())
    expect(onSave).toHaveBeenCalledWith(tpo.activity.start, '2026-10-16', tpo.activity.after, expect.objectContaining({ mustFinishBy: '2026-10-14', notBefore: null }))
  })

  it('says a finish before its start, and a start before the day it cannot start before', () => {
    const { save } = form()
    fireEvent.change(screen.getByLabelText('Finishes'), { target: { value: '2026-09-01' } })
    expect(screen.getByText('It has to finish on or after it starts.')).toBeTruthy()
    expect(save().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Finishes'), { target: { value: tpo.activity.finish } })
    fireEvent.change(screen.getByLabelText('The day it cannot start before'), { target: { value: '2026-09-25' } })
    expect(screen.getByText('It cannot start before Fri Sep 25.')).toBeTruthy()
    expect(save().disabled).toBe(true)
  })

  it('keeps the real days at once, and says a refusal in its words', async () => {
    const onActual = vi.fn().mockRejectedValueOnce(new Error('Only the office can record that.')).mockResolvedValueOnce(undefined)
    form({ onActual })
    fireEvent.change(screen.getByLabelText('The day it really started'), { target: { value: '2026-09-22' } })
    fireEvent.click(screen.getByRole('button', { name: 'Keep the real days' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Only the office can record that.')
    fireEvent.click(screen.getByRole('button', { name: 'Keep the real days' }))
    await waitFor(() => expect(onActual).toHaveBeenCalledTimes(2))
    expect(onActual).toHaveBeenLastCalledWith('2026-09-22', null)
  })

  it('says what a slip would cost before anyone asks (G-80)', () => {
    form()
    expect(screen.getByText(/^If it slips 5 days: /)).toBeTruthy()
    expect(screen.getByText(/^If it slips 10 days: /)).toBeTruthy()
  })
})
