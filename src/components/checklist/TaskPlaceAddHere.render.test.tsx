// @vitest-environment jsdom
/**
 * Standing at this task? Add its place (punch list #328, PR 8): one quiet line in an open task with
 * no place. Nothing is asked of the phone until the press, the reading is shown before it is kept,
 * a wide reading is not kept at all, and what is saved is said beside the press.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const phone = vi.hoisted(() => ({ asked: 0, fix: { lat: 29.55, lng: -98.28, accuracyM: 6 as number | null }, why: null as null | 'refused' | 'none' | 'failed' }))
vi.mock('../../lib/materials/myLocation', () => ({
  requestMyFix: (onOk: (p: unknown) => void, onFail: (w: string) => void) => {
    phone.asked += 1
    if (phone.why) onFail(phone.why)
    else onOk(phone.fix)
  },
}))
const io = vi.hoisted(() => ({ calls: [] as unknown[][], refusal: null as string | null }))
vi.mock('../../lib/tasks/taskPlaceIo', () => ({
  addTaskPlaceFromTheSpot: (...args: unknown[]) => {
    io.calls.push(args)
    return Promise.resolve(io.refusal)
  },
}))

import { TaskPlaceAddHere } from './TaskPlaceAddHere'

afterEach(() => {
  cleanup()
  phone.asked = 0
  phone.fix = { lat: 29.55, lng: -98.28, accuracyM: 6 }
  phone.why = null
  io.calls = []
  io.refusal = null
})

describe('TaskPlaceAddHere', () => {
  it('is one quiet line that asks the phone nothing until it is pressed', () => {
    render(<TaskPlaceAddHere instanceId="i1" onAdded={() => {}} />)
    expect(document.querySelector('[data-task-place-add]')?.textContent).toBe('Standing at this task? Add its place')
    expect(phone.asked).toBe(0)
  })

  it('shows what the phone found and what will be saved before anything is kept, then adds the place', async () => {
    const onAdded = vi.fn()
    render(<TaskPlaceAddHere instanceId="i1" onAdded={onAdded} />)
    fireEvent.click(screen.getByRole('button', { name: 'Standing at this task? Add its place' }))
    expect(document.querySelector('[data-task-place-add-found]')?.textContent).toBe('Found you. Your phone is sure within 20 ft.')
    expect(screen.getByText('This saves where you stand as the task’s place. The app does not follow you after.')).toBeTruthy()
    expect(io.calls).toEqual([])
    fireEvent.change(screen.getByLabelText('Name it, to pick it next time'), { target: { value: 'Shop bay 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    await waitFor(() => expect(onAdded).toHaveBeenCalledTimes(1))
    expect(io.calls).toEqual([['i1', { lat: 29.55, lng: -98.28, accuracyM: 6 }, 'Shop bay 2']])
    expect(phone.asked).toBe(1)
  })

  it('a reading too wide is not kept: the words say how wide, and Try again asks once more', () => {
    phone.fix = { lat: 29.55, lng: -98.28, accuracyM: 121 }
    render(<TaskPlaceAddHere instanceId="i1" onAdded={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Standing at this task? Add its place' }))
    expect(document.querySelector('[data-task-place-add-refused]')?.textContent).toBe('Your phone is only sure within 400 ft. Try again in the open.')
    expect(screen.queryByRole('button', { name: 'Add this place' })).toBeNull()
    phone.fix = { lat: 29.55, lng: -98.28, accuracyM: 9 }
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('button', { name: 'Add this place' })).toBeTruthy()
    expect(phone.asked).toBe(2)
  })

  it('a reading with no margin is not kept either', () => {
    phone.fix = { lat: 29.55, lng: -98.28, accuracyM: null }
    render(<TaskPlaceAddHere instanceId="i1" onAdded={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Standing at this task? Add its place' }))
    expect(document.querySelector('[data-task-place-add-refused]')?.textContent).toBe('Your phone did not say how sure it is. Try again in the open.')
  })

  it('a refusal says what would make the press work, and Cancel folds it back to the one line', () => {
    phone.why = 'refused'
    render(<TaskPlaceAddHere instanceId="i1" onAdded={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Standing at this task? Add its place' }))
    expect(document.querySelector('[data-task-place-add-refused]')?.textContent).toBe('Location is off for this app. To add a place from where you stand, allow location in the phone’s settings.')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(document.querySelector('[data-task-place-add]')?.textContent).toBe('Standing at this task? Add its place')
  })

  it('a save the database refuses says its reason and keeps the reading, so the press can be tried again', async () => {
    io.refusal = 'This task already has a place. If it is wrong, say so in a note.'
    const onAdded = vi.fn()
    render(<TaskPlaceAddHere instanceId="i1" onAdded={onAdded} />)
    fireEvent.click(screen.getByRole('button', { name: 'Standing at this task? Add its place' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add this place' }))
    expect((await screen.findByRole('alert')).textContent).toBe('This task already has a place. If it is wrong, say so in a note.')
    expect(onAdded).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Add this place' })).toBeTruthy()
  })
})
