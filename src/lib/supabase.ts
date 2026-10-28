import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { makeConsoleRowCapReporter, wrapFetchWithRowCapTripwire } from './supabaseRowCapTripwire'
import { wrapFetchCountingWrites } from './unsavedWork'
import { bindAppHealthToWindow, wrapFetchReportingHealth } from './appHealth'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

// Create Supabase client
// Note: Auth errors are handled by useAuth hook with periodic session checks
// and automatic sign-out on expiry
// db.schema: explicit public schema for RPC (avoids 404 when PostgREST schema differs)
// global.fetch: the row-cap tripwire (v2.2756) — any un-limited read that comes
// back with exactly max_rows rows is reported in the console instead of
// silently truncating (see src/lib/supabaseRowCapTripwire.ts). Outside it, every non-GET
// request is counted while in flight so the auto-reload never lands mid-save (v2.3741,
// src/lib/unsavedWork.ts). Outermost, every database and auth request reports its start and
// its end to the app-health kernel (#183 PR 1, v2.6009, src/lib/appHealth.ts), which the strip
// at the top of every screen and the auth gate read.
export const supabase = createClient<Database>(url, anonKey, {
  db: { schema: 'public' },
  global: {
    fetch: wrapFetchReportingHealth(
      wrapFetchCountingWrites(wrapFetchWithRowCapTripwire((input, init) => fetch(input, init), makeConsoleRowCapReporter())),
    ),
  },
})

if (typeof window !== 'undefined') bindAppHealthToWindow(window)
