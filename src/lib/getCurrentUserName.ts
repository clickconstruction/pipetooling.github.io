import { supabase } from './supabase'

/**
 * Display name for the signed-in user (name, else email, else 'Unknown') — used in
 * checklist completion-notification text. Shared by Dashboard and the Quickfill
 * My Inbox adapter.
 */
export async function getCurrentUserName(authUserId: string | null | undefined): Promise<string> {
  if (!authUserId) return 'Unknown'
  const { data } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', authUserId)
    .single()
  const row = data as { name: string | null; email: string | null } | null
  return row?.name || row?.email || 'Unknown'
}
