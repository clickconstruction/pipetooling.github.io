// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { setTimeout as delay } from 'node:timers/promises'
import { act, render } from '@testing-library/react'
import type { Paper } from '../../../../lib/messages/papers'
import type { PapersIo } from '../../../../lib/messages/papersIo'
import { usePapers } from './usePapers'

const BILL: Paper = { kind: 'bill', id: 'b-1', jobId: 'j-1', job: 'Helotes re-pipe', number: '1312', open: true, amount: 1440, billedYmd: '2026-10-01', payUrl: null }

/** A box's worth of the hook: the papers it holds, drawn as their count, `none` while it holds nothing. */
function Box({ io, customerId, wanted }: { io: PapersIo; customerId: string | null; wanted: boolean }) {
  const papers = usePapers(io, customerId, wanted)
  return <div data-papers={papers === null ? 'none' : String(papers.length)} />
}

/** A read the test lands by hand: `land` inside `act`, `landRaw` as the network would, with nothing waiting on it. */
function heldRead() {
  let resolve!: (papers: Paper[]) => void
  const io: PapersIo = { load: vi.fn(() => new Promise<Paper[]>((r) => { resolve = r })) }
  return { io, land: (papers: Paper[]) => act(async () => resolve(papers)), landRaw: (papers: Paper[]) => resolve(papers) }
}

const drawn = (el: HTMLElement) => el.querySelector('[data-papers]')!.getAttribute('data-papers')

describe('usePapers reads a customer’s papers once wanted (#127)', () => {
  it('reads once they are wanted, holds them for that customer, and never asks twice', async () => {
    const { io, land } = heldRead()
    const { container, rerender } = render(<Box io={io} customerId="cust-1" wanted={false} />)
    expect(io.load).not.toHaveBeenCalled()
    rerender(<Box io={io} customerId="cust-1" wanted />)
    expect(io.load).toHaveBeenCalledWith('cust-1')
    expect(drawn(container)).toBe('none')
    await land([BILL])
    expect(drawn(container)).toBe('1')
    rerender(<Box io={io} customerId="cust-1" wanted={false} />)
    rerender(<Box io={io} customerId="cust-1" wanted />)
    expect(io.load).toHaveBeenCalledTimes(1)
    expect(drawn(container)).toBe('1')
  })

  it('a fold while the read is out keeps the read', async () => {
    const { io, land } = heldRead()
    const { container, rerender } = render(<Box io={io} customerId="cust-1" wanted />)
    rerender(<Box io={io} customerId="cust-1" wanted={false} />)
    await land([BILL])
    rerender(<Box io={io} customerId="cust-1" wanted />)
    expect(drawn(container)).toBe('1')
    expect(io.load).toHaveBeenCalledTimes(1)
  })

  it('a read that lands after the box is gone reaches nothing, with the window gone too', async () => {
    // PR #6892's red run with every test passing: the strip test ended, the box was unmounted, the environment torn
    // down, and the papers read landed in the gap before the worker's exit. React's setState after unmount still
    // reads `window` (`getCurrentEventPriority`), so the landing was `ReferenceError: window is not defined`, an
    // unhandled rejection that fails the run. Here the window goes the way the teardown takes it, and whatever
    // the landing throws is caught in vitest's place and must be nothing.
    const { io, landRaw } = heldRead()
    const { unmount } = render(<Box io={io} customerId="cust-1" wanted />)
    expect(io.load).toHaveBeenCalledTimes(1)
    unmount()
    const g = globalThis as { window?: unknown }
    const savedWindow = g.window
    delete g.window
    const vitestListeners = process.listeners('unhandledRejection')
    for (const l of vitestListeners) process.off('unhandledRejection', l)
    const leaked: unknown[] = []
    const keep = (e: unknown) => {
      leaked.push(e)
    }
    process.on('unhandledRejection', keep)
    try {
      landRaw([BILL])
      await delay(20)
    } finally {
      process.off('unhandledRejection', keep)
      for (const l of vitestListeners) process.on('unhandledRejection', l)
      g.window = savedWindow
    }
    expect(leaked).toEqual([])
  })
})
