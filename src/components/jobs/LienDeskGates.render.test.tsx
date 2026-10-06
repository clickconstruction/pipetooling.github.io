// @vitest-environment jsdom
/**
 * The gates strip (v2.4718): a clear gate's section folds until its cell is pressed or
 * Details ∨ opens them all; a gate that is not clear opens on its own; Fold the details ∧
 * closes the clear ones and leaves the open one alone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import LienDeskGates from './LienDeskGates'
import type { LienGate } from '../../lib/jobs/lienDeskGates'

afterEach(cleanup)

const gate = (n: 1 | 2 | 3 | 4, key: LienGate['key'], label: string, tone: LienGate['tone'], value: string): LienGate => ({ n, key, label, tone, value, title: `${label}: ${value}` })
const clear = [gate(1, 'owner', 'Owner of record', 'ok', 'Khan Umar'), gate(2, 'gc', 'Original contractor', 'ok', 'RMC- Dudley Mason'), gate(3, 'kind', 'Property kind', 'ok', 'Residential · Bexar'), gate(4, 'months', 'Approved hours', 'ok', 'Jul, Aug')]
const details = { owner: <span>owner row</span>, gc: <span>gc row</span>, kind: <span>kind row</span>, months: <span>months row</span> }
const verdict = { ready: true, headline: 'Ready to go out', summary: 'All 4 clear', blockers: 0, checks: 0 }

describe('LienDeskGates — the fold (v2.4718)', () => {
  it('on a clear job every section is folded; a cell press opens its own row and rings it; Details ∨ opens them all and Fold closes them', () => {
    const onPick = vi.fn()
    const { container } = render(<LienDeskGates gates={clear} verdict={verdict} details={details} onPick={onPick} />)
    expect(container.querySelectorAll('[data-gate-detail]')).toHaveLength(0)
    expect((container.querySelector('[data-gate="owner"]') as HTMLElement).getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(container.querySelector('[data-gate="gc"]') as HTMLElement)
    expect(onPick).toHaveBeenCalledWith('gc')
    expect([...container.querySelectorAll('[data-gate-detail]')].map((d) => d.getAttribute('data-gate-detail'))).toEqual(['gc'])
    expect((container.querySelector('[data-gate-detail="gc"]') as HTMLElement).textContent).toBe('2Original contractorgc row')
    fireEvent.click(container.querySelector('[data-lien-gates-fold="open"]') as HTMLElement)
    expect(container.querySelectorAll('[data-gate-detail]')).toHaveLength(4)
    fireEvent.click(container.querySelector('[data-lien-gates-fold="close"]') as HTMLElement)
    expect(container.querySelectorAll('[data-gate-detail]')).toHaveLength(0)
  })
  it('a gate that is not clear is open on its own and stays open through Fold', () => {
    const blocked = [gate(1, 'owner', 'Owner of record', 'blocker', 'missing'), ...clear.slice(1)]
    const { container } = render(<LienDeskGates gates={blocked} verdict={{ ready: false, headline: "Can't go out yet", summary: '1 blocker', blockers: 1, checks: 0 }} details={details} />)
    expect([...container.querySelectorAll('[data-gate-detail]')].map((d) => d.getAttribute('data-gate-detail'))).toEqual(['owner'])
    expect((container.querySelector('[data-gate-detail="owner"]') as HTMLElement).getAttribute('data-tone')).toBe('blocker')
    fireEvent.click(container.querySelector('[data-lien-gates-fold="open"]') as HTMLElement)
    expect(container.querySelectorAll('[data-gate-detail]')).toHaveLength(4)
    fireEvent.click(container.querySelector('[data-lien-gates-fold="close"]') as HTMLElement)
    expect([...container.querySelectorAll('[data-gate-detail]')].map((d) => d.getAttribute('data-gate-detail'))).toEqual(['owner'])
  })
})
