// @vitest-environment jsdom
/**
 * Paint a map's start sheet (punch list #345, PR 2): a name, what the map is for, and Start
 * drawing. A job in a development may be painted for the job or for every lot. Nothing is saved
 * by this sheet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

/** The job search, stood in for: one press picks a made-up job. */
vi.mock('../costBatches/CostBatchJobPicker', () => ({
  CostBatchJobPicker: (props: { title: string; onPick: (job: { id: string; hcp_number: string; job_name: string; job_address: string }) => void }) => (
    <div data-testid="job-picker">
      {props.title}
      <button type="button" onClick={() => props.onPick({ id: 'j9', hcp_number: 'J900', job_name: 'Made Up Lot', job_address: '9 Made Up Road' })}>pick J900</button>
    </div>
  ),
}))

import { PaintAMapStartSheet } from './PaintAMapStartSheet'
import type { PaintedMapToStart } from './PaintedMapWindow'

// jsdom has no geolocation. A phone has, and the sheet offers walking only where there is one.
const withLocation = (on: boolean) => {
  if (on) Object.defineProperty(navigator, 'geolocation', { value: {}, configurable: true })
  else delete (navigator as unknown as { geolocation?: unknown }).geolocation
}
beforeEach(() => withLocation(true))
afterEach(() => {
  cleanup()
  withLocation(false)
})

describe('PaintAMapStartSheet', () => {
  it('opened with no job, says so, and starts a map on no job', () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} onStart={(s) => started.push(s)} onClose={() => {}} />)
    expect(screen.getByText('It is on no job yet. It stays yours and the office’s until it is put on one.')).toBeTruthy()
    expect(screen.queryByTestId('job-picker')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand' }))
    expect(started[0]!.home.jobId ?? null).toBeNull()
  })

  it('opened with no job, lets the painter pick the job it is for, and starts the map there', () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} onStart={(s) => started.push(s)} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick the job it is for' }))
    expect(screen.getByTestId('job-picker').textContent).toContain('Which job is it for?')
    fireEvent.click(screen.getByRole('button', { name: 'pick J900' }))
    expect(screen.getByText('J900 · Made Up Lot')).toBeTruthy()
    expect(screen.queryByText(/It is on no job yet/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand' }))
    expect(started[0]!.home).toMatchObject({ jobId: 'j9', label: 'J900 · Made Up Lot', address: '9 Made Up Road' })
  })

  it('lets a picked job be taken back', () => {
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} onStart={() => {}} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pick the job it is for' }))
    fireEvent.click(screen.getByRole('button', { name: 'pick J900' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leave it on no job' }))
    expect(screen.getByText(/It is on no job yet/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pick the job it is for' })).toBeTruthy()
  })

  it('offers no job search on a sheet opened for a job', () => {
    render(<PaintAMapStartSheet home={{ jobId: 'j1', label: 'Lot 14' }} onStart={() => {}} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Pick the job it is for' })).toBeNull()
  })

  it('names the map from a chip and starts it for the job', () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: 'j1', label: 'Lot 14' }} onStart={(s) => started.push(s)} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'The way in' }))
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand' }))
    expect(started).toHaveLength(1)
    expect(started[0]).toMatchObject({ name: 'The way in', words: '', first: 'line', home: { jobId: 'j1', label: 'Lot 14' } })
    expect(started[0]!.id.length).toBeGreaterThan(8)
  })

  it('offers walking first, and says what the phone will do before it is asked anything', () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: 'j1' }} onStart={(s) => started.push(s)} onClose={() => {}} />)
    expect(screen.getByText('Keep this screen on and in your hand. The line stops if the phone locks.')).toBeTruthy()
    expect(screen.getByText('The line stays on this phone until you press Save.')).toBeTruthy()
    expect(screen.getByText(/It is read only while this screen says Painting/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Walk or drive it' }))
    expect(started[0]!.first).toBe('walk')
  })

  it('offers no walking on a device that gives no location, and still draws by hand', () => {
    withLocation(false)
    render(<PaintAMapStartSheet home={{ jobId: 'j1' }} onStart={() => {}} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Walk or drive it' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Draw it by hand' })).toBeTruthy()
  })

  it('may start with a place', () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: 'j1' }} onStart={(s) => started.push(s)} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Start with a place' }))
    expect(started[0]!.first).toBe('place')
  })

  it('gives a map nobody named a name', () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: 'j1' }} onStart={(s) => started.push(s)} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand' }))
    expect(started[0]!.name).toBe('A painted map')
  })

  it('lets a job in a development be painted for every lot, and then the job is not its home', () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: 'j1', developmentId: 'd1', label: 'Lot 14', developmentLabel: 'Juniper Ridge' }} onStart={(s) => started.push(s)} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Lot 14' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Juniper Ridge, every lot' }))
    expect(screen.getByText('It will show on every job in the development.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand' }))
    expect(started[0]!.home).toMatchObject({ jobId: null, developmentId: 'd1' })
  })

  it('keeps one home when the job is chosen', () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: 'j1', developmentId: 'd1', label: 'Lot 14', developmentLabel: 'Juniper Ridge' }} onStart={(s) => started.push(s)} onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand' }))
    expect(started[0]!.home).toMatchObject({ jobId: 'j1', developmentId: null })
  })

  it('says a map with no home is the painter\'s and the office\'s, and closes on Cancel', () => {
    let closed = 0
    render(<PaintAMapStartSheet home={{}} onStart={() => {}} onClose={() => (closed += 1)} />)
    expect(screen.getByText(/It is on no job yet/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(closed).toBe(1)
  })
})
