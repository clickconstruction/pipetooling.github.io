// @vitest-environment jsdom
/**
 * The Person desk ends above the Dispatch / Job mode footer (v2.4380). The bar was fixed at z 1000
 * over the desk (z 60) then, and the desk's last row — Merge a duplicate…, Archive — sat under it.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PersonDeskDrawer } from './PersonDeskDrawer'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ role: 'dev' }) }))
vi.mock('../../contexts/PersonDeskContext', () => ({
  usePersonDeskContext: () => ({ payload: { userId: 'u-1', displayName: 'Kai Moss' }, close: () => {}, changeKey: 0, markChanged: () => {} }),
}))
vi.mock('./PersonDeskBody', () => ({ PersonDeskBody: () => <p>the desk</p> }))

describe('PersonDeskDrawer', () => {
  it('ends where the bottom bar starts, so its last row is never under the bar', () => {
    render(<PersonDeskDrawer />)
    const desk = screen.getByRole('dialog', { name: 'Person Desk: Kai Moss' })
    expect(desk.style.top).toBe('0px')
    expect(desk.style.bottom).toBe('var(--app-bottom-chrome, 0px)')
    // and starts below an iPhone's status bar (v2.4444): the backdrop still covers it, the panel does not
    expect(desk.style.paddingTop).toBe('var(--app-top-chrome, 0px)')
  })
})
