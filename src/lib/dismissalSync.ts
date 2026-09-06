import { supabase } from './supabase'
import { registerDismissalPusher, seedDismissalsIntoLocalStorage } from './dismissalStore'

/** Runtime half of the dismissal store (T5-08): register the server pusher and hydrate once per sign-in. */
export async function startDismissalSync(userId: string): Promise<void> {
  registerDismissalPusher((uid, key, state) => {
    void supabase.from('user_dismissals').upsert({ user_id: uid, key, state: state as never, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' })
  })
  const { data, error } = await supabase.from('user_dismissals').select('key, state').eq('user_id', userId)
  if (error) return
  seedDismissalsIntoLocalStorage(userId, (data ?? []) as Array<{ key: string; state: unknown }>)
}

export function stopDismissalSync(): void {
  registerDismissalPusher(null)
}
