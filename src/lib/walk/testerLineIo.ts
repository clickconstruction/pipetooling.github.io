/**
 * The two reads behind the walk tester's line (punch list #142 PR 3): the tester's `users` row (devs alone see it,
 * `users_walk_tester_hidden`) and the kit's row. Takes a client so the card's smoke feeds rows.
 */
import { supabase } from '../supabase'
import { WALK_KIT_KEY } from './kit'
import type { WalkTesterRow } from './testerLine'

export interface WalkTesterRead {
  tester: WalkTesterRow | null
  kitValueText: string | null
}

export type LoadWalkTester = () => Promise<WalkTesterRead>

export async function loadWalkTester(client: unknown = supabase): Promise<WalkTesterRead> {
  const db = client as typeof supabase
  const [tester, kit] = await Promise.all([
    db.from('users').select('id, email, read_only, last_sign_in_at').eq('is_walk_tester', true).is('archived_at', null).limit(1).maybeSingle(),
    db.from('app_settings').select('value_text').eq('key', WALK_KIT_KEY).maybeSingle(),
  ])
  return {
    tester: (tester.data ?? null) as WalkTesterRow | null,
    kitValueText: (kit.data as { value_text: string | null } | null)?.value_text ?? null,
  }
}
