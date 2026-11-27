// @vitest-environment jsdom
/**
 * Render smokes for the toast's place on the screen (punch list #414, v2.8359). On a phone the corner toast moves to
 * the foot, above the bottom chrome, so it covers no card heading; on a desktop it keeps the top-right corner; an
 * anchored toast and a centre toast keep their own places on a phone. Drawn through `ToastProvider`, the one
 * container the app draws toasts from.
 */
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const viewport = { phone: false }
vi.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => viewport.phone }))

import { ToastProvider, useToastContext } from '../contexts/ToastContext'
import type { ToastAnchor, ToastPlacement } from './Toast'
import { TOAST_FILLS, TOAST_WORDS } from '../lib/toastFills'

function Shower({ message, anchor, placement, action, type = 'success' }: { message: string; anchor?: ToastAnchor; placement?: ToastPlacement; action?: () => void; type?: 'info' | 'warning' | 'error' | 'success' }) {
  const { showToast, showActionToast } = useToastContext()
  useEffect(() => {
    if (action) showActionToast(message, { label: 'Undo', onClick: action })
    else showToast(message, type, 5000, anchor, placement)
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

function draw(props: Parameters<typeof Shower>[0]) {
  return render(
    <ToastProvider>
      <Shower {...props} />
    </ToastProvider>,
  )
}

const toastOf = (message: string) => screen.getByText(message).closest('div[style]')!.parentElement as HTMLElement

beforeEach(() => {
  cleanup()
  viewport.phone = false
})
afterEach(() => cleanup())

describe('Toast — where it sits', () => {
  it('a desktop keeps the corner toast top-right, under the header', () => {
    draw({ message: 'Saved.' })
    const toast = toastOf('Saved.')
    expect(toast.dataset.toastFoot).toBeUndefined()
    expect(toast.style.position).toBe('fixed')
    expect(toast.style.right).toBe('1rem')
    expect(toast.style.top).not.toBe('')
    expect(toast.style.bottom).toBe('')
  })

  it('a phone draws the corner toast at the foot of the screen, above the tab bar and the Job Mode press bar, so no heading is covered', () => {
    viewport.phone = true
    draw({ message: 'Saved.' })
    const toast = toastOf('Saved.')
    expect(toast.dataset.toastFoot).toBe('')
    expect(toast.style.position).toBe('fixed')
    expect(toast.style.top).toBe('')
    expect(toast.style.bottom).toContain('var(--app-bottom-chrome, 0px)')
    expect(toast.style.bottom).toContain('env(safe-area-inset-bottom, 0px)')
    expect(toast.style.bottom).toContain('var(--job-mode-press-bar, 0px)')
    // Centred, and never wider than the screen less its gutters.
    expect(toast.style.left).toBe('50%')
    // jsdom writes the function with its own spacing, so read its two parts.
    expect(toast.style.width).toMatch(/^min\(400px/)
    expect(toast.style.width).toContain('calc(100vw - 2rem)')
    // Above every piece of chrome it stands on.
    expect(Number(toast.style.zIndex)).toBeGreaterThan(701)
  })

  it('the foot toast still carries its press and its dismiss', () => {
    viewport.phone = true
    const undo = vi.fn()
    draw({ message: 'Imported 12 rows', action: undo })
    const toast = toastOf('Imported 12 rows')
    expect(toast.dataset.toastFoot).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(undo).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('Imported 12 rows')).toBeNull()
  })

  it('an anchored toast on a phone keeps its anchor', () => {
    viewport.phone = true
    draw({ message: 'Copied.', anchor: { clientX: 120, clientY: 300 } })
    const toast = toastOf('Copied.')
    expect(toast.dataset.toastFoot).toBeUndefined()
    expect(toast.style.top).not.toBe('')
    expect(toast.style.bottom).toBe('')
  })

  it('on a phone the toast’s press and its × stand a fingertip tall, and the toast is no taller for it (punch list #426)', () => {
    viewport.phone = true
    draw({ message: 'Hidden: a bid.', action: () => {} })
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo.style.minHeight).toBe('44px')
    // The margins give back the 18 px it grew by, so the toast keeps its height.
    expect(undo.style.marginTop).toBe('-9px')
    expect(undo.style.marginBottom).toBe('-9px')
    const dismiss = screen.getByRole('button', { name: 'Dismiss' })
    expect(dismiss.style.minHeight).toBe('44px')
    expect(dismiss.style.minWidth).toBe('44px')
    expect(dismiss.style.marginLeft).toBe('-15px')
    expect(dismiss.style.marginRight).toBe('-15px')
  })

  it('at a desk the toast’s press and its × are as they were drawn', () => {
    draw({ message: 'Hidden: a bid.', action: () => {} })
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo.style.minHeight).toBe('')
    expect(undo.style.marginTop).toBe('')
    const dismiss = screen.getByRole('button', { name: 'Dismiss' })
    expect(dismiss.style.minHeight).toBe('')
    expect(dismiss.style.minWidth).toBe('')
  })

  it('a centre toast on a phone keeps the centre', () => {
    viewport.phone = true
    draw({ message: 'Hold on.', placement: 'center' })
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.style.top).toBe('50%')
    expect(dialog.dataset.toastFoot).toBeUndefined()
  })

  it('a toast’s words carry a role a screen reader says: an alert for a failure or a warning, a status for the rest (punch list #445)', () => {
    draw({ message: 'That did not save.', type: 'error' })
    expect(screen.getByRole('alert').textContent).toBe('That did not save.')
    cleanup()
    draw({ message: 'This bid was sent.', type: 'warning' })
    expect(screen.getByRole('alert').textContent).toBe('This bid was sent.')
    cleanup()
    draw({ message: 'Heads up.', type: 'info' })
    expect(screen.getByRole('status').textContent).toBe('Heads up.')
    cleanup()
    draw({ message: 'Saved.' })
    expect(screen.getByRole('status').textContent).toBe('Saved.')
  })

  it('the role is on the words alone: the action press and the × are not read out with them', () => {
    draw({ message: 'Put away.', action: () => {} })
    const words = screen.getByRole('status')
    expect(words.textContent).toBe('Put away.')
    expect(words.contains(screen.getByRole('button', { name: 'Undo' }))).toBe(false)
    expect(words.contains(screen.getByRole('button', { name: 'Dismiss' }))).toBe(false)
  })

  it('a foot toast and an anchored toast carry the role too', () => {
    viewport.phone = true
    draw({ message: 'Saved.' })
    expect(toastOf('Saved.').dataset.toastFoot).toBe('')
    expect(screen.getByRole('status').textContent).toBe('Saved.')
    cleanup()
    draw({ message: 'Copied.', anchor: { clientX: 40, clientY: 40 } })
    expect(screen.getByRole('status').textContent).toBe('Copied.')
  })

  it('a centre toast stays one dialog that names its words: no alert or status inside it', () => {
    draw({ message: 'Hold on.', placement: 'center', type: 'error' })
    expect(screen.getByRole('alertdialog').getAttribute('aria-describedby')).toBe(screen.getByText('Hold on.').id)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('Toast — its fill under the white words (finding 321)', () => {
  const rgb = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
  it.each(['success', 'info', 'warning', 'error'] as const)('a %s toast fills with the kernel’s deep shade and keeps white words', (type) => {
    draw({ message: 'Copied for text', type })
    let card: HTMLElement | null = screen.getByText('Copied for text')
    while (card && card.style.color !== TOAST_WORDS) card = card.parentElement
    expect(card).toBeTruthy()
    expect(card!.style.background).toBe(rgb(TOAST_FILLS[type].bg))
    expect(card!.style.border).toBe(`2px solid ${rgb(TOAST_FILLS[type].border)}`)
  })
})
