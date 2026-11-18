// @vitest-environment jsdom
/**
 * The hook that keeps a percent row's price on its rule. The numbers are pinned in
 * `lib/bids/percentRow.test.ts`; this pins when the Workbench writes: once for each answer, only
 * while it may, never again after a refusal, and never over a price she typed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

const io = vi.hoisted(() => ({
  insert: vi.fn(async (..._args: [unknown, Record<string, unknown>]) => ({ id: 'new-row', error: null as string | null, missing: false })),
  save: vi.fn(async (..._args: [unknown, string, unknown]) => ({ error: null as string | null, missing: false })),
}))
const toast = vi.hoisted(() => ({ showToast: vi.fn() }))

vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../contexts/ToastContext', () => ({ useToastContext: () => toast }))
vi.mock('../lib/bids/percentRowIo', () => ({
  insertPercentCountRow: io.insert,
  savePercentRule: io.save,
  PERCENT_RULE_NOT_PUSHED: 'not pushed',
}))

import { percentWindowPreview, type PercentWindowValue } from '../lib/bids/percentRow'
import { percentGridRows, usePercentRows, type PercentDerivedRow, type PercentRowsArgs } from './usePercentRows'

const RULE = { pct: 40, basis: 'revenue', source: { kind: 'pipe' } }
const derived = (id: string, fixture: string, count: number, unitPrice: number | null): PercentDerivedRow => ({ countRow: { id, fixture }, count, revenue: unitPrice == null ? 0 : count * unitPrice, cost: 0, unitPrice: unitPrice ?? 0, priced: unitPrice != null, isFixedPrice: false })

/** Two pipe rows that sell for $3,000.00, and Connections at 40% of them. */
const rowsWith = (connPrice: number | null, waste = 60): PercentDerivedRow[] => [derived('w', 'ft of 4IN WASTE', waste, 20), derived('v', 'ft of 2IN VENT', 90, 20), derived('conn', 'Connections', 1, connPrice)]
const COUNT_ROWS = [{ id: 'w' }, { id: 'v' }, { id: 'conn', percent_rule: RULE }]

function setup(over: Partial<PercentRowsArgs> = {}) {
  const calls = {
    writePrice: vi.fn(async () => null as { message: string } | null),
    afterPriceWrites: vi.fn(async () => undefined),
    reloadRows: vi.fn(async () => undefined),
    guard: vi.fn(() => true),
  }
  const base: PercentRowsArgs = {
    bidId: 'bid',
    bidVersionId: null,
    pricingVersionId: 'price',
    pricingCountRows: COUNT_ROWS,
    derivedRows: rowsWith(null),
    rowMarks: {},
    mayFollow: true,
    mayWrite: true,
    guardPricingWrite: calls.guard,
    writePrice: calls.writePrice,
    afterPriceWrites: calls.afterPriceWrites,
    reloadRows: calls.reloadRows,
    ...over,
  }
  const hook = renderHook((p: PercentRowsArgs) => usePercentRows(p), { initialProps: base })
  return { calls, hook, base }
}

beforeEach(() => {
  localStorage.clear()
  io.insert.mockClear()
  io.save.mockClear()
  toast.showToast.mockClear()
})
afterEach(cleanup)

describe('the rows as the rule reads them', () => {
  it('gives each row its kind (the guess, or the saved pick), its tags and its rule', () => {
    const rows = percentGridRows(rowsWith(1200), { v: { tags: ['vent'] }, conn: { kind: 'fitting' } }, { conn: { pct: 40, basis: 'revenue', source: { kind: 'pipe' } } })
    expect(rows.map((r) => [r.id, r.kind, r.tags, r.rule?.pct ?? null])).toEqual([
      ['w', 'pipe', [], null],
      ['v', 'pipe', ['vent'], null],
      ['conn', 'fitting', [], 40],
    ])
  })
})

describe('usePercentRows: the price follows the rule', () => {
  it('writes a rule row nothing prices, once, and then reloads', async () => {
    const { calls, hook, base } = setup()
    await waitFor(() => expect(calls.afterPriceWrites).toHaveBeenCalledTimes(1))
    expect(calls.writePrice.mock.calls).toEqual([['conn', 1200]])
    // The same stale rows again: nothing more is written.
    hook.rerender({ ...base })
    hook.rerender({ ...base, derivedRows: rowsWith(1200) })
    await act(async () => {})
    expect(calls.writePrice).toHaveBeenCalledTimes(1)
    expect(hook.result.current.ruleRowIds.has('conn')).toBe(true)
  })

  it('writes again when a pipe row moves, and marks the row as followed', async () => {
    const { calls, hook, base } = setup({ derivedRows: rowsWith(1200) })
    await act(async () => {})
    expect(calls.writePrice).not.toHaveBeenCalled()
    hook.rerender({ ...base, derivedRows: rowsWith(1200, 90) })
    await waitFor(() => expect(calls.writePrice.mock.calls).toEqual([['conn', 1440]]))
    await waitFor(() => expect(hook.result.current.followed).toEqual({ conn: true }))
  })

  it('writes nothing while it may not follow: a sent bid keeps the price it went out with', async () => {
    const { calls, hook, base } = setup({ mayFollow: false, derivedRows: rowsWith(1200, 90) })
    hook.rerender({ ...base, mayFollow: false, derivedRows: rowsWith(1200, 120) })
    await act(async () => {})
    expect(calls.writePrice).not.toHaveBeenCalled()
    expect(hook.result.current.drift).toHaveLength(1)
  })

  it('a refused write is tried once for each answer, never every render', async () => {
    const refused = vi.fn(async () => ({ message: 'permission denied' }) as { message: string } | null)
    const { calls, hook, base } = setup({ writePrice: refused })
    await waitFor(() => expect(refused).toHaveBeenCalledTimes(1))
    hook.rerender({ ...base })
    hook.rerender({ ...base })
    await act(async () => {})
    expect(refused).toHaveBeenCalledTimes(1)
    expect(calls.afterPriceWrites).not.toHaveBeenCalled()
    // The rule comes to a new number: one more try.
    hook.rerender({ ...base, derivedRows: rowsWith(null, 90) })
    await waitFor(() => expect(refused).toHaveBeenCalledTimes(2))
    expect(refused.mock.calls[1]).toEqual(['conn', 1440])
  })

  it('reads no rule where the column is absent or unreadable', async () => {
    const { calls, hook } = setup({ pricingCountRows: [{ id: 'w' }, { id: 'v' }, { id: 'conn', percent_rule: { pct: 'forty' } }] })
    await act(async () => {})
    expect(hook.result.current.ruleRowIds.size).toBe(0)
    expect(calls.writePrice).not.toHaveBeenCalled()
  })
})

describe('usePercentRows: the window press', () => {
  const value = (over: Partial<PercentWindowValue> = {}): PercentWindowValue => ({ name: 'Gas connections', kind: 'fitting', pct: '40', basis: 'revenue', sourceKey: 'kind:pipe', follow: true, ...over })
  const NO_RULE_ROWS = [{ id: 'w' }, { id: 'v' }, { id: 'conn' }]

  it('a new row is added with its rule, the rows reload, and this device remembers the rule', async () => {
    const { calls, hook } = setup({ pricingCountRows: NO_RULE_ROWS, derivedRows: rowsWith(500) })
    act(() => hook.result.current.openNew())
    const v = value()
    const preview = percentWindowPreview({ rows: hook.result.current.gridRows!, self: null, value: v })
    await act(async () => hook.result.current.submit(v, preview))
    expect(io.insert).toHaveBeenCalledWith({}, { bidId: 'bid', bidVersionId: null, name: 'Gas connections', kind: 'fitting', rule: { pct: 40, basis: 'revenue', source: { kind: 'pipe' } } })
    expect(calls.reloadRows).toHaveBeenCalledWith('bid')
    expect(hook.result.current.windowTarget).toBeNull()
    expect(JSON.parse(localStorage.getItem('pipetooling_percent_row_last_v1')!)).toEqual({ name: 'Gas connections', kind: 'fitting', pct: '40', basis: 'revenue', sourceKey: 'kind:pipe' })
    expect(toast.showToast).toHaveBeenCalledWith('Gas connections is 40% of Pipe revenue: $1,200.00. It follows those rows until the bid is sent.', 'success')
  })

  it('with Keep following off the row gets no rule and its one price is written when it is on screen', async () => {
    const { calls, hook, base } = setup({ pricingCountRows: NO_RULE_ROWS, derivedRows: rowsWith(500) })
    act(() => hook.result.current.openNew())
    const v = value({ follow: false })
    const preview = percentWindowPreview({ rows: hook.result.current.gridRows!, self: null, value: v })
    await act(async () => hook.result.current.submit(v, preview))
    expect(io.insert.mock.calls[0]![1]).toMatchObject({ rule: null })
    expect(localStorage.getItem('pipetooling_percent_row_last_v1')).toBeNull()
    expect(calls.writePrice).not.toHaveBeenCalled()
    hook.rerender({ ...base, pricingCountRows: [...NO_RULE_ROWS, { id: 'new-row' }], derivedRows: [...rowsWith(500), derived('new-row', 'Gas connections', 1, null)] })
    await waitFor(() => expect(calls.writePrice.mock.calls).toEqual([['new-row', 1200]]))
  })

  it('a rule set on a row already here saves on that row and the price follows at once', async () => {
    const { calls, hook } = setup({ pricingCountRows: NO_RULE_ROWS, derivedRows: rowsWith(500) })
    act(() => hook.result.current.openForRow('conn'))
    const self = hook.result.current.gridRows!.find((r) => r.id === 'conn')!
    const v = value({ name: 'Connections' })
    const preview = percentWindowPreview({ rows: hook.result.current.gridRows!, self, value: v })
    await act(async () => hook.result.current.submit(v, preview))
    expect(io.insert).not.toHaveBeenCalled()
    expect(io.save).toHaveBeenCalledWith({}, 'conn', { pct: 40, basis: 'revenue', source: { kind: 'pipe' } })
    await waitFor(() => expect(calls.writePrice.mock.calls).toEqual([['conn', 1200]]))
  })

  it('the lock refuses the press, and a held press writes nothing', async () => {
    const { calls, hook } = setup({ pricingCountRows: NO_RULE_ROWS, derivedRows: rowsWith(500) })
    calls.guard.mockReturnValue(false)
    act(() => hook.result.current.openNew())
    const v = value()
    await act(async () => hook.result.current.submit(v, percentWindowPreview({ rows: hook.result.current.gridRows!, self: null, value: v })))
    calls.guard.mockReturnValue(true)
    const held = value({ pct: '' })
    await act(async () => hook.result.current.submit(held, percentWindowPreview({ rows: hook.result.current.gridRows!, self: null, value: held })))
    expect(io.insert).not.toHaveBeenCalled()
    expect(hook.result.current.windowTarget).not.toBeNull()
  })

  it('a database without the column says so and keeps the window open', async () => {
    io.insert.mockResolvedValueOnce({ id: null as unknown as string, error: 'column not found', missing: true })
    const { calls, hook } = setup({ pricingCountRows: NO_RULE_ROWS, derivedRows: rowsWith(500) })
    act(() => hook.result.current.openNew())
    const v = value()
    await act(async () => hook.result.current.submit(v, percentWindowPreview({ rows: hook.result.current.gridRows!, self: null, value: v })))
    expect(toast.showToast).toHaveBeenCalledWith('not pushed', 'error')
    expect(calls.reloadRows).not.toHaveBeenCalled()
    expect(hook.result.current.windowTarget).not.toBeNull()
  })
})

describe('usePercentRows: a price typed over a rule row', () => {
  it('drops the rule first, so the typed price stands and nothing re-writes it', async () => {
    const { calls, hook, base } = setup({ derivedRows: rowsWith(1200) })
    let ok = false
    await act(async () => {
      ok = await hook.result.current.dropRuleForTypedPrice('conn', 'Connections')
    })
    expect(ok).toBe(true)
    expect(io.save).toHaveBeenCalledWith({}, 'conn', null)
    expect(hook.result.current.ruleRowIds.has('conn')).toBe(false)
    // Her typed $900 is on screen now: the Workbench leaves it alone.
    hook.rerender({ ...base, derivedRows: rowsWith(900) })
    await act(async () => {})
    expect(calls.writePrice).not.toHaveBeenCalled()
  })

  it('a rule that cannot be dropped stops the typed price', async () => {
    io.save.mockResolvedValueOnce({ error: 'permission denied', missing: false })
    const { hook } = setup({ derivedRows: rowsWith(1200) })
    let ok = true
    await act(async () => {
      ok = await hook.result.current.dropRuleForTypedPrice('conn', 'Connections')
    })
    expect(ok).toBe(false)
    expect(hook.result.current.ruleRowIds.has('conn')).toBe(true)
  })
})
