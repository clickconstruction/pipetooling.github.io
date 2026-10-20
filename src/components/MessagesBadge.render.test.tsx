// @vitest-environment jsdom
/**
 * Messages in the header (residential R7, PR 3): the count on its link over a fake read. Each person waiting on us once,
 * read again when the window comes back into focus; nothing while nobody waits or the read fails.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessagesBadge } from './MessagesBadge'

afterEach(cleanup)

describe('MessagesBadge', () => {
  it('shows how many wait on us, and reads again on focus', async () => {
    const load = vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(0)
    render(<MessagesBadge load={load} />)
    expect((await screen.findByLabelText('4 waiting on us')).textContent).toBe('4')
    act(() => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitFor(() => expect(screen.queryByLabelText(/waiting on us/)).toBeNull())
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('says 99+ past ninety-nine, and nothing when the read fails', async () => {
    render(<MessagesBadge load={async () => 140} />)
    expect((await screen.findByLabelText('140 waiting on us')).textContent).toBe('99+')
    cleanup()
    const failing = vi.fn(async () => Promise.reject(new Error('offline')))
    render(<MessagesBadge load={failing} />)
    await waitFor(() => expect(failing).toHaveBeenCalled())
    expect(screen.queryByLabelText(/waiting on us/)).toBeNull()
  })
})
