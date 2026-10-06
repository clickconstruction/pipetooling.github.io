// @vitest-environment jsdom
/**
 * Render smoke for the import review (v2.4699): the four piles drawn from the kernel's review, the
 * bucket switch and a row's tick changing the summary, the rename proposal becoming one update,
 * Missing starting on Keep for a partial copy, and Apply handing back the choices. The kernel's own
 * tests pin what each choice writes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { reviewCountsImport } from '../../lib/bids/countsImportReview'
import type { CountSheetRow } from '../../lib/bids/countSheet'
import type { ParsedCountImportRow } from '../../lib/bids/parseCountsImportText'
import { CountsImportReviewModal } from './CountsImportReviewModal'

afterEach(() => cleanup())

const ex = (id: string, fixture: string, count: number, group_tag: string | null = null, page: string | null = null): CountSheetRow => ({ id, fixture, count, group_tag, page, unit: null })
const inc = (fixture: string, count: number, group_tag: string | null = null, page: string | null = null): ParsedCountImportRow => ({ fixture, count, group_tag, page, unit: 'ea' })

const existing = [ex('a', 'WC', 12, 'Restroom A', '2, 4'), ex('t', 'Trap primer', 2, 'Restroom B', '4'), ex('h', 'Hose bibb', 1, 'Break room', '7'), ex('s', 'UR', 4, 'Restroom A', '2')]
const incoming = [inc('WC', 14, 'Restroom A', '2, 4, 6'), inc('Trap primer TP-1', 2, 'Restroom B', '4'), inc('Mop sink', 1, 'Janitor', '6'), inc('UR', 4, 'Restroom A', '2')]

function setup(scope: 'all' | 'partial' = 'all') {
  const review = reviewCountsImport({ incoming, existing, alternateTags: [], scope })
  const onApply = vi.fn()
  const onCancel = vi.fn()
  render(<CountsImportReviewModal review={review} existingCount={existing.length} attached={new Map([['a', { parts: 6, priced: true }], ['t', { parts: 3, priced: true }]])} busy={false} onApply={onApply} onCancel={onCancel} />)
  return { review, onApply, onCancel }
}
const summary = () => screen.getByTestId('counts-review-summary').textContent ?? ''
const apply = () => screen.getByRole('button', { name: /^Apply/ }) as HTMLButtonElement

describe('CountsImportReviewModal', () => {
  it('draws the piles with their defaults on a copy of every sheet: update all, add all, remove all, same folded', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Review the import' })).toBeTruthy()
    expect(screen.getByTestId('counts-review-changed').textContent).toContain('6 parts · priced · stays')
    expect(screen.getByTestId('counts-review-missing').textContent).toContain('lost on remove')
    expect(screen.getByTestId('counts-review-same').textContent).toContain('1 row matches exactly')
    expect(summary()).toContain('Will update 1, add 2, remove 2. 1 unchanged.')
    expect(apply().textContent).toBe('Apply 5 changes')
  })

  it('a partial copy starts Missing on Keep all, and says why', () => {
    setup('partial')
    expect(summary()).toContain('Will update 1, add 2. 1 unchanged.')
    expect(screen.getByTestId('counts-review-missing').textContent).toContain('part of the takeoff')
  })

  it('the bucket switch and a row tick change the summary; nothing ticked holds Apply', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Leave as is' }))
    expect(summary()).toContain('Will add 2, remove 2. 1 unchanged.')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Update WC' }))
    expect(summary()).toContain('Will update 1, add 2, remove 2. 1 unchanged.')
    fireEvent.click(screen.getByRole('button', { name: 'Skip all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep all' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Update WC' }))
    expect(summary()).toContain('Nothing to change. 1 unchanged.')
    expect(apply().disabled).toBe(true)
  })

  it('accepting the rename proposal turns a delete and an insert into one update', () => {
    const { onApply } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Same row, renamed' }))
    expect(summary()).toContain('Will update 2, add 1, remove 1. 1 unchanged.')
    expect(screen.getByTestId('counts-review-missing').textContent).toContain('kept as the same row')
    fireEvent.click(apply())
    expect(onApply).toHaveBeenCalledTimes(1)
    const choices = onApply.mock.calls[0]![0]
    expect([...choices.pair]).toEqual([0])
    expect([...choices.update]).toEqual(['a'])
  })

  it('Cancel and × hand back without applying', () => {
    const { onApply, onCancel } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onCancel).toHaveBeenCalledTimes(2)
    expect(onApply).not.toHaveBeenCalled()
  })
})
