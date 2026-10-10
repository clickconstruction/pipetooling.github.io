/**
 * The office notices' two reads through `gc-office-notices` (gcIo.ts, O10b, O10c): Preview and Email me a test send
 * a `since` day only when the Settings block gives one, so the function reads as if the notices went on it; without
 * one it falls back to the switch's day, else today, as before.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn(async (_name: string, _opts: { body: Record<string, unknown> }) => ({ data: { since: '2026-10-05', notices: [], sent: 1 }, error: null }))
vi.mock('../supabase', () => ({ supabase: { functions: { invoke: (name: string, opts: { body: Record<string, unknown> }) => invoke(name, opts) } } }))

describe('the office notices’ Preview and test', () => {
  beforeEach(() => invoke.mockClear())

  it('send the day picked', async () => {
    const { previewOfficeNotices, sendOfficeNoticesTest } = await import('./gcIo')
    expect((await previewOfficeNotices('2026-10-05')).since).toBe('2026-10-05')
    expect(invoke).toHaveBeenLastCalledWith('gc-office-notices', { body: { mode: 'preview', since: '2026-10-05' } })
    expect(await sendOfficeNoticesTest('2026-10-05')).toBe(1)
    expect(invoke).toHaveBeenLastCalledWith('gc-office-notices', { body: { mode: 'test_send', since: '2026-10-05' } })
  })

  it('send no day when none is given', async () => {
    const { previewOfficeNotices, sendOfficeNoticesTest } = await import('./gcIo')
    await previewOfficeNotices()
    expect(invoke).toHaveBeenLastCalledWith('gc-office-notices', { body: { mode: 'preview' } })
    await sendOfficeNoticesTest()
    expect(invoke).toHaveBeenLastCalledWith('gc-office-notices', { body: { mode: 'test_send' } })
  })
})
