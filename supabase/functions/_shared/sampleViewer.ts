/**
 * Who may open a sample customer surface (What customers see, Settings dev tab). The public
 * functions run with `verify_jwt = false` and normally take a token as their only credential;
 * for the sample token the app sends the signed-in user's JWT instead, and this helper says
 * whether that user is office staff. Sample data is invented, so this is tidiness more than
 * security — it keeps the public endpoints from growing an anonymous extra mode.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SAMPLE_VIEWER_ROLES } from './customerSample.ts'

export async function authorizeSampleViewer(req: Request): Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authHeader = req.headers.get('authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt || jwt === anonKey) return { ok: false, status: 401, error: 'Sign in to the app to view the sample.' }
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } })
  const { data, error } = await userClient.auth.getUser(jwt)
  if (error || !data?.user) return { ok: false, status: 401, error: 'Sign in to the app to view the sample.' }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: row } = await admin.from('users').select('role, archived_at').eq('id', data.user.id).maybeSingle()
  const role = String((row as { role?: string | null } | null)?.role ?? '')
  if (!row || (row as { archived_at?: string | null }).archived_at || !SAMPLE_VIEWER_ROLES.has(role)) {
    return { ok: false, status: 403, error: 'Only office roles can view the sample.' }
  }
  return { ok: true, userId: data.user.id }
}
