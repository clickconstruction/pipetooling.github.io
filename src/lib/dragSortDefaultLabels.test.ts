import { beforeEach, describe, expect, it, vi } from 'vitest'

const upsert = vi.fn(async (_rows: unknown, _opts: unknown) => ({ error: null as null | { message: string; code?: string; details?: string } }))
vi.mock('./supabase', () => ({ supabase: { from: (_table: string) => ({ upsert }) } }))
vi.mock('../utils/errorHandling', () => ({
  withRetry: async (op: () => Promise<void>) => op(),
  DatabaseError: class DatabaseError extends Error {
    code?: string
    details?: string
    constructor(message: string, code?: string, details?: string) {
      super(message)
      this.name = 'DatabaseError'
      this.code = code
      this.details = details
    }
  },
}))

import {
  DRAG_SORT_DEFAULT_LABELS,
  INTERNAL_TRANSFERS_DEFAULT_KEY,
  ensureDragSortDefaultLabels,
  isInternalTransfersLabel,
} from './dragSortDefaultLabels'

beforeEach(() => {
  upsert.mockClear()
  upsert.mockResolvedValue({ error: null })
})

describe('the built-in label table', () => {
  it('has unique snake_case keys and no blank fields', () => {
    const keys = DRAG_SORT_DEFAULT_LABELS.map((d) => d.defaultKey)
    expect(new Set(keys).size).toBe(keys.length)
    for (const d of DRAG_SORT_DEFAULT_LABELS) {
      expect(d.defaultKey).toMatch(/^[a-z0-9_]+$/)
      expect(d.name.trim()).toBe(d.name)
      expect(d.name.length).toBeGreaterThan(0)
      expect(d.scheduleCLine.length).toBeGreaterThan(0)
      expect(d.description.length).toBeGreaterThan(0)
    }
  })
  it('carries the Internal Transfers built-in that the split guards key on', () => {
    const it_ = DRAG_SORT_DEFAULT_LABELS.find((d) => d.defaultKey === INTERNAL_TRANSFERS_DEFAULT_KEY)
    expect(it_).toMatchObject({ name: 'Internal Transfers', scheduleCLine: 'N/A' })
    expect(isInternalTransfersLabel({ default_key: 'internal_transfers' })).toBe(true)
    expect(isInternalTransfersLabel({ default_key: 'fuel_gas' })).toBe(false)
    expect(isInternalTransfersLabel({ default_key: null })).toBe(false)
    expect(isInternalTransfersLabel(null)).toBe(false)
    expect(isInternalTransfersLabel(undefined)).toBe(false)
  })
  it('every Schedule C line is a recognised form reference', () => {
    for (const d of DRAG_SORT_DEFAULT_LABELS) {
      expect(d.scheduleCLine).toMatch(/^(\d+[ab]?( or (COGS|\d+))?|\d+[ab]? \(Other Expenses\)|Part (I|III)|N\/A)$/)
    }
  })
})

describe('ensureDragSortDefaultLabels', () => {
  it('upserts one system row per definition, in table order, keyed on default_key and never overwriting', async () => {
    await ensureDragSortDefaultLabels()
    expect(upsert).toHaveBeenCalledTimes(1)
    const [rows, opts] = upsert.mock.calls[0] as [Array<Record<string, unknown>>, Record<string, unknown>]
    expect(opts).toEqual({ onConflict: 'default_key', ignoreDuplicates: true })
    expect(rows).toHaveLength(DRAG_SORT_DEFAULT_LABELS.length)
    expect(rows[0]).toEqual({ default_key: 'advertising', name: 'Advertising', schedule_c_line: '8', description: DRAG_SORT_DEFAULT_LABELS[0]!.description, is_system_default: true, sort_order: 0 })
    expect(rows.map((r) => r.sort_order)).toEqual(DRAG_SORT_DEFAULT_LABELS.map((_, i) => i * 10))
    expect(rows.every((r) => r.is_system_default === true)).toBe(true)
  })
  it('surfaces a database error as a DatabaseError carrying the code and details', async () => {
    upsert.mockResolvedValue({ error: { message: 'permission denied', code: '42501', details: 'rls' } })
    await expect(ensureDragSortDefaultLabels()).rejects.toMatchObject({ name: 'DatabaseError', message: 'Failed to upsert mercury_drag_sort default labels: permission denied', code: '42501', details: 'rls' })
  })
})
