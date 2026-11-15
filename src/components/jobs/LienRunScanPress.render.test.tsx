// @vitest-environment jsdom
/**
 * Scan › on a Mailed box (v2.7331): no press without a camera to ask for; a refused camera says so and
 * leaves typing; the browser's own reader lands the grouped number in the box.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LienRunScanPress from './LienRunScanPress'

type Nav = { mediaDevices?: { getUserMedia: (c: unknown) => Promise<unknown> } }
const nav = navigator as unknown as Nav
const win = window as unknown as { BarcodeDetector?: unknown; isSecureContext?: boolean }

function withCamera(getUserMedia: (c: unknown) => Promise<unknown>) {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true })
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
}

afterEach(() => {
  cleanup()
  delete win.BarcodeDetector
  Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
})

describe('LienRunScanPress', () => {
  it('draws nothing where the page cannot ask for a camera', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    render(<LienRunScanPress label="650 · AXO Schertz — owner" onRead={() => {}} />)
    expect(screen.queryByTestId('run-scan')).toBeNull()
    expect(nav.mediaDevices).toBeUndefined()
  })

  it('a refused camera says so under the box and reads nothing', async () => {
    withCamera(async () => {
      throw Object.assign(new Error('denied'), { name: 'NotAllowedError' })
    })
    const onRead = vi.fn()
    render(<LienRunScanPress label="650 · AXO Schertz — owner" onRead={onRead} />)
    fireEvent.click(screen.getByRole('button', { name: '650 · AXO Schertz — owner — scan the slip' }))
    expect(await screen.findByTestId('run-scan-words')).toBeTruthy()
    expect(screen.getByTestId('run-scan-words').textContent).toBe('The camera was refused. Type the number from the slip instead.')
    expect(screen.queryByTestId('run-scan-camera')).toBeNull()
    expect(onRead).not.toHaveBeenCalled()
  })

  it('the browser’s own reader lands the receipt’s number, grouped, and says to check it; Type it instead closes the camera', async () => {
    const stop = vi.fn()
    withCamera(async () => ({ getTracks: () => [{ stop }] }))
    win.BarcodeDetector = class {
      async detect() {
        return [{ rawValue: '420781549407111898765432109812' }]
      }
    }
    const onRead = vi.fn()
    render(<LienRunScanPress label="650 · AXO Schertz — owner" onRead={onRead} />)
    fireEvent.click(screen.getByTestId('run-scan'))
    expect(await screen.findByTestId('run-scan-camera')).toBeTruthy()
    await waitFor(() => expect(onRead).toHaveBeenCalledWith('9407 1118 9876 5432 1098 12'))
    expect(screen.getByTestId('run-scan-words').textContent).toBe('Read 9407 1118 9876 5432 1098 12. Check it against the slip.')
    expect(screen.queryByTestId('run-scan-camera')).toBeNull()
    expect(stop).toHaveBeenCalled()
    // Opened again and closed by hand: nothing read, the camera let go.
    fireEvent.click(screen.getByTestId('run-scan'))
    expect(await screen.findByTestId('run-scan-camera')).toBeTruthy()
    fireEvent.click(screen.getByTestId('run-scan-close'))
    expect(screen.queryByTestId('run-scan-camera')).toBeNull()
  })
})
