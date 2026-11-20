/**
 * Who may act on the Document builder from an edge function (punch list #404): a signed-in dev, for now. The tab is
 * a dev's by the owner's call of 2026-11-19, and its tables open to `is_dev()` alone. A function that writes with the
 * service role asks here first, since the database then sees no caller to refuse: an archived account, a training
 * account and a twin are each turned away, as the fences turn them away on a table.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { refuseArchivedCaller } from './refuseArchivedCaller.ts'

// deno-lint-ignore no-explicit-any
type Admin = any

export type BuilderCaller = { userId: string; name: string; email: string }

/** The signed-in dev, or the Response to answer with. `refuse` builds the function's own refusal for a key. */
export async function documentBuilderCaller(
  req: Request,
  admin: Admin,
  supabaseUrl: string,
  corsHeaders: Record<string, string>,
  refuse: (why: 'notYours' | 'training') => Response,
): Promise<BuilderCaller | Response> {
  const auth = req.headers.get('Authorization') ?? ''
  if (!auth) return refuse('notYours')
  const mine = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const { data: u } = await mine.auth.getUser()
  const userId = u?.user?.id
  if (!userId) return refuse('notYours')
  const archived = await refuseArchivedCaller(admin, userId, corsHeaders)
  if (archived) return archived
  const { data: me } = await admin.from('users').select('role, name, email, read_only, is_digital_twin').eq('id', userId).maybeSingle()
  const who = me as { role?: string | null; name?: string | null; email?: string | null; read_only?: boolean | null; is_digital_twin?: boolean | null } | null
  if (who?.role !== 'dev') return refuse('notYours')
  if (who.read_only || who.is_digital_twin) return refuse('training')
  return { userId, name: String(who.name ?? '').trim(), email: String(who.email ?? '').trim() }
}
