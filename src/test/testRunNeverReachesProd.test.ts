import { describe, expect, it } from 'vitest'

/**
 * A test run holds an address that answers nobody.
 *
 * `src/lib/supabase.ts` builds its client from `VITE_SUPABASE_URL`. On a dev machine `.env.local`
 * holds the live project's address, and a render test whose component makes a call the test did
 * not mock sent that call to the live database, as `anon`, with the fixture's made-up id.
 * `test.env` in `vite.config.ts` now sets both values for every run, over `.env.local` and over
 * the shell. This test fails on a machine with a real `.env.local` the day that block is removed.
 */
describe('a test run never reaches the live database', () => {
  it('holds the stand-in address, whatever .env.local says', () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toBe('https://example.supabase.co')
  })

  it('holds the stand-in key, whatever .env.local says', () => {
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBe('test-dummy-anon-key')
  })

  it('builds the client on the stand-in address', async () => {
    const { supabase } = await import('../lib/supabase')
    const address = (supabase as unknown as { supabaseUrl: string }).supabaseUrl
    expect(new URL(address).host).toBe('example.supabase.co')
  })
})
