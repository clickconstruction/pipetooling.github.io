// @vitest-environment jsdom
/**
 * Where is it? with the keyboard up on a phone (punch list #348, PR 2). The sheet was pinned to the page, so when
 * an iPhone slid the page under the place's name, its title and Cancel left the top of the screen. It fills the
 * part of the page that shows now, and its map gives way so the name and Use this place stay in it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

vi.mock('../materials/OnSiteMap', () => ({ default: () => <div data-testid="map" /> }))

import { TaskPlaceSheet } from './TaskPlaceSheet'

type Listener = () => void

function installViewport(height: number) {
  const heard = new Set<Listener>()
  const vv = { height, offsetTop: 0, addEventListener: (_type: string, f: Listener) => heard.add(f), removeEventListener: (_type: string, f: Listener) => heard.delete(f) }
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  return {
    keyboard(room: number, slide: number) {
      vv.height = room
      vv.offsetTop = slide
      act(() => heard.forEach((f) => f()))
    },
  }
}

const sheet = () => document.querySelector<HTMLElement>('[data-task-place-sheet]')!
const open = () => render(<TaskPlaceSheet start={{ lat: 29.7, lng: -98.1 }} initial={null} onUse={() => {}} onClose={() => {}} />)

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })
})

describe('TaskPlaceSheet and the keyboard', () => {
  it('fills the screen while no keyboard is up', () => {
    installViewport(740)
    open()
    expect([sheet().style.top, sheet().style.height, sheet().style.position]).toEqual(['0px', '740px', 'fixed'])
    expect(screen.getByRole('dialog', { name: 'Where is it?' })).toBeTruthy()
  })

  it('follows the page when the keyboard slides it, so its title and Cancel stay on screen', () => {
    const vv = installViewport(740)
    open()
    vv.keyboard(377, 253)
    expect([sheet().style.top, sheet().style.height]).toEqual(['253px', '377px'])
    vv.keyboard(740, 0)
    expect([sheet().style.top, sheet().style.height]).toEqual(['0px', '740px'])
  })

  it('lets its map give way, so the name and Use this place stay in the room that is left', async () => {
    installViewport(377)
    open()
    const mapBox = (await screen.findByTestId('map')).parentElement as HTMLElement
    expect(mapBox.style.minHeight).toBe('60px')
    expect(mapBox.style.flex).toBe('1 1 220px')
    expect(screen.getByPlaceholderText('Pump house')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Use this place' })).toBeTruthy()
  })

  it('covers the whole page in a browser that cannot say what shows', () => {
    open()
    expect(['0', '0px']).toContain(sheet().style.inset)
    expect(sheet().style.height).toBe('')
  })
})
