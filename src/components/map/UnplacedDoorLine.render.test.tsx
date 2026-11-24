// @vitest-environment jsdom
/**
 * A map card's count line as a press (punch list #408, step 3): a link to the Map page's list for a
 * viewer who may open that page, and the plain words for everyone else.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UnplacedDoorLine } from './UnplacedDoorLine'

const auth = vi.hoisted(() => ({ role: 'assistant' as string | null }))
vi.mock('../../hooks/useAuth', () => ({ useOptionalAuth: () => (auth.role ? { role: auth.role } : null) }))

afterEach(() => {
  cleanup()
  auth.role = 'assistant'
})

const LINE = '2 jobs have no map location yet'

describe('UnplacedDoorLine', () => {
  it('is a link to the Map page with its list open, for each role that may open the Map page', () => {
    for (const role of ['dev', 'master_technician', 'assistant', 'controller', 'estimator']) {
      auth.role = role
      render(
        <MemoryRouter>
          <UnplacedDoorLine line={LINE} />
        </MemoryRouter>,
      )
      const door = document.querySelector('[data-unplaced-door]') as HTMLAnchorElement
      expect(door, role).not.toBeNull()
      expect(door.textContent).toBe(LINE)
      expect(door.getAttribute('href')).toBe('/map?unplaced=1')
      cleanup()
    }
  })

  it('is the plain words for a role the Map page would bounce', () => {
    for (const role of ['helpers', 'subcontractor', 'superintendent', 'primary']) {
      auth.role = role
      const view = render(
        <MemoryRouter>
          <UnplacedDoorLine line={LINE} />
        </MemoryRouter>,
      )
      expect(document.querySelector('[data-unplaced-door]'), role).toBeNull()
      expect(view.container.textContent).toBe(LINE)
      cleanup()
    }
  })

  it('is the plain words with nobody signed in, and outside a router', () => {
    auth.role = null
    const signedOut = render(
      <MemoryRouter>
        <UnplacedDoorLine line={LINE} />
      </MemoryRouter>,
    )
    expect(signedOut.container.textContent).toBe(LINE)
    expect(document.querySelector('a')).toBeNull()
    cleanup()
    auth.role = 'assistant'
    const noRouter = render(<UnplacedDoorLine line={LINE} />)
    expect(noRouter.container.textContent).toBe(LINE)
    expect(document.querySelector('a')).toBeNull()
  })

  it('takes a finger on a phone', () => {
    render(
      <MemoryRouter>
        <UnplacedDoorLine line={LINE} finger />
      </MemoryRouter>,
    )
    expect((document.querySelector('[data-unplaced-door]') as HTMLElement).style.minHeight).toBe('44px')
  })
})
