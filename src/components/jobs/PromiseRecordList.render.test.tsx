// @vitest-environment jsdom
/**
 * Render smoke for the record under "They said…": each promise on the bill
 * with who said it, the one the board shows marked, and "never said that"
 * handing the parent the promise to take off.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PromiseRecordList from './PromiseRecordList'
import type { PaymentPromise } from '../../lib/jobs/paymentPromises'

const said = (id: string, promisedYmd: string, over: Partial<PaymentPromise> = {}): PaymentPromise => ({
  id,
  jobId: 'j1',
  customerId: 'c1',
  promisedYmd,
  saidBy: null,
  heardByName: 'Robert',
  channel: 'phone',
  source: 'office',
  note: null,
  createdAt: '2026-09-28T15:00:00Z',
  ...over,
})

describe('PromiseRecordList', () => {
  it('draws nothing when the bill has no promises', () => {
    const { container } = render(<PromiseRecordList promises={[]} boardYmd={null} busyId={null} onNeverSaid={() => {}} />)
    expect(container.textContent).toBe('')
  })

  it('lists each promise and hands over the one that was never said', () => {
    const onNeverSaid = vi.fn()
    const promises = [said('p2', '2026-10-09', { saidBy: 'Tanya, their office' }), said('p1', '2026-09-25', { channel: 'text', createdAt: '2026-09-10T15:00:00Z' })]
    render(<PromiseRecordList promises={promises} boardYmd="2026-10-09" busyId={null} onNeverSaid={onNeverSaid} />)
    expect(screen.getByText('On record for this bill · 2 promises')).toBeTruthy()
    const rows = screen.getAllByTestId('promise-record-row')
    expect(rows[0]!.textContent).toContain('Oct 9')
    expect(rows[0]!.textContent).toContain('Tanya, their office · by phone · heard by Robert · written Sep 28')
    expect(rows[1]!.textContent).toContain('by text · heard by Robert · written Sep 10')
    fireEvent.click(screen.getByRole('button', { name: 'They never said Sep 25 — take it off the record' }))
    expect(onNeverSaid).toHaveBeenCalledWith(promises[1])
  })

  it('holds every row while one is being taken off', () => {
    const onNeverSaid = vi.fn()
    render(<PromiseRecordList promises={[said('p2', '2026-10-09'), said('p1', '2026-09-25')]} boardYmd={null} busyId="p2" onNeverSaid={onNeverSaid} />)
    expect(screen.getByText('removing…')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'They never said Sep 25 — take it off the record' }))
    expect(onNeverSaid).not.toHaveBeenCalled()
  })
})
