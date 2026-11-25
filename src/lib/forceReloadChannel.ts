/**
 * Global Reload's signal (v2.8532): the Realtime channel every signed-in copy of the app hears, and a dev sends on.
 *
 * The channel is PRIVATE. Realtime checks a private channel against the row policies on `realtime.messages`
 * (`supabase/migrations/20261124215500_global_reload_dev_only.sql`): anyone signed in may hear this topic, and only a
 * dev may send on it. A send the policy refuses is dropped by the server without a word.
 *
 * A private channel and an open channel of one name are two channels. Until v2.8532 the app heard the open one, which
 * anyone holding the app's public key could send on. `forceReloadChannel.test.ts` holds these names to the migration's.
 */
export const FORCE_RELOAD_TOPIC = 'force-reload'

/** The one event the channel carries. */
export const FORCE_RELOAD_EVENT = 'force_reload'

/** What makes the channel private. Without it the app would hear the open channel again. */
export const FORCE_RELOAD_CHANNEL_OPTIONS = { config: { private: true } } as const

/** The message a dev's press sends. It carries nothing: the event is the whole signal. */
export const FORCE_RELOAD_MESSAGE = { type: 'broadcast', event: FORCE_RELOAD_EVENT, payload: {} } as const
