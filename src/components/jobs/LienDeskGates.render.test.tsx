// @vitest-environment jsdom
/**
 * The gates strip (v2.4718): a clear gate's section folds until its cell is pressed or
 * More details ∨ opens them all; a gate that is not clear opens on its own; Fewer details ∧
 * closes the clear ones and leaves the open one alone. Since v2.7423 (Taunya's ask of
 * 2026-11-15) the press carries those words and tucks under an open row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import LienDeskGates, { LienGatesSentFold } from './LienDeskGates'
import type { LienGate } from '../../lib/jobs/lienDeskGates'

afterEach(cleanup)

const gate = (n: 1 | 2 | 3 | 4, key: LienGate['key'], label: string, tone: LienGate['tone'], value: string): LienGate => ({ n, key, label, tone, value, title: `${label}: ${value}` })
const clear = [gate(1, 'owner', 'Owner of record', 'ok', 'Karrow Ulric'), gate(2, 'gc', 'Original contractor', 'ok', 'RLC- Dunmere Mallin'), gate(3, 'kind', 'Property kind', 'ok', 'Residential · Bexar'), gate(4, 'months', 'Approved hours', 'ok', 'Jul, Aug')]
const details = { owner: <span>owner row</span>, gc: <span>gc row</span>, kind: <span>kind row</span>, months: <span>months row</span> }
const verdict = { ready: true, headline: 'Ready to go out', summary: 'All 4 clear', blockers: 0, checks: 0 }

describe('LienGatesSentFold — one line on a sent notice (v2.6625, punch list #248)', () => {
  it('draws the line with no verdict, and More details ∨ opens the four facts as rows', () => {
    const fold = { sentOn: 'Oct 14', head: 'Sent Oct 14', months: 'Jul + Aug', line: 'Sent Oct 14 · Karrow Ulric · RLC- Dunmere Mallin · Residential · Bexar · Jul + Aug', rows: [{ n: 1 as const, key: 'owner' as const, label: 'Owner of record', value: 'Karrow Ulric' }, { n: 2 as const, key: 'gc' as const, label: 'Original contractor', value: 'RLC- Dunmere Mallin' }, { n: 3 as const, key: 'kind' as const, label: 'Property kind', value: 'Residential · Bexar' }, { n: 4 as const, key: 'months' as const, label: 'Months the notice named', value: 'Jul + Aug' }] }
    const { container } = render(<LienGatesSentFold fold={fold} />)
    expect((container.querySelector('[data-lien-gates-sent-line]') as HTMLElement).textContent).toBe(fold.line)
    expect(container.querySelector('.lienGatesVerdict')).toBeNull()
    expect(container.querySelectorAll('[data-lien-gates-sent-row]')).toHaveLength(0)
    expect((container.querySelector('[data-lien-gates-sent-fold]') as HTMLElement).textContent).toBe('More details ∨')
    fireEvent.click(container.querySelector('[data-lien-gates-sent-fold="open"]') as HTMLElement)
    expect((container.querySelector('[data-lien-gates-sent-fold]') as HTMLElement).textContent).toBe('Fewer details ∧')
    expect([...container.querySelectorAll('[data-lien-gates-sent-row]')].map((d) => d.textContent)).toEqual(['1Owner of recordKarrow Ulric', '2Original contractorRLC- Dunmere Mallin', '3Property kindResidential · Bexar', '4Months the notice namedJul + Aug'])
    fireEvent.click(container.querySelector('[data-lien-gates-sent-fold="close"]') as HTMLElement)
    expect(container.querySelectorAll('[data-lien-gates-sent-row]')).toHaveLength(0)
  })
})

describe('LienDeskGates — the fold (v2.4718)', () => {
  it('on a clear job every section is folded; a cell press opens its own row and rings it; More details ∨ opens them all and Fewer details ∧ closes them', () => {
    const onPick = vi.fn()
    const { container } = render(<LienDeskGates gates={clear} verdict={verdict} details={details} onPick={onPick} />)
    expect(container.querySelectorAll('[data-gate-detail]')).toHaveLength(0)
    expect((container.querySelector('[data-gate="owner"]') as HTMLElement).getAttribute('aria-expanded')).toBe('false')
    // With no row open the press keeps the box's whole gap under the four cells.
    const press = () => container.querySelector('[data-lien-gates-fold]') as HTMLElement
    expect(press().textContent).toBe('More details ∨')
    expect((press().parentElement as HTMLElement).getAttribute('data-under-row')).toBe('no')
    fireEvent.click(container.querySelector('[data-gate="gc"]') as HTMLElement)
    expect(onPick).toHaveBeenCalledWith('gc')
    expect([...container.querySelectorAll('[data-gate-detail]')].map((d) => d.getAttribute('data-gate-detail'))).toEqual(['gc'])
    expect((container.querySelector('[data-gate-detail="gc"]') as HTMLElement).textContent).toBe('2Original contractorgc row')
    // One row is open and three are not: the press still reads More details, and tucks under the row.
    expect(press().textContent).toBe('More details ∨')
    expect((press().parentElement as HTMLElement).getAttribute('data-under-row')).toBe('yes')
    fireEvent.click(container.querySelector('[data-lien-gates-fold="open"]') as HTMLElement)
    expect(container.querySelectorAll('[data-gate-detail]')).toHaveLength(4)
    expect(press().textContent).toBe('Fewer details ∧')
    fireEvent.click(container.querySelector('[data-lien-gates-fold="close"]') as HTMLElement)
    expect(container.querySelectorAll('[data-gate-detail]')).toHaveLength(0)
    expect((press().parentElement as HTMLElement).getAttribute('data-under-row')).toBe('no')
  })
  it('a gate that is not clear is open on its own and stays open through Fold', () => {
    const blocked = [gate(1, 'owner', 'Owner of record', 'blocker', 'missing'), ...clear.slice(1)]
    const { container } = render(<LienDeskGates gates={blocked} verdict={{ ready: false, headline: "Can't go out yet", summary: '1 blocker', blockers: 1, checks: 0 }} details={details} />)
    expect([...container.querySelectorAll('[data-gate-detail]')].map((d) => d.getAttribute('data-gate-detail'))).toEqual(['owner'])
    expect((container.querySelector('[data-gate-detail="owner"]') as HTMLElement).getAttribute('data-tone')).toBe('blocker')
    // The gate's words are the last thing above the press, so no band stands between them (v2.7423).
    expect((container.querySelector('.lienGatesFold') as HTMLElement).getAttribute('data-under-row')).toBe('yes')
    expect((container.querySelector('[data-lien-gates-fold]') as HTMLElement).textContent).toBe('More details ∨')
    fireEvent.click(container.querySelector('[data-lien-gates-fold="open"]') as HTMLElement)
    expect(container.querySelectorAll('[data-gate-detail]')).toHaveLength(4)
    fireEvent.click(container.querySelector('[data-lien-gates-fold="close"]') as HTMLElement)
    expect([...container.querySelectorAll('[data-gate-detail]')].map((d) => d.getAttribute('data-gate-detail'))).toEqual(['owner'])
  })
})
