import { describe, expect, it, vi } from 'vitest'
import { SEED_FLOWS } from '../flows/seed'
import { loadReminderFlows } from './remindersCardIo'

vi.mock('../supabase', () => ({ supabase: {} }))

describe('loadReminderFlows (v2.5720)', () => {
  it('reads each flow the card lists once, by kind', async () => {
    const load = vi.fn(async (kind: keyof typeof SEED_FLOWS) => SEED_FLOWS[kind])
    const flows = await loadReminderFlows(load)
    expect(Object.keys(flows).sort()).toEqual(['arch', 'candidate', 'customer', 'residential', 'sub', 'trade'])
    expect(flows.residential).toBe(SEED_FLOWS.residential)
    expect(load).toHaveBeenCalledTimes(6)
  })

  it('leaves out a kind whose read throws, so the rest still draw', async () => {
    const load = vi.fn(async (kind: keyof typeof SEED_FLOWS) => {
      if (kind === 'trade') throw new Error('boom')
      return SEED_FLOWS[kind]
    })
    const flows = await loadReminderFlows(load)
    expect(flows.trade).toBeUndefined()
    expect(flows.residential).toBe(SEED_FLOWS.residential)
  })
})
