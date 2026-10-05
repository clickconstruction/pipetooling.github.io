// @vitest-environment jsdom
/**
 * Render smoke for the Submittals tab's one help door: closed until pressed, three choices spelled
 * out, each closing the menu as it runs; Esc and a click elsewhere close it too.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { SubmittalHelpMenu } from './SubmittalHelpMenu'

afterEach(() => cleanup())

function mount() {
  const on = { onWalkThrough: vi.fn(), onWords: vi.fn() }
  render(
    <div>
      <SubmittalHelpMenu {...on} wordCount={15} guideHref="/help?g=build-a-submittal-package" />
      <button type="button">elsewhere</button>
    </div>,
  )
  return on
}

describe('SubmittalHelpMenu', () => {
  it('is one button until pressed; then three choices, each with a line saying what it does', () => {
    mount()
    const help = screen.getByRole('button', { name: '? Help' })
    expect(help.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(help)
    expect(help.getAttribute('aria-expanded')).toBe('true')
    const items = within(screen.getByRole('menu')).getAllByRole('menuitem')
    expect(items.map((i) => i.textContent)).toEqual([
      'Walk me through itAbout a minute, from the first step to the last.',
      'Words on this pageCut sheet, revision, tag and 12 more.',
      'Open the guideThe full written guide, in a new tab.',
    ])
    expect(items[2]!.getAttribute('href')).toBe('/help?g=build-a-submittal-package')
    expect(items[2]!.getAttribute('target')).toBe('_blank')
  })

  it('a choice runs and closes the menu', () => {
    const on = mount()
    fireEvent.click(screen.getByRole('button', { name: '? Help' }))
    fireEvent.click(screen.getByTestId('submittal-help-walk'))
    expect(on.onWalkThrough).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '? Help' }))
    fireEvent.click(screen.getByTestId('submittal-words'))
    expect(on.onWords).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Esc closes it, and so does a click anywhere else; a second press of the button folds it', () => {
    mount()
    const help = screen.getByRole('button', { name: '? Help' })
    fireEvent.click(help)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(help)
    fireEvent.mouseDown(screen.getByRole('button', { name: 'elsewhere' }))
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(help)
    fireEvent.click(help)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
