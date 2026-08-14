import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import {
  resolveSubLaborJobByNumber,
  subLaborAssignPickerRows,
  subLaborJobDisplayLabel,
  subLaborJobNumberForStorage,
  subLaborJobPickerOptions,
  subLaborJobSearchLabel,
} from './subLaborJobPicker'

const keith = {
  id: 'j1',
  hcp_number: '925',
  click_number: null,
  job_name: 'Keith Stadtmueller',
  customer_name: 'Keith Stadtmueller',
  job_address: '106 Lenz Dr, Seguin, TX',
}
const clickOnly = {
  id: 'j2',
  hcp_number: null,
  click_number: '961',
  job_name: 'Cop Properties',
  customer_name: 'Todd Cop',
  job_address: '10 Cascade Gln',
}
const bare = { id: 'j3', hcp_number: null, click_number: null, job_name: null, customer_name: null, job_address: null }

describe('subLaborJobDisplayLabel / searchLabel', () => {
  it('leads with the effective number (HCP wins, Click fallback)', () => {
    expect(subLaborJobDisplayLabel(keith)).toBe('J925 · Keith Stadtmueller')
    expect(subLaborJobDisplayLabel(clickOnly)).toBe('J961 · Cop Properties')
    expect(subLaborJobDisplayLabel(bare)).toBe('— · Job')
  })

  it('search label includes customer and address so substrings match', () => {
    expect(subLaborJobSearchLabel(clickOnly)).toBe('J961 · Cop Properties · Todd Cop · 10 Cascade Gln')
  })
})

describe('subLaborJobPickerOptions', () => {
  it('sorts newest number first and keys by job id', () => {
    const opts = subLaborJobPickerOptions([keith, clickOnly])
    expect(opts.map((o) => o.value)).toEqual(['j2', 'j1'])
  })
})

describe('resolveSubLaborJobByNumber', () => {
  it('matches effective number, raw HCP, and raw Click, case/space-insensitive', () => {
    expect(resolveSubLaborJobByNumber([keith, clickOnly], ' 925 ')?.id).toBe('j1')
    expect(resolveSubLaborJobByNumber([keith, clickOnly], '961')?.id).toBe('j2')
    expect(resolveSubLaborJobByNumber([keith, clickOnly], '')).toBeNull()
    expect(resolveSubLaborJobByNumber([keith, clickOnly], '999')).toBeNull()
  })
})

describe('subLaborJobNumberForStorage', () => {
  it('stores the effective number capped at 10 chars', () => {
    expect(subLaborJobNumberForStorage(keith)).toBe('925')
    expect(subLaborJobNumberForStorage(clickOnly)).toBe('961')
    expect(subLaborJobNumberForStorage(bare)).toBe('')
  })
})


describe('subLaborAssignPickerRows (v2.1618 standard picker)', () => {
  const working = {
    ...keith,
    created_at: '2026-08-01T12:00:00Z',
    status: 'working',
    serviceType: { name: 'Plumbing' },
  }
  const paidOld = {
    ...clickOnly,
    created_at: '2026-08-10T12:00:00Z',
    status: 'paid',
    serviceType: null,
  }

  it('carries stage + trade pill + subline, finished jobs last', () => {
    const rows = subLaborAssignPickerRows([working, paidOld], '', '')
    expect(rows.map((r) => r.id)).toEqual(['j1', 'j2'])
    expect(rows[0]?.status).toBe('working')
    expect(rows[0]?.serviceTypeName).toBe('Plumbing')
    expect(rows[0]?.subline).toContain('106 Lenz Dr')
    expect(rows[1]?.status).toBe('paid')
  })

  it('text search matches number, name, customer, and address', () => {
    expect(subLaborAssignPickerRows([working, paidOld], 'cascade', '').map((r) => r.id)).toEqual(['j2'])
    expect(subLaborAssignPickerRows([working, paidOld], '925', '').map((r) => r.id)).toEqual(['j1'])
    expect(subLaborAssignPickerRows([working, paidOld], 'todd', '').map((r) => r.id)).toEqual(['j2'])
  })

  it('digits-only number query switches to number matching', () => {
    expect(subLaborAssignPickerRows([working, paidOld], 'ignored', '961').map((r) => r.id)).toEqual(['j2'])
  })
})
