// @vitest-environment jsdom
/**
 * Paint a map's start sheet (punch list #345, PR 2): a name, what the map is for, and Start
 * drawing. A job in a development may be painted for the job or for every lot. Nothing is saved
 * by this sheet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

/** The picker, stood in for: it says how it was opened, one press picks a made-up job, one says paint now. */
vi.mock('./PaintAMapJobPicker', () => ({
  PaintAMapJobPicker: (props: { mode?: string; excludeJobId?: string | null; lists?: unknown; onPick: (job: { id: string; number: string; name: string; address: string; developmentId?: string | null }) => void; onClose: () => void; onLater?: () => void }) => (
    <div data-testid="job-picker" data-mode={props.mode} data-exclude={props.excludeJobId ?? ''} data-handed={props.lists ? 'yes' : 'no'}>
      <button type="button" onClick={() => props.onPick({ id: 'j9', number: 'J900', name: 'Made Up Lot', address: '9 Made Up Road' })}>pick J900</button>
      <button type="button" onClick={() => props.onPick({ id: 'j7', number: 'J700', name: 'Site Lot 7', address: '7 Site Road', developmentId: 'd1' })}>pick J700</button>
      <button type="button" onClick={props.onClose}>cancel the picker</button>
      {props.onLater ? <button type="button" onClick={props.onLater}>paint now</button> : null}
    </div>
  ),
}))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, role: 'helpers' }) }))
vi.mock('../../hooks/useModalStackEntry', () => ({ useModalStackEntry: () => () => true }))

import type { PickerLists } from '../../lib/paintedMap/paintedMapJobPickerIo'
import { PaintAMapStartSheet } from './PaintAMapStartSheet'
import type { PaintedMapToStart } from './PaintedMapWindow'

/** A person nobody has put on a job: the sheet has no last job to open on, so it asks. */
const NOTHING: PickerLists = { todayStops: [], last: [], paintable: new Set(), todayYmd: '2026-11-19' }
const noLists = async () => NOTHING
/** The read lands, and the sheet draws what it found. */
const settle = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}
/** The one question the sheet asks the screen: is it a desk's width? jsdom cannot say, which is a phone. */
const setDesk = (desk: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: desk && query.includes('min-width'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
}

/** What the phone says of the page shows, as `window.visualViewport` gives it. jsdom has none, which keeps the page box. */
const setShows = (box: { height: number; offsetTop: number } | null) => {
  if (box) Object.defineProperty(window, 'visualViewport', { value: { ...box, addEventListener: () => {}, removeEventListener: () => {} }, configurable: true })
  else delete (window as unknown as { visualViewport?: unknown }).visualViewport
}

// jsdom has no geolocation. A phone has, and the sheet offers walking only where there is one.
const withLocation = (on: boolean) => {
  if (on) Object.defineProperty(navigator, 'geolocation', { value: {}, configurable: true })
  else delete (navigator as unknown as { geolocation?: unknown }).geolocation
}
beforeEach(() => withLocation(true))
afterEach(() => {
  cleanup()
  withLocation(false)
  setShows(null)
  delete (window as unknown as { matchMedia?: unknown }).matchMedia
})

describe('PaintAMapStartSheet', () => {
  it('opened with no job by a person with no last job, asks which job first and draws no sheet behind the question (punch list #392)', async () => {
    const closed = vi.fn()
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={noLists} onStart={() => {}} onClose={closed} />)
    await settle()
    expect(screen.getByTestId('job-picker').getAttribute('data-mode')).toBe('pick')
    // The picker opens on the lists the sheet has just read, so it reads nothing more.
    expect(screen.getByTestId('job-picker').getAttribute('data-handed')).toBe('yes')
    expect(document.querySelector('[data-paint-a-map-start]')).toBeNull()
    // Cancel on the question closes everything: there is no sheet to go back to.
    fireEvent.click(screen.getByRole('button', { name: 'cancel the picker' }))
    expect(closed).toHaveBeenCalledTimes(1)
  })

  const marlowe = { id: 'j-marlowe', number: 'J2398', name: 'Marlowe Dental', address: '410 Made Up Bend' }
  const cedar = { id: 'j-cedar', number: 'J2417', name: 'Cedar Hollow 12', address: '1208 Made Up Loop' }
  const withLast = (over: Partial<PickerLists> = {}): PickerLists => ({
    todayStops: [],
    last: [
      { job: cedar, how: 'clock', day: '2026-09-18' },
      { job: marlowe, how: 'schedule', day: '2026-11-10' },
    ],
    paintable: new Set([marlowe.id, cedar.id]),
    todayYmd: '2026-11-19',
    ...over,
  })

  it('opened with no job by a person with a last job, opens on it with no question and says how it knows (the owner’s word of 2026-11-19)', async () => {
    const started: PaintedMapToStart[] = []
    const load = vi.fn(async () => withLast())
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={load} onStart={(s) => started.push(s)} onClose={() => {}} />)
    // While the read is out the sheet's own head is drawn, and no question.
    expect(document.querySelector('[data-paint-a-map-reading]')?.textContent).toContain('Reading your jobs…')
    expect(screen.queryByTestId('job-picker')).toBeNull()
    await settle()
    expect(load).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledWith('me')
    expect(screen.queryByTestId('job-picker')).toBeNull()
    const forBlock = document.querySelector('[data-paint-a-map-for]') as HTMLElement
    expect(forBlock.textContent).toContain('J2398 · Marlowe Dental')
    expect(forBlock.textContent).toContain('410 Made Up Bend')
    expect(document.querySelector('[data-paint-a-map-guess]')?.textContent).toBe('The last job on your schedule, Nov 10.')
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand' }))
    expect(started[0]!.home).toMatchObject({ jobId: 'j-marlowe', label: 'J2398 · Marlowe Dental', canChangeJob: true })
  })

  it('Change the job on a guess opens the picker on the lists already read, and a pick takes the guess’s line away', async () => {
    const load = vi.fn(async () => withLast())
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={load} onStart={() => {}} onClose={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Change the job' }))
    const picker = screen.getByTestId('job-picker')
    expect(picker.getAttribute('data-mode')).toBe('change')
    expect(picker.getAttribute('data-exclude')).toBe('j-marlowe')
    expect(picker.getAttribute('data-handed')).toBe('yes')
    fireEvent.click(screen.getByRole('button', { name: 'pick J900' }))
    expect((document.querySelector('[data-paint-a-map-for]') as HTMLElement).textContent).toContain('J900 · Made Up Lot')
    expect(document.querySelector('[data-paint-a-map-guess]')).toBeNull()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('asks when a job is on today’s schedule, and when the person is only on a team', async () => {
    const today = render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={async () => withLast({ todayStops: [{ job: cedar, timeStart: '09:30:00', timeEnd: '12:00:00' }] })} onStart={() => {}} onClose={() => {}} />)
    await settle()
    expect(screen.getByTestId('job-picker').getAttribute('data-mode')).toBe('pick')
    today.unmount()
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={async () => withLast({ last: [{ job: cedar, how: 'team', day: null }] })} onStart={() => {}} onClose={() => {}} />)
    await settle()
    expect(screen.getByTestId('job-picker').getAttribute('data-mode')).toBe('pick')
  })

  it('asks a person whose only signs are jobs they changed, and hands the picker those jobs', async () => {
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={async () => withLast({ last: [{ job: cedar, how: 'changed', day: '2026-11-18' }] })} onStart={() => {}} onClose={() => {}} />)
    await settle()
    expect(screen.getByTestId('job-picker').getAttribute('data-mode')).toBe('pick')
    expect(screen.getByTestId('job-picker').getAttribute('data-handed')).toBe('yes')
  })

  const changedSince = [
    { job: marlowe, how: 'changed' as const, day: '2026-11-18', there: { how: 'schedule' as const, day: '2026-11-10' } },
    { job: cedar, how: 'changed' as const, day: '2026-11-17' },
  ]

  it('opens on the last job they were at, though they changed another since', async () => {
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={async () => withLast({ last: changedSince })} onStart={() => {}} onClose={() => {}} />)
    await settle()
    expect(screen.queryByTestId('job-picker')).toBeNull()
    expect(document.querySelector('[data-paint-a-map-guess]')?.textContent).toBe('The last job on your schedule, Nov 10.')
  })

  it('opens on the next job on their schedule over the last one, and says so (the owner’s word of 2026-11-19, call 16)', async () => {
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={async () => withLast({ soon: [{ job: cedar, day: '2026-11-20', timeStart: '07:30:00' }], last: changedSince })} onStart={() => {}} onClose={() => {}} />)
    await settle()
    expect(screen.queryByTestId('job-picker')).toBeNull()
    expect(document.querySelector('[data-paint-a-map-start]')?.textContent).toContain('J2417 · Cedar Hollow 12')
    expect(document.querySelector('[data-paint-a-map-guess]')?.textContent).toBe('The next job on your schedule, tomorrow.')
  })

  it('a read that fails falls to the question, which reads again and draws its own retry', async () => {
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={async () => Promise.reject(new TypeError('Failed to fetch'))} onStart={() => {}} onClose={() => {}} />)
    await settle()
    const picker = screen.getByTestId('job-picker')
    expect(picker.getAttribute('data-mode')).toBe('pick')
    expect(picker.getAttribute('data-handed')).toBe('no')
    // Paint now is still offered there: a person with no signal must be able to paint.
    expect(screen.getByRole('button', { name: 'paint now' })).toBeTruthy()
  })

  it('a sheet opened on a job reads nothing', async () => {
    const load = vi.fn(async () => withLast())
    render(<PaintAMapStartSheet home={{ jobId: 'j1', developmentId: null, label: 'J100 · First Lot' }} loadLists={load} onStart={() => {}} onClose={() => {}} />)
    await settle()
    expect(load).not.toHaveBeenCalled()
    expect(document.querySelector('[data-paint-a-map-guess]')).toBeNull()
  })

  it('is a sheet on a phone and a window at a desk, where it is not drawn behind the picker', async () => {
    const phone = render(<PaintAMapStartSheet home={{ jobId: 'j1', developmentId: null, label: 'J100 · First Lot' }} onStart={() => {}} onClose={() => {}} />)
    expect(document.querySelector('[data-paint-a-map-start]')?.getAttribute('data-paint-a-map-shape')).toBe('sheet')
    phone.unmount()
    setDesk(true)
    render(<PaintAMapStartSheet home={{ jobId: 'j1', developmentId: null, label: 'J100 · First Lot', canChangeJob: true }} onStart={() => {}} onClose={() => {}} />)
    const scrim = document.querySelector('[data-paint-a-map-start]') as HTMLElement
    expect(scrim.getAttribute('data-paint-a-map-shape')).toBe('window')
    expect(scrim.style.alignItems).toBe('flex-start')
    // The picker hangs at the same height and is shorter, so the sheet behind it is kept and not drawn.
    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'The back gate' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change the job' }))
    const sheet = scrim.querySelector('[role=dialog]') as HTMLElement
    expect(sheet.style.visibility).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'cancel the picker' }))
    expect(sheet.style.visibility).toBe('')
    expect((screen.getByLabelText('What is it?') as HTMLInputElement).value).toBe('The back gate')
  })

  it('on a phone the scrim is the part of the page that shows, so the sheet ends above Safari’s bar (the simulator’s walk of 2026-11-25)', async () => {
    // The phone says 706 px of the page show: the rest is under Safari's bar.
    setShows({ height: 706, offsetTop: 0 })
    const phone = render(<PaintAMapStartSheet home={{ jobId: 'j1', developmentId: null, label: 'J100 · First Lot' }} onStart={() => {}} onClose={() => {}} />)
    const scrim = document.querySelector('[data-paint-a-map-start]') as HTMLElement
    expect(scrim.style.height).toBe('706px')
    expect(parseFloat(scrim.style.top)).toBe(0)
    expect(scrim.style.bottom).toBe('')
    expect(scrim.style.alignItems).toBe('flex-end')
    // The sheet is at most as tall as that band and scrolls inside it, so Start with a place is reachable.
    const sheet = scrim.querySelector('[role=dialog]') as HTMLElement
    expect(sheet.style.maxHeight).toBe('100%')
    expect(sheet.style.overflowY).toBe('auto')
    expect(screen.getByRole('button', { name: /Start with a place/ })).toBeTruthy()
    phone.unmount()
    // At a desk the window keeps the page box, whatever shows.
    setDesk(true)
    render(<PaintAMapStartSheet home={{ jobId: 'j1', developmentId: null, label: 'J100 · First Lot' }} onStart={() => {}} onClose={() => {}} />)
    const desk = document.querySelector('[data-paint-a-map-start]') as HTMLElement
    expect(desk.style.height).toBe('')
    expect(parseFloat(desk.style.inset)).toBe(0)
  })

  it('a job pressed opens the sheet on it, with For at the top, and starts the map there', async () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={noLists} onStart={(s) => started.push(s)} onClose={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'pick J900' }))
    expect(screen.queryByTestId('job-picker')).toBeNull()
    const forBlock = document.querySelector('[data-paint-a-map-for]') as HTMLElement
    expect(forBlock.textContent).toContain('J900 · Made Up Lot')
    expect(forBlock.textContent).toContain('9 Made Up Road')
    // For leads the sheet: it comes before the name.
    const body = forBlock.parentElement as HTMLElement
    expect(body.firstElementChild).toBe(forBlock)
    expect(screen.queryByText(/It is on no job yet/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Leave it on no job' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand' }))
    expect(started[0]!.home).toMatchObject({ jobId: 'j9', label: 'J900 · Made Up Lot', address: '9 Made Up Road', canChangeJob: true })
  })

  it('a job the painter picked can be changed, and the picker leaves that job out', async () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={noLists} onStart={(s) => started.push(s)} onClose={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'pick J900' }))
    fireEvent.change(screen.getByLabelText('What is it?'), { target: { value: 'The back gate' } })
    fireEvent.click(screen.getByRole('button', { name: 'Change the job' }))
    const picker = screen.getByTestId('job-picker')
    expect(picker.getAttribute('data-mode')).toBe('change')
    expect(picker.getAttribute('data-exclude')).toBe('j9')
    // The sheet stays behind the picker, so what was typed is kept.
    fireEvent.click(screen.getByRole('button', { name: 'cancel the picker' }))
    expect((screen.getByLabelText('What is it?') as HTMLInputElement).value).toBe('The back gate')
    expect((document.querySelector('[data-paint-a-map-for]') as HTMLElement).textContent).toContain('J900 · Made Up Lot')
  })

  it('a lot picked from the list keeps its two chips, the job or every lot', async () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={noLists} onStart={(s) => started.push(s)} onClose={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'pick J700' }))
    expect(screen.getByRole('group', { name: 'For' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'The whole development' }))
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand' }))
    expect(started[0]!.home).toMatchObject({ jobId: null, developmentId: 'd1' })
  })

  it('with the lists unread, paints now on no job and can still pick the job', async () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: null, developmentId: null }} loadLists={noLists} onStart={(s) => started.push(s)} onClose={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'paint now' }))
    expect(screen.getByText('It is on no job yet. It stays yours and the office’s until it is put on one.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pick the job it is for' }))
    // The second ask offers no paint-now: that answer was already given.
    expect(screen.queryByRole('button', { name: 'paint now' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'cancel the picker' }))
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand' }))
    expect(started[0]!.home.jobId ?? null).toBeNull()
  })

  it('opened by the Dashboard press on a job the app picked, offers Change the job', () => {
    const started: PaintedMapToStart[] = []
    render(<PaintAMapStartSheet home={{ jobId: 'j1', developmentId: null, label: 'J100 · First Lot', address: '1 First Road', canChangeJob: true }} onStart={(s) => started.push(s)} onClose={() => {}} />)
    expect((document.querySelector('[data-paint-a-map-for]') as HTMLElement).textContent).toContain('J100 · First Lot')
    fireEvent.click(screen.getByRole('button', { name: 'Change the job' }))
    expect(screen.getByTestId('job-picker').getAttribute('data-exclude')).toBe('j1')
    fireEvent.click(screen.getByRole('button', { name: 'pick J900' }))
    expect(screen.queryByTestId('job-picker')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Draw it by hand' }))
    expect(started[0]!.home).toMatchObject({ jobId: 'j9', label: 'J900 · Made Up Lot', address: '9 Made Up Road' })
  })

  it('a job the sheet was opened on from its own address cannot be changed', () => {
    render(<PaintAMapStartSheet home={{ jobId: 'j1', developmentId: null, label: 'J100 · First Lot' }} onStart={() => {}} onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Change the job' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pick the job it is for' })).toBeNull()
    expect(screen.queryByTestId('job-picker')).toBeNull()
  })

  it('has no paragraph between the walk box and Draw it by hand, so both presses sit near the fold', () => {
    render(<PaintAMapStartSheet home={{ jobId: 'j1', label: 'Lot 14' }} onStart={() => {}} onClose={() => {}} />)
    const draw = screen.getByRole('button', { name: 'Draw it by hand' })
    expect(draw.previousElementSibling?.getAttribute('data-paint-a-map-walk-box')).not.toBeNull()
    expect(screen.queryByText(/Or draw the line by hand/)).toBeNull()
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

  it('closes on Cancel', () => {
    let closed = 0
    render(<PaintAMapStartSheet home={{ jobId: 'j1', label: 'Lot 14' }} onStart={() => {}} onClose={() => (closed += 1)} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(closed).toBe(1)
  })
})
