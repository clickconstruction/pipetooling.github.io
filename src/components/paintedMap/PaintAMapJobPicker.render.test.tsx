// @vitest-environment jsdom
/**
 * Which job is it for? (punch list #392, step 4): today's stops, the jobs clocked onto lately, a
 * search with the jobs a person may not paint on marked, and a read that fails. Every job here is
 * made up.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../hooks/useModalStackEntry', () => ({ useModalStackEntry: () => () => true }))
/** The retry panel, stood in for: it says the failure and offers its retry. */
vi.mock('../OfflineRetryPanel', () => ({
  default: (props: { failure: { kind: string; message: string } | null; onRetry: () => void; idempotent?: boolean }) =>
    props.failure ? (
      <div data-testid="retry-panel" data-kind={props.failure.kind} data-idempotent={props.idempotent ? 'yes' : 'no'}>
        {props.failure.message}
        <button type="button" onClick={() => void props.onRetry()}>Retry</button>
      </div>
    ) : null,
}))

import type { PickerJob } from '../../lib/paintedMap/paintedMapJobPicker'
import type { PickerLists } from '../../lib/paintedMap/paintedMapJobPickerIo'
import { PaintAMapJobPicker, type PaintAMapJobPickerIo } from './PaintAMapJobPicker'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const job = (id: string, number: string, name: string): PickerJob => ({ id, number, name, address: `${number} Made Up Road` })
const cedar = job('j-cedar', 'J2417', 'Cedar Hollow 12')
const marlowe = job('j-marlowe', 'J2398', 'Marlowe Dental')
const pinto = job('j-pinto', 'J2431', 'Pinto Ridge 3')
const tavish = job('j-tavish', 'J2402', 'Tavish repipe')

const LISTS: PickerLists = {
  todayStops: [{ job: cedar, timeStart: '09:30:00', timeEnd: '12:00:00' }],
  lately: [{ job: marlowe, lastOn: '2026-11-13' }],
  paintable: new Set([cedar.id, marlowe.id]),
  todayYmd: '2026-11-18',
}

const settle = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

function makeIo(over: Partial<PaintAMapJobPickerIo> = {}): PaintAMapJobPickerIo {
  return {
    lists: vi.fn(async () => LISTS),
    search: vi.fn(async () => ({ hits: [pinto, tavish], paintable: new Set([pinto.id]) })),
    ...over,
  }
}

describe('PaintAMapJobPicker', () => {
  it('lists today then lately, and one press on a row picks the job', async () => {
    const io = makeIo()
    const picked: PickerJob[] = []
    render(<PaintAMapJobPicker userId="me" io={io} onPick={(j) => picked.push(j)} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Which job is it for?' })).toBeTruthy()
    expect(screen.getByText('Reading your jobs…')).toBeTruthy()
    await settle()
    expect(io.lists).toHaveBeenCalledWith('me')
    expect(document.querySelector('[data-picker-today]')?.textContent).toContain('J2417 · Cedar Hollow 12')
    expect(document.querySelector('[data-picker-today]')?.textContent).toContain('9:30 AM')
    expect(document.querySelector('[data-picker-lately]')?.textContent).toContain('J2398 · Marlowe Dental')
    expect(document.querySelector('[data-picker-lately]')?.textContent).toContain('Friday')
    fireEvent.click(screen.getByRole('button', { name: /Marlowe Dental/ }))
    expect(picked).toEqual([marlowe])
  })

  it('searches every job, and a hit the person may not paint on says why and takes no press', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    const picked: PickerJob[] = []
    render(<PaintAMapJobPicker userId="me" io={io} onPick={(j) => picked.push(j)} onClose={() => {}} />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    fireEvent.change(screen.getByLabelText('Or search every job'), { target: { value: 'ri' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(io.search).toHaveBeenCalledWith('ri', 'me')
    const rows = [...document.querySelectorAll('[data-picker-found] [data-picker-row]')] as HTMLButtonElement[]
    expect(rows.map((r) => r.getAttribute('data-picker-row'))).toEqual(['yes', 'no'])
    expect(rows[1]!.disabled).toBe(true)
    expect(rows[1]!.textContent).toContain('You are not on this job, so you cannot paint a map for it.')
    fireEvent.click(rows[1]!)
    expect(picked).toEqual([])
    fireEvent.click(rows[0]!)
    expect(picked).toEqual([pinto])
  })

  it('does not search on one letter', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    render(<PaintAMapJobPicker userId="me" io={io} onPick={() => {}} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Or search every job'), { target: { value: 'r' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(io.search).not.toHaveBeenCalled()
  })

  it('with no stop and no clock lately, says so and points at the search', async () => {
    const io = makeIo({ lists: vi.fn(async () => ({ ...LISTS, todayStops: [], lately: [] })) })
    render(<PaintAMapJobPicker userId="me" io={io} onPick={() => {}} onClose={() => {}} />)
    await settle()
    expect(document.querySelector('[data-empty-state]')?.textContent).toContain('Search for the job.')
    expect(screen.getByLabelText('Or search every job')).toBeTruthy()
  })

  it('leaves out the job a map is already on, and says move in its head', async () => {
    const io = makeIo()
    render(<PaintAMapJobPicker userId="me" io={io} mode="move" excludeJobId={cedar.id} onPick={() => {}} onClose={() => {}} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Move it to another job' })).toBeTruthy()
    expect(document.querySelector('[data-picker-today]')).toBeNull()
    expect(document.querySelector('[data-picker-lately]')?.textContent).toContain('Marlowe Dental')
  })

  it('a read that fails draws the retry panel, reads again on Retry, and offers to paint now where allowed', async () => {
    let fail = true
    const io = makeIo({
      lists: vi.fn(async () => {
        if (fail) throw new TypeError('Failed to fetch')
        return LISTS
      }),
    })
    const later = vi.fn()
    render(<PaintAMapJobPicker userId="me" io={io} onPick={() => {}} onClose={() => {}} onLater={later} />)
    await settle()
    const panel = screen.getByTestId('retry-panel')
    expect(panel.getAttribute('data-idempotent')).toBe('yes')
    fireEvent.click(screen.getByRole('button', { name: 'Paint now and pick the job later' }))
    expect(later).toHaveBeenCalledTimes(1)
    // The search is still there: it may answer when the lists did not.
    expect(screen.getByLabelText('Or search every job')).toBeTruthy()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await settle()
    expect(screen.queryByTestId('retry-panel')).toBeNull()
    expect(document.querySelector('[data-picker-today]')?.textContent).toContain('Cedar Hollow 12')
  })

  it('offers no paint-now where the caller does not allow it', async () => {
    const io = makeIo({ lists: vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))) })
    render(<PaintAMapJobPicker userId="me" io={io} mode="move" onPick={() => {}} onClose={() => {}} />)
    await settle()
    expect(screen.getByTestId('retry-panel')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Paint now and pick the job later' })).toBeNull()
  })

  it('closes on Cancel and on Escape', async () => {
    const closed = vi.fn()
    render(<PaintAMapJobPicker userId="me" io={makeIo()} onPick={() => {}} onClose={closed} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closed).toHaveBeenCalledTimes(2)
  })
})
