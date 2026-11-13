// @vitest-environment jsdom
/**
 * The frame of the three task windows on a phone with the keyboard up (punch list #331's walk).
 *
 * An iPhone slides the page under a field that sits where the keyboard will be. The card was pinned to the top of
 * the page, so it left the top of the screen with the field in it. It now follows the part of the page that shows.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { TaskWindowShell } from './TaskWindowShell'

type Listener = () => void

function installViewport(height: number) {
  const heard: Record<string, Set<Listener>> = { resize: new Set(), scroll: new Set() }
  const vv = {
    height,
    offsetTop: 0,
    addEventListener: (type: string, fn: Listener) => heard[type]?.add(fn),
    removeEventListener: (type: string, fn: Listener) => heard[type]?.delete(fn),
  }
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  return {
    /** The keyboard comes up: the room shrinks, and the page slides if the field was under it. */
    keyboard(room: number, slide: number) {
      vv.height = room
      vv.offsetTop = slide
      act(() => {
        for (const fn of [...heard.resize, ...heard.scroll]) fn()
      })
    },
  }
}

/** jsdom lays nothing out, so the two boxes the frame measures are given their places by hand. */
function place(el: Element, top: number, bottom: number) {
  el.getBoundingClientRect = () => ({ top, bottom, left: 0, right: 300, width: 300, height: bottom - top, x: 0, y: top, toJSON: () => ({}) })
}

function shell(phone: boolean) {
  return render(
    <TaskWindowShell titleId="t" title="New task" headActions={<button type="button">×</button>} bar={<button type="button">Send to Theo</button>} phone={phone} zIndex={10} cardTestId="card">
      <textarea aria-label="The task" />
      <textarea aria-label="Done when" />
    </TaskWindowShell>,
  )
}

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true })
})

describe('TaskWindowShell on a phone', () => {
  it('fills the screen from the top while no keyboard is up', () => {
    installViewport(740)
    shell(true)
    const card = screen.getByTestId('card')
    expect(card.style.marginTop).toBe('0px')
    expect(card.style.maxHeight).toContain('740px')
  })

  it('shrinks to the room the keyboard leaves', () => {
    const vv = installViewport(740)
    shell(true)
    vv.keyboard(377, 0)
    const card = screen.getByTestId('card')
    expect(card.style.marginTop).toBe('0px')
    expect(card.style.maxHeight).toContain('377px')
  })

  it('follows the page when the keyboard slides it, so the head and the bar stay on screen', () => {
    const vv = installViewport(740)
    shell(true)
    vv.keyboard(377, 253)
    const card = screen.getByTestId('card')
    expect(card.style.marginTop).toBe('253px')
    expect(card.style.maxHeight).toContain('377px')
    vv.keyboard(740, 0)
    expect(card.style.marginTop).toBe('0px')
  })

  it('brings the field that has the keyboard back into the form when the card shrinks over it', () => {
    const vv = installViewport(740)
    shell(true)
    const form = screen.getByTestId('new-task-form')
    const field = screen.getByLabelText('Done when')
    // After the keyboard: the form shows 100 to 300, and the field sits under the bar at 320 to 400.
    place(form, 100, 300)
    place(field, 320, 400)
    field.focus()
    vv.keyboard(377, 253)
    expect(form.scrollTop).toBe(108)
  })

  it('leaves the form alone when the field with the keyboard already shows', () => {
    const vv = installViewport(740)
    shell(true)
    const form = screen.getByTestId('new-task-form')
    const field = screen.getByLabelText('The task')
    place(form, 100, 300)
    place(field, 110, 190)
    field.focus()
    vv.keyboard(377, 0)
    expect(form.scrollTop).toBe(0)
  })

  it('stands where it did in a browser that cannot say what shows', () => {
    shell(true)
    const card = screen.getByTestId('card')
    expect(card.style.marginTop).toBe('0px')
    expect(card.style.maxHeight).toBe('100%')
  })
})

describe('TaskWindowShell at a desk', () => {
  it('is centered and does not follow the keyboard', () => {
    const vv = installViewport(740)
    shell(false)
    vv.keyboard(377, 253)
    const card = screen.getByTestId('card')
    expect(card.style.marginTop).toBe('')
    expect(card.style.maxWidth).toBe('480px')
  })
})
