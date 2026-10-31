// @vitest-environment jsdom
/**
 * The #217 prototypes' shared helper: a per-person switch, off by default and remembered per
 * user in localStorage; `?sbs=1` for a dev draws today's look and the shape together, captioned,
 * with no switch; anyone else sees the switch alone.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { installDomShims, renderWithProviders, SMOKE_AUTH_USER_ID } from '../../test/renderSmokeMocks'
import { ShapeSwitch, SideBySide, readShapeView, shapeViewStorageKey, sideBySideRequested, useShapeView, writeShapeView } from './SideBySide'

let role = 'dev'
vi.mock('../../hooks/useAuth', async () => {
  const { makeUseAuthValue } = await import('../../test/renderSmokeMocks')
  return {
    useAuth: () => makeUseAuthValue({ role }),
    useOptionalAuth: () => makeUseAuthValue({ role }),
  }
})

beforeAll(installDomShims)
afterEach(() => {
  cleanup()
  role = 'dev'
  window.localStorage.removeItem(shapeViewStorageKey('probe', SMOKE_AUTH_USER_ID))
})

function Probe() {
  const view = useShapeView('probe')
  const today = <p>today's look</p>
  const shape = <p>the shape</p>
  if (view.sideBySide) return <SideBySide label="With the strip" today={today} shape={shape} />
  return (
    <div>
      <ShapeSwitch view={view} words={{ on: "Show today's look", off: 'Show the strip' }} />
      {view.on ? shape : today}
    </div>
  )
}

describe('the pure bits', () => {
  it('keys the switch per card and per person, off until written, and reads ?sbs=1 alone', () => {
    expect(shapeViewStorageKey('k', 'u1')).toBe('pt-shape-view:k:u1')
    expect(shapeViewStorageKey('k', null)).toBe('pt-shape-view:k:anon')
    expect(readShapeView('k', 'u1')).toBe(false)
    writeShapeView('k', 'u1', true)
    expect(readShapeView('k', 'u1')).toBe(true)
    expect(readShapeView('k', 'u2')).toBe(false)
    writeShapeView('k', 'u1', false)
    expect(readShapeView('k', 'u1')).toBe(false)
    expect(window.localStorage.getItem('pt-shape-view:k:u1')).toBeNull()
    expect(sideBySideRequested('?sbs=1')).toBe(true)
    expect(sideBySideRequested('sbs=1&view=roller')).toBe(true)
    expect(sideBySideRequested('?sbs=0')).toBe(false)
    expect(sideBySideRequested('')).toBe(false)
  })
})

describe('the switch and the two blocks', () => {
  it('opens on today’s look, the press turns the shape on and remembers it for the person', () => {
    renderWithProviders(<Probe />)
    expect(screen.getByText("today's look")).toBeTruthy()
    const press = screen.getByRole('button', { name: 'Show the strip' })
    expect(press.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(press)
    expect(screen.getByText('the shape')).toBeTruthy()
    expect(screen.getByRole('button', { name: "Show today's look" }).getAttribute('aria-pressed')).toBe('true')
    expect(window.localStorage.getItem(shapeViewStorageKey('probe', SMOKE_AUTH_USER_ID))).toBe('1')
    cleanup()
    renderWithProviders(<Probe />)
    expect(screen.getByText('the shape')).toBeTruthy()
  })

  it('with ?sbs=1 a dev sees both, captioned Today and the shape’s label, and no switch', () => {
    render(
      <MemoryRouter initialEntries={['/quickfill?sbs=1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Probe />
      </MemoryRouter>,
    )
    const sbs = screen.getByTestId('side-by-side')
    expect(sbs.querySelector('[data-side-by-side-today] p')?.textContent).toBe('Today')
    expect(sbs.querySelector('[data-side-by-side-shape] p')?.textContent).toBe('With the strip')
    expect(screen.getByText("today's look")).toBeTruthy()
    expect(screen.getByText('the shape')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('?sbs=1 does nothing for anyone but a dev', () => {
    role = 'assistant'
    render(
      <MemoryRouter initialEntries={['/quickfill?sbs=1']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Probe />
      </MemoryRouter>,
    )
    expect(screen.queryByTestId('side-by-side')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show the strip' })).toBeTruthy()
  })
})
