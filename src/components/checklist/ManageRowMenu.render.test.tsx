// @vitest-environment jsdom
/**
 * The ⋮ menu of a task on Checklist → Manage (punch list #348, PR 1). On a phone the menu of the last task
 * was cut by the list's edge, so *Delete* could not be reached. It is drawn over the page now and opens upward
 * when there is no room under its press.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MANAGE_ROW_MENU_Z, ManageRowMenu, type ManageRowMenuLine } from './ManageRowMenu'

const realInnerHeight = window.innerHeight
const realInnerWidth = window.innerWidth

function screenIs(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
}

/** jsdom lays nothing out, so the press is given its place on screen by hand. */
function placePress(top: number) {
  const press = screen.getByRole('button', { name: 'Actions for Grease the pump' })
  press.getBoundingClientRect = () => ({ top, bottom: top + 36, left: 334, right: 370, width: 36, height: 36, x: 334, y: top, toJSON: () => ({}) })
  return press
}

function Row({ lines }: { lines: ManageRowMenuLine[] }) {
  const [open, setOpen] = useState(false)
  return (
    <ul style={{ overflow: 'hidden' }}>
      <li>
        <ManageRowMenu title="Grease the pump" lines={lines} open={open} onOpenChange={setOpen} />
      </li>
    </ul>
  )
}

const pressed: string[] = []
const lines: ManageRowMenuLine[] = [
  { key: 'edit', label: 'Edit', onPress: () => pressed.push('edit') },
  { key: 'mute', label: 'Mute notifications', onPress: () => pressed.push('mute') },
  { key: 'delete', label: 'Delete', danger: true, onPress: () => pressed.push('delete') },
]

afterEach(() => {
  cleanup()
  pressed.length = 0
  screenIs(realInnerWidth, realInnerHeight)
  vi.restoreAllMocks()
})

describe('ManageRowMenu', () => {
  it('is closed until its press', () => {
    render(<Row lines={lines} />)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('button', { name: 'Actions for Grease the pump' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('opens under its press, over the page, when there is room', () => {
    screenIs(402, 740)
    render(<Row lines={lines} />)
    fireEvent.click(placePress(200))
    const menu = screen.getByRole('menu')
    expect(menu.style.position).toBe('fixed')
    expect(menu.dataset.opens).toBe('down')
    expect(menu.style.top).toBe('240px')
    expect(menu.style.right).toBe('32px')
    expect(menu.style.zIndex).toBe(String(MANAGE_ROW_MENU_Z))
    expect(screen.getAllByRole('menuitem').map((b) => b.textContent)).toEqual(['Edit', 'Mute notifications', 'Delete'])
  })

  it('opens above its press on the last task, so Delete can be reached', () => {
    screenIs(402, 740)
    render(<Row lines={lines} />)
    fireEvent.click(placePress(644))
    const menu = screen.getByRole('menu')
    expect(menu.dataset.opens).toBe('up')
    expect(menu.style.bottom).toBe('100px')
    expect(menu.style.top).toBe('')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(pressed).toEqual(['delete'])
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes on a press outside it', () => {
    render(<Row lines={lines} />)
    fireEvent.click(placePress(200))
    fireEvent.click(screen.getByTestId('manage-row-menu-backdrop'))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(pressed).toEqual([])
  })

  it('closes when the page scrolls or the phone turns, since it is pinned to the screen', () => {
    render(<Row lines={lines} />)
    fireEvent.click(placePress(200))
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(placePress(200))
    expect(screen.getByRole('menu')).toBeTruthy()
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('draws a roadmap task one line, Open in Roadmap', () => {
    render(<Row lines={[{ key: 'roadmap', label: '⛰ Open in Roadmap', onPress: () => pressed.push('roadmap') }]} />)
    fireEvent.click(placePress(200))
    fireEvent.click(screen.getByRole('menuitem', { name: '⛰ Open in Roadmap' }))
    expect(pressed).toEqual(['roadmap'])
  })
})
