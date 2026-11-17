import { supabase } from './supabase'
import { registerDismissalPusher, seedDismissalsIntoLocalStorage } from './dismissalStore'

/** Runtime half of the dismissal store (T5-08): register the server pusher and hydrate once per sign-in. */
export async function startDismissalSync(userId: string): Promise<void> {
  registerDismissalPusher((uid, key, state) => {
    // The client sends a query only when it is awaited: until this `then`, the save never left the device.
    // A refusal or a lost signal is let go; the device's own copy still holds the dismissal.
    void supabase
      .from('user_dismissals')
      .upsert({ user_id: uid, key, state: state as never, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' })
      .then(
        () => undefined,
        () => undefined,
      )
  })
  const { data, error } = await supabase.from('user_dismissals').select('key, state').eq('user_id', userId)
  if (error) return
  seedDismissalsIntoLocalStorage(userId, (data ?? []) as Array<{ key: string; state: unknown }>)
}

export function stopDismissalSync(): void {
  registerDismissalPusher(null)
}
