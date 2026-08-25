// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { RouteLoadingFallback } from './RouteLoadingFallback'

describe('RouteLoadingFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('starts as a bare Loading… with no countdown', () => {
    render(<RouteLoadingFallback />)
    expect(screen.getByText('Loading…')).toBeTruthy()
    expect(screen.queryByText(/more options in/)).toBeNull()
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByText(/more options in/)).toBeNull()
  })

  it('shows the countdown from 3s and counts down toward 10', () => {
    render(<RouteLoadingFallback />)
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByText(/more options in 7/)).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.getByText(/more options in 3/)).toBeTruthy()
    expect(screen.getByText('Loading…')).toBeTruthy()
  })

  it('shows Reload and Fix the app at 10s', () => {
    render(<RouteLoadingFallback />)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(screen.getByText(/Still loading/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy()
    const fix = screen.getByRole('link', { name: 'Fix the app' }) as HTMLAnchorElement
    expect(fix.getAttribute('href')).toBe('/fix-cache.html')
  })

  it('Reload calls window.location.reload', () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', {
      value: { ...original, reload },
      writable: true,
    })
    render(<RouteLoadingFallback />)
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    screen.getByRole('button', { name: 'Reload' }).click()
    expect(reload).toHaveBeenCalledTimes(1)
    Object.defineProperty(window, 'location', { value: original, writable: true })
  })
})
