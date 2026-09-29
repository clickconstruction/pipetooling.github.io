// @vitest-environment jsdom
/**
 * Render smoke for the My lines editor (v2.4070): the rows with their split, the totals,
 * the reconcile bar with scale-to-contract, and the writes (+ Add line, paste, scale)
 * landing on `bid_sov_lines` before the parent is asked to re-read.
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderSmokeMocks'
import { CoverLetterSovLinesEditor } from './CoverLetterSovLinesEditor'
import type { SovLine } from '../../lib/bidDocuments/sovLines'

const writes: Array<{ op: string; payload: unknown }> = []
vi.mock('../../lib/supabase', () => {
  const builder = (op: string, payload?: unknown) => {
    const b: Record<string, unknown> = {}
    const chain = () => b
    b.eq = chain
    b.order = chain
    b.select = chain
    b.then = (resolve: (v: { data: null; error: null }) => void) => {
      writes.push({ op, payload })
      resolve({ data: null, error: null })
    }
    return b
  }
  return {
    supabase: {
      from: () => ({
        insert: (payload: unknown) => builder('insert', payload),
        update: (payload: unknown) => builder('update', payload),
        delete: () => builder('delete'),
        select: () => builder('select'),
      }),
    },
  }
})

const line = (p: Partial<SovLine> & { id: string; label: string; value: number }): SovLine => ({ sortOrder: 0, labor: null, note: '', stage: null, ...p })

describe('CoverLetterSovLinesEditor', () => {
  it('shows the lines with their split and the gap against the contract, and scales them', async () => {
    const onChanged = vi.fn()
    renderWithProviders(
      <CoverLetterSovLinesEditor
        bidId="b1"
        lines={[line({ id: 'l1', sortOrder: 0, label: 'Gas piping', value: 4200, labor: 1900, note: 'To the meter' }), line({ id: 'l2', sortOrder: 1, label: 'Water heater', value: 4500 })]}
        contractAmount={9000}
        splitOn
        ruleLaborPct={45}
        seeds={null}
        onChanged={onChanged}
      />,
    )
    expect(screen.getByLabelText('Line 1 name')).toHaveProperty('value', 'Gas piping')
    expect(screen.getByLabelText('Line 1 note')).toHaveProperty('value', 'To the meter')
    // Water heater has no labor typed: the company share (45% of 4,500 = 2,025) is the placeholder, material 2,475.
    expect(screen.getByLabelText('Line 2 labor')).toHaveProperty('placeholder', '2,025.00')
    expect(screen.getByText('$2,475.00')).toBeTruthy()
    expect(screen.getByText('2 lines')).toBeTruthy()
    const gap = screen.getByTestId('cover-letter-sov-lines-gap')
    expect(gap.textContent).toContain('Lines add to $8,700.00')
    expect(gap.textContent).toContain('$300.00 short of the $9,000.00 contract')
    fireEvent.click(screen.getByText('Scale every line to the contract'))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    const updates = writes.filter((w) => w.op === 'update').map((w) => w.payload as { value: number; labor: number | null })
    expect(updates.map((u) => u.value)).toEqual([4344.83, 4655.17])
    expect(updates[0]!.labor).toBeCloseTo(1965.52, 2)
    expect(updates[1]!.labor).toBeNull()
  })

  it('adds a line, and pastes the GC’s names as lines with blank values', async () => {
    writes.length = 0
    const onChanged = vi.fn()
    renderWithProviders(<CoverLetterSovLinesEditor bidId="b1" lines={[line({ id: 'l1', label: 'Trim', value: 9000 })]} contractAmount={9000} splitOn={false} ruleLaborPct={45} seeds={null} onChanged={onChanged} />)
    expect(screen.queryByTestId('cover-letter-sov-lines-gap')).toBeNull()
    expect(screen.getByText('Lines add to the $9,000.00 contract.')).toBeTruthy()
    fireEvent.click(screen.getByText('+ Add line'))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(writes[0]).toMatchObject({ op: 'insert', payload: { bid_id: 'b1', sort_order: 1, label: '', value: 0 } })
    fireEvent.click(screen.getByText("Paste the GC's line names…"))
    fireEvent.change(screen.getByLabelText("The GC's line names, one per row"), { target: { value: '1. Mobilization\n2. Gas piping\n' } })
    fireEvent.click(screen.getByText('Add these lines (values blank)'))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(2))
    expect(writes[1]).toMatchObject({ op: 'insert', payload: [{ label: 'Mobilization', sort_order: 1, value: 0 }, { label: 'Gas piping', sort_order: 2, value: 0 }] })
  })
})
