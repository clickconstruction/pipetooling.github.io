// @vitest-environment jsdom
/**
 * Render smoke for TwinFreshKeyPanel (v2.3721): the key is shown once with the three ways to
 * use it — the claude.ai connector steps copy `Bearer <key>` as the header value, the
 * Desktop command copies without the key inside it, and the guide link is the Desktop guide.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import TwinFreshKeyPanel from './TwinFreshKeyPanel'
import { renderWithProviders } from '../../test/renderSmokeMocks'

const KEY = `ptt_${'ab'.repeat(32)}`

describe('TwinFreshKeyPanel', () => {
  it('shows the key once and walks through the connector, the Terminal command and the handoff', () => {
    const copy = vi.fn()
    const onDone = vi.fn()
    renderWithProviders(<TwinFreshKeyPanel twinName="Twin Estimator 1" twinEmail="twin-estimator-1@twins.pipetooling.local" token={KEY} copy={copy} onDone={onDone} />)

    expect(screen.getByText('New key for Twin Estimator 1 — shown ONCE')).toBeTruthy()
    expect(screen.getByText(KEY)).toBeTruthy()
    const panel = screen.getByLabelText('New key for Twin Estimator 1')
    expect(panel.textContent).toContain('Add custom connector')
    expect(panel.textContent).toContain('https://mcp.clicktooling.com/twin')
    expect(panel.textContent).toContain('Request headers')
    expect(panel.textContent).toContain('Terminal')
    expect(panel.textContent).toContain('TWIN_HARNESS.md')

    fireEvent.click(screen.getByRole('button', { name: 'Copy header value' }))
    expect(copy).toHaveBeenLastCalledWith(`Bearer ${KEY}`, 'the header value')

    fireEvent.click(screen.getByRole('button', { name: 'Copy Desktop setup command' }))
    const [command] = copy.mock.calls[copy.mock.calls.length - 1] as [string, string]
    expect(command).toContain('mcp-remote')
    expect(command).not.toContain(KEY) // the command asks for the key; it never carries it

    fireEvent.click(screen.getByRole('button', { name: 'Copy key' }))
    expect(copy).toHaveBeenLastCalledWith(KEY, 'the key')

    expect(screen.getByRole('link', { name: 'How do I run the robot with it?' }).getAttribute('href')).toBe('/help?g=run-the-robots-from-claude-desktop')
    fireEvent.click(screen.getByRole('button', { name: 'Done — I saved it' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
