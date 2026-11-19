// @vitest-environment jsdom
/**
 * Which job is it for? (punch list #392, step 4): the search on top, today's stops, Your last jobs
 * with how the app knows, a search with the jobs a person may not paint on marked, a read that
 * fails, and the window a desk draws. Every job here is made up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { PickerNoFix, type PickerLists } from '../../lib/paintedMap/paintedMapJobPickerIo'
import { PaintAMapJobPicker, type PaintAMapJobPickerIo } from './PaintAMapJobPicker'

// jsdom has no geolocation. A phone has, and the picker offers Find the jobs near me only where there is one.
const withLocation = (on: boolean) => {
  if (on) Object.defineProperty(navigator, 'geolocation', { value: {}, configurable: true })
  else delete (navigator as unknown as { geolocation?: unknown }).geolocation
}
beforeEach(() => withLocation(true))
/** The one question the picker asks the screen: is it a desk's width? jsdom cannot say, which is a phone. */
const setDesk = (desk: boolean) => {
  window.matchMedia = ((query: string) => ({ matches: desk && query.includes('min-width'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia
}
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  withLocation(false)
  delete (window as unknown as { matchMedia?: unknown }).matchMedia
})

const job = (id: string, number: string, name: string): PickerJob => ({ id, number, name, address: `${number} Made Up Road` })
const cedar = job('j-cedar', 'J2417', 'Cedar Hollow 12')
const marlowe = job('j-marlowe', 'J2398', 'Marlowe Dental')
const pinto = job('j-pinto', 'J2431', 'Pinto Ridge 3')
const tavish = job('j-tavish', 'J2402', 'Tavish repipe')
const hadley = job('j-hadley', 'J2301', 'Hadley remodel')
const finch = job('j-finch', 'J2240', 'Finch warehouse')

const LISTS: PickerLists = {
  todayStops: [{ job: cedar, timeStart: '09:30:00', timeEnd: '12:00:00' }],
  last: [{ job: marlowe, how: 'clock', day: '2026-11-13' }],
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
    locate: vi.fn(async () => ({ lat: 30, lng: -97 })),
    near: vi.fn(async () => ({ nearest: [{ key: 'j2417 made up road', meters: 90 }, { key: 'j2402 made up road', meters: 3200 }], jobs: [tavish, cedar], paintable: new Set([tavish.id, cedar.id]) })),
    ...over,
  }
}

describe('PaintAMapJobPicker', () => {
  it('lists today then your last jobs, and one press on a row picks the job', async () => {
    const io = makeIo()
    const picked: PickerJob[] = []
    render(<PaintAMapJobPicker userId="me" io={io} onPick={(j) => picked.push(j)} onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Which job is it for?' })).toBeTruthy()
    expect(screen.getByText('Reading your jobs…')).toBeTruthy()
    await settle()
    expect(io.lists).toHaveBeenCalledWith('me')
    expect(document.querySelector('[data-picker-today]')?.textContent).toContain('J2417 · Cedar Hollow 12')
    expect(document.querySelector('[data-picker-today]')?.textContent).toContain('9:30 AM')
    expect(document.querySelector('[data-picker-last]')?.textContent).toContain('J2398 · Marlowe Dental')
    expect(document.querySelector('[data-picker-last]')?.textContent).toContain('Friday')
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
    fireEvent.change(screen.getByLabelText('Search every job'), { target: { value: 'ri' } })
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
    fireEvent.change(screen.getByLabelText('Search every job'), { target: { value: 'r' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(io.search).not.toHaveBeenCalled()
  })

  it('a person with nothing today and no clock opens on jobs they can press: a scheduled day says so, and the team fills the rest', async () => {
    const io = makeIo({
      lists: vi.fn(async () => ({
        todayStops: [],
        // In the list's own order, as the read hands them on.
        last: [
          { job: marlowe, how: 'schedule' as const, day: '2026-11-10' },
          { job: hadley, how: 'clock' as const, day: '2026-09-18' },
          { job: finch, how: 'team' as const, day: '2026-08-01' },
        ],
        paintable: new Set([finch.id, hadley.id, marlowe.id]),
        todayYmd: '2026-11-19',
      })),
    })
    const picked: PickerJob[] = []
    render(<PaintAMapJobPicker userId="me" io={io} onPick={(j) => picked.push(j)} onClose={() => {}} />)
    await settle()
    expect(screen.getByText('Your last jobs')).toBeTruthy()
    expect(document.querySelector('[data-picker-today]')).toBeNull()
    expect(document.querySelector('[data-empty-state]')).toBeNull()
    const rows = [...document.querySelectorAll('[data-picker-last] [data-picker-row]')] as HTMLButtonElement[]
    expect(rows.map((r) => r.getAttribute('data-picker-row'))).toEqual(['yes', 'yes', 'yes'])
    expect(rows.map((r) => r.querySelector('[data-picker-tag]')?.textContent)).toEqual(['scheduledNov 10', 'Sep 18', 'on the team'])
    expect(rows[0]!.textContent).toContain('J2398 · Marlowe Dental')
    fireEvent.click(rows[2]!)
    expect(picked).toEqual([finch])
  })

  it('a person nobody has put on a job is told so, with the two presses named', async () => {
    const io = makeIo({ lists: vi.fn(async () => ({ ...LISTS, todayStops: [], last: [] })) })
    render(<PaintAMapJobPicker userId="me" io={io} onPick={() => {}} onClose={() => {}} />)
    await settle()
    expect(document.querySelector('[data-empty-state]')?.textContent).toBe('You have not been on a job yet. Search for the job, or press Near me.')
    expect(screen.getByLabelText('Search every job')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Near me' })).toBeTruthy()
  })

  it('names the search alone on a device that gives no location', async () => {
    withLocation(false)
    const io = makeIo({ lists: vi.fn(async () => ({ ...LISTS, todayStops: [], last: [] })) })
    render(<PaintAMapJobPicker userId="me" io={io} onPick={() => {}} onClose={() => {}} />)
    await settle()
    expect(document.querySelector('[data-empty-state]')?.textContent).toBe('You have not been on a job yet. Search for the job above.')
  })

  it('opens on lists the caller has just read, and reads nothing', async () => {
    const io = makeIo()
    render(<PaintAMapJobPicker userId="me" io={io} lists={LISTS} onPick={() => {}} onClose={() => {}} />)
    expect(screen.queryByText('Reading your jobs…')).toBeNull()
    expect(document.querySelector('[data-picker-today]')?.textContent).toContain('Cedar Hollow 12')
    await settle()
    expect(io.lists).not.toHaveBeenCalled()
  })

  it('puts the search over the lists, and what it finds takes their place', async () => {
    vi.useFakeTimers()
    const io = makeIo()
    render(<PaintAMapJobPicker userId="me" io={io} lists={LISTS} onPick={() => {}} onClose={() => {}} />)
    const search = screen.getByLabelText('Search every job')
    const today = document.querySelector('[data-picker-today]') as HTMLElement
    // The box comes before the lists in the page, so what is found is drawn under it and over a phone's keyboard.
    expect(search.compareDocumentPosition(today) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.change(search, { target: { value: 'ri' } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
    expect(document.querySelector('[data-picker-today]')).toBeNull()
    expect(document.querySelector('[data-picker-last]')).toBeNull()
    expect(screen.getByText('Every job')).toBeTruthy()
    expect(document.querySelectorAll('[data-picker-found] [data-picker-row]')).toHaveLength(2)
    // Clearing the box brings the lists back.
    fireEvent.change(search, { target: { value: '' } })
    expect(document.querySelector('[data-picker-today]')).not.toBeNull()
  })

  it('is a sheet on a phone with no cursor in the search, and a window at a desk with the cursor in it', async () => {
    const io = makeIo()
    const phone = render(<PaintAMapJobPicker userId="me" io={io} lists={LISTS} onPick={() => {}} onClose={() => {}} />)
    expect(document.querySelector('[data-paint-a-map-job-picker]')?.getAttribute('data-picker-shape')).toBe('sheet')
    expect((screen.getByLabelText('Search every job') as HTMLInputElement).placeholder).toBe('Search every job')
    expect(document.activeElement).not.toBe(screen.getByLabelText('Search every job'))
    phone.unmount()
    setDesk(true)
    render(<PaintAMapJobPicker userId="me" io={io} lists={LISTS} onPick={() => {}} onClose={() => {}} />)
    const scrim = document.querySelector('[data-paint-a-map-job-picker]') as HTMLElement
    expect(scrim.getAttribute('data-picker-shape')).toBe('window')
    expect(scrim.style.alignItems).toBe('flex-start')
    const search = screen.getByLabelText('Search every job') as HTMLInputElement
    expect(search.placeholder).toBe('Search every job by number, name or address')
    expect(document.activeElement).toBe(search)
  })

  it('leaves out the job a map is already on, and says move in its head', async () => {
    const io = makeIo()
    render(<PaintAMapJobPicker userId="me" io={io} mode="move" excludeJobId={cedar.id} onPick={() => {}} onClose={() => {}} />)
    await settle()
    expect(screen.getByRole('dialog', { name: 'Move it to another job' })).toBeTruthy()
    expect(document.querySelector('[data-picker-today]')).toBeNull()
    expect(document.querySelector('[data-picker-last]')?.textContent).toContain('Marlowe Dental')
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
    expect(screen.getByLabelText('Search every job')).toBeTruthy()
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

  it('Near me reads the phone once and lists the jobs nearest first, each once', async () => {
    const io = makeIo()
    const picked: PickerJob[] = []
    render(<PaintAMapJobPicker userId="me" io={io} onPick={(j) => picked.push(j)} onClose={() => {}} />)
    await settle()
    expect(document.querySelector('[data-picker-near-note]')?.textContent).toBe('Near me asks where you are once, for this list.')
    expect(io.locate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Near me' }))
    await settle()
    expect(io.locate).toHaveBeenCalledTimes(1)
    expect(io.near).toHaveBeenCalledWith({ lat: 30, lng: -97 })
    const rows = [...document.querySelectorAll('[data-picker-near] [data-picker-row]')]
    expect(rows.map((r) => r.textContent)).toEqual([expect.stringContaining('Cedar Hollow 12'), expect.stringContaining('Tavish repipe')])
    expect(rows[0]!.textContent).toContain('about 300 ft')
    expect(rows[1]!.textContent).toContain('about 2.0 mi')
    expect(document.querySelector('[data-picker-near-only]')?.textContent).toBe('Only jobs with an address the app has placed on the map are listed. Search finds the rest.')
    // Cedar Hollow is under Near you now, so Today does not say it again.
    expect(document.querySelector('[data-picker-today]')).toBeNull()
    expect(document.querySelector('[data-picker-last]')?.textContent).toContain('Marlowe Dental')
    // The press stays beside the search, for a person who has moved. Its promise is not said twice.
    expect(screen.getByRole('button', { name: 'Near me' })).toBeTruthy()
    expect(document.querySelector('[data-picker-near-note]')).toBeNull()
    fireEvent.click(rows[1]!)
    expect(picked).toEqual([tavish])
  })

  it('says why when the phone gives no place, and the press can be tried again', async () => {
    let refuse = true
    const io = makeIo({
      locate: vi.fn(async () => {
        if (refuse) throw new PickerNoFix('refused')
        return { lat: 30, lng: -97 }
      }),
    })
    render(<PaintAMapJobPicker userId="me" io={io} onPick={() => {}} onClose={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Near me' }))
    await settle()
    expect(screen.getByRole('alert').textContent).toBe('Location is off for this app. Allow it in the phone’s settings, or search for the job.')
    expect(io.near).not.toHaveBeenCalled()
    refuse = false
    fireEvent.click(screen.getByRole('button', { name: 'Near me' }))
    await settle()
    expect(document.querySelector('[data-picker-near]')).not.toBeNull()
  })

  it('names no phone in that reason at a desk', async () => {
    setDesk(true)
    const io = makeIo({ locate: vi.fn(async () => Promise.reject(new PickerNoFix('refused'))) })
    render(<PaintAMapJobPicker userId="me" io={io} onPick={() => {}} onClose={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Near me' }))
    await settle()
    expect(screen.getByRole('alert').textContent).toBe('Location is off for this app. Allow it in the browser’s settings, or search for the job.')
  })

  it('with nothing placed nearby, says so and points at the search', async () => {
    const io = makeIo({ near: vi.fn(async () => ({ nearest: [], jobs: [], paintable: new Set<string>() })) })
    render(<PaintAMapJobPicker userId="me" io={io} onPick={() => {}} onClose={() => {}} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Near me' }))
    await settle()
    expect(document.querySelector('[data-picker-near]')).toBeNull()
    expect(screen.getByText('No job the app has placed on the map is near you. Search for the job.')).toBeTruthy()
  })

  it('offers no such press on a device that gives no location', async () => {
    withLocation(false)
    render(<PaintAMapJobPicker userId="me" io={makeIo()} onPick={() => {}} onClose={() => {}} />)
    await settle()
    expect(screen.queryByRole('button', { name: 'Near me' })).toBeNull()
  })
})
