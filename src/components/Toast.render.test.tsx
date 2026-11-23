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

function Shower({ message, anchor, placement, action }: { message: string; anchor?: ToastAnchor; placement?: ToastPlacement; action?: () => void }) {
  const { showToast, showActionToast } = useToastContext()
  useEffect(() => {
    if (action) showActionToast(message, { label: 'Undo', onClick: action })
    else showToast(message, 'success', 5000, anchor, placement)
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

  it('a centre toast on a phone keeps the centre', () => {
    viewport.phone = true
    draw({ message: 'Hold on.', placement: 'center' })
    const dialog = screen.getByRole('alertdialog')
    expect(dialog.style.top).toBe('50%')
    expect(dialog.dataset.toastFoot).toBeUndefined()
  })
})
