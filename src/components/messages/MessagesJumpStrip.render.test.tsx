// @vitest-environment jsdom
/**
 * Render smoke for Messages' jump strip (punch list #151 PR 1): the five lanes with their headings' counts, Needs you
 * only while it has rows, an empty lane greyed in place, "…" while a lane has not read, a press → the lane, the lane
 * being scrolled through lit and the offset told to the headings, the phone's one-line form, and a dark render.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { installDomShims } from '../../test/renderSmokeMocks'
import type { JumpCounts } from '../../lib/messages/jumpStrip'
import { JUMP_STRIP_PHONE_QUERY, MessagesJumpStrip } from './MessagesJumpStrip'

beforeAll(installDomShims)

const counts: JumpCounts = { new: 3, needsYou: 0, needsReply: 0, weOwe: 1, waiting: 3, wentOut: 9 }
const rect = (top: number) => () => ({ top, bottom: top + 40, left: 0, right: 800, width: 800, height: 40, x: 0, y: top, toJSON: () => ({}) })

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  delete document.documentElement.dataset.theme
})

describe('MessagesJumpStrip', () => {
  it('draws the five lanes in page order with the counts their headings show, greys an empty lane, hides Needs you at zero, and a press names the lane', () => {
    const onJump = vi.fn()
    render(<MessagesJumpStrip counts={counts} onJump={onJump} />)
    const nav = screen.getByRole('navigation', { name: 'Messages lanes' })
    expect(screen.getAllByTestId('jump-lane').map((b) => b.textContent)).toEqual(['New3', 'Needs a reply0', 'We owe them1', 'Waiting on them3', 'Went out9'])
    expect(screen.getByLabelText('Jump to New, 3 people')).toBeTruthy()
    expect(screen.getByLabelText('Jump to Needs a reply, 0 people').className).toContain('isEmpty')
    expect(screen.getByLabelText('Jump to We owe them, 1 row').className).not.toContain('isEmpty')
    expect(screen.queryByLabelText(/Jump to Needs you/)).toBeNull()
    expect([...nav.children].map((c) => (c.tagName === 'BUTTON' ? 'lane' : c.textContent?.trim()))).toEqual(['lane', '→', 'lane', '→', 'lane', '→', 'lane', '→', 'lane'])
    expect(screen.getByLabelText('Jump to Went out, 9 sends').style.getPropertyValue('--stage-color')).toBe('#059669')
    expect(nav.parentElement?.className).toBe('stagesStageBar messagesJumpStrip')
    fireEvent.click(screen.getByLabelText('Jump to Waiting on them, 3 people'))
    expect(onJump).toHaveBeenCalledWith('waiting')
  })

  it('shows Needs you once it has rows, and "…" for a lane that has not read yet', () => {
    render(<MessagesJumpStrip counts={{ ...counts, needsYou: 2, waiting: null, wentOut: null }} onJump={vi.fn()} />)
    expect(screen.getAllByTestId('jump-lane').map((b) => b.dataset.lane)).toEqual(['new', 'needsYou', 'needsReply', 'weOwe', 'waiting', 'wentOut'])
    expect(screen.getByLabelText('Jump to Needs you, 2 rows').style.getPropertyValue('--stage-color')).toBe('#dc2626')
    const waiting = screen.getByLabelText('Jump to Waiting on them, … people')
    expect(waiting.textContent).toBe('Waiting on them…')
    expect(waiting.className).not.toContain('isEmpty')
  })

  it('lights the lane whose heading has reached the bar, follows the scroll, and tells the headings where to land', async () => {
    const heading = (id: string, top: number) => {
      const el = document.createElement('section')
      el.id = id
      el.getBoundingClientRect = rect(top)
      document.body.appendChild(el)
      return el
    }
    const newLane = heading('new-lane', 400)
    const reply = heading('needs-reply', 900)
    render(<MessagesJumpStrip counts={counts} onJump={vi.fn()} />)
    const lit = () => [...document.querySelectorAll('[aria-current="location"]')].map((b) => b.getAttribute('aria-label'))
    // The top of the page: no heading has reached the bar; the bar's own height is jsdom's zero plus the landing gap.
    expect(lit()).toEqual([])
    expect(document.documentElement.style.getPropertyValue('--messages-jump-offset')).toBe('8px')

    newLane.getBoundingClientRect = rect(-300)
    reply.getBoundingClientRect = rect(10)
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
      await new Promise((r) => requestAnimationFrame(() => r(null)))
    })
    expect(lit()).toEqual(['Jump to Needs a reply, 0 people'])
    expect(screen.getByLabelText('Jump to Needs a reply, 0 people').className).toContain('isOn')
  })

  it('on a phone reads as one line of name and count, with no arrows', () => {
    const real = window.matchMedia
    vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ ...real(q), matches: q === JUMP_STRIP_PHONE_QUERY }))
    render(<MessagesJumpStrip counts={counts} onJump={vi.fn()} />)
    const bar = screen.getByRole('navigation', { name: 'Messages lanes' }).parentElement!
    expect(bar.className).toBe('stagesStageBar messagesJumpStrip isLine')
    expect(screen.getAllByTestId('jump-lane').length).toBe(5)
  })

  it('renders under the dark theme as it does in light', () => {
    document.documentElement.dataset.theme = 'dark'
    render(<MessagesJumpStrip counts={counts} onJump={vi.fn()} />)
    expect(screen.getAllByTestId('jump-lane').length).toBe(5)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
