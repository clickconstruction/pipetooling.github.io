// @vitest-environment jsdom
/**
 * Render smokes for the comma nudge under the Job Address input (v2.2323):
 * preview states (split ✓ / stuck city / no city), the one-tap Add comma
 * chip, and the per-address ignore.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import JobFormAddressNudge from './JobFormAddressNudge'

describe('JobFormAddressNudge', () => {
  it('renders nothing for a blank address', () => {
    const { container } = render(<JobFormAddressNudge address="" onApply={() => {}} />)
    expect(container.innerHTML).toBe('')
  })

  it('well-formed address: street + quiet city with a check, no chip', () => {
    render(<JobFormAddressNudge address="1200 Kenney Fort Blvd, Round Rock, TX 78665" onApply={() => {}} />)
    expect(screen.getByText('1200 Kenney Fort Blvd')).toBeTruthy()
    expect(screen.getByText('Round Rock, TX 78665')).toBeTruthy()
    expect(screen.getByText('✓')).toBeTruthy()
    expect(screen.queryByText('Add comma')).toBeNull()
  })

  it('missing comma: warns, offers the fix, applies it on tap', () => {
    const onApply = vi.fn()
    render(<JobFormAddressNudge address="1200 Kenney Fort Blvd Round Rock, TX 78665" onApply={onApply} />)
    expect(screen.getByText('city is stuck in the street')).toBeTruthy()
    expect(screen.getByText('1200 Kenney Fort Blvd, Round Rock, TX 78665')).toBeTruthy()
    fireEvent.click(screen.getByText('Add comma'))
    expect(onApply).toHaveBeenCalledWith('1200 Kenney Fort Blvd, Round Rock, TX 78665')
  })

  it('ignore dismisses the chip but keeps the preview', () => {
    render(<JobFormAddressNudge address="4110 N Main St Taylor, TX 76574" onApply={() => {}} />)
    fireEvent.click(screen.getByText('ignore'))
    expect(screen.queryByText('Add comma')).toBeNull()
    expect(screen.getByText('city is stuck in the street')).toBeTruthy()
  })

  it('no recognizable city: neutral note, no warning', () => {
    render(<JobFormAddressNudge address="TBD — new build off CR 110" onApply={() => {}} />)
    expect(screen.getByText('no city found — shown as-is')).toBeTruthy()
    expect(screen.queryByText('city is stuck in the street')).toBeNull()
    expect(screen.queryByText('Add comma')).toBeNull()
  })
})
