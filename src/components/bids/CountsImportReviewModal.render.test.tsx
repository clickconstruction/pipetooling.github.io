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
import { INCOMING_SOURCE_KEY } from '../../lib/bids/countSources'
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

describe('the Combine and re-copy faces (v2.5519)', () => {
  const shared = (id: string, fixture: string, count: number, page: string | null, shares: Record<string, number> | null): CountSheetRow => ({ id, fixture, count, group_tag: null, page, unit: null, source_shares: shares })
  const bid = [shared('w34', 'ft of 3/4IN WATER', 1489.04, '10, 11, 12', { t1: 1489.04 }), shared('w4', 'ft of 4IN WASTE', 118.61, '10', { t1: 118.61 }), shared('ewc', 'EWC-1', 5, '10, 11, 12', { t1: 5 })]
  const robert = [inc('ft of 3/4IN WATER', 338.41, null, '12'), inc('ft of 4IN WASTE', 376.48, null, '12'), inc('ft of 1IN WATER', 682.49, null, '12')]
  const source = (onModeChange: ((m: 'combine' | 'replace') => void) | null) => ({ projectName: 'SpaceX BA', importerName: 'Robert', bidProjects: [{ id: 't1', label: 'SpaceX BA · Taunya', rows: 3 }], onModeChange })

  it('a second project’s copy: the strip, Both counted with its math, Only on the bid, and the footer', () => {
    const review = reviewCountsImport({ incoming: robert, existing: bid, alternateTags: [], scope: 'all', mode: 'combine', incomingKey: INCOMING_SOURCE_KEY })
    const onModeChange = vi.fn()
    const onApply = vi.fn()
    render(<CountsImportReviewModal review={review} existingCount={bid.length} attached={new Map()} busy={false} onApply={onApply} onCancel={() => {}} source={source(onModeChange)} />)
    expect(screen.getByTestId('counts-review-headline').textContent).toBe('3 rows copied · every sheet and every layer · SpaceX BA · Robert · 3 rows on this bid from SpaceX BA · Taunya')
    expect(screen.getByTestId('counts-review-mode').textContent).toContain('A second CountTooling project. Robert’s count joins SpaceX BA · Taunya’s count on this bid.')
    const both = screen.getByTestId('counts-review-both').textContent ?? ''
    expect(both).toContain('Both counted 2')
    expect(both).toContain('1,489.04 + 338.41 = 1,827.45')
    expect(both).toContain('page 10 + 12 → 10, 12')
    expect(screen.getByTestId('counts-review-untouched').textContent).toContain('Only on the bid 1')
    expect(screen.getByTestId('counts-review-untouched').textContent).toContain('EWC-1 · 5')
    expect(screen.queryByTestId('counts-review-missing')).toBeNull()
    expect(summary()).toBe('Will add to 2, add 1. 1 untouched. The copy’s link joins the bid’s CountTooling links (2).')
    // One row replaced instead: the row takes the copy’s count.
    fireEvent.click(screen.getAllByRole('button', { name: 'Replace' })[1]!)
    expect(summary()).toContain('Will add to 1, replace 1, add 1.')
    // The bucket switch: Leave as is empties the pile; Add to it fills it again.
    fireEvent.click(screen.getByRole('button', { name: 'Leave as is' }))
    expect(summary()).toContain('Will add 1.')
    fireEvent.click(screen.getByRole('button', { name: 'Add to it' }))
    expect(summary()).toContain('Will add to 2, add 1.')
    fireEvent.click(screen.getByRole('button', { name: 'Replace what matches' }))
    expect(onModeChange).toHaveBeenCalledWith('replace')
    fireEvent.click(apply())
    expect(onApply).toHaveBeenCalledTimes(1)
    expect([...(onApply.mock.calls[0]![0] as { update: Set<string> }).update]).toEqual(['w34', 'w4'])
  })

  it('a re-copy of a project on the bid: the strip, the share words, a shared missing row, and the untouched fold', () => {
    const combined = [shared('w34', 'ft of 3/4IN WATER', 1827.45, '10, 11, 12', { t1: 1489.04, r2: 338.41 }), shared('w4', 'ft of 4IN WASTE', 495.09, '10, 12', { t1: 118.61, r2: 376.48 }), shared('ewc', 'EWC-1', 5, '10, 11, 12', { t1: 5 })]
    const again = [inc('ft of 3/4IN WATER', 340, null, '12')]
    const review = reviewCountsImport({ incoming: again, existing: combined, alternateTags: [], scope: 'all', mode: 'recopy', incomingKey: 'r2' })
    render(<CountsImportReviewModal review={review} existingCount={combined.length} attached={new Map()} busy={false} onApply={() => {}} onCancel={() => {}} source={{ ...source(null), bidProjects: [{ id: 't1', label: 'SpaceX BA · Taunya', rows: 3 }, { id: 'r2', label: 'SpaceX BA · Robert', rows: 2 }] }} />)
    expect(screen.getByTestId('counts-review-recopy').textContent).toContain('This project is already on the bid.')
    expect(screen.queryByTestId('counts-review-mode')).toBeNull()
    expect(screen.getByTestId('counts-review-changed').textContent).toContain('share 338.41 → 340 · 1,489.04 stays with the other projects')
    expect(screen.getByTestId('counts-review-missing').textContent).toContain('only this project’s 376.48 leaves · 118.61 stays')
    expect(screen.getByTestId('counts-review-untouched').textContent).toContain('EWC-1 · 5')
    expect(summary()).toBe('Will update 2. 1 untouched. The link stays.')
  })
})
