// @vitest-environment jsdom
/**
 * The Build waits by job (punch list #192, write A, v2.8723): one read when the board mounts, again when a wait is
 * marked or lifted, nothing when it is off, and an empty map when the database refuses the read. Made-up jobs.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

import { useOpenBuildWaits } from './useOpenBuildWaits'
import { BUILD_WAITS_CHANGED_EVENT } from '../lib/bridge/build/buildWaitsIo'
import { BuildWaitChip } from '../components/jobs/BuildWaitChip'
import type { BuildWait } from '../lib/bridge/build/buildWaits'

const wait = (jobId: string, over: Partial<BuildWait> = {}): BuildWait => ({ jobId, reason: 'gc_not_ready', note: '', sinceYmd: '2026-10-26', markedByName: 'Dana Office', ...over })

function Probe({ enabled, io }: { enabled: boolean; io: { loadOpen: () => Promise<BuildWait[] | null> } }) {
  const byJobId = useOpenBuildWaits(enabled, io)
  return (
    <div>
      <span data-testid="count">{byJobId.size}</span>
      <BuildWaitChip wait={byJobId.get('j878')} />
    </div>
  )
}

describe('useOpenBuildWaits and the job’s chip', () => {
  it('reads once on mount, and the waiting job wears its chip', async () => {
    const loadOpen = vi.fn(async () => [wait('j878'), wait('j912', { reason: 'materials' })])
    render(<Probe enabled io={{ loadOpen }} />)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))
    expect(loadOpen).toHaveBeenCalledTimes(1)
    const chip = screen.getByTestId('build-wait-chip')
    expect(chip.textContent).toBe('Waits · the GC is not ready for us · since Oct 26')
    expect(chip.getAttribute('title')).toContain('marked as waiting by Dana')
    // A label, not a press.
    expect(chip.tagName).toBe('SPAN')
  })

  it('reads again when a wait is marked or lifted anywhere on the page', async () => {
    let waits: BuildWait[] = [wait('j878')]
    const loadOpen = vi.fn(async () => waits)
    render(<Probe enabled io={{ loadOpen }} />)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    waits = []
    act(() => {
      window.dispatchEvent(new Event(BUILD_WAITS_CHANGED_EVENT))
    })
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))
    expect(screen.queryByTestId('build-wait-chip')).toBeNull()
    expect(loadOpen).toHaveBeenCalledTimes(2)
  })

  it('a read the database refuses leaves the board as it was, with no chip', async () => {
    const loadOpen = vi.fn(async () => null)
    render(<Probe enabled io={{ loadOpen }} />)
    await waitFor(() => expect(loadOpen).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('count').textContent).toBe('0')
    expect(screen.queryByTestId('build-wait-chip')).toBeNull()
  })

  it('reads nothing while it is off', () => {
    const loadOpen = vi.fn(async () => [wait('j878')])
    render(<Probe enabled={false} io={{ loadOpen }} />)
    expect(loadOpen).not.toHaveBeenCalled()
    expect(screen.getByTestId('count').textContent).toBe('0')
  })

  it('a job with no wait wears no chip', () => {
    const { container } = render(<BuildWaitChip wait={undefined} />)
    expect(container.textContent).toBe('')
  })
})
