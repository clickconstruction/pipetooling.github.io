import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

// Create Supabase client
// Note: Auth errors are handled by useAuth hook with periodic session checks
// and automatic sign-out on expiry
export const supabase = createClient<Database>(url, anonKey)
