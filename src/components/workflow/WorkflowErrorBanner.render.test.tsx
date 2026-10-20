// @vitest-environment jsdom
/**
 * v2.5108: the Workflow page's error banner (the map's quirk 21). Pins it — nothing drawn with no
 * message; the message drawn as it is handed, in an alert; Dismiss calls back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderSettled } from '../../test/renderSmokeMocks'
import { WorkflowErrorBanner } from './WorkflowErrorBanner'

afterEach(() => {
  cleanup()
})

describe('WorkflowErrorBanner', () => {
  it('draws nothing with no message', async () => {
    const { container } = await renderSettled(<WorkflowErrorBanner message={null} onDismiss={() => {}} />, {
      loaded: () => true,
    })
    expect(container.innerHTML).toBe('')
  })

  it('draws the message as handed, in an alert, and Dismiss calls back', async () => {
    const onDismiss = vi.fn()
    await renderSettled(<WorkflowErrorBanner message="Failed to delete projection: rls" onDismiss={onDismiss} />, {
      loaded: () => screen.findByRole('alert'),
    })
    const banner = screen.getByRole('alert')
    expect(banner.textContent).toContain('Failed to delete projection: rls')
    fireEvent.click(within(banner).getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
