// @vitest-environment jsdom
/**
 * Render smoke for the promote/take-off confirm (punch list #134): one alternate gets the
 * plain sentence and both doors; two alternates get the radio with the recommended pick
 * preselected; the promote mode keeps the old GC and says so; a legacy-builder primary
 * loses the keep door. The swap itself is the promote_bid_gc RPC, pinned by the kernel
 * tests (`promoteBidGc.test.ts`) and the migration.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PromoteBidGcModal } from './PromoteBidGcModal'
import type { PromoteAlternate } from '../../lib/bids/promoteBidGc'

afterEach(() => cleanup())

const rio: PromoteAlternate = { customerId: 'rio', name: 'Rio Grande Commercial', source: 'version' }
const mesa: PromoteAlternate = { customerId: 'mesa', name: 'Mesa & Stone GC', source: 'manual' }

function setup(over: Partial<Parameters<typeof PromoteBidGcModal>[0]> = {}) {
  const props = {
    mode: 'remove' as const,
    oldGcName: 'Caldwell Builders',
    oldIsCustomer: true,
    alternates: [rio],
    recommendedId: 'rio',
    busy: false,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
  render(<PromoteBidGcModal {...props} />)
  return props
}

describe('PromoteBidGcModal', () => {
  it('one alternate: names the successor, takes off on the primary, keeps on the second door', () => {
    const p = setup()
    expect(screen.getByText('Take Caldwell Builders off this bid?')).toBeTruthy()
    expect(screen.queryByRole('radio')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Take off — Rio Grande Commercial leads' }))
    expect(p.onConfirm).toHaveBeenCalledWith('rio', false)
    fireEvent.click(screen.getByRole('button', { name: 'Keep as an alternate instead' }))
    expect(p.onConfirm).toHaveBeenCalledWith('rio', true)
  })

  it('two alternates: asks who steps up, preselecting the recommended pick', () => {
    const p = setup({ alternates: [mesa, rio], recommendedId: 'rio' })
    expect(screen.getByText('Who runs the bid now?')).toBeTruthy()
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios).toHaveLength(2)
    expect(radios.find((r) => r.checked)).toBeTruthy()
    expect(screen.getByText('Rio Grande Commercial')).toBeTruthy()
    fireEvent.click(radios[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Take off — Mesa & Stone GC leads' }))
    expect(p.onConfirm).toHaveBeenCalledWith('mesa', false)
  })

  it('promote mode keeps the old GC on the bid and says so', () => {
    const p = setup({ mode: 'promote', targetCustomerId: 'rio' })
    expect(screen.getByText("Make Rio Grande Commercial the bid's GC?")).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Keep as an alternate instead' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: "Make bid's GC" }))
    expect(p.onConfirm).toHaveBeenCalledWith('rio', true)
  })

  it('a legacy-builder primary cannot stay as an alternate', () => {
    setup({ oldIsCustomer: false })
    expect(screen.queryByRole('button', { name: 'Keep as an alternate instead' })).toBeNull()
  })

  it('while the swap runs everything is held', () => {
    const p = setup({ busy: true })
    const go = screen.getByRole('button', { name: 'Working…' }) as HTMLButtonElement
    expect(go.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(p.onClose).not.toHaveBeenCalled()
  })
})
