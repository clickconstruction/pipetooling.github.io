// @vitest-environment jsdom
/** The Move cost door on the job window's Costs tab: drawn for a dev, not for anyone else; the press closes the window and goes to the screen on this job. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { JobWindowMoveCostDoor } from './JobWindowMoveCostDoor'

const auth = vi.hoisted(() => ({ role: 'dev' as string }))

vi.mock('../../hooks/useAuth', () => ({
  useOptionalAuth: () => ({ role: auth.role }),
  useAuth: () => ({ role: auth.role }),
}))

function Where() {
  const loc = useLocation()
  return <output data-testid="where">{`${loc.pathname}${loc.search}`}</output>
}

afterEach(cleanup)

describe('JobWindowMoveCostDoor', () => {
  it('a dev presses it: the window is told to close and Banking opens on Cost batches for the job', () => {
    auth.role = 'dev'
    const onBeforeNavigate = vi.fn()
    render(
      <MemoryRouter initialEntries={['/jobs']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <JobWindowMoveCostDoor jobId="dd372a5b-726f-4235-a728-071008ab9cfe" onBeforeNavigate={onBeforeNavigate} />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Move cost ▸' }))
    expect(onBeforeNavigate).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('where').textContent).toBe('/banking?product=mercury&tab=cost_batches&job=dd372a5b-726f-4235-a728-071008ab9cfe')
  })

  it('is not drawn for the office', () => {
    auth.role = 'controller'
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <JobWindowMoveCostDoor jobId="j1" />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button')).toBeNull()
  })
})
