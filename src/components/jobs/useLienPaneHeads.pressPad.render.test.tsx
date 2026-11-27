// @vitest-environment jsdom
/**
 * The open paper's small presses on a phone (punch list #352, the leftovers): the pane the heads hook is given gets
 * the job window's press pad (v2.7309), so a press under 40 px is marked with its pad and nothing moves. A computer's
 * pane is left alone, and a pane that mounts after the hook's first render is picked up, since a paper opens later.
 */
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useLienPaneHeads } from './useLienPaneHeads'

afterEach(cleanup)

/** jsdom measures nothing, so each press says its own size. */
const sized = (width: number, height: number) => (el: HTMLButtonElement | null) => {
  if (el) el.getBoundingClientRect = () => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
}

const SECTIONS = [{ key: 'gates' as const, label: 'Gates', fact: '', tail: '' }]

function Pane({ phone, startOpen }: { phone: boolean; startOpen: boolean }) {
  const paneRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(startOpen)
  useLienPaneHeads({ paneRef, sections: SECTIONS, phone })
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open the paper
      </button>
      {open ? (
        <div ref={paneRef} data-lien-pane-phone={phone ? 'yes' : undefined}>
          {/* No border here: the test page's own button comes with 2 px, which the pad would add (finding 340). */}
          <button type="button" ref={sized(86, 20)} style={{ borderWidth: 0 }}>
            Fix it
          </button>
          <button type="button" ref={sized(300, 44)}>
            Approve
          </button>
        </div>
      ) : null}
    </div>
  )
}

/** The pad walks 50 ms after the last change under the pane. */
const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 90)))

describe('useLienPaneHeads · the press pad on a phone', () => {
  it('pads a small press in a phone’s pane and leaves a thumb-sized one bare', async () => {
    render(<Pane phone startOpen />)
    await settle()
    const small = screen.getByRole('button', { name: 'Fix it' })
    expect(small.getAttribute('data-press-pad')).toBe('')
    expect(small.style.getPropertyValue('--press-pad-y')).toBe('12px')
    expect(small.style.getPropertyValue('--press-pad-x')).toBe('0px')
    expect(screen.getByRole('button', { name: 'Approve' }).hasAttribute('data-press-pad')).toBe(false)
  })

  it('picks up a paper that opens after the first render', async () => {
    render(<Pane phone startOpen={false} />)
    await settle()
    fireEvent.click(screen.getByRole('button', { name: 'Open the paper' }))
    await settle()
    expect(screen.getByRole('button', { name: 'Fix it' }).hasAttribute('data-press-pad')).toBe(true)
  })

  it('leaves a computer’s pane alone', async () => {
    render(<Pane phone={false} startOpen />)
    await settle()
    expect(screen.getByRole('button', { name: 'Fix it' }).hasAttribute('data-press-pad')).toBe(false)
  })
})
