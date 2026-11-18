import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { timerEventRows } from './prospectTimerIo'

describe('timerEventRows', () => {
  const row = { id: 't-1', created_at: '2026-10-01T12:00:00Z', timer_seconds: 125, button_name: 'next_prospect' }

  it('keeps an embedded prospect as it is', () => {
    expect(timerEventRows([{ ...row, prospect: { company_name: 'Alpha Builders' } }])).toEqual([{ ...row, prospect: { company_name: 'Alpha Builders' } }])
  })
  it('takes the first row when the embed came back as a list, and none when the list is empty', () => {
    expect(timerEventRows([{ ...row, prospect: [{ company_name: 'Alpha Builders' }, { company_name: 'Bravo Homes' }] }])[0]?.prospect).toEqual({ company_name: 'Alpha Builders' })
    expect(timerEventRows([{ ...row, prospect: [] }])[0]?.prospect).toBeNull()
  })
  it('keeps a missing prospect as none', () => {
    expect(timerEventRows([{ ...row, prospect: null }])[0]?.prospect).toBeNull()
  })
  it('carries only the five fields the window draws', () => {
    const out = timerEventRows([{ ...row, prospect: null, extra: 'x' } as never])[0] ?? {}
    expect(Object.keys(out).sort()).toEqual(['button_name', 'created_at', 'id', 'prospect', 'timer_seconds'])
  })
})
