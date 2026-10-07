// @vitest-environment jsdom
/**
 * Render smoke for the robot-icon key (v2.3337): the sealed-envelope explainer
 * sits under the intro, quotes the live gate figures, and the key still closes.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { RobotIconKeyModal } from './RobotIconKeyModal'
import { GATE_B_PCT, GATE_B_STREAK } from '../../lib/bids/confidenceBoard'

describe('RobotIconKeyModal', () => {
  it('explains the sealed envelope with the gate figures, above the live-bid rows', () => {
    const onClose = vi.fn()
    render(<RobotIconKeyModal onClose={onClose} />)
    const block = screen.getByTestId('robot-key-envelope')
    expect(block.textContent).toContain('Why you can’t see the robot’s number yet')
    expect(block.textContent).toContain('in secret')
    expect(block.textContent).toContain(`${GATE_B_STREAK} in a row within ${GATE_B_PCT}%`)
    // The explainer comes before the first state row, so the "why" is read before the "what".
    const dialog = screen.getByRole('dialog', { name: 'What the robot icon means' })
    // The window leaves room for an iPhone's status bar, and its panel cannot grow back under it (v2.4447).
    expect(dialog.getAttribute('style')).toContain('padding: calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem')
    expect(dialog.firstElementChild?.getAttribute('style')).toContain('max-height: min(85vh, 100%)')
    const html = dialog.innerHTML
    expect(html.indexOf('robot-key-envelope')).toBeLessThan(html.indexOf('Robot is on it'))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
