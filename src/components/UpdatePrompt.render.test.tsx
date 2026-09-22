// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { UpdatePrompt } from './UpdatePrompt'
import { AUTO_RELOAD_KEY } from '../lib/autoReload'
import { __resetUnsavedWorkForTests, holdUnsavedWork, wrapFetchCountingWrites } from '../lib/unsavedWork'

type SWOpts = { onNeedRefresh?: () => void; onRegisteredSW?: (url: string, reg: unknown) => void }
const swOpts: { current: SWOpts | null } = { current: null }
const updateSW = vi.fn(async () => {})
vi.mock('virtual:pwa-register', () => ({
  registerSW: (opts: SWOpts) => {
    swOpts.current = opts
    return updateSW
  },
}))

function Nav() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate('/jobs')}>
      go
    </button>
  )
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <UpdatePrompt />
      <Routes>
        <Route path="*" element={<Nav />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('UpdatePrompt auto-reload (v2.3740)', () => {
  const reload = vi.fn()
  const originalLocation = window.location
  beforeEach(() => {
    vi.useFakeTimers()
    reload.mockReset()
    updateSW.mockClear()
    sessionStorage.clear()
    __resetUnsavedWorkForTests()
    Object.defineProperty(window, 'location', { value: { ...originalLocation, reload }, writable: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
    document.body.innerHTML = ''
  })

  it('first paint, untouched: reloads itself and says so, no buttons', () => {
    mount()
    act(() => swOpts.current?.onNeedRefresh?.())
    expect(screen.getByText('Updating to the newest version…')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Reload' })).toBeNull()
    expect(updateSW).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(AUTO_RELOAD_KEY)).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(reload).toHaveBeenCalled()
  })

  it('after a touch, first paint is over: the pill shows and nothing reloads', () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    expect(screen.getByText('A new version is ready.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    expect(updateSW).not.toHaveBeenCalled()
  })

  it('a route change with nothing open reloads; with a dialog open it only shows the pill', () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    // A dialog is open: navigating must not reload.
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    fireEvent.click(screen.getByText('go'))
    expect(updateSW).not.toHaveBeenCalled()
    expect(screen.getByText('A new version is ready.')).toBeTruthy()
  })

  it('a route change with nothing open reloads', () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    expect(updateSW).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('go'))
    expect(updateSW).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Updating to the newest version…')).toBeTruthy()
  })

  it('"Not now" holds for ten minutes even across route changes', () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss update notice until the next deploy' }))
    fireEvent.click(screen.getByText('go'))
    expect(updateSW).not.toHaveBeenCalled()
    expect(screen.queryByText('A new version is ready.')).toBeNull()
  })

  it('v2.3741: a held unsaved form or a write in flight blocks the route-change reload', async () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    const release = holdUnsavedWork('Legal firm settings')
    fireEvent.click(screen.getByText('go'))
    expect(updateSW).not.toHaveBeenCalled()
    release()
    let finish: (r: Response) => void = () => undefined
    const counting = wrapFetchCountingWrites(() => new Promise<Response>((r) => (finish = r)))
    const pending = counting('https://x/rpc/save', { method: 'POST' })
    fireEvent.click(screen.getByText('go'))
    expect(updateSW).not.toHaveBeenCalled()
    finish(new Response('{}'))
    await pending
  })

  it('v2.3741: a tab hidden five minutes reloads when it comes back; hidden one minute does not', () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    const setVisibility = (v: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { value: v, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    act(() => setVisibility('hidden'))
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    act(() => setVisibility('visible'))
    expect(updateSW).not.toHaveBeenCalled()
    act(() => setVisibility('hidden'))
    act(() => {
      vi.advanceTimersByTime(6 * 60_000)
    })
    // The hidden timer fired at 5 min + 1 s while still hidden.
    expect(updateSW).toHaveBeenCalledTimes(1)
    act(() => setVisibility('visible'))
    expect(updateSW).toHaveBeenCalledTimes(1)
  })

  it('v2.3741: a visible tab untouched for half an hour reloads on the minute check', () => {
    mount()
    fireEvent.pointerDown(window)
    act(() => swOpts.current?.onNeedRefresh?.())
    act(() => {
      vi.advanceTimersByTime(29 * 60_000)
    })
    expect(updateSW).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(2 * 60_000)
    })
    expect(updateSW).toHaveBeenCalledTimes(1)
  })

  it('loop guard: a tab that auto-reloaded a moment ago shows the pill instead', () => {
    sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now() - 5_000))
    mount()
    act(() => swOpts.current?.onNeedRefresh?.())
    expect(screen.getByText('A new version is ready.')).toBeTruthy()
    expect(updateSW).not.toHaveBeenCalled()
  })
})
