// @vitest-environment jsdom
/**
 * Render smoke for Codes with no part (punch list #298 PR 2a, v2.7121): the list by dollars with its offers, the
 * batch press that names its count and takes the sure offers alone, a refusal named with its reason while the rest
 * go on, This is it, Pick a part, Not a part, Later, New part in the book, and the good empty state. The list and
 * the offers are codesWithNoPart.ts (kernel-tested); this holds the wiring.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders, settle } from '../../test/renderSmokeMocks'
import type { CodesData, CodesIo } from '../../lib/materials/lines/codesWithNoPartIo'
import type { CodeLine } from '../../lib/materials/lines/codesWithNoPart'
import { CodesWithNoPartWindow } from './CodesWithNoPartWindow'

vi.mock('../../hooks/useAuth', async () => {
  const m = await import('../../test/renderSmokeMocks')
  return m.useAuthModuleMock({ role: 'assistant' })
})

const line = (over: Partial<CodeLine> & { id: string }): CodeLine => ({ invoiceId: `b-${over.id}`, houseId: 'h1', datedOn: '2026-10-22', lineKind: 'part', houseCode: '', description: '', unit: 'EA', pricingUnit: 'each', unitPrice: null, partId: null, quantity: null, extendedCents: null, ...over })

// Made up: a pipe code nothing in the book fits, an angle stop the maker's number finds, a wax ring of the same name.
const data = (): CodesData => ({
  lines: [
    line({ id: '1', houseCode: '0417-2210', description: 'PVC SCH40 PIPE 2X20 PE', quantity: 30, extendedCents: 151080 }),
    line({ id: '3', houseCode: 'RS-55310', mfrNumber: 'KTCR19X', description: 'ANGLE STOP 1/2X3/8 KTCR19X', quantity: 20, extendedCents: 12400 }),
    line({ id: '4', houseId: 'h2', houseCode: 'PS-0077', description: 'Wax Ring With Horn', quantity: 6, extendedCents: 1860 }),
  ],
  teaches: [],
  houseNames: new Map([['h1', 'Ridgeway Supply'], ['h2', 'Pecan Supply Co']]),
  book: [
    { id: 'p-valve', name: 'Brasscraft KTCR19X angle stop 1/2 x 3/8', manufacturer: 'Brasscraft' },
    { id: 'p-wax', name: 'Wax ring with horn', manufacturer: null },
    { id: 'p-pipe', name: 'PVC pipe schedule 40, 2 in. x 20 ft', manufacturer: null },
  ],
})

function mount(over: Partial<CodesIo> = {}) {
  const io: CodesIo = { load: vi.fn(async () => data()), keep: vi.fn(async () => ({ error: null })), ...over }
  const onClose = vi.fn()
  const onNewPart = vi.fn()
  const r = renderWithProviders(<CodesWithNoPartWindow io={io} onClose={onClose} onNewPart={onNewPart} />)
  return { ...r, io, onClose, onNewPart }
}

afterEach(() => cleanup())

describe('CodesWithNoPartWindow', () => {
  it('lists the codes by dollars, each with what the book offers, and the press names its count', async () => {
    mount()
    const win = await screen.findByTestId('codes-no-part')
    expect((await within(win).findByTestId('codes-standing')).textContent).toBe('3 codes with no part · $1,653 behind them')
    const rows = within(win).getAllByTestId('codes-row')
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringMatching(/PVC SCH40 PIPE 2X20 PE.*Ridgeway Supply 0417-2210.*1 time.*30 EA.*\$1,511.*no part fits yet/),
      expect.stringMatching(/ANGLE STOP.*RS-55310.*maker’s number KTCR19X.*\$124.*Brasscraft KTCR19X angle stop.*by its manufacturer’s number/),
      expect.stringMatching(/Wax Ring With Horn.*Pecan Supply Co PS-0077.*\$19.*Wax ring with horn.*by the same name/),
    ])
    expect(within(win).getByRole('button', { name: 'Match 2 offered codes' })).toBeTruthy()
    fireEvent.click(within(win).getByRole('button', { name: /1 left for a person/ }))
    expect(within(win).getByTestId('codes-held-why').textContent).toMatch(/leaves a code with no offer/)
  })

  it('the batch press teaches the sure offers, names the one refused with its reason, and goes on', async () => {
    const keep = vi.fn(async (input: { code: string }) => (input.code === 'PS-0077' ? { error: 'That house already uses this number for another part.' } : { error: null }))
    const { io } = mount({ keep })
    const win = await screen.findByTestId('codes-no-part')
    fireEvent.click(await within(win).findByRole('button', { name: 'Match 2 offered codes' }))
    await waitFor(() => expect(io.keep).toHaveBeenCalledTimes(2))
    expect(keep).toHaveBeenCalledWith({ supplyHouseId: 'h1', code: 'RS-55310', partId: 'p-valve', notAPart: false, taughtFrom: 'bill', taughtLineId: '3' })
    const outcome = await within(win).findByTestId('codes-outcome')
    expect(outcome.textContent).toMatch(/1/)
    expect(outcome.textContent).toMatch(/Pecan Supply Co PS-0077: That house already uses this number for another part\./)
    // The taught code is gone; the refused one and the one with no offer stay.
    expect(within(win).getAllByTestId('codes-row')).toHaveLength(2)
    expect(within(win).getByRole('button', { name: 'Match 1 offered code' })).toBeTruthy()
  })

  it('Pick a part finds one by its words, and Not a part marks a code as none', async () => {
    const { io } = mount()
    const win = await screen.findByTestId('codes-no-part')
    fireEvent.click(await within(win).findByRole('button', { name: 'Pick a part: 0417-2210' }))
    fireEvent.change(within(win).getByLabelText('Find a part for 0417-2210'), { target: { value: 'pvc pipe 2 in' } })
    fireEvent.click(await within(win).findByRole('button', { name: 'This is PVC pipe schedule 40, 2 in. x 20 ft: 0417-2210' }))
    await waitFor(() => expect(io.keep).toHaveBeenCalledWith({ supplyHouseId: 'h1', code: '0417-2210', partId: 'p-pipe', notAPart: false, taughtFrom: 'bill', taughtLineId: '1' }))
    await waitFor(() => expect(within(win).getAllByTestId('codes-row')).toHaveLength(2))
    fireEvent.click(within(win).getByRole('button', { name: 'Not a part: RS-55310' }))
    await waitFor(() => expect(io.keep).toHaveBeenCalledWith({ supplyHouseId: 'h1', code: 'RS-55310', partId: null, notAPart: true, taughtFrom: 'bill', taughtLineId: '3' }))
    await waitFor(() => expect(within(win).getAllByTestId('codes-row')).toHaveLength(1))
  })

  it('This is it teaches one, Later sets one aside with no write, and New part hands the words to the form', async () => {
    const { io, onNewPart } = mount()
    const win = await screen.findByTestId('codes-no-part')
    fireEvent.click(await within(win).findByRole('button', { name: 'This is it: PS-0077' }))
    await waitFor(() => expect(io.keep).toHaveBeenCalledWith({ supplyHouseId: 'h2', code: 'PS-0077', partId: 'p-wax', notAPart: false, taughtFrom: 'bill', taughtLineId: '4' }))
    await waitFor(() => expect(within(win).getAllByTestId('codes-row')).toHaveLength(2))
    fireEvent.click(within(win).getByRole('button', { name: 'Later: RS-55310' }))
    await settle()
    expect(within(win).getAllByTestId('codes-row')).toHaveLength(1)
    expect(io.keep).toHaveBeenCalledTimes(1)
    fireEvent.click(within(win).getByRole('button', { name: 'New part in the book: 0417-2210' }))
    expect(onNewPart).toHaveBeenCalledWith('PVC SCH40 PIPE 2X20 PE')
  })

  it('with nothing left it says so, and a failed read says its reason', async () => {
    const none = mount({ load: vi.fn(async () => ({ ...data(), lines: [] })) })
    expect((await screen.findByTestId('codes-no-part')).textContent).toMatch(/Nothing waiting on a part\./)
    expect((screen.getByRole('button', { name: 'Match offered codes' }) as HTMLButtonElement).disabled).toBe(true)
    none.unmount()
    mount({ load: vi.fn(async () => Promise.reject(new Error('permission denied for view supply_purchase_lines'))) })
    expect(await screen.findByText(/permission denied for view supply_purchase_lines/)).toBeTruthy()
  })
})
