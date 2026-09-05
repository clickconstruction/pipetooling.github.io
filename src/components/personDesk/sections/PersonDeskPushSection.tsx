import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { Chip, DeskEmpty, DeskRow, DeskSection } from '../personDeskShared'

/**
 * Person Desk → Push (v2.2810): whether the app can reach this person's phone. The Users
 * row's "no push" fact opens here, so the fact has a door. Reads `push_subscriptions` for
 * the account (the same table People → Users reads for the chip); office roles only.
 */
export function PersonDeskPushSection({ userId, canSeePush, changeKey }: { userId: string | null; canSeePush: boolean; changeKey: number }) {
  const [state, setState] = useState<{ devices: number; latest: string | null } | 'loading' | 'hidden'>('loading')

  useEffect(() => {
    if (!canSeePush || !userId) {
      setState('hidden')
      return
    }
    let cancelled = false
    setState('loading')
    void (async () => {
      const { data, error } = await supabase.from('push_subscriptions').select('created_at').eq('user_id', userId).order('created_at', { ascending: false })
      if (cancelled) return
      if (error) {
        setState('hidden')
        return
      }
      const rows = (data ?? []) as Array<{ created_at: string | null }>
      setState({ devices: rows.length, latest: rows[0]?.created_at ?? null })
    })()
    return () => {
      cancelled = true
    }
  }, [userId, canSeePush, changeKey])

  if (!canSeePush) return null
  return (
    <DeskSection id="push" title="Push notifications">
      {!userId ? (
        <DeskEmpty>No app account — push needs a login on their phone.</DeskEmpty>
      ) : state === 'loading' ? (
        <DeskEmpty>Loading…</DeskEmpty>
      ) : state === 'hidden' ? (
        <DeskEmpty>Not visible to you.</DeskEmpty>
      ) : state.devices > 0 ? (
        <DeskRow label="Status">
          <Chip tone="green">on</Chip>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
            {state.devices} device{state.devices === 1 ? '' : 's'}
            {state.latest ? ` · latest added ${state.latest.slice(0, 10)}` : ''}
          </span>
        </DeskRow>
      ) : (
        <>
          <DeskRow label="Status">
            <Chip tone="gray">off</Chip>
          </DeskRow>
          <DeskEmpty>To turn it on, they open the app on their phone and tap Enable notifications under Settings → Your account. Dispatch and schedule alerts stay silent until then.</DeskEmpty>
        </>
      )}
    </DeskSection>
  )
}
