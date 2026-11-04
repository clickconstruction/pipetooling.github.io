// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { useRef, useState } from 'react'
import { useCloseOnOutsideClick } from './useCloseOnOutsideClick'

/** A menu whose one row removes itself on its press, as a picker's row closes the picker. */
function Menu({ onClose, escape, capture }: { onClose: () => void; escape?: boolean; capture?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [row, setRow] = useState(true)
  useCloseOnOutsideClick(ref, true, onClose, { ...(escape === undefined ? {} : { escape }), ...(capture === undefined ? {} : { capture }) })
  return (
    <div>
      <button type="button">Outside</button>
      <div ref={ref} data-menu>
        {row && (
          <button type="button" onClick={() => setRow(false)}>
            Row
          </button>
        )}
      </div>
    </div>
  )
}

afterEach(cleanup)

describe('useCloseOnOutsideClick', () => {
  it('closes on a click outside, not on one inside', () => {
    const onClose = vi.fn()
    const { getByText } = render(<Menu onClose={onClose} />)
    fireEvent.click(getByText('Row'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(getByText('Outside'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('reads inside from the click’s path, so a row that removes itself under the press still counts as inside (v2.6504)', () => {
    const onClose = vi.fn()
    const { getByText, container } = render(<Menu onClose={onClose} />)
    const row = getByText('Row')
    fireEvent.click(row)
    expect(container.querySelector('[data-menu]')!.contains(row)).toBe(false)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('with capture, hears a click a window’s panel stops on its way up (v2.6504)', () => {
    const onClose = vi.fn()
    const { getByText } = render(
      <div onClick={(e) => e.stopPropagation()}>
        <Menu onClose={onClose} capture />
      </div>,
    )
    fireEvent.click(getByText('Outside'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('without capture, a click a panel stops leaves the menu as it always did', () => {
    const onClose = vi.fn()
    const { getByText } = render(
      <div onClick={(e) => e.stopPropagation()}>
        <Menu onClose={onClose} />
      </div>,
    )
    fireEvent.click(getByText('Outside'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape unless told to leave the key alone', () => {
    const onClose = vi.fn()
    render(<Menu onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    const quiet = vi.fn()
    render(<Menu onClose={quiet} escape={false} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(quiet).not.toHaveBeenCalled()
  })
})

describe('useCloseOnOutsideClick ignores the click that opened its owner', () => {
  it('a click stamped before the listener was attached closes nothing (v2.6504)', () => {
    const onClose = vi.fn()
    const { getByText } = render(<Menu onClose={onClose} />)
    const old = new MouseEvent('click', { bubbles: true })
    Object.defineProperty(old, 'timeStamp', { value: 0 })
    getByText('Outside').dispatchEvent(old)
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(getByText('Outside'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
